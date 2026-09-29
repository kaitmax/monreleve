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
// SETTINGS ARE KEPT ON SIGN-OUT (PARKAN-28). The six calculation settings are configuration, not the fiscal
// record; keeping them lets a re-sign-in land on a computable Aujourd'hui without re-onboarding (which is what
// increment 5's walkthrough does). Deletion clears them - a deleted account returns to a first-run state.
// Whether sign-out should ALSO clear them for a cleaner account switch is PARKAN-28, a reversible one-line
// change (add settingsStore.clear() to clearForSignOut).

interface LocalStore {
    /** R295: sign-out clears the record, the cache, the tokens and any queued sync. Settings are kept. */
    suspend fun clearForSignOut()

    /** R289: deletion clears the sign-out set PLUS the settings and the pending sign-in - a first-run state. */
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
    }

    override suspend fun clearForDeletion() {
        clearForSignOut()
        settingsStore.clear()
        pendingSignIn.clear()
    }
}
