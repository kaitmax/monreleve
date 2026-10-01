package ch.monreleve.app.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

// AN5 increment 1 / AN6a increment 3. The migration harness, now with a REAL migration to
// run - the execution AN5's report honestly recorded as never having happened. It creates the
// database at version 1 (the AN5 entry store), applies MIGRATION_1_2, and validates the result
// against the exported schemas/2.json: if the migration's DDL drifts from what Room expects for
// TallyEntity, runMigrationsAndValidate fails here, on the emulator, before a device that
// cannot be un-installed ever runs it (R187).
//
// Instrumented (needs the device runtime), so the JVM gate skips it with a reason, as it does
// connectedDebugAndroidTest; run on the emulator.
@RunWith(AndroidJUnit4::class)
class MonReleveMigrationTest {
    @get:Rule
    val helper =
        MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            MonReleveDatabase::class.java,
        )

    @Test
    fun migratesFromVersion1ToLatest() {
        // A genuine v1 database migrated ALL THE WAY to the current version through every real migration
        // (MIGRATION_1_2 then MIGRATION_2_3), validated against the exported schema for DATABASE_VERSION.
        helper.createDatabase(TEST_DB, 1).close()
        helper.runMigrationsAndValidate(TEST_DB, DATABASE_VERSION, true, MIGRATION_1_2, MIGRATION_2_3)
    }

    @Test
    fun migratesFromVersion2ToVersion3AssigningExistingRowsUnowned() {
        // AN-FIX F4 / R303. A GENUINE v2 database (AN6b testers may hold it) carrying one real entry row,
        // migrated to v3 by the REAL MIGRATION_2_3 - not a freshly-created v3. The v2 entry table has no
        // accountTag and PK (dayDate, portion), so this exercises the table recreate and the data copy.
        helper.createDatabase(TEST_DB, 2).apply {
            execSQL(
                "INSERT INTO entry (clientMutationId, dayDate, portion, kind, absenceReason, note, " +
                    "provenance, detectedKind, detectedAt, clientClaimedAt, serverId, firstRecordedAt, " +
                    "lastModifiedAt, syncState) VALUES ('mut-1', '2026-09-28', 'FULL', 'CH', NULL, NULL, " +
                    "'MANUAL', NULL, NULL, '2026-09-28T12:00:00.000+02:00', NULL, NULL, NULL, 'PENDING')",
            )
            close()
        }

        // runMigrationsAndValidate validates the migrated schema against schemas/3.json AND returns the db.
        val db = helper.runMigrationsAndValidate(TEST_DB, DATABASE_VERSION, true, MIGRATION_2_3)

        // The pre-F4 row SURVIVED (R303: nothing is lost) and was tagged UNOWNED - its account is
        // unrecoverable, so it is held, never sent, never shown, never mis-attributed.
        db.query(
            "SELECT accountTag, clientMutationId FROM entry WHERE dayDate = '2026-09-28' AND portion = 'FULL'",
        ).use { cursor ->
            assertTrue("the pre-F4 row must survive the migration", cursor.moveToFirst())
            assertEquals("UNOWNED", cursor.getString(cursor.getColumnIndexOrThrow("accountTag")))
            assertEquals("mut-1", cursor.getString(cursor.getColumnIndexOrThrow("clientMutationId")))
        }
    }

    private companion object {
        const val TEST_DB = "migration-test.db"
    }
}
