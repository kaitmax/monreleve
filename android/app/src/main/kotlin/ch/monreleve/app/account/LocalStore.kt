package ch.monreleve.app.account

import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.settings.DetectionModeStore
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
    // AN-FIX F4 / R303: the account scope cleared alongside the record it scopes. R303 is explicit that
    // R295's sign-out still clears everything - set-aside rows included - so the next holder of the phone
    // inherits a first-run device, not the previous account's tag pointing at cleared rows.
    private val accountStore: AccountStore,
    // AN-AUTO increment 2 (R315): the detection logging-mode cache (monreleve.detection). Cleared on sign-out
    // and deletion so the next account on a shared device does not inherit AUTO_DETECT; restored from
    // GET /api/v1/me on the next sign-in, like the calculation settings (R297).
    private val detectionModeStore: DetectionModeStore,
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
        // R315: the detection mode cache goes too, restored from /me on the next sign-in. No account on a
        // shared device inherits the previous person's AUTO_DETECT.
        detectionModeStore.clear()
        // AN-FIX F4 / R303: the account tag goes too, so no stale scope outlives the record it scoped.
        accountStore.clear()
    }

    override suspend fun clearForDeletion() {
        // clearForSignOut() now also clears the settings (R297), so deletion adds only the pending sign-in.
        clearForSignOut()
        pendingSignIn.clear()
    }

    /**
     * AN-FORCED-SIGNOUT (R521). A session the SERVER ended - a sign-out nobody asked for. Not R295's wipe: it KEEPS
     * the record and its account tag, so the days wait for the same person (R509) and stay invisible to anybody
     * else (R303). It clears what the next account must not inherit and the same account loses nothing by:
     *   - the calculation settings - every key GET /api/v1/me restores at the next sign-in (StartupDecider);
     *   - the cached releve - refetched from the server by the Releve's next load;
     *   - the exported files - the cached record in another form, never read back by the app;
     *   - the tokens - already cleared by SessionManager; cleared again because this scope must not depend on it.
     * NOT the detection file (monreleve.detection): it is one file swept by one clear(), and the loggingMode in it is
     * carried by /me but restored by nothing, beside six device-only keys /me does not carry at all - so it is a
     * QUESTION (REPORT-AN-FORCED-SIGNOUT.txt, R521), neither cleared nor kept silently. Not the queued sync: the
     * worker settles an unauthenticated drain without retrying (R523). Not the pending sign-in: not account data.
     *
     * NOT ON THE LocalStore INTERFACE, deliberately: the screens that hold a LocalStore - Parametres - only ever end
     * a session voluntarily or delete it. The one caller of this is the process's session (onServerEndedSession).
     */
    suspend fun clearForSessionEnd() {
        tokenStore.clear()
        dossierCache.clear()
        clearExports()
        settingsStore.clear()
    }
}
