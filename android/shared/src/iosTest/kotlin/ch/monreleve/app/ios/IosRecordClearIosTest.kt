package ch.monreleve.app.ios

import ch.monreleve.app.data.local.RhythmEntity
import ch.monreleve.app.data.local.RhythmKind
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// IOS-2f R889. clearIosRecord - Android's clearAllTables() on iOS, where Room 2.7.2 does not offer it - over the REAL
// iOS database: every record table is emptied (the entries, the detection tally, the weekly rhythm), the list of
// tables is DERIVED from the database and excludes Room's own bookkeeping, and the database is still the same database
// afterwards: it accepts a write, and it reopens at its version with no migration error.

private const val R889_RECORD_ACCOUNT = "e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1"

class IosRecordClearIosTest {
    @Test
    fun everyRecordTableIsEmptiedAndTheDatabaseStaysUsable() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            database.entryDao().upsert(ios2fEntry("r889-c1", "2026-10-13", R889_RECORD_ACCOUNT))
            database.entryDao().upsert(ios2fEntry("r889-c2", "2026-10-14", R889_RECORD_ACCOUNT))
            database.tallyDao().upsert(ios2fTally("2026-10-13"))
            database.rhythmDao().upsert(
                RhythmEntity(R889_RECORD_ACCOUNT, RhythmKind.SUISSE, null, RhythmKind.DOMICILE, null, null),
            )
            assertEquals(2, database.entryDao().all().size, "control: two rows recorded")
            assertEquals(1, database.tallyDao().all().size, "control: one tally")
            assertEquals(RhythmKind.SUISSE, database.rhythmDao().forAccount(R889_RECORD_ACCOUNT)?.monday, "control")

            clearIosRecord(database)

            assertTrue(database.entryDao().all().isEmpty(), "the entries (the record and the mutation queue) are gone")
            assertTrue(database.tallyDao().all().isEmpty(), "the detection tally is gone")
            assertNull(database.rhythmDao().forAccount(R889_RECORD_ACCOUNT), "the weekly rhythm is gone")

            database.entryDao().upsert(ios2fEntry("r889-c3", "2026-10-15", R889_RECORD_ACCOUNT))
            assertEquals(listOf("r889-c3"), database.entryDao().all().map { it.clientMutationId }, "still writable")
            database.close()

            val reopened = buildIosDatabase(directory)
            assertEquals(listOf("r889-c3"), reopened.entryDao().all().map { it.clientMutationId }, "reopens, same data")
            reopened.close()
            removeDirectory(directory)
        }

    @Test
    fun theTablesSweptAreDerivedFromTheDatabaseAndNeverRoomsOwn() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            database.entryDao().all() // opens the connection, so Room has created its tables
            val tables = recordTables(database)
            assertTrue(
                tables.containsAll(listOf("daily_tally", "entry", "weekly_rhythm")),
                "the three entity tables are found: $tables",
            )
            assertFalse("room_master_table" in tables, "Room's identity table is never swept: $tables")
            assertFalse(tables.any { it.startsWith("sqlite_") }, "SQLite's internals are never swept: $tables")
            database.close()
            removeDirectory(directory)
        }
}
