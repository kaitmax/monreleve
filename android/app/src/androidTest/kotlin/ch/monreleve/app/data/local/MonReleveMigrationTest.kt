package ch.monreleve.app.data.local

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

// AN5 increment 1. The migration harness R187 requires from the very first
// version. It reads the exported schema JSON from the test APK's assets (wired by
// android.sourceSets.androidTest.assets.srcDir("schemas") in build.gradle.kts) and
// opens a real SQLite database against it - so it needs the device runtime and is
// an instrumented test, run on the emulator, not by `./gradlew test`. The gate
// names connectedDebugAndroidTest among what it skips for exactly this reason.
//
// WITH ONE VERSION THERE IS NO MIGRATION TO RUN YET. What this proves today is
// that the exported schema and the compiled schema agree, and that the database
// opens at version 1. Its real value is the day a column is added: runMigrationsAndValidate
// then proves the ALTER against the frozen schema BEFORE it ships to a device that
// cannot be un-installed - which is the whole point of exporting the schema.
@RunWith(AndroidJUnit4::class)
class MonReleveMigrationTest {
    @get:Rule
    val helper =
        MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            MonReleveDatabase::class.java,
        )

    @Test
    fun schemaVersion1OpensAndValidates() {
        helper.createDatabase(TEST_DB, DATABASE_VERSION).close()
    }

    private companion object {
        const val TEST_DB = "migration-test.db"
    }
}
