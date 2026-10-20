package ch.monreleve.app.data.repo

import android.util.Log
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.deviceClaimNow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
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
    // AN-FIX F4 / R303: the account that owns rows recorded and read through this repository. A null
    // account (no active session) tags a row UNOWNED - held, never sent, never shown (fail closed).
    //
    // AN-ACCOUNT-TAG (R423): A FUNCTION, NOT A STRING, AND THAT IS THE WHOLE FIX. It used to be a
    // String? read once by whoever constructed this - and MainActivity, which constructs it, is also
    // what hosts the sign-in screen, so the value it read was null. Signing in by CODE sets the account
    // without restarting the activity (the magic LINK does restart it, which is why this survived for
    // so long), so every day recorded in that session was tagged UNOWNED: held forever, never shown,
    // never sent, and gone at the next launch.
    //
    // SIGNING IN IS EXACTLY THE EVENT THAT CHANGES THE ANSWER, so the same question asked twice in one
    // app session has to be allowed to give two answers. Asking at write time is what allows it.
    private val currentAccount: () -> String? = { null },
    //
    // AN-ACCOUNT-TAG (R425): THE CANARY FOR THIS DEFECT COMING BACK. It answers one question -
    // is anybody signed in RIGHT NOW - from the account store itself, independently of the
    // provider above. In production both read the same store, so they agree and this never
    // fires. It fires precisely when they DISAGREE, which is what a stale capture looks like:
    // a provider frozen at composition saying nobody is signed in, while the store says someone
    // is. That is the shape that lost days silently, and it cost a device session to find.
    //
    // DEFAULTS TO false, so every existing construction and every test is untouched: no probe,
    // no claim, no firing. R303's genuine case - truly nobody signed in - stays silent and
    // correct, because then the probe says false too and there is nothing to disagree about.
    private val isSignedIn: () -> Boolean = { false },
    private val newMutationId: () -> String = { UUID.randomUUID().toString() },
) : EntryRepository {
    override suspend fun record(command: RecordCommand): EntryEntity {
        // The tap's account, stamped at the tap the way the mutation id is (R303). Fail closed to
        // UNOWNED when there is no active account rather than leaving the row untagged.
        val resolved = currentAccount()
        val account = resolved ?: UNOWNED_ACCOUNT

        // R425. Loud, and only for the case that cannot be legitimate: no tag resolved, yet the
        // store says somebody is signed in. A row written here would be HELD forever - never
        // shown, never sent, gone at the next launch - and nothing downstream would complain,
        // because R303 tells every one of them to ignore it. Silence is the whole problem, so
        // this is the one place that must not be silent.
        if (resolved == null && isSignedIn()) {
            val complaint =
                "account tag unresolved while a session exists: this row would be held as " +
                    "UNOWNED and silently lost (R423/R425). The account was probably captured " +
                    "when a screen was built instead of read at the write."

            // DEBUG CRASHES, RELEASE LOGS. A reader's day is not worth losing to keep an app
            // alive, but neither is crashing somebody mid-record in the field over a condition
            // they cannot act on. The log names the condition so it is findable either way.
            check(!BuildConfig.DEBUG) { complaint }
            Log.e("EntryRepository", complaint)
        }
        val existing = dao.byAccountDayPortion(account, command.dayDate, command.portion)
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
                // AN-FIX F4 / R303: born at the tap, the way the mutation id is.
                accountTag = account,
            )
        // Persisted BEFORE any network. On a (dayDate, portion) collision this REPLACES
        // the row (coalescing): an edit made offline before the earlier mutation drained
        // becomes one pending mutation carrying the new value and a new id - the queue
        // never holds two mutations for one day (the property increment 4 rests on).
        dao.upsert(entity)
        return entity
    }

    // AN-FIX F4 / R303: every screen reads through these, scoped to the CURRENT account, so an expired
    // session is never a window onto the previous account's record (an expiry is not a sign-out, so R295's
    // clearing never ran). A null account resolves to UNOWNED, which owns no real row, so the screens show
    // nothing rather than another account's days.
    override fun observePending(): Flow<List<EntryEntity>> =
        dao.observeAllForAccount(currentAccount() ?: UNOWNED_ACCOUNT)
            .map { rows -> rows.filter { it.syncState == SyncState.PENDING } }

    override fun observeAll(): Flow<List<EntryEntity>> = dao.observeAllForAccount(currentAccount() ?: UNOWNED_ACCOUNT)
}
