package ch.monreleve.app.startup

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.onboarding.OnboardingPlan
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.onboarding.onboardingPlanFor
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.isMeAnswer
import ch.monreleve.app.settings.parseLoggingMode
import ch.monreleve.app.settings.parseMeSettings
import ch.monreleve.app.settings.parseMeView

// R297 / R335. After sign-in, decide onboarding vs the main shell by consulting the SERVER's settings (GET
// /api/v1/me) BEFORE the decision. Sign-out now clears the device's settings (R297 reverses PARKAN-28), so a
// re-signed-in device holds none locally even when the account has them on the server; without this the person
// would be sent to re-onboard every time. R335: the decision is now keyed on COMPLETENESS (every field the
// releve needs), not on canton alone - a partial account goes to onboarding carrying the prefill of only the
// steps it is missing. JVM-testable: the /me fetch and the settings store are seams, and MainActivity maps
// AuthedOutcome to MeFetch and supplies the real SharedPreferences store.
//
// AN-SIGNIN-RESOLVE (R1160, R1161). ONBOARDING ONLY ON A POSITIVE ANSWER THAT THE SETTINGS ARE ABSENT. Until this
// task an unreachable server, a non-200 and an unreadable body all ran the FULL onboarding with nothing prefilled -
// the "safe direction" this file used to name. R1160 measured what that costs (emulator API 36, minified and debug
// builds alike): the network changed under a pending /me, the transport threw, and a returning person whose settings
// were complete on the server was shown step 1 with an EMPTY form - which, finished, PATCHes over those settings.
// The server meanwhile logged its GET /me 200: it answered into a socket the phone had already lost. So "the server
// could not be read" is now its own outcome, Unresolved, which waits and offers a retry and writes NOTHING; only a
// 200 that is recognisably a /me answer (isMeAnswer) reaches a plan, and only its canton-less form - the one the
// server gives an account that never onboarded - runs the full flow.
//
// R1162 (PARK-E3). Every positive answer also hands the server's logging mode, read fail-closed (parseLoggingMode:
// AUTO_DETECT only with a consent stamp), to [decideStartAfterSignIn]'s restoreMode - BEFORE the settings are cached,
// because cached settings are what send the next launch straight to the shell, past RESOLVING: a process death
// between the two writes then re-runs the resolve instead of opening the shell with the mode never restored.

/** Where to send the person after sign-in; Onboard carries the prefill (R335) - the steps owed and their values. */
sealed interface StartDecision {
    data object Main : StartDecision

    data object SignIn : StartDecision

    data class Onboard(val prefill: OnboardingSnapshot) : StartDecision

    /**
     * R1161: the server gave no answer this phone can act on - nothing arrived, or what arrived was not a GET /me
     * answer. RESOLVING stays on screen with a retry. Neither onboarding nor the shell: either would be a guess about
     * settings the server holds, and onboarding's guess overwrites them when it is finished.
     */
    data class Unresolved(val cause: UnresolvedCause) : StartDecision
}

/** R1161: why RESOLVING could not decide - which is what the retry line says to the person. */
enum class UnresolvedCause {
    /** Nothing came back: no network, a network that changed mid-request, a timeout. */
    UNREACHABLE,

    /** Something came back, and it was not a GET /me answer: a non-200, a foreign or truncated body. */
    UNREADABLE,
}

/** R1161: the line RESOLVING shows for this cause - the sign-in's own failure lines, referenced, not copied (R206). */
fun UnresolvedCause.message(): String =
    when (this) {
        UnresolvedCause.UNREACHABLE -> SignInCopy.NETWORK_ERROR
        UnresolvedCause.UNREADABLE -> SignInCopy.GENERIC_ERROR
    }

/** The outcome of the /me fetch, reduced to the three cases the start decision branches on. */
sealed interface MeFetch {
    /** An answer that was not a 401, with its status (R1161: only a 200 can be read as the account's settings). */
    data class Ok(val status: Int, val body: String) : MeFetch

    /** The session is gone - revoked, expired, or absent: the person must sign in again. */
    data object SessionGone : MeFetch

    /** The server could not be reached. R1161: Unresolved - never onboarding. */
    data object Unreachable : MeFetch
}

private const val HTTP_OK = 200

/**
 * Reached only when the device is signed in but holds no COMPLETE local settings (a fresh account, a re-sign-in
 * after R297's sign-out wipe, or a partial account missing a releve field). Fetches /me; a COMPLETE account is
 * restored and goes to the main shell; an incomplete one goes to onboarding carrying the prefill of just the
 * steps it is missing (R335). A gone session goes to sign-in rather than onboarding, so a revoked or expired
 * token is never shown an onboarding form it would only PATCH into a 401. R1161: anything that is not a 200 /me
 * answer is [StartDecision.Unresolved], with nothing written. R1162: a positive answer hands the server's mode to
 * [restoreMode] first.
 */
suspend fun decideStartAfterSignIn(
    fetchMe: suspend () -> MeFetch,
    store: SettingsStore,
    restoreMode: (LoggingMode) -> Unit,
): StartDecision =
    when (val outcome = fetchMe()) {
        is MeFetch.Ok -> decideOn(outcome, store, restoreMode)
        MeFetch.SessionGone -> StartDecision.SignIn
        MeFetch.Unreachable -> StartDecision.Unresolved(UnresolvedCause.UNREACHABLE)
    }

private fun decideOn(
    outcome: MeFetch.Ok,
    store: SettingsStore,
    restoreMode: (LoggingMode) -> Unit,
): StartDecision {
    val unreadable = StartDecision.Unresolved(UnresolvedCause.UNREADABLE)
    val view = parseMeView(outcome.body)
    if (outcome.status != HTTP_OK || !isMeAnswer(outcome.body) || view == null) return unreadable
    return when (val plan = onboardingPlanFor(view)) {
        // Complete means every field is present; the strict reader still has the last word. Read BEFORE anything is
        // written, so a body it refuses leaves the phone exactly as it was.
        OnboardingPlan.Complete ->
            parseMeSettings(outcome.body)?.let { settings ->
                restoreMode(parseLoggingMode(outcome.body))
                // Restore, so Aujourd'hui computes offline and the person does not re-onboard.
                store.save(settings)
                StartDecision.Main
            } ?: unreadable
        is OnboardingPlan.Onboard -> {
            // A partial account's onboarding never asks the mode (Completeness.kt), so the server's stands - restored
            // here; a brand-new account's is the server's MANUAL default.
            restoreMode(parseLoggingMode(outcome.body))
            StartDecision.Onboard(plan.prefill)
        }
    }
}

/**
 * Maps an authenticated GET's outcome to the three cases the start decision branches on, the status kept (R1161). A
 * gone session (revoked/expired/absent) sends the person to sign-in, not onboarding, so a dead token is never shown a
 * form it would only PATCH into a 401; an unreachable server is Unresolved. Kept here beside MeFetch (not in
 * MainActivity) so the composition root stays within its function budget and the mapping is testable.
 */
fun meFetchOf(outcome: AuthedOutcome): MeFetch =
    when (outcome) {
        is AuthedOutcome.Ok -> MeFetch.Ok(outcome.status, outcome.body)
        AuthedOutcome.SessionEnded, AuthedOutcome.NoSession, AuthedOutcome.SessionExpired -> MeFetch.SessionGone
        AuthedOutcome.NetworkError -> MeFetch.Unreachable
    }
