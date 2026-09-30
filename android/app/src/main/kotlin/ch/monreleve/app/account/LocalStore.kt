package ch.monreleve.app.account

import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.SettingsStore

// AN12 increment 2 (R295) and increment 3 (R289). The ONE place the device's account data is cleared, so the
// sign-out and deletion scopes cannot drift apart - deletion is a strict superset of sign-out, expressed here
// as clearForDeletion() calling clearForSignOut() and adding to it.
//
// R295 REVERSES PARKAN-2. Sign-out used to clear the tokens ALONE (SessionManager.signOut), leaving one
// person's fiscal record on a shared or re-signed-in device. It now clears the RECORD too: the Room entries -
// which ARE the mutation queue, since a pending mutation is just a row with syncState = PENDING (R217) - the
// detection tally, the cached releve, and any queued sync. The tokens go as well, so the next authenticated
// call is refused.
//
// R297 REVERSES PARKAN-28: SIGN-OUT NOW CLEARS THE SETTINGS TOO. The six calculation settings are held by the
// server, so a re-sign-in restores them from GET /api/v1/me before the onboarding decision (StartupDecider) -
// clearing them on sign-out costs the same person nothing and protects whoever holds the phone next. This
// closes the multi-user half PARKAN-28 left open: after sign-out nothing of one person's setup outlives the
// next. Deletion still adds the pending sign-in on top, so it remains a strict superset of sign-out.

interface LocalStore {
    /**
     * R295 + R297: sign-out clears the record, the cache, the tokens, any queued sync, the exported files AND
     * the settings. The pending sign-in is kept (it is not account data; deletion clears it).
     */
    suspend fun clearForSignOut()

    /** R289: deletion clears the sign-out set PLUS the pending sign-in - a first-run state. */
    suspend fun clearForDeletion()
}

// The Room clear, the sync cancel and the exports delete are lambdas (seams): each needs an Android Context,
// so injecting them as functions keeps this class - and the scope decision it encodes - JVM-testable against
// fakes. The prefs-backed stores are already interfaces. The parameters ARE the device's stores; a holder
// would only move the list (the MainShell suppression's reasoning).
@Suppress("LongParameterList")
class DeviceLocalStore(
    private val tokenStore: TokenStore,
    private val settingsStore: SettingsStore,
    private val dossierCache: DossierCache,
    private val pendingSignIn: PendingSignInStore,
    /** Clears the Room tables (entry + daily_tally) off the main thread - MonReleveDatabase.clearAllTables(). */
    private val clearRecord: suspend () -> Unit,
    /** Cancels the unique entries-sync work so a drain cannot repopulate a cleared queue. */
    private val cancelSync: () -> Unit,
    /**
     * Deletes the cacheDir/exports directory. A rendered export - the account JSON carries the ENTIRE record
     * (entries, trail, sessions), the releve PDF/CSV the whole year - is written there for the share sheet and
     * left on disk; it is the cached record in another form, the same class as the cached releve R295 names.
     * So sign-out clears it, and deletion inherits it (R289: the ErasureCensusTest keys on prefs/DB names and
     * is structurally blind to a file path, so this seam is the guard for it).
     */
    private val clearExports: () -> Unit,
) : LocalStore {
    override suspend fun clearForSignOut() {
        clearRecord()
        dossierCache.clear()
        tokenStore.clear()
        cancelSync()
        clearExports()
        // R297: the settings go too. Restored from GET /api/v1/me on the next sign-in (StartupDecider).
        settingsStore.clear()
    }

    override suspend fun clearForDeletion() {
        // clearForSignOut() now also clears the settings (R297), so deletion adds only the pending sign-in.
        clearForSignOut()
        pendingSignIn.clear()
    }
}
