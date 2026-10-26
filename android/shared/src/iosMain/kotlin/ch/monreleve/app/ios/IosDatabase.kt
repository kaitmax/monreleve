package ch.monreleve.app.ios

import androidx.room.Room
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import ch.monreleve.app.data.local.DATABASE_NAME
import ch.monreleve.app.data.local.MIGRATION_1_2
import ch.monreleve.app.data.local.MIGRATION_2_3
import ch.monreleve.app.data.local.MIGRATION_3_4
import ch.monreleve.app.data.local.MIGRATION_4_5
import ch.monreleve.app.data.local.MIGRATION_5_6
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.MonReleveDatabaseConstructor
import kotlinx.coroutines.Dispatchers

// IOS-1a R567. THE DATABASE ON iOS: monreleve.db under Application Support, the SAME name, version 6 and
// migrations as Android. The only differences are the ones Room KMP requires of a target with no Android
// framework: the file is named by a PATH (there is no Context), the constructor is the generated
// MonReleveDatabaseConstructor (no reflection on Kotlin/Native), and the driver is BundledSQLiteDriver - the
// operator-approved dependency (REPORT-KMP-UP2 R548) - because Room KMP has no other SQLite on iOS that
// is the same SQLite as Android's across OS versions. Android keeps its own SQLite and sets no driver.
//
// BACKUP: the database file keeps the system default (included in a device backup). It is the person's own
// record of their days, and restoring it onto a new phone is what a backup is for; iOS-1c rules on it with the
// app's privacy notice in hand (R572). The token (Keychain, ThisDeviceOnly) and the cached releve (excluded)
// are the two that must not travel, and neither is in this file.

/** Opens (creating and migrating if need be) the app's database. [directoryPath] defaults to Application Support. */
fun buildIosDatabase(
    directoryPath: String = applicationSupportPath(),
    fileName: String = DATABASE_NAME,
): MonReleveDatabase =
    Room.databaseBuilder<MonReleveDatabase>(
        name = "$directoryPath/$fileName",
        factory = { MonReleveDatabaseConstructor.initialize() },
    )
        .setDriver(BundledSQLiteDriver())
        .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6)
        .setQueryCoroutineContext(Dispatchers.Default)
        .build()
