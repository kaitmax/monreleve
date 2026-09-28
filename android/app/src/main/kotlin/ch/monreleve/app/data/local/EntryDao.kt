package ch.monreleve.app.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

// AN5 increment 1. The only code that touches the entry table (SPEC 5 fence 5:
// ui/ writes through EntryRepository, never a DAO directly).
//
// @Upsert MATCHES ON THE PRIMARY KEY (dayDate, portion), which is the coalescing
// this data layer is built around: an edit to a day already pending overwrites its
// row in place - a new clientMutationId, PENDING again - rather than adding a
// second mutation for the same day. The queue mechanics that rely on it are
// increment 2; increment 1 only needs to write a row and read it back, which is
// what the on-device round-trip and the migration harness exercise.

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

    /** Every stored row, ordered as the record reads: day ascending, then portion. */
    @Query("SELECT * FROM entry ORDER BY dayDate ASC, portion ASC")
    suspend fun all(): List<EntryEntity>
}
