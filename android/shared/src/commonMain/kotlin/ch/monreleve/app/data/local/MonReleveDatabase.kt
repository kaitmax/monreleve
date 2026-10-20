package ch.monreleve.app.data.local

import androidx.room.ConstructedBy
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.RoomDatabaseConstructor
import androidx.room.migration.Migration
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.execSQL

// AN5 increment 1 / AN6a increment 3. The device's local store.
//
// KMP-2b (R394/R395). THIS FILE MOVED FROM :app TO :shared commonMain, unchanged in every way that
// reaches a device: the file name (monreleve.db), DATABASE_VERSION, every table, column, index,
// primary key, default and identity hash are exactly what they were, and the five migrations execute
// the same statements in the same order (MigrationSqlVerbatimTest compares them character for
// character against a fixture recorded at main's HEAD before the move).
//
// WHAT DID CHANGE, and only this: each migration body is written against androidx.sqlite's
// SQLiteConnection instead of the Android-only SupportSQLiteDatabase, because common code cannot see
// the latter. Room 2.7.2 ALWAYS enters migrate(connection) - on Android with no driver it hands the
// body a SupportSQLiteConnection, and the Support overload exists only as a delegation out of the
// connection form (Migration.android.kt, whose KDoc says so). REPORT-KMP-2.txt records both the
// documentary evidence and a device probe that logged exactly one entry into the connection form.
// So ONE body serves Android and iOS; there is no second copy of the SQL to drift.
//
// THE BUILDER STAYS IN :app (R394): Room.databaseBuilder needs a Context. It is
// app/src/main/kotlin/ch/monreleve/app/data/local/MonReleveDatabaseBuilder.kt, an extension on this
// class's companion, so every call site still reads MonReleveDatabase.get(context).
//
// exportSchema = true writes schemas/<db>/<version>.json at compile time, committed and made
// the frozen contract (R187) that RoomSchemaContractTest reads back and MigrationTestHelper
// validates against a real database. KMP-2b moved that directory to android/shared/schemas with the
// database; the JSON files are byte-identical.
//
// NO @TypeConverter. Room persists an enum as its constant name directly, so the wire enums
// store as TEXT with no hand-written converter to drift.
//
// VERSION 2 (AN6a). Version 1 was the entry store (AN5); version 2 adds the detection tally
// (AN6a increment 3). MIGRATION_1_2 creates the daily_tally table. There is NO destructive-migration
// fallback: a schema change ships a real Migration proven by the harness, never wipes a device's
// records.
//
// VERSION 3 (AN-FIX, F4 / R303). Adds the LOCAL-ONLY accountTag column to the entry table AND makes
// it part of the primary key (accountTag, dayDate, portion), so one account's queued days can never
// drain into, or be shown under, another account on the same device. MIGRATION_2_3 recreates the
// entry table (SQLite cannot alter a primary key in place) and tags every EXISTING row UNOWNED: a
// pre-F4 device's rows have no recoverable account (the address was never stored and /api/v1/me omits
// it), so they are held as UNOWNED - never sent, never shown - rather than wiped (R303: deleting would
// destroy days nobody decided to delete) or mis-attributed to whoever signs in next (that is F4
// reborn). Still NO destructive fallback.
//
// VERSION 5 (AN-NEXT-2, R324). Adds the provider COUNTS to daily_tally (gpsCheckCount, networkCheckCount):
// how often GPS vs the NETWORK (wifi/cell) fallback decided a day, so the field test can read it. MIGRATION_4_5
// adds the two columns with DEFAULT 0 and KEEPS every existing row. Still a real Migration, still no destructive
// fallback, and still no coordinate or accuracy value in the store (D18) - these are counts.

// VERSION 6 (AN-FORECAST, R341 / R303). Adds the weekly_rhythm table: one row per account (PK accountTag)
// holding Monday..Friday each as a RhythmKind (SUISSE/DOMICILE) or NULL. The rhythm is a LOCAL planning
// preference, not a record and not on the wire (R340/R341) - no server field. MIGRATION_5_6 creates the
// table and KEEPS every existing row in entry and daily_tally. clearAllTables() (derived from @Database)
// sweeps weekly_rhythm with the record on sign-out/deletion (R295), so the rhythm never outlives its
// account. A real Migration, no destructive fallback.

const val DATABASE_NAME = "monreleve.db"

const val DATABASE_VERSION = 6

// Adds the daily_tally table. The DDL matches what Room generates for TallyEntity;
// MigrationTestHelper.runMigrationsAndValidate fails if it drifts from schemas/2.json.
val MIGRATION_1_2 =
    object : Migration(1, 2) {
        override fun migrate(connection: SQLiteConnection) {
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS `daily_tally` (" +
                    "`dayDate` TEXT NOT NULL, " +
                    "`minutesSwitzerland` INTEGER NOT NULL, " +
                    "`minutesElsewhere` INTEGER NOT NULL, " +
                    "`fixCount` INTEGER NOT NULL, " +
                    "`bufferFixCount` INTEGER NOT NULL, " +
                    "`windowStartMinuteOfDay` INTEGER NOT NULL, " +
                    "`windowEndMinuteOfDay` INTEGER NOT NULL, " +
                    "`tier` TEXT, " +
                    "PRIMARY KEY(`dayDate`))",
            )
        }
    }

// AN-FIX F4 / R303. Adds accountTag to the entry table AND moves it into the primary key. SQLite
// cannot add a column to a primary key in place, so the table is recreated: create the v3 shape, copy
// every existing row across with accountTag = 'UNOWNED' (a pre-F4 row has no recoverable account - it
// is held, never sent, never shown - rather than wiped or mis-attributed), drop the old table, rename.
// The recreated table's columns, affinities, nullability and key must match what Room generates for
// EntryEntity at v3; MigrationTestHelper.runMigrationsAndValidate against schemas/3.json fails here, on
// the emulator, if the DDL drifts. The DROP/RENAME runs inside the migration's transaction, so a
// failure leaves the v2 table intact (no half-migrated store).
val MIGRATION_2_3 =
    object : Migration(2, 3) {
        override fun migrate(connection: SQLiteConnection) {
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS `entry_new` (" +
                    "`clientMutationId` TEXT NOT NULL, " +
                    "`dayDate` TEXT NOT NULL, " +
                    "`portion` TEXT NOT NULL, " +
                    "`kind` TEXT NOT NULL, " +
                    "`absenceReason` TEXT, " +
                    "`note` TEXT, " +
                    "`provenance` TEXT NOT NULL, " +
                    "`detectedKind` TEXT, " +
                    "`detectedAt` TEXT, " +
                    "`clientClaimedAt` TEXT, " +
                    "`serverId` TEXT, " +
                    "`firstRecordedAt` TEXT, " +
                    "`lastModifiedAt` TEXT, " +
                    "`syncState` TEXT NOT NULL, " +
                    "`accountTag` TEXT NOT NULL, " +
                    "PRIMARY KEY(`accountTag`, `dayDate`, `portion`))",
            )
            connection.execSQL(
                "INSERT INTO `entry_new` (" +
                    "`clientMutationId`, `dayDate`, `portion`, `kind`, `absenceReason`, `note`, " +
                    "`provenance`, `detectedKind`, `detectedAt`, `clientClaimedAt`, `serverId`, " +
                    "`firstRecordedAt`, `lastModifiedAt`, `syncState`, `accountTag`) " +
                    "SELECT `clientMutationId`, `dayDate`, `portion`, `kind`, `absenceReason`, `note`, " +
                    "`provenance`, `detectedKind`, `detectedAt`, `clientClaimedAt`, `serverId`, " +
                    "`firstRecordedAt`, `lastModifiedAt`, `syncState`, 'UNOWNED' FROM `entry`",
            )
            connection.execSQL("DROP TABLE `entry`")
            connection.execSQL("ALTER TABLE `entry_new` RENAME TO `entry`")
        }
    }

// R320 / R305 / R187. Reshapes daily_tally from the continuous minutes-and-hysteresis tally (version 2/3) to the
// four daily checks. The two shapes share no column and no meaning - a minutes tally cannot be converted into four
// discrete check slots - and the only rows that can exist are from AN-AUTO's own on-device testing, because the
// detection feature has never shipped. So the old rows are DROPPED EXPLICITLY rather than migrated: there is nothing
// to carry across. The entry table - the person's recorded days - is NOT touched. The recreated daily_tally's
// columns, affinities, nullability and key must match what Room generates for TallyEntity at v4;
// MigrationTestHelper.runMigrationsAndValidate against schemas/4.json fails here, on the emulator, if the DDL drifts.
// This is a real Migration, never a destructive fallback (R305).
val MIGRATION_3_4 =
    object : Migration(3, 4) {
        override fun migrate(connection: SQLiteConnection) {
            // Drop the continuous-era tally and its rows explicitly (only AN-AUTO test rows can exist; nothing to
            // convert into the four check slots). The entry table is untouched.
            connection.execSQL("DROP TABLE IF EXISTS `daily_tally`")
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS `daily_tally` (" +
                    "`dayDate` TEXT NOT NULL, " +
                    "`check1` TEXT, " +
                    "`check2` TEXT, " +
                    "`check3` TEXT, " +
                    "`check4` TEXT, " +
                    "PRIMARY KEY(`dayDate`))",
            )
        }
    }

// AN-NEXT-2 / R324 / R305 / R187. Adds the provider COUNTS to daily_tally: gpsCheckCount and networkCheckCount,
// how many of a day's checks came from GPS vs the NETWORK (wifi/cell) fallback. A REAL, NON-DESTRUCTIVE migration -
// two ADD COLUMN steps, each INTEGER NOT NULL DEFAULT 0 (SQLite requires a default to add a NOT NULL column to a
// table that may already hold rows) - so every existing daily_tally row is PRESERVED and reads as zero counts
// until a v5 wake records one. It DROPS NOTHING and recreates nothing; the entry table is untouched. DEFAULT 0
// matches @ColumnInfo(defaultValue = "0") on TallyEntity, so runMigrationsAndValidate against schemas/5.json (on
// the emulator, MonReleveMigrationTest) passes rather than failing on a default mismatch. No coordinate, no
// accuracy value - the counts are the only new facts, and they are counts (D18).
val MIGRATION_4_5 =
    object : Migration(4, 5) {
        override fun migrate(connection: SQLiteConnection) {
            // Step 1: add the GPS check count, defaulting existing rows to 0 (they predate provider counting).
            connection.execSQL("ALTER TABLE `daily_tally` ADD COLUMN `gpsCheckCount` INTEGER NOT NULL DEFAULT 0")
            // Step 2: add the NETWORK check count, same default for existing rows.
            connection.execSQL("ALTER TABLE `daily_tally` ADD COLUMN `networkCheckCount` INTEGER NOT NULL DEFAULT 0")
        }
    }

// AN-FORECAST (R341 / R303 / R187). Creates weekly_rhythm (one row per account), leaving entry and
// daily_tally untouched. The DDL must match what Room generates for RhythmEntity at v6;
// MigrationTestHelper.runMigrationsAndValidate against schemas/6.json fails here, on the device, if it
// drifts. A real, non-destructive Migration (R305).
val MIGRATION_5_6 =
    object : Migration(5, 6) {
        override fun migrate(connection: SQLiteConnection) {
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS `weekly_rhythm` (" +
                    "`accountTag` TEXT NOT NULL, " +
                    "`monday` TEXT, " +
                    "`tuesday` TEXT, " +
                    "`wednesday` TEXT, " +
                    "`thursday` TEXT, " +
                    "`friday` TEXT, " +
                    "PRIMARY KEY(`accountTag`))",
            )
        }
    }

@Database(
    entities = [EntryEntity::class, TallyEntity::class, RhythmEntity::class],
    version = DATABASE_VERSION,
    exportSchema = true,
)
@ConstructedBy(MonReleveDatabaseConstructor::class)
abstract class MonReleveDatabase : RoomDatabase() {
    abstract fun entryDao(): EntryDao

    abstract fun tallyDao(): TallyDao

    abstract fun rhythmDao(): RhythmDao

    // KMP-2b (R394). The companion is EMPTY and exists only so :app can attach the builder to it as an
    // extension (MonReleveDatabaseBuilder.kt), which keeps every call site reading
    // MonReleveDatabase.get(context) exactly as it did before the move. Room.databaseBuilder takes a
    // Context, so the builder itself cannot live here.
    companion object
}

// KMP-2b (R394/R400). Room's KMP constructor. Room's compiler generates the `actual` for each target it
// processes, which is how a commonMain @Database is instantiated on a platform that has no reflection.
// On Android nothing reads it - Room.databaseBuilder(context, klass, name) still resolves the generated
// _Impl by name, exactly as before - so this changes nothing about how an existing install opens its
// database. It is declared NOW so the day a Mac runs kspKotlinIosArm64 no source file changes (R400).
//
// @Suppress("NO_ACTUAL_FOR_EXPECT") is Room's own documented form: the actual is generated by KSP per
// target, which the common metadata compilation cannot see.
@Suppress("NO_ACTUAL_FOR_EXPECT")
expect object MonReleveDatabaseConstructor : RoomDatabaseConstructor<MonReleveDatabase> {
    override fun initialize(): MonReleveDatabase
}
