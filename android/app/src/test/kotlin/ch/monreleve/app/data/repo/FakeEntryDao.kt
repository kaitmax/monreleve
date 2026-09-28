package ch.monreleve.app.data.repo

import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * AN5 increment 2. An in-memory EntryDao for the repository's JVM tests - Room's
 * real DAO needs the device runtime (that is what the on-device migration and
 * round-trip tests cover). It reproduces the one behaviour these tests turn on:
 * upsert keyed on (dayDate, portion), so a re-record of a day replaces its row.
 */
class FakeEntryDao : EntryDao {
    val rows = linkedMapOf<Pair<String, Portion>, EntryEntity>()

    override suspend fun upsert(entry: EntryEntity) {
        rows[entry.dayDate to entry.portion] = entry
    }

    override suspend fun byDayPortion(
        dayDate: String,
        portion: Portion,
    ): EntryEntity? {
        return rows[dayDate to portion]
    }

    override suspend fun all(): List<EntryEntity> {
        return rows.values.sortedWith(compareBy({ it.dayDate }, { it.portion }))
    }

    override suspend fun pending(): List<EntryEntity> {
        return rows.values.filter { it.syncState == SyncState.PENDING }
    }

    override fun observePending(): Flow<List<EntryEntity>> {
        return flowOf(rows.values.filter { it.syncState == SyncState.PENDING })
    }

    override fun observeAll(): Flow<List<EntryEntity>> {
        return flowOf(rows.values.toList())
    }
}
