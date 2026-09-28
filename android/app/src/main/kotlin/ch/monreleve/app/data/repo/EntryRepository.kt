package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.deviceClaimNow
import kotlinx.coroutines.flow.Flow
import java.time.Clock
import java.util.UUID

// AN5 increment 2. The mutation queue, and the only writer of entries (SPEC 5
// fence 5: ui/ records through this, never through the DAO or the API directly).
//
// THE MUTATION ID IS BORN AT THE TAP, not at send time, and is persisted with the
// row BEFORE any network call - there is no network in this file. An id minted at
// send time would be regenerated on every retry, turning a safe replay (the server
// dedups on clientMutationId, R219) into a duplicate write. The queue's whole
// safety rests on that id being stable from the moment the person taps.
//
// THE QUEUE IS THE SET OF PENDING ROWS. Room persists to disk, so it survives
// process death; a mutation recorded offline is durable the instant record()
// returns, and sync (increment 3) drains it later. Pending is a first-class,
// persistent state - observePending() feeds the UI that shows it (DESIGN-SYSTEM
// section 2), never a toast.

/** One tap's intent. The id and the claim timestamp are stamped by record(), not by the caller. */
data class RecordCommand(
    val dayDate: String,
    val kind: EntryKind,
    val portion: Portion = Portion.FULL,
    val absenceReason: AbsenceReason? = null,
    val note: String? = null,
    val provenance: Provenance = Provenance.MANUAL,
    val detectedKind: EntryKind? = null,
    val detectedAt: String? = null,
)

interface EntryRepository {
    /** Record (or edit) a day. Returns the persisted pending row. Performs no network. */
    suspend fun record(command: RecordCommand): EntryEntity

    /** The durable pending state the UI renders (DESIGN-SYSTEM section 2). */
    fun observePending(): Flow<List<EntryEntity>>

    /** Every stored row - for the dev recorder (increment 5). */
    fun observeAll(): Flow<List<EntryEntity>>
}

class LocalEntryRepository(
    private val dao: EntryDao,
    private val clock: Clock,
    private val newMutationId: () -> String = { UUID.randomUUID().toString() },
) : EntryRepository {
    override suspend fun record(command: RecordCommand): EntryEntity {
        val existing = dao.byDayPortion(command.dayDate, command.portion)
        val entity =
            EntryEntity(
                // Born at the tap, before any network call (D30/R219).
                clientMutationId = newMutationId(),
                dayDate = command.dayDate,
                portion = command.portion,
                kind = command.kind,
                absenceReason = command.absenceReason,
                note = command.note,
                provenance = command.provenance,
                detectedKind = command.detectedKind,
                detectedAt = command.detectedAt,
                // The device's clock at the tap, sent verbatim; the client never
                // computes lateness - the server's observation is the only one that counts.
                // Recomputed on every record(), so a coalescing edit carries the FINAL
                // tap's time, never the original's (R275) - a timestamp describes the value
                // it is attached to.
                clientClaimedAt = deviceClaimNow(clock),
                // SERVER-ASSIGNED COLUMNS SURVIVE AN EDIT. Re-recording a synced day
                // keeps its immutable firstRecordedAt locally rather than nulling it
                // until the next drain restores it from the server (which returns it
                // identical - it cannot move). A brand-new day has no existing row, so
                // all three are null until the first sync.
                serverId = existing?.serverId,
                firstRecordedAt = existing?.firstRecordedAt,
                lastModifiedAt = existing?.lastModifiedAt,
                // Pending until sync acknowledges it. Re-recording a synced day sets it
                // PENDING again, which is what makes the edit a new mutation to drain.
                syncState = SyncState.PENDING,
            )
        // Persisted BEFORE any network. On a (dayDate, portion) collision this REPLACES
        // the row (coalescing): an edit made offline before the earlier mutation drained
        // becomes one pending mutation carrying the new value and a new id - the queue
        // never holds two mutations for one day (the property increment 4 rests on).
        dao.upsert(entity)
        return entity
    }

    override fun observePending(): Flow<List<EntryEntity>> = dao.observePending()

    override fun observeAll(): Flow<List<EntryEntity>> = dao.observeAll()
}
