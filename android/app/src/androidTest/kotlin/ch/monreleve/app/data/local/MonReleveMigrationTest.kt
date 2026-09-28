package ch.monreleve.app.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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
    fun migratesFromVersion1ToVersion2() {
        helper.createDatabase(TEST_DB, 1).close()
        helper.runMigrationsAndValidate(TEST_DB, DATABASE_VERSION, true, MIGRATION_1_2)
    }

    private companion object {
        const val TEST_DB = "migration-test.db"
    }
}
