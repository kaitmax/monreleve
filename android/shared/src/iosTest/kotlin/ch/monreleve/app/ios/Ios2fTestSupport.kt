package ch.monreleve.app.ios

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.TallyEntity
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

// IOS-2f. Fixtures the R889-R892 simulator tests share. Nothing here is product code. Every wait a test makes goes
// through ios2fBounded, so a stub that never completes fails one test by name instead of billing the job's timeout.

/** One recorded day, PENDING, for [account] - the shape IosSyncTriggerTest writes. */
internal fun ios2fEntry(
    mutationId: String,
    day: String,
    account: String,
    syncState: SyncState = SyncState.PENDING,
): EntryEntity =
    EntryEntity(
        clientMutationId = mutationId,
        dayDate = day,
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
        syncState = syncState,
        accountTag = account,
    )

/** One detection tally row (the record's second table). */
internal fun ios2fTally(day: String): TallyEntity = TallyEntity(day, "CH", null, null, null)

/** Runs [block] within [millis]; a block that does not finish is a FAILED test naming [what], never a hang. */
internal suspend fun <T> ios2fBounded(
    what: String,
    millis: Long = 5_000,
    block: suspend () -> T,
): T =
    try {
        withTimeout(millis) { block() }
    } catch (timeout: TimeoutCancellationException) {
        throw AssertionError("did not finish within $millis ms: $what", timeout)
    }
