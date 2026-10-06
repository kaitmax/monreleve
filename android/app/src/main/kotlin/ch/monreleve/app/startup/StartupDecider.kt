package ch.monreleve.app.startup

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.onboarding.OnboardingPlan
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.onboarding.freshOnboardingSnapshot
import ch.monreleve.app.onboarding.onboardingPlanFor
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.parseMeSettings
import ch.monreleve.app.settings.parseMeView

// R297 / R335. After sign-in, decide onboarding vs the main shell by consulting the SERVER's settings (GET
// /api/v1/me) BEFORE the decision. Sign-out now clears the device's settings (R297 reverses PARKAN-28), so a
// re-signed-in device holds none locally even when the account has them on the server; without this the person
// would be sent to re-onboard every time. R335: the decision is now keyed on COMPLETENESS (every field the
// releve needs), not on canton alone - a partial account goes to onboarding carrying the prefill of only the
// steps it is missing. JVM-testable: the /me fetch and the settings store are seams, and MainActivity maps
// AuthedOutcome to MeFetch and supplies the real SharedPreferences store.

/** Where to send the person after sign-in; Onboard carries the prefill (R335) - the steps owed and their values. */
sealed interface StartDecision {
    data object Main : StartDecision

    data object SignIn : StartDecision

    data class Onboard(val prefill: OnboardingSnapshot) : StartDecision
}

/** The outcome of the /me fetch, reduced to the three cases the start decision branches on. */
sealed interface MeFetch {
    data class Ok(val body: String) : MeFetch

    /** The session is gone - revoked, expired, or absent: the person must sign in again. */
    data object SessionGone : MeFetch

    /** The server could not be reached: fall through to onboarding; a save retries when the network returns. */
    data object Unreachable : MeFetch
}

/**
 * Reached only when the device is signed in but holds no COMPLETE local settings (a fresh account, a re-sign-in
 * after R297's sign-out wipe, or a partial account missing a releve field). Fetches /me; a COMPLETE account is
 * restored and goes to the main shell; an incomplete one goes to onboarding carrying the prefill of just the
 * steps it is missing (R335). A gone session goes to sign-in rather than onboarding, so a revoked or expired
 * token is never shown an onboarding form it would only PATCH into a 401; an unreachable server runs the full
 * flow (a save retries when the network returns).
 */
suspend fun decideStartAfterSignIn(
    fetchMe: suspend () -> MeFetch,
    store: SettingsStore,
): StartDecision =
    when (val outcome = fetchMe()) {
        is MeFetch.Ok ->
            when (val plan = onboardingPlanFor(parseMeView(outcome.body))) {
                OnboardingPlan.Complete -> {
                    // Complete means every field is present, so parseMeSettings (the stricter reader) is non-null.
                    // Restore, so Aujourd'hui computes offline and the person does not re-onboard.
                    val settings = parseMeSettings(outcome.body)
                    if (settings != null) {
                        store.save(settings)
                        StartDecision.Main
                    } else {
                        // Defensive only (should not happen): complete-by-fields but unparseable by the strict
                        // reader - run the full flow rather than crash. Nothing is saved locally.
                        StartDecision.Onboard(freshOnboardingSnapshot())
                    }
                }
                is OnboardingPlan.Onboard -> StartDecision.Onboard(plan.prefill)
            }
        MeFetch.SessionGone -> StartDecision.SignIn
        MeFetch.Unreachable -> StartDecision.Onboard(freshOnboardingSnapshot())
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
