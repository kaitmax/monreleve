package ch.monreleve.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

// AN5 increment 1. The device's local store.
//
// exportSchema = true is the whole point of this increment: it writes
// schemas/ch.monreleve.app.data.local.MonReleveDatabase/1.json at compile time,
// which is committed and becomes the frozen contract (R187) that
// RoomSchemaContractTest reads back and MigrationTestHelper validates against a
// real database.
//
// NO @TypeConverter. Room persists an enum as its constant name directly, so
// EntryKind/Portion/Provenance/AbsenceReason/SyncState store as TEXT with no
// hand-written converter to drift - the same "one home" property that makes
// enum.name serve as both the column value and the wire value (WireEnums.kt).
//
// VERSION 1. A future column or table bumps this and adds a Migration; the
// androidTest harness exists from now precisely so that migration is proven
// against the exported schema before it ships, not discovered by a device that
// cannot be un-installed.

const val DATABASE_NAME = "monreleve.db"

const val DATABASE_VERSION = 1

@Database(
    entities = [EntryEntity::class],
    version = DATABASE_VERSION,
    exportSchema = true,
)
abstract class MonReleveDatabase : RoomDatabase() {
    abstract fun entryDao(): EntryDao

    companion object {
        @Volatile
        private var instance: MonReleveDatabase? = null

        /**
         * The on-disk store, one per process. Being on disk is what makes the
         * mutation queue survive process death (increment 2). NO destructive-migration
         * fallback: a schema change must ship a real Migration proven by the harness
         * (R187), never wipe a device's records.
         */
        fun get(context: Context): MonReleveDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    MonReleveDatabase::class.java,
                    DATABASE_NAME,
                ).build().also { instance = it }
            }
    }
}
