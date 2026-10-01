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
 * round-trip tests cover). It reproduces the behaviour these tests turn on:
 *
 * AN-FIX F4 / R303: upsert keyed on the WHOLE primary key (accountTag, dayDate, portion), so a
 * re-record of a day replaces its row AND two accounts' same (dayDate, portion) coexist without
 * either overwriting the other. The scoped reads (byAccountDayPortion / pendingForAccount /
 * observeAllForAccount) filter by accountTag exactly as the Room queries do, so a JVM test proves the
 * one-account-per-queue property the real DAO enforces on the device.
 */
class FakeEntryDao : EntryDao {
    val rows = linkedMapOf<Triple<String, String, Portion>, EntryEntity>()

    private fun keyOf(entry: EntryEntity) = Triple(entry.accountTag, entry.dayDate, entry.portion)

    override suspend fun upsert(entry: EntryEntity) {
        rows[keyOf(entry)] = entry
    }

    override suspend fun byDayPortion(
        dayDate: String,
        portion: Portion,
    ): EntryEntity? = rows.values.firstOrNull { it.dayDate == dayDate && it.portion == portion }

    override suspend fun byAccountDayPortion(
        accountTag: String,
        dayDate: String,
        portion: Portion,
    ): EntryEntity? = rows[Triple(accountTag, dayDate, portion)]

    private fun pendingRows(): List<EntryEntity> = rows.values.filter { it.syncState == SyncState.PENDING }

    override suspend fun all(): List<EntryEntity> = rows.values.sortedWith(compareBy({ it.dayDate }, { it.portion }))

    override suspend fun pending(): List<EntryEntity> = pendingRows()

    override suspend fun pendingForAccount(accountTag: String): List<EntryEntity> {
        return pendingRows().filter { it.accountTag == accountTag }
    }

    override fun observePending(): Flow<List<EntryEntity>> = flowOf(pendingRows())

    override fun observeAll(): Flow<List<EntryEntity>> = flowOf(rows.values.toList())

    override fun observeAllForAccount(accountTag: String): Flow<List<EntryEntity>> =
        flowOf(rows.values.filter { it.accountTag == accountTag })
}
