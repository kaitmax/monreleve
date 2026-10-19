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
        // (MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5), validated against the exported schema
        // for DATABASE_VERSION.
        helper.createDatabase(TEST_DB, 1).close()
        helper.runMigrationsAndValidate(
            TEST_DB,
            DATABASE_VERSION,
            true,
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
        )
    }

    @Test
    fun migratesFromVersion4ToVersion5AddingProviderCountsAndKeepingChecks() {
        // AN-NEXT-2 / R324 / R305 / R187. A GENUINE v4 database carrying a four-check daily_tally row, migrated to
        // v5 by the REAL MIGRATION_4_5. The two provider-count columns are ADDED (ADD COLUMN ... DEFAULT 0); the
        // existing row - its four checks - must SURVIVE and read as zero counts (it predates provider counting).
        // No destructive fallback (R305): nothing is dropped or recreated.
        helper.createDatabase(TEST_DB, 4).apply {
            execSQL(
                "INSERT INTO daily_tally (dayDate, check1, check2, check3, check4) VALUES " +
                    "('2027-06-18', 'INSIDE', 'OUTSIDE', NULL, 'BUFFER')",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, DATABASE_VERSION, true, MIGRATION_4_5, MIGRATION_5_6)

        db.query(
            "SELECT check1, check2, check3, check4, gpsCheckCount, networkCheckCount FROM daily_tally " +
                "WHERE dayDate = '2027-06-18'",
        ).use { cursor ->
            assertTrue("the v4 tally row must survive the provider-count migration", cursor.moveToFirst())
            assertEquals("INSIDE", cursor.getString(cursor.getColumnIndexOrThrow("check1")))
            assertEquals("OUTSIDE", cursor.getString(cursor.getColumnIndexOrThrow("check2")))
            assertEquals("BUFFER", cursor.getString(cursor.getColumnIndexOrThrow("check4")))
            // The new columns default to 0 for a pre-v5 row (no provider was counted when it was written).
            assertEquals(0, cursor.getInt(cursor.getColumnIndexOrThrow("gpsCheckCount")))
            assertEquals(0, cursor.getInt(cursor.getColumnIndexOrThrow("networkCheckCount")))
        }
    }

    @Test
    fun migratesFromVersion3ToVersion4DroppingOldTallyRowsAndKeepingEntries() {
        // R320 / R305 / R187. A GENUINE v3 database carrying a continuous-era daily_tally row AND a real entry row,
        // migrated to v4 by the REAL MIGRATION_3_4. The old tally shape cannot convert into the four check slots, so
        // its rows are DROPPED explicitly; the entry table - the person's recorded days - must be UNTOUCHED.
        helper.createDatabase(TEST_DB, 3).apply {
            execSQL(
                "INSERT INTO daily_tally (dayDate, minutesSwitzerland, minutesElsewhere, fixCount, bufferFixCount, " +
                    "windowStartMinuteOfDay, windowEndMinuteOfDay, tier) VALUES " +
                    "('2026-09-28', 400, 20, 30, 1, 420, 1140, 'HIGH')",
            )
            execSQL(
                "INSERT INTO entry (clientMutationId, dayDate, portion, kind, absenceReason, note, provenance, " +
                    "detectedKind, detectedAt, clientClaimedAt, serverId, firstRecordedAt, lastModifiedAt, " +
                    "syncState, accountTag) VALUES ('mut-9', '2026-09-28', 'FULL', 'CH', NULL, NULL, 'MANUAL', " +
                    "NULL, NULL, '2026-09-28T12:00:00.000+02:00', NULL, NULL, NULL, 'PENDING', 'acct-1')",
            )
            close()
        }

        val db =
            helper.runMigrationsAndValidate(
                TEST_DB,
                DATABASE_VERSION,
                true,
                MIGRATION_3_4,
                MIGRATION_4_5,
                MIGRATION_5_6,
            )

        // The old continuous-era tally row is GONE (the reshaped table starts empty; nothing to carry across).
        db.query("SELECT COUNT(*) FROM daily_tally").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(0, cursor.getInt(0))
        }
        // The person's entry row is UNTOUCHED by the tally reshape.
        db.query("SELECT accountTag FROM entry WHERE dayDate = '2026-09-28' AND portion = 'FULL'").use { cursor ->
            assertTrue("the entry row must survive the daily_tally reshape", cursor.moveToFirst())
            assertEquals("acct-1", cursor.getString(cursor.getColumnIndexOrThrow("accountTag")))
        }
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

        // runMigrationsAndValidate validates the migrated schema against schemas/<DATABASE_VERSION>.json AND
        // returns the db. The v2 row is carried across every migration in the chain to the current version.
        val db =
            helper.runMigrationsAndValidate(
                TEST_DB,
                DATABASE_VERSION,
                true,
                MIGRATION_2_3,
                MIGRATION_3_4,
                MIGRATION_4_5,
                MIGRATION_5_6,
            )

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

    // ------------------------------------------------------------------------------------------
    // KMP-2 / R397. EVERY STEP INDIVIDUALLY, AND THE START VERSION THAT WAS MISSING.
    //
    // The four tests above each start at some version and run STRAIGHT THROUGH to DATABASE_VERSION,
    // which is how a real install upgrades. They leave two gaps R397 names explicitly:
    //
    //   - NO TEST STARTED AT VERSION 5. A device last opened on v5 - the shape immediately before
    //     the current one, so the MOST likely version still in the wild - had no coverage at all.
    //   - NO STEP WAS VALIDATED AT ITS OWN INTERMEDIATE VERSION. Running 1->6 asserts the END state
    //     against schemas/6.json; it never asserts that the database is a VALID v2 after
    //     MIGRATION_1_2. A migration that produced a wrong v2 and a second that happened to correct
    //     it would pass the chain and fail nobody - until a device stopped at v2 and opened.
    //
    // Each test below inserts rows BEFORE migrating and asserts what survives after, because a
    // migration that drops the table and recreates it empty satisfies every schema assertion
    // perfectly (R133: validate presence, not merely absence of complaint).

    @Test
    fun step1To2CreatesTheTallyTableAndLeavesEntriesAlone() {
        helper.createDatabase(TEST_DB, 1).apply {
            execSQL(
                "INSERT INTO entry (clientMutationId, dayDate, portion, kind, absenceReason, note, " +
                    "provenance, detectedKind, detectedAt, clientClaimedAt, serverId, firstRecordedAt, " +
                    "lastModifiedAt, syncState) VALUES ('mut-s12', '2026-03-02', 'FULL', 'CH', NULL, NULL, " +
                    "'MANUAL', NULL, NULL, '2026-03-02T09:00:00.000+01:00', NULL, NULL, NULL, 'PENDING')",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 2, true, MIGRATION_1_2)

        db.query("SELECT clientMutationId FROM entry WHERE dayDate = '2026-03-02'").use { cursor ->
            assertTrue("the v1 entry row must survive the tally table being added", cursor.moveToFirst())
            assertEquals("mut-s12", cursor.getString(0))
        }
        // The new table exists and starts empty - nothing to carry across at v2.
        db.query("SELECT COUNT(*) FROM daily_tally").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(0, cursor.getInt(0))
        }
    }

    @Test
    fun step2To3TagsExistingEntriesUnownedAndKeepsTheTally() {
        helper.createDatabase(TEST_DB, 2).apply {
            execSQL(
                "INSERT INTO entry (clientMutationId, dayDate, portion, kind, absenceReason, note, " +
                    "provenance, detectedKind, detectedAt, clientClaimedAt, serverId, firstRecordedAt, " +
                    "lastModifiedAt, syncState) VALUES ('mut-s23', '2026-03-03', 'AM', 'HOME', NULL, NULL, " +
                    "'MANUAL', NULL, NULL, '2026-03-03T09:00:00.000+01:00', NULL, NULL, NULL, 'PENDING')",
            )
            execSQL(
                "INSERT INTO daily_tally (dayDate, minutesSwitzerland, minutesElsewhere, fixCount, " +
                    "bufferFixCount, windowStartMinuteOfDay, windowEndMinuteOfDay, tier) VALUES " +
                    "('2026-03-03', 300, 60, 20, 2, 420, 1140, 'LOW')",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 3, true, MIGRATION_2_3)

        db.query("SELECT accountTag, clientMutationId, kind FROM entry WHERE dayDate = '2026-03-03'").use { cursor ->
            assertTrue("the v2 entry row must survive the primary-key change", cursor.moveToFirst())
            assertEquals("UNOWNED", cursor.getString(0))
            assertEquals("mut-s23", cursor.getString(1))
            assertEquals("HOME", cursor.getString(2))
        }
        // MIGRATION_2_3 recreates `entry` only; the tally table is not its business and must be untouched.
        db.query("SELECT minutesSwitzerland FROM daily_tally WHERE dayDate = '2026-03-03'").use { cursor ->
            assertTrue("the tally row must be untouched by the entry recreate", cursor.moveToFirst())
            assertEquals(300, cursor.getInt(0))
        }
    }

    @Test
    fun step3To4ReshapesTheTallyAndKeepsEntries() {
        helper.createDatabase(TEST_DB, 3).apply {
            execSQL(
                "INSERT INTO entry (clientMutationId, dayDate, portion, kind, absenceReason, note, " +
                    "provenance, detectedKind, detectedAt, clientClaimedAt, serverId, firstRecordedAt, " +
                    "lastModifiedAt, syncState, accountTag) VALUES ('mut-s34', '2026-03-04', 'PM', " +
                    "'MISSION_FR', NULL, NULL, 'MANUAL', NULL, NULL, '2026-03-04T09:00:00.000+01:00', " +
                    "NULL, NULL, NULL, 'PENDING', 'acct-s34')",
            )
            execSQL(
                "INSERT INTO daily_tally (dayDate, minutesSwitzerland, minutesElsewhere, fixCount, " +
                    "bufferFixCount, windowStartMinuteOfDay, windowEndMinuteOfDay, tier) VALUES " +
                    "('2026-03-04', 480, 0, 40, 0, 420, 1140, 'HIGH')",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 4, true, MIGRATION_3_4)

        // The continuous-era shape cannot convert into four check slots, so its rows go - deliberately.
        db.query("SELECT COUNT(*) FROM daily_tally").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(0, cursor.getInt(0))
        }
        // The person's recorded day is NOT part of that reshape.
        db.query("SELECT accountTag FROM entry WHERE dayDate = '2026-03-04' AND portion = 'PM'").use { cursor ->
            assertTrue("the entry row must survive the tally reshape", cursor.moveToFirst())
            assertEquals("acct-s34", cursor.getString(0))
        }
    }

    @Test
    fun step4To5AddsProviderCountsWithoutDisturbingTheChecks() {
        helper.createDatabase(TEST_DB, 4).apply {
            execSQL(
                "INSERT INTO daily_tally (dayDate, check1, check2, check3, check4) VALUES " +
                    "('2026-03-05', 'OUTSIDE', NULL, 'INSIDE', 'INSIDE')",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, 5, true, MIGRATION_4_5)

        db.query(
            "SELECT check1, check2, check3, check4, gpsCheckCount, networkCheckCount FROM daily_tally " +
                "WHERE dayDate = '2026-03-05'",
        ).use { cursor ->
            assertTrue("the v4 tally row must survive the column additions", cursor.moveToFirst())
            assertEquals("OUTSIDE", cursor.getString(0))
            assertTrue("a NULL check must stay NULL", cursor.isNull(1))
            assertEquals("INSIDE", cursor.getString(2))
            assertEquals("INSIDE", cursor.getString(3))
            // A pre-v5 row counted no provider, so the added columns read as their declared default.
            assertEquals(0, cursor.getInt(4))
            assertEquals(0, cursor.getInt(5))
        }
    }

    @Test
    fun migratesFromVersion5ToVersion6AddingTheRhythmTableAndKeepingEverything() {
        // THE START VERSION THAT HAD NO TEST, and - because 5 and 6 are adjacent - also R397's
        // individual 5->6 step. One test rather than two identical ones (R268).
        helper.createDatabase(TEST_DB, 5).apply {
            execSQL(
                "INSERT INTO entry (clientMutationId, dayDate, portion, kind, absenceReason, note, " +
                    "provenance, detectedKind, detectedAt, clientClaimedAt, serverId, firstRecordedAt, " +
                    "lastModifiedAt, syncState, accountTag) VALUES ('mut-s56', '2026-03-06', 'FULL', " +
                    "'ABSENT', 'CONGE', 'une note', 'MANUAL', NULL, NULL, " +
                    "'2026-03-06T09:00:00.000+01:00', NULL, NULL, NULL, 'PENDING', 'acct-s56')",
            )
            execSQL(
                "INSERT INTO daily_tally (dayDate, check1, check2, check3, check4, gpsCheckCount, " +
                    "networkCheckCount) VALUES ('2026-03-06', 'INSIDE', 'INSIDE', 'BUFFER', NULL, 7, 3)",
            )
            close()
        }

        val db = helper.runMigrationsAndValidate(TEST_DB, DATABASE_VERSION, true, MIGRATION_5_6)

        // The entry survives whole - including the absence reason and the free-text note, which are the
        // two fields a person cannot reconstruct if they are lost.
        db.query(
            "SELECT accountTag, kind, absenceReason, note FROM entry WHERE dayDate = '2026-03-06'",
        ).use { cursor ->
            assertTrue("the v5 entry row must survive", cursor.moveToFirst())
            assertEquals("acct-s56", cursor.getString(0))
            assertEquals("ABSENT", cursor.getString(1))
            assertEquals("CONGE", cursor.getString(2))
            assertEquals("une note", cursor.getString(3))
        }
        // The tally survives with its provider counts intact.
        db.query(
            "SELECT check3, gpsCheckCount, networkCheckCount FROM daily_tally WHERE dayDate = '2026-03-06'",
        ).use { cursor ->
            assertTrue("the v5 tally row must survive", cursor.moveToFirst())
            assertEquals("BUFFER", cursor.getString(0))
            assertEquals(7, cursor.getInt(1))
            assertEquals(3, cursor.getInt(2))
        }
        // The new table exists and is empty: a rhythm is something the person sets, never inferred here.
        db.query("SELECT COUNT(*) FROM weekly_rhythm").use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(0, cursor.getInt(0))
        }
    }

    private companion object {
        const val TEST_DB = "migration-test.db"
    }
}
