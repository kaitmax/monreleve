package ch.monreleve.app.ios

import androidx.room.useWriterConnection
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.SettingsStore

// IOS-2f R889. THE iOS COMPOSITION OF THE DEVICE'S LocalStore - Android's deviceLocalStore(context), with iOS's stores.
//
// THE CLASS IS ANDROID'S OWN. account/DeviceLocalStore.kt in iosMain is a BYTE-IDENTICAL copy of :app's file at the
// same package and name (0 files under android/app may change, so it cannot move to commonMain here). The JVM guard
// IosAndroidTwinsTest (androidUnitTest) fails the moment the two differ, and a later move of :app's file to
// commonMain fails iOS compilation with a redeclaration until this copy is deleted (PARKED, R893). So the three
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
// Android's clearRecord first stops a year still downloading (AN-PULL, processYearDownloads.stop()); iOS has no year
// download yet, so there is nothing to stop - the iOS host that adds one owes that line here (PARKED, R893).

// The parameters ARE the device's stores and seams, as DeviceLocalStore's own are; a holder would only move the list.

/**
 * The device's LocalStore over iOS's own stores - the one construction (Android's deviceLocalStore). The defaults are
 * the production stores; tests pass test-scoped ones (a unique Keychain service, a UserDefaults suite, a temporary
 * directory) through the same parameters, so the wiring under test is this function's.
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
): DeviceLocalStore =
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
    database.useWriterConnection { connection ->
        connection.usePrepared(RECORD_TABLES_SQL) { statement ->
            buildList { while (statement.step()) add(statement.getText(0)) }
        }
    }

// RED STUB (IOS-2f run 1): clears nothing. Replaced by the sweep at the R889 code step.

/**
 * Android's MonReleveDatabase.clearAllTables() on iOS. Room 2.7.2 offers clearAllTables on Android only
 * (RoomDatabase.android.kt's performClear); its sequence is reproduced: every record table emptied in ONE IMMEDIATE
 * transaction (the schema has no foreign key, so no defer_foreign_keys), then, outside it, a full WAL checkpoint and
 * VACUUM, so the deleted rows do not linger in the file's free pages - the person's record must not outlive the
 * sign-out in any form (R295).
 */
@Suppress("UnusedParameter")
suspend fun clearIosRecord(database: MonReleveDatabase) = Unit
