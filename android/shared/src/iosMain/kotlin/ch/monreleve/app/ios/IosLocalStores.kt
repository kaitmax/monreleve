package ch.monreleve.app.ios

import androidx.room.PooledConnection
import androidx.room.Transactor
import androidx.room.execSQL
import androidx.room.useReaderConnection
import androidx.room.useWriterConnection
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SessionEndSeam
import ch.monreleve.app.auth.SessionEndingStore
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.SettingsStore

// IOS-2f R889. THE iOS COMPOSITION OF THE DEVICE'S LocalStore - Android's deviceLocalStore(context), with iOS's stores.
//
// THE CLASS IS ANDROID'S OWN. account/DeviceLocalStore.kt lives ONCE, in :shared commonMain at the same package
// (IOS-MOVE-TWINS R1240, closing PARK-IF4 - until then this was a byte-identical iosMain copy of :app's file).
// MovedTwinsFenceTest (androidUnitTest) fails if a copy reappears in :app or iosMain. So the three
// scopes - sign-out (R295/R297/R303), deletion (R289) and the server-ended session (R521/R527) - clear on iOS exactly
// the stores they clear on Android, by the same lines of code; only the seams below are iOS's.
//
// THE SEAMS, EACH THE iOS COUNTERPART OF deviceLocalStore's:
//   tokenStore      KeychainTokenStore                 (Android: KeystoreTokenStore)
//   settingsStore   UserDefaultsSettingsStore          (SharedPrefsSettingsStore)
//   dossierCache    FileDossierCache                   (SharedPrefsDossierCache)
//   pendingSignIn   KeychainPendingSignInStore         (SharedPrefsPendingSignInStore)
//   accountStore    KeychainAccountStore               (SharedPrefsAccountStore)
//   detectionMode   INJECTED - iOS has no persistent detection file yet (R894 lists it); the host passes one
//   clearRecord     clearIosRecord(database)           (MonReleveDatabase.clearAllTables())
//   cancelSync      the IosSyncTrigger's cancel()       (SyncScheduler.cancel - R890)
//   clearExports    the IosExportFiles directory clear (File(cacheDir, EXPORTS_DIR).deleteRecursively() - R891)
// Android's clearRecord first stops a year still downloading (AN-PULL, processYearDownloads.stop()); iOS stops its year
// downloads (IOS-SHELL-3 R1371) through the session-end seam instead (iosSessionEndSeam's stopYearDownloads), which
// the wrapper runs before this clear on every ending path - so clearRecord here stays the record alone.
//
// IOS-MOVE-SEAM (R1281, closing I0's FINDING 2). THE STORE IS HANDED OUT THROUGH THE "SESSION ENDED" SEAM, as Android's
// is: the commonMain wrapper SessionEndingStore (auth/SessionEndSeam.kt) over iOS's seam, iosSessionEndSeam
// (ios/IosSessionEndSeam.kt) - this app's PENDING local notification requests removed, then the scope cleared in a
// finally. Before, this returned the bare DeviceLocalStore, so a reminder scheduled ahead would have outlived a
// sign-out, a deletion or a server-ended session. SessionEndSeamFenceTest (R1282) holds this as iOS's ONE construction.

// The parameters ARE the device's stores and seams, as DeviceLocalStore's own are; a holder would only move the list.

/**
 * The device's LocalStore over iOS's own stores - the one construction (Android's deviceLocalStore) - handed out
 * through the "session ended" seam (R1281). The defaults are the production stores and seam; tests pass test-scoped
 * ones (a unique Keychain service, a UserDefaults suite, a temporary directory, a seam action that touches no
 * notification centre) through the same parameters, so the wiring under test is this function's.
 */
@Suppress("LongParameterList")
fun iosDeviceLocalStore(
    database: MonReleveDatabase,
    syncTrigger: IosSyncTrigger,
    exportFiles: IosExportFiles,
    detectionModeStore: DetectionModeStore,
    tokenStore: TokenStore = KeychainTokenStore(),
    settingsStore: SettingsStore = UserDefaultsSettingsStore(),
    dossierCache: DossierCache = FileDossierCache(),
    pendingSignIn: PendingSignInStore = KeychainPendingSignInStore(),
    accountStore: AccountStore = KeychainAccountStore(),
    sessionEndSeam: SessionEndSeam = iosSessionEndSeam(),
): SessionEndingStore =
    SessionEndingStore(
        DeviceLocalStore(
            tokenStore = tokenStore,
            settingsStore = settingsStore,
            dossierCache = dossierCache,
            pendingSignIn = pendingSignIn,
            accountStore = accountStore,
            detectionModeStore = detectionModeStore,
            clearRecord = { clearIosRecord(database) },
            cancelSync = { syncTrigger.cancel() },
            clearExports = { exportFiles.clear() },
        ),
        sessionEndSeam,
    )

// Room's own bookkeeping, never part of the record: its identity hash (room_master_table) and SQLite's internals.
// Room's invalidation log is a TEMP table (sqlite_temp_master), so it is not listed here at all.
private const val RECORD_TABLES_SQL =
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' " +
        "AND name <> 'room_master_table' AND name <> 'android_metadata' ORDER BY name"

/**
 * The record's tables, DERIVED from the database itself - every table but Room's and SQLite's own - so a table a later
 * schema adds is swept without a list to update (clearAllTables is derived from @Database for the same reason).
 */
internal suspend fun recordTables(database: MonReleveDatabase): List<String> =
    database.useReaderConnection { connection -> connection.recordTableNames() }

private suspend fun PooledConnection.recordTableNames(): List<String> =
    usePrepared(RECORD_TABLES_SQL) { statement ->
        buildList { while (statement.step()) add(statement.getText(0)) }
    }

/**
 * Android's MonReleveDatabase.clearAllTables() on iOS. Room 2.7.2 offers clearAllTables on Android only
 * (RoomDatabase.android.kt's performClear); its sequence is reproduced: every record table emptied in ONE IMMEDIATE
 * transaction (the schema has no foreign key, so no defer_foreign_keys), then, outside it, a full WAL checkpoint and
 * VACUUM, so the deleted rows do not linger in the file's free pages - the person's record must not outlive the
 * sign-out in any form (R295).
 */
suspend fun clearIosRecord(database: MonReleveDatabase) {
    database.useWriterConnection { connection ->
        connection.withTransaction(Transactor.SQLiteTransactionType.IMMEDIATE) {
            recordTableNames().forEach { table -> execSQL("DELETE FROM `$table`") }
        }
        connection.execSQL("PRAGMA wal_checkpoint(FULL)")
        connection.execSQL("VACUUM")
    }
}
