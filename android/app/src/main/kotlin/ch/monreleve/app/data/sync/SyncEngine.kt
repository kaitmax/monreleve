package ch.monreleve.app.data.sync

import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState

// AN5 increment 3. The drain, as pure logic - no WorkManager, no Android - so it runs
// as plain JVM tests. SyncWorker is the thin CoroutineWorker that calls this and maps
// the outcome to Result.success/retry.

private const val HTTP_OK = 200
private const val HTTP_BAD_REQUEST = 400
private const val HTTP_CONFLICT = 409
private const val HTTP_PAYLOAD_TOO_LARGE = 413

sealed interface SyncOutcome {
    /**
     * The queue is drained. `written` rows were reconciled from the server's rows;
     * `defects` rows the server refused as client defects and are held FAILED.
     */
    data class Settled(val written: Int, val defects: Int) : SyncOutcome

    /** A transient fault (network, or a 200 whose body did not parse). Rows stay PENDING; retry with backoff. */
    data object Retryable : SyncOutcome

    /** No usable session. Rows stay PENDING until a fresh sign-in triggers another sync. */
    data object Unauthenticated : SyncOutcome
}

class SyncEngine(
    private val dao: EntryDao,
    private val poster: AuthenticatedPoster,
    // AN-FIX F4 / R303: the account whose queue this drains. The worker reads it from the AccountStore
    // at drain time; a null account (no active session) drains NOTHING - fail closed.
    private val currentAccount: String?,
    private val batchLimit: Int = MAX_BATCH_ITEMS,
) {
    suspend fun sync(): SyncOutcome {
        // AN-FIX F4 / R303: no active account -> nothing to drain. An expired session that never signed
        // back in has no account here, so its queue stays PENDING rather than draining under whoever is
        // next.
        if (currentAccount == null) return SyncOutcome.Unauthenticated
        var written = 0
        var defects = 0
        var terminal: SyncOutcome? = null
        // Snapshot the queue and split into batches of at most the server's limit. Each
        // batch is independent, so a network fault on a later batch leaves the earlier,
        // already-reconciled ones done - partial progress is safe because a replay is
        // harmless (R219).
        for (batch in dao.pending().chunked(batchLimit)) {
            if (terminal != null) break
            when (val step = syncBatch(batch)) {
                is BatchResult.Wrote -> written += step.count
                is BatchResult.Defect -> defects += step.count
                is BatchResult.Isolated -> {
                    written += step.written
                    defects += step.defects
                }
                BatchResult.Retryable -> terminal = SyncOutcome.Retryable
                BatchResult.Unauthenticated -> terminal = SyncOutcome.Unauthenticated
            }
        }
        return terminal ?: SyncOutcome.Settled(written, defects)
    }

    // ONE ROUND TRIP PER BATCH. The response carries the written rows (R217), so the
    // pending state clears from the server's rows, not from what the client sent.
    private suspend fun syncBatch(batch: List<EntryEntity>): BatchResult =
        when (val outcome = poster.authenticatedPost(ENTRIES_PATH, entriesRequestBody(batch))) {
            is PostOutcome.Ok -> handleOk(batch, outcome.status, outcome.body)
            PostOutcome.NetworkError -> BatchResult.Retryable
            PostOutcome.SessionExpired -> BatchResult.Unauthenticated
            PostOutcome.SessionEnded -> BatchResult.Unauthenticated
            PostOutcome.NoSession -> BatchResult.Unauthenticated
        }

    private suspend fun handleOk(
        batch: List<EntryEntity>,
        status: Int,
        body: String,
    ): BatchResult =
        when (status) {
            HTTP_OK ->
                parseEntriesResponse(body)
                    ?.let { BatchResult.Wrote(reconcile(batch, it)) }
                    ?: BatchResult.Retryable
            // R296: a 400 is a payload the CLIENT built and the server refused, but a MULTI-item batch
            // does not say WHICH item is at fault - so retry each on its own, ONCE (isolate): the good
            // ones sync, the refused one stays FAILED and named. A single-item batch is already isolated,
            // so it goes straight to FAILED - re-sending a payload the server refused is a queue that can
            // never drain (R198). 409 and 413 stay WHOLE-batch FAILED: isolating a 409 would replay the
            // out-of-order hazard the ordering evidence guards against, and 413 is unreachable under the
            // parity-tested batch/note caps.
            HTTP_BAD_REQUEST -> if (batch.size > 1) isolate(batch) else BatchResult.Defect(markFailed(batch))
            HTTP_CONFLICT -> BatchResult.Defect(markFailed(batch))
            HTTP_PAYLOAD_TOO_LARGE -> BatchResult.Defect(markFailed(batch))
            else -> BatchResult.Retryable
        }

    // R217, and a concurrency guard: mark a row SYNCED from the server's row ONLY if the
    // local row is STILL the same pending mutation we sent. If the user edited the day
    // while the batch was in flight (a new clientMutationId, PENDING again), that newer
    // mutation must not be clobbered by this batch's older server row.
    private suspend fun reconcile(
        batch: List<EntryEntity>,
        response: EntriesResponse,
    ): Int {
        val sent = batch.associateBy { it.clientMutationId }
        var count = 0
        for (serverEntry in response.entries) {
            // AN-FIX F4 / R303: look up and write the synced row under the LOCAL account that sent it
            // (the server never returns the tag), so reconcile stays within one account's rows.
            val sentRow = sent[serverEntry.clientMutationId] ?: continue
            val current =
                dao.byAccountDayPortion(sentRow.accountTag, serverEntry.dayDate, Portion.valueOf(serverEntry.portion))
            if (current != null &&
                current.clientMutationId == serverEntry.clientMutationId &&
                current.syncState == SyncState.PENDING
            ) {
                dao.upsert(serverEntry.toSyncedEntity(sentRow.accountTag))
                count++
            }
        }
        return count
    }

    // R296 isolation: one round trip per item, ONCE. Reuses syncBatch, so each item takes the same
    // reconcile/markFailed path - a good item comes back 200 and syncs; the refused item comes back 400
    // and, as a size-1 batch, is marked FAILED (never re-isolated - "once"). A transient fault
    // (network/5xx) on an item leaves it PENDING and makes the run Retryable, so WorkManager drains the
    // rest without ever re-sending the item the server already refused.
    private suspend fun isolate(batch: List<EntryEntity>): BatchResult {
        var written = 0
        var defects = 0
        var retry = false
        for (item in batch) {
            when (val step = syncBatch(listOf(item))) {
                is BatchResult.Wrote -> written += step.count
                is BatchResult.Defect -> defects += step.count
                // A size-1 batch never isolates, so this is unreachable; folded in for exhaustiveness.
                is BatchResult.Isolated -> {
                    written += step.written
                    defects += step.defects
                }
                BatchResult.Retryable -> retry = true
                BatchResult.Unauthenticated -> return BatchResult.Unauthenticated
            }
        }
        return if (retry) BatchResult.Retryable else BatchResult.Isolated(written, defects)
    }

    private suspend fun markFailed(batch: List<EntryEntity>): Int {
        for (row in batch) {
            // AN-FIX F4 / R303: the full-key lookup, so a FAILED mark stays within the sending account.
            val current = dao.byAccountDayPortion(row.accountTag, row.dayDate, row.portion)
            if (current != null && current.clientMutationId == row.clientMutationId) {
                dao.upsert(current.copy(syncState = SyncState.FAILED))
            }
        }
        return batch.size
    }

    private sealed interface BatchResult {
        data class Wrote(val count: Int) : BatchResult

        data class Defect(val count: Int) : BatchResult

        /** R296: a multi-item 400 retried item by item - some written, some held FAILED. */
        data class Isolated(val written: Int, val defects: Int) : BatchResult

        data object Retryable : BatchResult

        data object Unauthenticated : BatchResult
    }
}
