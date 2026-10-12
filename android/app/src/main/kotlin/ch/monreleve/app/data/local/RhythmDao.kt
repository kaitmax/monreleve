package ch.monreleve.app.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

// AN-FORECAST (R341, R303). The only code that touches the weekly_rhythm table (the rhythm repository
// is its one writer, mirroring EntryDao/EntryRepository). Every read and write is scoped by accountTag,
// so one account's rhythm is never read or replaced under another's. @Upsert matches on the primary key
// (accountTag), so saving a rhythm replaces that account's single row in place.

@Dao
interface RhythmDao {
    @Upsert
    suspend fun upsert(rhythm: RhythmEntity)

    /** This account's rhythm, observed; null when none is set. */
    @Query("SELECT * FROM weekly_rhythm WHERE accountTag = :accountTag")
    fun observeForAccount(accountTag: String): Flow<RhythmEntity?>

    /** This account's rhythm, or null. */
    @Query("SELECT * FROM weekly_rhythm WHERE accountTag = :accountTag")
    suspend fun forAccount(accountTag: String): RhythmEntity?

    /** Drop this account's rhythm (the "clear my rhythm" action). */
    @Query("DELETE FROM weekly_rhythm WHERE accountTag = :accountTag")
    suspend fun clearForAccount(accountTag: String)
}
