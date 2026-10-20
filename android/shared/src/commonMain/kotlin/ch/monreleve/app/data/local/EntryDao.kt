package ch.monreleve.app.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

// AN5. The only code that touches the entry table (SPEC 5 fence 5: ui/ writes
// through EntryRepository, never a DAO directly).
//
// @Upsert MATCHES ON THE PRIMARY KEY (dayDate, portion), which is the coalescing
// this data layer is built around: an edit to a day already pending overwrites its
// row in place - a new clientMutationId, PENDING again - rather than adding a
// second mutation for the same day (increment 2).
//
// THE PENDING QUERY ORDERS BY clientClaimedAt, the device's tap time, which is the
// queue's FIFO order (increment 3 drains it). One pending row per (dayDate,
// portion) means cross-day order is all that remains, and nothing correctness-
// bearing depends on it - the structural one-row-per-day property is what the
// ordering evidence rests on (increment 4), not this sort.

@Dao
interface EntryDao {
    /** Insert or, on a (dayDate, portion) collision, replace the existing row (coalescing). */
    @Upsert
    suspend fun upsert(entry: EntryEntity)

    /** The current row for one day-and-portion, or null. */
    @Query("SELECT * FROM entry WHERE dayDate = :dayDate AND portion = :portion")
    suspend fun byDayPortion(
        dayDate: String,
        portion: Portion,
    ): EntryEntity?

    /**
     * The current row for one account-and-day-and-portion, or null (AN-FIX F4 / R303). This is the
     * full primary-key lookup; the reconcile and the record path use it so one account's row is never
     * read or replaced under another account's identity.
     */
    @Query("SELECT * FROM entry WHERE accountTag = :accountTag AND dayDate = :dayDate AND portion = :portion")
    suspend fun byAccountDayPortion(
        accountTag: String,
        dayDate: String,
        portion: Portion,
    ): EntryEntity?

    /**
     * The mutations ONE account still owes the server, in tap order (AN-FIX F4 / R303). The sync
     * worker drains only the current account's rows, so an expired session's queue cannot drain under
     * the next account's token. UNOWNED rows never match a real account tag, so they are never sent.
     */
    @Query(
        "SELECT * FROM entry WHERE syncState = 'PENDING' AND accountTag = :accountTag " +
            "ORDER BY clientClaimedAt ASC",
    )
    suspend fun pendingForAccount(accountTag: String): List<EntryEntity>

    /**
     * Every row belonging to ONE account, observed (AN-FIX F4 / R303). Every screen reads through this,
     * so an account only ever sees its own days - an expired session is not a sign-out, so without this
     * the next account to reach the shell would see the previous one's record. UNOWNED rows never match
     * a real account tag, so they are never shown.
     */
    @Query("SELECT * FROM entry WHERE accountTag = :accountTag ORDER BY dayDate ASC, portion ASC")
    fun observeAllForAccount(accountTag: String): Flow<List<EntryEntity>>

    /** Every stored row, ordered as the record reads: day ascending, then portion. */
    @Query("SELECT * FROM entry ORDER BY dayDate ASC, portion ASC")
    suspend fun all(): List<EntryEntity>

    /** The mutations the queue still owes the server, in tap order (FIFO). */
    @Query("SELECT * FROM entry WHERE syncState = 'PENDING' ORDER BY clientClaimedAt ASC")
    suspend fun pending(): List<EntryEntity>

    /**
     * The durable pending state the UI renders (DESIGN-SYSTEM section 2: a
     * first-class persistent state, never a toast). A Flow so the screen updates
     * as sync drains the queue, without polling.
     */
    @Query("SELECT * FROM entry WHERE syncState = 'PENDING' ORDER BY clientClaimedAt ASC")
    fun observePending(): Flow<List<EntryEntity>>

    /** Every stored row, observed - for the dev recorder (increment 5). */
    @Query("SELECT * FROM entry ORDER BY dayDate ASC, portion ASC")
    fun observeAll(): Flow<List<EntryEntity>>
}
