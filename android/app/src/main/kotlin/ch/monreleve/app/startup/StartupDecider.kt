package ch.monreleve.app.startup

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.parseMeSettings

// R297. After sign-in, decide onboarding vs the main shell by consulting the SERVER's settings (GET
// /api/v1/me) BEFORE the decision. Sign-out now clears the device's settings (R297 reverses PARKAN-28), so a
// re-signed-in device holds none locally even when the account has them on the server; without this the person
// would be sent to re-onboard every time. JVM-testable: the /me fetch and the settings store are seams, and
// MainActivity maps AuthedOutcome to MeFetch and supplies the real SharedPreferences store.

enum class StartDestination { SIGN_IN, ONBOARDING, MAIN }

/** The outcome of the /me fetch, reduced to the three cases the start decision branches on. */
sealed interface MeFetch {
    data class Ok(val body: String) : MeFetch

    /** The session is gone - revoked, expired, or absent: the person must sign in again. */
    data object SessionGone : MeFetch

    /** The server could not be reached: fall through to onboarding; a save retries when the network returns. */
    data object Unreachable : MeFetch
}

/**
 * Reached only when the device is signed in but holds no local settings (a fresh account, or a re-sign-in
 * after R297's sign-out wipe). Fetches /me; if the server has settings, restores them and goes to the main
 * shell; if not, onboarding. A gone session goes to sign-in rather than onboarding, so a revoked or expired
 * token is never shown an onboarding form it would only PATCH into a 401.
 */
suspend fun decideStartAfterSignIn(
    fetchMe: suspend () -> MeFetch,
    store: SettingsStore,
): StartDestination =
    when (val outcome = fetchMe()) {
        is MeFetch.Ok -> {
            val settings = parseMeSettings(outcome.body)
            if (settings != null) {
                // Restore, so Aujourd'hui computes offline from the first launch and the person does not
                // re-onboard. The device never holds settings the server refused (same order as onboarding).
                store.save(settings)
                StartDestination.MAIN
            } else {
                StartDestination.ONBOARDING
            }
        }
        MeFetch.SessionGone -> StartDestination.SIGN_IN
        MeFetch.Unreachable -> StartDestination.ONBOARDING
    }

/**
 * Maps an authenticated GET's outcome to the three cases the start decision branches on. A gone session
 * (revoked/expired/absent) sends the person to sign-in, not onboarding, so a dead token is never shown a form
 * it would only PATCH into a 401; an unreachable server falls through to onboarding. Kept here beside MeFetch
 * (not in MainActivity) so the composition root stays within its function budget and the mapping is testable.
 */
fun meFetchOf(outcome: AuthedOutcome): MeFetch =
    when (outcome) {
        is AuthedOutcome.Ok -> MeFetch.Ok(outcome.body)
        AuthedOutcome.SessionEnded, AuthedOutcome.NoSession, AuthedOutcome.SessionExpired -> MeFetch.SessionGone
        AuthedOutcome.NetworkError -> MeFetch.Unreachable
    }
