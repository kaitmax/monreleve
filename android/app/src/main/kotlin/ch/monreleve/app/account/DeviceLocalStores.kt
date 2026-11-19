package ch.monreleve.app.account

import android.content.Context
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SessionEndingStore
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.processSessionEndSeam
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.SharedPrefsDossierCache
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.data.sync.processYearDownloads
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

// AN12 increment 2 (R295), moved here from MainActivity by AN-FORCED-SIGNOUT (R521). THE DEVICE'S LocalStore, BUILT
// ONCE, IN ONE PLACE. MainActivity builds it for the voluntary sign-out and the deletion; the process's session builds
// it for a session the server ended (SessionHolder.kt -> onServerEndedSession -> clearForSessionEnd). Two callers of
// one construction rather than two constructions, so the three scopes - sign-out, deletion, session end - clear the
// same stores by the same names and cannot drift apart (R206). Every store here is a stateless view of a
// SharedPreferences file the application owns, so building it again from the application context is building the
// same stores.
//
// clearAllTables() is derived from @Database, so it sweeps every Room table with no per-DAO list to drift, and runs off
// the main thread (it throws on it).

/**
 * AN12: the cacheDir subdirectory an export is written to before the share sheet. ONE home (R206): shareFile writes
 * here and the device erasure deletes here, so a rendered export - the account JSON is the whole record - cannot
 * outlive the account it belongs to (R289).
 */
internal const val EXPORTS_DIR = "exports"

/**
 * The device's LocalStore over the application's own stores - the one construction (see the header). AN-SESSION-END
 * (R1181): handed out as the [SessionEndingStore] over it, so every clear it performs ends the session through the seam
 * (auth/SessionEndSeam.kt) - the sampler stopped with it.
 */
internal fun deviceLocalStore(context: Context): SessionEndingStore {
    val app = context.applicationContext
    val store =
        DeviceLocalStore(
            tokenStore = KeystoreTokenStore(app),
            settingsStore = SharedPrefsSettingsStore(app),
            dossierCache = SharedPrefsDossierCache(app),
            pendingSignIn = SharedPrefsPendingSignInStore(app),
            accountStore = SharedPrefsAccountStore(app),
            // R315: the detection logging-mode cache, cleared on sign-out and deletion.
            detectionModeStore = SharedPrefsDetectionModeStore(app),
            clearRecord = {
                // AN-PULL: a year still arriving is stopped BEFORE the record is cleared, so it cannot land in the
                // store this sign-out empties (YearDownloads.stop says why it is a cancel, not a join).
                processYearDownloads.stop()
                withContext(Dispatchers.IO) { MonReleveDatabase.get(app).clearAllTables() }
            },
            cancelSync = { SyncScheduler.cancel(app) },
            clearExports = { File(app.cacheDir, EXPORTS_DIR).deleteRecursively() },
        )
    return SessionEndingStore(store, processSessionEndSeam(app))
}
