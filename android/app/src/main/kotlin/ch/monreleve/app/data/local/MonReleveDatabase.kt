package ch.monreleve.app.data.local

import androidx.room.Database
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
}
