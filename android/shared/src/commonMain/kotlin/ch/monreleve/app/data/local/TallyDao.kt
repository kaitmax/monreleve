package ch.monreleve.app.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

// AN6a increment 3. The only code that touches the daily_tally table. One row per day; a
// re-computation of a day (a later fix arrives, the window rolls) upserts it.

@Dao
interface TallyDao {
    @Upsert
    suspend fun upsert(tally: TallyEntity)

    @Query("SELECT * FROM daily_tally WHERE dayDate = :dayDate")
    suspend fun byDay(dayDate: String): TallyEntity?

    @Query("SELECT * FROM daily_tally ORDER BY dayDate ASC")
    suspend fun all(): List<TallyEntity>

    @Query("SELECT * FROM daily_tally ORDER BY dayDate ASC")
    fun observeAll(): Flow<List<TallyEntity>>
}
