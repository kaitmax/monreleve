package ch.monreleve.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

// AN5 increment 1 / AN6a increment 3. The device's local store.
//
// exportSchema = true writes schemas/<db>/<version>.json at compile time, committed and made
// the frozen contract (R187) that RoomSchemaContractTest reads back and MigrationTestHelper
// validates against a real database.
//
// NO @TypeConverter. Room persists an enum as its constant name directly, so the wire enums
// store as TEXT with no hand-written converter to drift.
//
// VERSION 2 (AN6a). Version 1 was the entry store (AN5); version 2 adds the detection tally
// (AN6a increment 3). MIGRATION_1_2 creates the daily_tally table - the migration harness's
// FIRST REAL EXECUTION, the loop AN5's report left open. There is NO destructive-migration
// fallback: a schema change ships a real Migration proven by the harness, never wipes a
// device's records.

const val DATABASE_NAME = "monreleve.db"

const val DATABASE_VERSION = 2

// Adds the daily_tally table. The DDL matches what Room generates for TallyEntity;
// MigrationTestHelper.runMigrationsAndValidate fails if it drifts from schemas/2.json.
val MIGRATION_1_2 =
    object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
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

@Database(
    entities = [EntryEntity::class, TallyEntity::class],
    version = DATABASE_VERSION,
    exportSchema = true,
)
abstract class MonReleveDatabase : RoomDatabase() {
    abstract fun entryDao(): EntryDao

    abstract fun tallyDao(): TallyDao

    companion object {
        @Volatile
        private var instance: MonReleveDatabase? = null

        fun get(context: Context): MonReleveDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    MonReleveDatabase::class.java,
                    DATABASE_NAME,
                ).addMigrations(MIGRATION_1_2).build().also { instance = it }
            }
    }
}
