package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.RhythmDao
import ch.monreleve.app.data.local.RhythmEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * KMP-4 (R466). An in-memory RhythmDao for the rhythm repository's tests - Room's real DAO needs the device
 * runtime. Keyed by accountTag, the weekly_rhythm table's primary key, so an upsert replaces that account's
 * row and two accounts' rows coexist, exactly as the Room table does.
 *
 * PLATFORM-FREE ON PURPOSE: it moves to :shared's commonTest with RhythmRepositoryPinTest, by git mv,
 * when LocalRhythmRepository moves. Nothing else uses it.
 */
class FakeRhythmDao : RhythmDao {
    val rows = linkedMapOf<String, RhythmEntity>()

    override suspend fun upsert(rhythm: RhythmEntity) {
        rows[rhythm.accountTag] = rhythm
    }

    override fun observeForAccount(accountTag: String): Flow<RhythmEntity?> = flowOf(rows[accountTag])

    override suspend fun forAccount(accountTag: String): RhythmEntity? = rows[accountTag]

    override suspend fun clearForAccount(accountTag: String) {
        rows.remove(accountTag)
    }
}
