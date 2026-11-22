@file:Suppress("TooManyFunctions")

package ch.monreleve.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.CodeController
import ch.monreleve.app.auth.CodePhase
import ch.monreleve.app.auth.CodeSnapshot
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.SessionEnds
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.auth.SignInPhase
import ch.monreleve.app.auth.SignInSnapshot
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.auth.heldDays
import ch.monreleve.app.auth.sessionClosedByServer
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.startup.StartDecision
import ch.monreleve.app.startup.UnresolvedCause
import ch.monreleve.app.startup.decideStartAfterSignIn
import ch.monreleve.app.startup.meFetchOf
import ch.monreleve.app.startup.message
import ch.monreleve.app.ui.screens.signin.CodeActions
import ch.monreleve.app.ui.screens.signin.CodeScreen
import ch.monreleve.app.ui.screens.signin.RequestLinkScreen
import ch.monreleve.app.ui.screens.signin.SignInActions
import ch.monreleve.app.ui.screens.signin.WelcomeScreen
import ch.monreleve.app.ui.shell.ResolvingScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.flowOf

// IOS-SHELL-1 (R1328). THE SHELL'S ROUTES, ONCE, IN COMMON CODE: the composable switch over the destination (SIGN_IN /
// RESOLVING / ONBOARDING / MAIN, and RESOLVING's StartDecision), the sign-in flow's two routes (SignInRoute, CodeRoute)
// and RESOLVING's route - MOVED from :app's MainActivity.kt, where they were private functions of the composition root,
// with Android's behaviour unchanged. What was Android's in them is now a PARAMETER the platform hands in, and nothing
// else changed:
//   - `pending` is the common PendingSignInStore (census N3), not :app's concrete SharedPrefs store - the same object
//     is passed;
//   - LocalContext's three uses: the legal pages and the mail app (onOpenLegal / onOpenMail - Android's openLegal and
//     openMail, a Custom Tab and an Intent) and the sign-in's drain (syncNow - Android's buildSyncEngine);
//   - RESOLVING's two phone-side writes (restoreMode / restoreReminder - Android's restoreLoggingMode and its
//     SharedPrefs evening store), and its year download (afterSignIn - Android's processYearDownloads);
//   - ONBOARDING and MAIN are SLOTS: each platform's own route (Android's OnboardingRoute and MainShell stay in
//     MainActivity - their OS permission launchers and Android-only facilities are interleaved with the controllers,
//     so they do not move without bending; IOS-SHELL-1's report names them, and iOS writes its own).
// The update gate (A4) stays OUTSIDE, in MainActivity, wrapped around this switch: it is Android's (iOS Ruling 3 Q3).
// The comments below are MainActivity's own, carried with the code they describe.

/**
 * The shell's one destination switch (R310/R520/R521), common to both platforms. [start] is the authority, recomputed
 * by the platform from the session on every launch. ONBOARDING and MAIN are the platform's own routes, as slots.
 */
@Suppress("LongParameterList", "LongMethod")
@Composable
fun ShellRouter(
    start: Destination,
    session: SessionManager,
    api: AuthApi,
    tokenStore: TokenStore,
    pending: PendingSignInStore,
    accountStore: AccountStore,
    repository: EntryRepository,
    settingsStore: SettingsStore,
    scope: CoroutineScope,
    sessionEnds: SessionEnds,
    syncNow: suspend () -> Unit,
    onOpenLegal: (LegalPage) -> Unit,
    onOpenMail: () -> Unit,
    restoreMode: (LoggingMode) -> Unit,
    restoreReminder: (Boolean) -> Unit,
    afterSignIn: suspend () -> Unit,
    onboarding: @Composable (seed: OnboardingSnapshot?, onDone: () -> Unit) -> Unit,
    main: @Composable (onSignedOut: () -> Unit) -> Unit,
) {
    // AN-STATE (R310): the destination survives a rebuild, reconciled against the session (see
    // sessionReconciled). `start`, recomputed in onCreate from the session, is the authority.
    // AN-FORCED-SIGNOUT (R521): reconciled AS IT IS RESTORED (destinationSaver), so a restored MAIN
    // with no session never composes - the LaunchedEffect below is then a no-op kept for its R310 role.
    var destination by rememberSaveable(stateSaver = destinationSaver(start)) { mutableStateOf(start) }
    // R335: the onboarding prefill (the steps owed + their /me values) the RESOLVING step computes,
    // carried into OnboardingRoute. Saveable so a rebuild during onboarding keeps the same subset.
    var onboardingSeed by rememberSaveable { mutableStateOf<OnboardingSnapshot?>(null) }
    LaunchedEffect(Unit) { destination = sessionReconciled(destination, start) }
    // AN-FORCED-SIGNOUT (R520): a session the SERVER ends - met by a screen or by the worker, in this
    // process (R507) - takes the person to sign-in from whatever screen is open (PARK-T1).
    LaunchedEffect(Unit) {
        sessionEnds.ends.collect {
            destination = destinationAfterSessionEnd(destination, session.isSignedIn())
        }
    }
    when (destination) {
        Destination.SIGN_IN -> {
            // R520: arrived here because the server ended the session? Read when sign-in opens, from
            // the stores (SessionEnds.kt) - and then the days still waiting, counted from the record
            // as the screen renders (R181), the current account's own (R303).
            val closed =
                remember { sessionClosedByServer(session.isSignedIn(), accountStore.current()) }
            val pendingRows by
                remember { if (closed) repository.observePending() else flowOf(null) }
                    .collectAsState(initial = null)
            SignInRoute(
                api,
                tokenStore,
                pending,
                accountStore,
                scope,
                sessionClosed = closed,
                sessionClosedHeldDays = pendingRows?.let(::heldDays),
                syncNow = syncNow,
                onOpenLegal = onOpenLegal,
                onOpenMail = onOpenMail,
                onSignedIn = { destination = Destination.RESOLVING },
            )
        }
        Destination.RESOLVING -> {
            // R481: every route here follows a sign-in (the code path's onSignedIn, or the link's
            // relaunch with its settings cleared), so this is where BOTH years come down. It does
            // not block the /me decision below; the shell shows its outcome (R484).
            LaunchedEffect(Unit) { afterSignIn() }
            ResolvingRoute(session, settingsStore, restoreMode, restoreReminder) { decision ->
                when (decision) {
                    StartDecision.Main -> destination = Destination.MAIN
                    StartDecision.SignIn -> destination = Destination.SIGN_IN
                    is StartDecision.Onboard -> {
                        onboardingSeed = decision.prefill
                        destination = Destination.ONBOARDING
                    }
                    is StartDecision.Unresolved -> Unit
                }
            }
        }
        Destination.ONBOARDING -> onboarding(onboardingSeed) { destination = Destination.MAIN }
        // R295/R289: sign-out or deletion has wiped the local store; return to first-run.
        // A re-auth restarts this activity, and `start` recomputes the destination.
        Destination.MAIN -> main { destination = Destination.SIGN_IN }
    }
}

// AN-ONBOARD: the sign-in flow is now three screens - Bienvenue (fresh install), the email request, and the
// six-digit code - the second way in beside the App Link callback (R195 leaves the callback untouched). On a
// code SIGNED it hands off to RESOLVING exactly as the callback's activity restart does: the start decision
// (GET /api/v1/me) then routes to onboarding or the shell. The welcome is shown only while unsigned.
// IOS-SHELL-1 (R1322): on iOS the code is the ONLY way in (iOS Ruling 3 Q2) - this flow ends at the code screen.
internal enum class SignInStep { WELCOME, EMAIL, CODE }

// LongParameterList suppressed as MainShell/MainGraph are: this is the composition root wiring the sign-in
// flow's stores and seams, not tangled logic (the ui/ screens bundle their callbacks into Actions instead,
// which the no-literal fence requires there - this file is the root, where @Suppress is permitted).

/** The sign-in flow: Bienvenue, the address, then the six-digit code; [onSignedIn] once the code is accepted. */
@Suppress("LongParameterList")
@Composable
fun SignInRoute(
    api: AuthApi,
    tokenStore: TokenStore,
    pending: PendingSignInStore,
    accountStore: AccountStore,
    scope: CoroutineScope,
    // AN-FORCED-SIGNOUT (R520): the server ended the session - open on the sign-in screen itself, with the notice,
    // never on Bienvenue, which is a first-run pitch and says nothing of why the person is here.
    sessionClosed: Boolean,
    sessionClosedHeldDays: Int?,
    syncNow: suspend () -> Unit,
    onOpenLegal: (LegalPage) -> Unit,
    onOpenMail: () -> Unit,
    onSignedIn: () -> Unit,
) {
    var step by rememberSaveable { mutableStateOf(if (sessionClosed) SignInStep.EMAIL else SignInStep.WELCOME) }
    // AN-STATE (R310): the typed email and a stable phase survive a rebuild.
    var saved by rememberSaveable { mutableStateOf<SignInSnapshot?>(null) }
    val controller = remember { SignInController(api, pending, scope, restored = saved) }
    val state by controller.state.collectAsState()
    LaunchedEffect(controller) { controller.state.collect { saved = SignInSnapshot(it.email, it.phase) } }
    // The request succeeded (one answer whatever the truth, docs 1.5) -> move to the code screen.
    LaunchedEffect(state.phase) { if (state.phase == SignInPhase.LINK_SENT) step = SignInStep.CODE }

    when (step) {
        SignInStep.WELCOME -> WelcomeScreen(onStart = { step = SignInStep.EMAIL })
        SignInStep.EMAIL ->
            RequestLinkScreen(
                state = state,
                // R520: named only while the server-ended state holds; null on any other arrival.
                sessionClosedHeldDays = if (sessionClosed) sessionClosedHeldDays else null,
                actions =
                    SignInActions(
                        onEmailChange = controller::onEmailChange,
                        onSubmit = controller::submit,
                        onRetry = controller::retry,
                        onBack = { step = SignInStep.WELCOME },
                        onOpenCgu = { onOpenLegal(LegalPage.TERMS) },
                        onOpenPrivacy = { onOpenLegal(LegalPage.PRIVACY) },
                    ),
            )
        SignInStep.CODE ->
            CodeRoute(
                api = api,
                tokenStore = tokenStore,
                pending = pending,
                accountStore = accountStore,
                email = state.email.trim(),
                scope = scope,
                syncNow = syncNow,
                onModify = { step = SignInStep.EMAIL },
                onOpenMail = onOpenMail,
                onSignedIn = onSignedIn,
            )
    }
}

/** The six-digit code screen over its controller; [onSignedIn] once the code is accepted (CodePhase.SIGNED). */
@Suppress("LongParameterList")
@Composable
fun CodeRoute(
    api: AuthApi,
    tokenStore: TokenStore,
    pending: PendingSignInStore,
    accountStore: AccountStore,
    email: String,
    scope: CoroutineScope,
    syncNow: suspend () -> Unit,
    onModify: () -> Unit,
    onOpenMail: () -> Unit,
    onSignedIn: () -> Unit,
) {
    // AN-STATE (R310): the typed digits and a stable phase survive a rebuild.
    var saved by rememberSaveable { mutableStateOf<CodeSnapshot?>(null) }
    // AN-TOKEN-RACE (R509): the sign-in sends the account's held days through the worker's own drain (R206).
    val controller =
        remember {
            CodeController(
                api,
                tokenStore,
                pending,
                accountStore,
                email,
                scope,
                syncNow = syncNow,
                restored = saved,
            )
        }
    val state by controller.state.collectAsState()
    LaunchedEffect(controller) { controller.state.collect { saved = CodeSnapshot(it.code, it.phase) } }
    LaunchedEffect(state.phase) { if (state.phase == CodePhase.SIGNED) onSignedIn() }

    CodeScreen(
        email = email,
        state = state,
        actions =
            CodeActions(
                onCodeChange = controller::onCodeChange,
                onSubmit = controller::submit,
                onModify = onModify,
                onResend = controller::resend,
                onOpenMail = onOpenMail,
            ),
    )
}

// R297: signed in but no local settings. Consult GET /api/v1/me BEFORE the onboarding decision - the settings
// are held by the server, so a re-sign-in after sign-out's wipe restores them rather than re-onboarding. The
// decision itself is JVM-tested in StartupDeciderTest over fakes (and ResolveFlowTest through the real session);
// this route is only the wiring and the loading state (the DoD's loading state for a screen that waits on the network).
// AN-SIGNIN-RESOLVE (R1161): an Unresolved decision is NOT handed on - it stays here as a retry line, and the retry
// runs the resolve again (the attempt is the effect's key). R1162: a positive answer restores the server's logging
// mode on the phone (restoreMode) before the settings are cached.

/** RESOLVING: GET /api/v1/me, decided; an Unresolved answer stays here as a retry line. */
@Composable
fun ResolvingRoute(
    session: SessionManager,
    settingsStore: SettingsStore,
    restoreMode: (LoggingMode) -> Unit,
    // AN-MANUAL-REMINDER (R1147): the evening opt-in the server holds, applied where this phone may notify.
    restoreReminder: (Boolean) -> Unit,
    onResolved: (StartDecision) -> Unit,
) {
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    var unresolved by remember { mutableStateOf<UnresolvedCause?>(null) }
    LaunchedEffect(attempt) {
        unresolved = null
        val decision =
            decideStartAfterSignIn(
                { meFetchOf(session.authenticatedGet(ME_PATH)) },
                settingsStore,
                restoreMode = restoreMode,
                restoreReminder = restoreReminder,
            )
        if (decision is StartDecision.Unresolved) unresolved = decision.cause else onResolved(decision)
    }
    ResolvingScreen(message = unresolved?.message(), onRetry = { attempt += 1 })
}
