package ch.monreleve.app.ios

import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.contracts.MemoryDossierBacking
import ch.monreleve.app.contracts.MemoryDossierCache
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.SyncEngine
import ch.monreleve.app.data.sync.SyncOutcome
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-1a R569. THE iOS SYNC TRIGGER, tested with fakes and, for the failure case, with the REAL SyncEngine over
// the real iOS database: a write triggers one drain; a failure leaves days PENDING and does not loop; a request
// during a drain is coalesced into exactly one more; cancelling the scope cancels the drain.

class IosSyncTriggerTest {
    @Test
    fun aWriteTriggersExactlyOneDrain() =
        runBlocking {
            var drains = 0
            val trigger = IosSyncTrigger(this) { SyncOutcome.Settled(1, 0).also { drains++ } }
            trigger.afterWrite().join()
            assertEquals(1, drains)
            assertEquals(SyncOutcome.Settled(1, 0), trigger.lastOutcome)
        }

    @Test
    fun requestsDuringADrainAreCoalescedIntoExactlyOneMore() =
        runBlocking {
            var drains = 0
            val gate = CompletableDeferred<Unit>()
            val trigger =
                IosSyncTrigger(this) {
                    drains++
                    if (drains == 1) gate.await()
                    SyncOutcome.Settled(0, 0)
                }
            val first = trigger.afterWrite()
            trigger.afterWrite()
            trigger.requestDrain()
            trigger.afterWrite()
            gate.complete(Unit)
            first.join()
            assertEquals(2, drains, "one running + one coalesced; never one per request")
        }

    @Test
    fun aFailedDrainLeavesTheDayPendingAndIsNotRetriedInALoop() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            val dao = database.entryDao()
            dao.upsert(
                EntryEntity(
                    clientMutationId = "m-1",
                    dayDate = "2026-10-12",
                    portion = Portion.FULL,
                    kind = EntryKind.HOME,
                    absenceReason = null,
                    note = null,
                    provenance = Provenance.MANUAL,
                    detectedKind = null,
                    detectedAt = null,
                    clientClaimedAt = null,
                    serverId = null,
                    firstRecordedAt = null,
                    lastModifiedAt = null,
                    syncState = SyncState.PENDING,
                    accountTag = "acct-1",
                ),
            )
            var posts = 0
            val poster =
                object : AuthenticatedPoster {
                    override suspend fun authenticatedPost(
                        path: String,
                        body: String,
                    ): PostOutcome {
                        posts++
                        return PostOutcome.NetworkError
                    }
                }
            val cache = MemoryDossierCache(MemoryDossierBacking())
            val trigger = IosSyncTrigger(this) { SyncEngine(dao, poster, "acct-1", cache).sync() }
            trigger.afterWrite().join()
            assertEquals(1, posts, "positive control: the engine really tried, once")
            assertEquals(SyncOutcome.Retryable, trigger.lastOutcome)
            val rows = dao.pendingForAccount("acct-1")
            assertEquals(listOf("m-1"), rows.map { it.clientMutationId }, "the day is still PENDING")
            assertTrue(rows.single().syncState == SyncState.PENDING)
            database.close()
            removeDirectory(directory)
        }

    @Test
    fun cancellingTheScopeCancelsTheDrainAndRecordsNoOutcome() =
        runBlocking {
            val scope = CoroutineScope(Job())
            val started = CompletableDeferred<Unit>()
            var cancelled = false
            val trigger =
                IosSyncTrigger(scope) {
                    started.complete(Unit)
                    try {
                        awaitCancellation()
                    } finally {
                        cancelled = true
                    }
                }
            val job = trigger.afterWrite()
            started.await()
            assertTrue(!cancelled, "control: the drain is running")
            scope.cancel()
            job.join()
            assertTrue(cancelled)
            assertNull(trigger.lastOutcome)
        }
}
