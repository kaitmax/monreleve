package ch.monreleve.app.data.local

import android.content.Context
import androidx.room.Room

// KMP-2b (R394). THE BUILDER STAYS IN :app, and this file is the whole of what stayed.
//
// MonReleveDatabase itself - the @Database, the three DAOs it exposes and the five migrations - moved
// to :shared commonMain so iOS can open the same store. Room.databaseBuilder takes a Context, which
// commonMain cannot see, so the construction half stays here: same database file name, same version,
// same five migrations in the same order, and still NO destructive fallback.
//
// IT IS AN EXTENSION ON THE COMPANION so every call site still reads MonReleveDatabase.get(context),
// exactly as it did before the move. That is deliberate rather than tidy: the point of this task is
// that nothing about how the app opens its database changes, and a call site that reads the same
// before and after is the cheapest possible evidence of it. The companion in commonMain is empty and
// exists only to receive this.
//
// Room.databaseBuilder(context, MonReleveDatabase::class.java, DATABASE_NAME) resolves the generated
// MonReleveDatabase_Impl BY NAME at runtime, and that is still how the Android build opens it. The
// @ConstructedBy/RoomDatabaseConstructor pair declared beside the @Database is for targets with no
// reflection (R400); it is not consulted here.
//
// THE SINGLETON IS THE ONE IT ALWAYS WAS: double-checked locking round a @Volatile holder, so every
// caller in the process shares one connection. It lives in a private object rather than a top-level
// var so the lock and the field are the same thing a reader can point at.
private object MonReleveDatabaseHolder {
    @Volatile
    var instance: MonReleveDatabase? = null
}

fun MonReleveDatabase.Companion.get(context: Context): MonReleveDatabase =
    MonReleveDatabaseHolder.instance ?: synchronized(MonReleveDatabaseHolder) {
        MonReleveDatabaseHolder.instance ?: Room.databaseBuilder(
            context.applicationContext,
            MonReleveDatabase::class.java,
            DATABASE_NAME,
        ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6)
            .build()
            .also { MonReleveDatabaseHolder.instance = it }
    }
