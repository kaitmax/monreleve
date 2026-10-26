package ch.monreleve.app.ios

import androidx.sqlite.SQLiteConnection
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.execSQL
import ch.monreleve.app.data.local.DATABASE_NAME
import ch.monreleve.app.data.local.DATABASE_VERSION
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.shared.SchemaIdentityHashes
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-1a R567. THE DATABASE ON iOS, PROVEN ON THE SIMULATOR.
//
//   1. A fresh database is created at version 6 and carries the identity hash schemas/6.json records. The hashes
//      live in commonTest SchemaIdentityHashes; the JVM test IdentityHashConstantTest (androidUnitTest) reads the
//      schemas/*.json files and
//      fails if a constant ever differs from them, so the file and this test cannot drift apart.
//   2. Migrations run through Room KMP on iOS over a HAND-BUILT old database. Room 2.7.2's multiplatform migration
//      test helper does not exist (MigrationTestHelper is Android-only until a later Room line, and room-testing
//      is an androidTest dependency here), so KMP-2b's nine-path matrix cannot run on iOS as it is. What CAN is
//      proved instead, with the REAL migrations and Room's own post-migration schema validation (a migration that
//      leaves a table the wrong shape makes Room throw on open): a v1 database whose rows are kept and tagged
//      UNOWNED, and a v5 database that gains the rhythm table with its rows kept. The old schemas are the
//      createSql of schemas/1.json and 5.json, verbatim.

private const val ENTRY_V1 =
    "CREATE TABLE IF NOT EXISTS `entry` (`clientMutationId` TEXT NOT NULL, `dayDate` TEXT NOT NULL, " +
        "`portion` TEXT NOT NULL, `kind` TEXT NOT NULL, `absenceReason` TEXT, `note` TEXT, " +
        "`provenance` TEXT NOT NULL, " +
        "`detectedKind` TEXT, `detectedAt` TEXT, `clientClaimedAt` TEXT, `serverId` TEXT, `firstRecordedAt` TEXT, " +
        "`lastModifiedAt` TEXT, `syncState` TEXT NOT NULL, PRIMARY KEY(`dayDate`, `portion`))"

private const val ENTRY_V5 =
    "CREATE TABLE IF NOT EXISTS `entry` (`clientMutationId` TEXT NOT NULL, `dayDate` TEXT NOT NULL, " +
        "`portion` TEXT NOT NULL, `kind` TEXT NOT NULL, `absenceReason` TEXT, `note` TEXT, " +
        "`provenance` TEXT NOT NULL, " +
        "`detectedKind` TEXT, `detectedAt` TEXT, `clientClaimedAt` TEXT, `serverId` TEXT, `firstRecordedAt` TEXT, " +
        "`lastModifiedAt` TEXT, `syncState` TEXT NOT NULL, `accountTag` TEXT NOT NULL, " +
        "PRIMARY KEY(`accountTag`, `dayDate`, `portion`))"

private const val TALLY_V5 =
    "CREATE TABLE IF NOT EXISTS `daily_tally` (`dayDate` TEXT NOT NULL, `check1` TEXT, `check2` TEXT, " +
        "`check3` TEXT, `check4` TEXT, `gpsCheckCount` INTEGER NOT NULL DEFAULT 0, " +
        "`networkCheckCount` INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(`dayDate`))"

private const val MASTER_TABLE =
    "CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY, identity_hash TEXT)"

private fun <T> withRawConnection(
    path: String,
    block: (SQLiteConnection) -> T,
): T {
    val connection = BundledSQLiteDriver().open(path)
    try {
        return block(connection)
    } finally {
        connection.close()
    }
}

private fun SQLiteConnection.longOf(sql: String): Long {
    val statement = prepare(sql)
    try {
        check(statement.step()) { "no row for: $sql" }
        return statement.getLong(0)
    } finally {
        statement.close()
    }
}

private fun SQLiteConnection.textOf(sql: String): String {
    val statement = prepare(sql)
    try {
        check(statement.step()) { "no row for: $sql" }
        return statement.getText(0)
    } finally {
        statement.close()
    }
}

private fun handBuild(
    path: String,
    version: Int,
    hash: String,
    vararg statements: String,
) = withRawConnection(path) { connection ->
    connection.execSQL(MASTER_TABLE)
    statements.forEach { connection.execSQL(it) }
    connection.execSQL("INSERT OR REPLACE INTO room_master_table (id, identity_hash) VALUES (42, '$hash')")
    connection.execSQL("PRAGMA user_version = $version")
}

class IosDatabaseTest {
    @Test
    fun aFreshDatabaseIsCreatedAtVersionSixWithTheIdentityHashOfSchemasSixJson() =
        runBlocking {
            val directory = freshTempDirectory()
            val database = buildIosDatabase(directory)
            assertEquals(emptyList(), database.entryDao().pendingForAccount("nobody"), "forces the file to be created")
            database.close()
            val path = "$directory/$DATABASE_NAME"
            assertEquals(6, DATABASE_VERSION)
            assertEquals(6L, withRawConnection(path) { it.longOf("PRAGMA user_version") })
            assertEquals(
                SchemaIdentityHashes.V6,
                withRawConnection(path) {
                    it.textOf("SELECT identity_hash FROM room_master_table WHERE id = 42")
                },
            )
            removeDirectory(directory)
        }

    @Test
    fun aVersionOneDatabaseMigratesToSixKeepingItsRowsTaggedUnowned() =
        runBlocking {
            val directory = freshTempDirectory()
            val path = "$directory/$DATABASE_NAME"
            handBuild(path, 1, SchemaIdentityHashes.V1, ENTRY_V1)
            withRawConnection(path) { connection ->
                connection.execSQL(
                    "INSERT INTO entry (clientMutationId, dayDate, portion, kind, provenance, syncState) " +
                        "VALUES ('m-1', '2026-06-15', 'FULL', 'HOME', 'MANUAL', 'SYNCED')",
                )
            }
            val database = buildIosDatabase(directory)
            val rows: List<EntryEntity> = database.entryDao().all()
            database.close()
            assertEquals(1, rows.size, "the v1 row must survive v1 -> v6")
            val row = rows.single()
            assertEquals("m-1", row.clientMutationId)
            assertEquals("2026-06-15", row.dayDate)
            assertEquals(Portion.FULL, row.portion)
            assertEquals(EntryKind.HOME, row.kind)
            assertEquals(Provenance.MANUAL, row.provenance)
            assertEquals(SyncState.SYNCED, row.syncState)
            assertEquals("UNOWNED", row.accountTag, "MIGRATION_2_3 tags every pre-account row UNOWNED")
            assertEquals(6L, withRawConnection(path) { it.longOf("PRAGMA user_version") })
            assertEquals(
                SchemaIdentityHashes.V6,
                withRawConnection(path) {
                    it.textOf("SELECT identity_hash FROM room_master_table WHERE id = 42")
                },
            )
            removeDirectory(directory)
        }

    @Test
    fun aVersionFiveDatabaseGainsTheRhythmTableAndKeepsEverythingElse() =
        runBlocking {
            val directory = freshTempDirectory()
            val path = "$directory/$DATABASE_NAME"
            handBuild(path, 5, SchemaIdentityHashes.V5, ENTRY_V5, TALLY_V5)
            withRawConnection(path) { connection ->
                connection.execSQL(
                    "INSERT INTO entry (clientMutationId, dayDate, portion, kind, provenance, syncState, accountTag) " +
                        "VALUES ('m-5', '2026-07-01', 'AM', 'CH', 'MANUAL', 'PENDING', 'acct-1')",
                )
                connection.execSQL("INSERT INTO daily_tally (dayDate, check1) VALUES ('2026-07-01', 'CH')")
            }
            val database = buildIosDatabase(directory)
            val rows = database.entryDao().pendingForAccount("acct-1")
            database.close()
            assertEquals(listOf("m-5"), rows.map { it.clientMutationId })
            withRawConnection(path) { connection ->
                assertEquals(
                    0L,
                    connection.longOf("SELECT count(*) FROM weekly_rhythm"),
                    "the table exists and is empty",
                )
                assertEquals(1L, connection.longOf("SELECT count(*) FROM daily_tally"), "the tally row survived")
                assertEquals(6L, connection.longOf("PRAGMA user_version"))
            }
            assertTrue(rows.single().syncState == SyncState.PENDING)
            removeDirectory(directory)
        }
}
