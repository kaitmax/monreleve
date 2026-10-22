@file:Suppress("TooManyFunctions")

package ch.monreleve.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.CodeController
import ch.monreleve.app.auth.CodePhase
import ch.monreleve.app.auth.CodeSnapshot
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.auth.SignInPhase
import ch.monreleve.app.auth.SignInSnapshot
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.SharedPrefsDossierCache
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.LocalRhythmRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.sync.ShellYearDownload
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.data.sync.YearDownloadStatus
import ch.monreleve.app.data.sync.buildEntriesDownload
import ch.monreleve.app.data.sync.buildSyncEngine
import ch.monreleve.app.data.sync.processYearDownloads
import ch.monreleve.app.data.sync.taxYearsToDownload
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.detection.BACKGROUND_LOCATION
import ch.monreleve.app.detection.EXTRA_OPEN_AUJOURDHUI
import ch.monreleve.app.detection.EXTRA_OPEN_FORECAST
import ch.monreleve.app.detection.EveningNotifier
import ch.monreleve.app.detection.FINE_LOCATION
import ch.monreleve.app.detection.POST_NOTIFICATIONS_PERMISSION
import ch.monreleve.app.detection.locationFullyGranted
import ch.monreleve.app.detection.maybeAlertThreshold
import ch.monreleve.app.dossier.buildComparison
import ch.monreleve.app.dossier.parseEmployerRate
import ch.monreleve.app.forecast.RhythmChoice
import ch.monreleve.app.fr.DisclosureCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.onboarding.ModeChoice
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.AccountExportKind
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.Site
import ch.monreleve.app.parametres.openLegalLink
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.releve.ExportKind
import ch.monreleve.app.releve.ReleveState
import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsEmployerFigureStore
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.startup.StartDecision
import ch.monreleve.app.startup.decideStartAfterSignIn
import ch.monreleve.app.startup.meFetchOf
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiActions
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.calendrier.CalendarActions
import ch.monreleve.app.ui.screens.calendrier.CalendrierScreen
import ch.monreleve.app.ui.screens.comparison.ComparisonActions
import ch.monreleve.app.ui.screens.comparison.ComparisonScreen
import ch.monreleve.app.ui.screens.disclosure.DisclosureScreen
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
import ch.monreleve.app.ui.screens.onboarding.PretScreen
import ch.monreleve.app.ui.screens.parametres.ParametresActions
import ch.monreleve.app.ui.screens.parametres.ParametresScreen
import ch.monreleve.app.ui.screens.prevision.PrevisionActions
import ch.monreleve.app.ui.screens.prevision.PrevisionScreen
import ch.monreleve.app.ui.screens.releve.ReleveActions
import ch.monreleve.app.ui.screens.releve.ReleveScreen
import ch.monreleve.app.ui.screens.rythme.RythmeActions
import ch.monreleve.app.ui.screens.rythme.RythmeScreen
import ch.monreleve.app.ui.screens.signin.CodeActions
import ch.monreleve.app.ui.screens.signin.CodeScreen
import ch.monreleve.app.ui.screens.signin.RequestLinkScreen
import ch.monreleve.app.ui.screens.signin.SignInActions
import ch.monreleve.app.ui.screens.signin.WelcomeScreen
import ch.monreleve.app.ui.screens.simulation.SimulationActions
import ch.monreleve.app.ui.screens.simulation.SimulationScreen
import ch.monreleve.app.ui.shell.AppBottomBar
import ch.monreleve.app.ui.shell.AppTab
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Clock
import java.time.Year
import java.time.ZoneId

/**
 * The single activity and composition root (SPEC 11). It may wire data/remote (fence 5 governs ui/,
 * not this file): it builds the AuthApi, the session, and the settings store, and routes to the one
 * screen the person needs.
 *
 * AN5b increment 1 adds the manual-onboarding step between sign-in and Aujourd'hui. The start
 * destination is decided once at launch from two facts - is there a session, and has onboarding been
 * completed on this device - and onboarding flips to the main shell when the settings save.
 *
 * AN10 turns the single Aujourd'hui screen into the main shell: a bottom navigation over the screens
 * that exist (Aujourd'hui, Calendrier), with both controllers created once and kept alive so switching
 * tabs neither recomputes nor leaks a collector on lifecycleScope. Releve and Parametres join the shell
 * when AN11/AN12 build them (R282: no tab for a screen that does not exist).
 */
internal enum class Destination { SIGN_IN, RESOLVING, ONBOARDING, MAIN }

// AN-FORECAST: the forecast screens reached from within the shell (not bottom-nav tabs) - a small overlay
// route beside the AppTab state, null when a tab is showing. AN-SIM adds the simulator, reached from Prevision.
internal enum class ForecastRoute { RYTHME, PREVISION, SIMULATION }

// AN12: the cacheDir subdirectory an export is written to before the share sheet. ONE home (R206): shareFile
// writes here and the device erasure deletes here, so a rendered export - the account JSON is the whole record
// - cannot outlive the account it belongs to (R289).
private const val EXPORTS_DIR = "exports"

class MainActivity : ComponentActivity() {
    // LongMethod suppressed as MainShell is: this is the composition root - store/seam construction and the
    // one-screen router - not tangled logic. AN-ONBOARD's sign-in flow added the WELCOME/EMAIL/CODE branch.
    @Suppress("LongMethod")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = applicationContext
        val api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
        val tokenStore = KeystoreTokenStore(context)
        // AN-TOKEN-RACE (R507): the PROCESS's session, not this activity's own. SyncWorker drains through the same
        // instance, so a screen and a drain meeting one expired token share ONE refresh instead of racing two (R210).
        val session = processSession(context)
        val settingsStore: SettingsStore = SharedPrefsSettingsStore(context)
        val pending = SharedPrefsPendingSignInStore(context)
        val accountStore = SharedPrefsAccountStore(context)
        // AN-RECON (R342): the employer attestation figure stays on the phone, account-tagged, in the
        // monreleve.detection file that sign-out already sweeps. The tag is read live from accountStore, so a
        // re-sign-in under a different account cannot read the previous one's figure (fail closed when null).
        val employerStore: EmployerFigureStore = SharedPrefsEmployerFigureStore(context) { accountStore.current() }
        val clock = Clock.systemDefaultZone()
        // AN-FIX F4 / R303: the record is scoped to the account signed in RIGHT NOW. A new account signs in
        // through CallbackActivity, which restarts this activity, so onCreate re-reads the current tag; an
        // expired session has no current account, so the shell shows nothing rather than the previous
        // account's days.
        val repository: EntryRepository =
            LocalEntryRepository(
                MonReleveDatabase.get(context).entryDao(),
                clock,
                // NAMED, because a trailing lambda would bind to newMutationId - the LAST parameter -
                // and both are () -> String-ish. The compiler caught it; a type that happened to match
                // would not have.
                currentAccount = { accountStore.current() },
                // R425: read independently of the provider, so a future stale capture is caught
                // rather than losing days quietly again.
                isSignedIn = { accountStore.current() != null },
            )
        // AN-FORECAST (R341/R303): the weekly rhythm, scoped to the SAME account as the record - the planning
        // preference stays on the phone and is cleared on sign-out with the rest of the account's local data.
        val rhythmRepository: RhythmRepository =
            LocalRhythmRepository(MonReleveDatabase.get(context).rhythmDao()) { accountStore.current() }
        // AN11: the Releve reads GET /api/v1/dossier through the session (R210 refresh handling included), and
        // caches the last body per year so an offline reader gets a dated copy rather than a blank screen (R288).
        val dossierCache = SharedPrefsDossierCache(context)
        val dossierApi = DossierApi(session::authenticatedGet, dossierCache)
        // AN12 increment 2 (R295): the device-wide erasure (built by buildLocalStore, below).
        val localStore = buildLocalStore(context, tokenStore, settingsStore, dossierCache, pending, accountStore)
        // AN-PULL (R481-R485): the server's year, brought down to the phone. Built on the process's session (R507),
        // so its GET shares the single-flight refresh with /me, the dossier and the sync drain (R210); the coordinator
        // is the process's, so a download and its status outlive a rotation.
        val entriesDownload = buildEntriesDownload(context, session::authenticatedGet)
        val yearDownload =
            ShellYearDownload(
                status = processYearDownloads.status,
                atStart = { processYearDownloads.atStart(entriesDownload, taxYearsToDownload(clock)) },
                retry = { processYearDownloads.retry(entriesDownload) },
            )
        // R28: the tax year is the Paris calendar year, not the device's. The composition root is
        // the one place a clock is allowed; the engine and the aggregation stay clock-free.
        val taxYear = Year.now(ZoneId.of("Europe/Paris")).value

        val start =
            when {
                !session.isSignedIn() -> Destination.SIGN_IN
                settingsStore.isOnboarded() -> Destination.MAIN
                // R297: signed in but no local settings - a fresh account, or a re-sign-in after sign-out
                // cleared them. Consult the server (GET /api/v1/me) before onboarding, so settings the server
                // holds are restored rather than re-asked.
                else -> Destination.RESOLVING
            }

        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    // AN-STATE (R310): the destination survives a rebuild, reconciled against the session (see
                    // sessionReconciled). `start`, recomputed in onCreate from the session, is the authority.
                    var destination by rememberSaveable { mutableStateOf(start) }
                    // R335: the onboarding prefill (the steps owed + their /me values) the RESOLVING step computes,
                    // carried into OnboardingRoute. Saveable so a rebuild during onboarding keeps the same subset.
                    var onboardingSeed by rememberSaveable { mutableStateOf<OnboardingSnapshot?>(null) }
                    LaunchedEffect(Unit) { destination = sessionReconciled(destination, start) }
                    when (destination) {
                        Destination.SIGN_IN ->
                            SignInRoute(
                                api,
                                tokenStore,
                                pending,
                                accountStore,
                                lifecycleScope,
                                onSignedIn = { destination = Destination.RESOLVING },
                            )
                        Destination.RESOLVING -> {
                            // R481: every route here follows a sign-in (the code path's onSignedIn, or the link's
                            // relaunch with its settings cleared), so this is where BOTH years come down. It does
                            // not block the /me decision below; the shell shows its outcome (R484).
                            LaunchedEffect(Unit) {
                                processYearDownloads.afterSignIn(entriesDownload, taxYearsToDownload(clock))
                            }
                            ResolvingRoute(session, settingsStore) { decision ->
                                when (decision) {
                                    StartDecision.Main -> destination = Destination.MAIN
                                    StartDecision.SignIn -> destination = Destination.SIGN_IN
                                    is StartDecision.Onboard -> {
                                        onboardingSeed = decision.prefill
                                        destination = Destination.ONBOARDING
                                    }
                                }
                            }
                        }
                        Destination.ONBOARDING ->
                            OnboardingRoute(session, settingsStore, taxYear, lifecycleScope, seed = onboardingSeed) {
                                destination = Destination.MAIN
                            }
                        Destination.MAIN ->
                            MainShell(
                                repository,
                                rhythmRepository,
                                settingsStore,
                                taxYear,
                                clock,
                                lifecycleScope,
                                requestSync = {
                                    // SPEC 13.2: recording enqueues the drain; WorkManager replays on connectivity.
                                    SyncScheduler.requestSync(context)
                                },
                                dossierFetch = dossierApi::fetch,
                                exportBytes = session::authenticatedGetBytes,
                                settingsSaver = SessionSettingsSaver(session),
                                revokeServer = session::revokeServerSession,
                                // AN-POLISH (R440): sign-out sends what it can first. The SAME engine the
                                // SyncWorker builds (R206 - one construction site), run inline and bounded
                                // by the controller, because WorkManager is asynchronous by design and
                                // sign-out needs an answer before it discards anything.
                                syncNow = { buildSyncEngine(context).sync() },
                                localStore = localStore,
                                authenticatedPost = session::authenticatedPost,
                                employerStore = employerStore,
                                yearDownload = yearDownload,
                                // R295/R289: sign-out or deletion has wiped the local store; return to first-run.
                                // A re-auth restarts this activity, and `start` recomputes the destination.
                                onSignedOut = { destination = Destination.SIGN_IN },
                            )
                    }
                }
            }
        }
    }
}

// AN-ONBOARD: the sign-in flow is now three screens - Bienvenue (fresh install), the email request, and the
// six-digit code - the second way in beside the App Link callback (R195 leaves the callback untouched). On a
// code SIGNED it hands off to RESOLVING exactly as the callback's activity restart does: the start decision
// (GET /api/v1/me) then routes to onboarding or the shell. The welcome is shown only while unsigned.
private enum class SignInStep { WELCOME, EMAIL, CODE }

// LongParameterList suppressed as MainShell/MainGraph are: this is the composition root wiring the sign-in
// flow's stores and seams, not tangled logic (the ui/ screens bundle their callbacks into Actions instead,
// which the no-literal fence requires there - this file is the root, where @Suppress is permitted).
@Suppress("LongParameterList")
@Composable
private fun SignInRoute(
    api: AuthApi,
    tokenStore: TokenStore,
    pending: SharedPrefsPendingSignInStore,
    accountStore: AccountStore,
    scope: CoroutineScope,
    onSignedIn: () -> Unit,
) {
    val context = LocalContext.current
    var step by rememberSaveable { mutableStateOf(SignInStep.WELCOME) }
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
                actions =
                    SignInActions(
                        onEmailChange = controller::onEmailChange,
                        onSubmit = controller::submit,
                        onRetry = controller::retry,
                        onBack = { step = SignInStep.WELCOME },
                        onOpenCgu = { openLegal(context, LegalPage.TERMS) },
                        onOpenPrivacy = { openLegal(context, LegalPage.PRIVACY) },
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
                onModify = { step = SignInStep.EMAIL },
                onSignedIn = onSignedIn,
            )
    }
}

@Suppress("LongParameterList")
@Composable
private fun CodeRoute(
    api: AuthApi,
    tokenStore: TokenStore,
    pending: SharedPrefsPendingSignInStore,
    accountStore: AccountStore,
    email: String,
    scope: CoroutineScope,
    onModify: () -> Unit,
    onSignedIn: () -> Unit,
) {
    val context = LocalContext.current
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
                syncNow = { buildSyncEngine(context).sync() },
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
                onOpenMail = { openMail(context) },
            ),
    )
}

// R297: signed in but no local settings. Consult GET /api/v1/me BEFORE the onboarding decision - the settings
// are held by the server, so a re-sign-in after sign-out's wipe restores them rather than re-onboarding. The
// decision itself is JVM-tested in StartupDeciderTest over fakes; this route is only the wiring and the loading
// state (the DoD's loading state for a screen that waits on the network). Runs once (LaunchedEffect(Unit)).
@Composable
private fun ResolvingRoute(
    session: SessionManager,
    settingsStore: SettingsStore,
    onResolved: (StartDecision) -> Unit,
) {
    LaunchedEffect(Unit) {
        onResolved(decideStartAfterSignIn({ meFetchOf(session.authenticatedGet(ME_PATH)) }, settingsStore))
    }
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

// AN-ONBOARD: the onboarding WIZARD (steps 1-7) then "Tout est prêt". The composition root owns what ui/
// cannot: the disclosure + OS permissions behind an automatic-mode choice (R316/R315) and the notification
// permission behind the evening reminder (R323). A deny at any step leaves manual / reminder off, never nags.
// LongMethod/CyclomaticComplexMethod/LongParameterList suppressed as the shell's are: this is wiring, and the
// ui/ screens bundle their callbacks into Actions instead (the fence forbids @Suppress there, not here).
@Suppress("LongMethod", "CyclomaticComplexMethod", "LongParameterList")
@Composable
private fun OnboardingRoute(
    session: SessionManager,
    store: SettingsStore,
    taxYear: Int,
    scope: CoroutineScope,
    seed: OnboardingSnapshot?,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val eveningStore = remember { SharedPrefsEveningNotificationStore(context) }
    // R335: the controller starts from the RESOLVING step's prefill (steps owed + /me values); a rebuild then
    // restores the live edited snapshot (R310). Both arrive through `restored`, so there is one mechanism.
    var saved by rememberSaveable { mutableStateOf(seed) }
    val controller =
        remember { OnboardingController(SessionSettingsSaver(session), store, taxYear, scope, restored = saved) }
    val state by controller.state.collectAsState()
    LaunchedEffect(controller) {
        controller.state.collect {
            saved =
                OnboardingSnapshot(
                    it.step, it.name, it.canton, it.rateChoice, it.customRate, it.denominator,
                    it.exactTotalWorkDays, it.allYear, it.activityStartDate, it.mode, it.reminder,
                    it.granularity, it.steps,
                )
        }
    }

    // Automatic mode (the Mode step): the disclosure first (D5/R316), then FINE, then BACKGROUND on API 29+; consent
    // (onModeChange(AUTO_DETECT)) is recorded only when ALL are granted, and the save then PATCHes it (R315).
    var showDisclosure by rememberSaveable { mutableStateOf(false) }
    val backgroundLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            showDisclosure = false
            controller.onModeChange(if (granted) ModeChoice.AUTO_DETECT else ModeChoice.MANUAL)
        }
    val fineLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            when {
                !granted -> {
                    showDisclosure = false
                    controller.onModeChange(ModeChoice.MANUAL)
                }
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> backgroundLauncher.launch(BACKGROUND_LOCATION)
                else -> {
                    showDisclosure = false
                    controller.onModeChange(ModeChoice.AUTO_DETECT)
                }
            }
        }

    // Evening reminder (step 7): "Oui" asks POST_NOTIFICATIONS on API 33+ (the S9 is 29, so it enables straight
    // away), then enables the local R323 notification and saves; a deny saves with the reminder off.
    val notificationLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) eveningStore.setEnabled(true)
            controller.onReminderChange(granted)
            controller.next()
        }
    val onReminderYes: () -> Unit = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationLauncher.launch(POST_NOTIFICATIONS_PERMISSION)
        } else {
            eveningStore.setEnabled(true)
            controller.onReminderChange(true)
            controller.next()
        }
    }
    val onReminderNo: () -> Unit = {
        eveningStore.setEnabled(false)
        controller.onReminderChange(false)
        controller.next()
    }

    if (state.phase == OnboardingPhase.READY) {
        val settings = store.load()
        if (settings == null) onDone() else PretScreen(settings = settings, taxYear = taxYear, onContinue = onDone)
        return
    }

    OnboardingScreen(
        state = state,
        actions =
            OnboardingActions(
                onNameChange = controller::onNameChange,
                onCantonChange = controller::onCantonChange,
                onRateChoiceChange = controller::onRateChoiceChange,
                onCustomRateChange = controller::onCustomRateChange,
                onDenominatorChange = controller::onDenominatorChange,
                onExactTotalChange = controller::onExactTotalChange,
                onGranularityChange = controller::onGranularityChange,
                onAllYearChange = controller::onAllYearChange,
                onActivityStartDateChange = controller::onActivityStartDateChange,
                onChooseManual = { controller.onModeChange(ModeChoice.MANUAL) },
                onChooseAuto = { showDisclosure = true },
                onReminderYes = onReminderYes,
                onReminderNo = onReminderNo,
                onNext = controller::next,
                onBack = controller::back,
            ),
    )

    if (showDisclosure) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            DisclosureScreen(
                onAllow = { fineLauncher.launch(FINE_LOCATION) },
                onStayManual = {
                    showDisclosure = false
                    controller.onModeChange(ModeChoice.MANUAL)
                },
            )
        }
    }
}

// The main shell: the bottom navigation over the screens that exist, with BOTH controllers created once
// (remember) and kept alive for the shell's whole life. Switching tabs changes only which screen reads
// its already-computed state - it never rebuilds a controller, so no second collector is launched on
// lifecycleScope (a controller's observe runs for the life of the scope, not the composable). The
// composition root wires the dependencies; bundling them into a data class would only move the list.
// Not ui/ (the no-literal fence scans ui/ and dev/), so the annotation is permitted here.
// LongMethod suppressed for the same reason onCreate carries its length: this is the composition shell -
// controller wiring, the export/account hand-off effects, and the F8 resume refresh - not tangled logic.
// CyclomaticComplexMethod suppressed for the same reason as LongMethod: this is the composition shell - the
// tab `when`, the gated permission launchers (R316) and the resume-time revocation fallback are branches of
// wiring, not tangled logic, and splitting them further would scatter the shell's one place of truth.
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod")
@Composable
internal fun MainShell(
    repository: EntryRepository,
    rhythmRepository: RhythmRepository,
    store: SettingsStore,
    taxYear: Int,
    clock: Clock,
    scope: CoroutineScope,
    requestSync: () -> Unit,
    dossierFetch: suspend (Int) -> DossierResult,
    exportBytes: suspend (String) -> BytesOutcome,
    settingsSaver: SettingsSaver,
    revokeServer: suspend () -> Unit,
    // AN-POLISH (R440): the bounded drain sign-out attempts before it discards anything.
    syncNow: suspend () -> Unit,
    localStore: LocalStore,
    authenticatedPost: suspend (String, String) -> PostOutcome,
    employerStore: EmployerFigureStore,
    // AN-PULL (R484/R485): the year download's status, start check and retry. No default (R291).
    yearDownload: ShellYearDownload,
    onSignedOut: () -> Unit,
) {
    // R291: the controllers are built by MainGraph, the ONE construction site MainGraphWiringTest also
    // calls - so the graph the JVM test checks is the graph the app uses. SPEC 13.2: both day-writers are
    // built with requestSync, and the test fails if either is not (the AN10 calendar-never-synced bug,
    // which hid because this wiring lived inside a Composable no JVM test reaches, R176/R204). AN11 adds
    // the Releve controller; AN12 adds the Parametres controller with the PATCH, export and erasure seams.
    // AN-STATE (R310): the controllers and the selected tab are held by named seams (ShellState.kt) whose
    // lifetime a test can drive, instead of inline `remember` that died with each rebuild and dropped the
    // person back on Aujourd'hui. rememberMainControllers still builds through MainGraph.build (R291).
    val controllers =
        rememberMainControllers(
            repository, rhythmRepository, store, taxYear, clock, scope, requestSync, dossierFetch, exportBytes,
            settingsSaver, revokeServer, localStore, authenticatedPost, syncNow,
        )
    var tab by rememberShellTab()
    // AN-FORECAST: the two forecast sub-screens (not bottom-nav tabs) are a nullable overlay over the shell,
    // held in rememberSaveable so a rotation or a background kill keeps the open screen (R310). Null = on a tab.
    var forecastRoute by rememberSaveable { mutableStateOf<ForecastRoute?>(null) }
    // AN-RECON: the employer comparison, a full-screen overlay over the releve for the year it holds. Null = not
    // open; held in rememberSaveable so a rotation or a background kill keeps it open on the same year (R310).
    var comparisonYear by rememberSaveable { mutableStateOf<Int?>(null) }
    val forecastState by controllers.forecast.state.collectAsState()
    val simulationState by controllers.simulation.state.collectAsState()
    // AN-CALENDAR (R475): opening the forecast (or the rhythm editor, or the simulator) re-reads the settings, so a
    // projection is never drawn from an employment rate or a method Parametres has since changed. Both refreshes
    // existed (F8) and nothing called them.
    LaunchedEffect(forecastRoute) {
        if (forecastRoute != null) {
            controllers.forecast.refresh()
            controllers.simulation.refresh()
        }
    }

    val aujourdhuiState by controllers.aujourdhui.state.collectAsState()
    // AN-PULL (R485): once per process, the years that are empty on the phone come down. A sign-in download
    // already ran in this process makes this a no-op (YearDownloads.atStart).
    LaunchedEffect(Unit) { yearDownload.atStart() }
    val yearDownloadStatus by yearDownload.status.collectAsState()
    val calendarState by controllers.calendar.state.collectAsState()
    val releveState by controllers.releve.state.collectAsState()
    val parametresState by controllers.parametres.state.collectAsState()

    // AC2 / R136: an export event carries the server-rendered file to the platform share sheet. Handled at
    // the shell level (not inside a tab) so a switch of tab after the tap does not cancel the hand-off. Both
    // the Releve exports and the Parametres account export share the one hand-off (R206).
    val context = LocalContext.current

    // AN-AUTO increment 3b (R316). Turning auto detection ON goes through the prominent disclosure (D5/SPEC 11.1)
    // and then the OS permission prompt - never straight to setAutoDetection. The disclosure is an overlay held
    // in shell state; the launchers request FINE first, then (API 29+) BACKGROUND as a SEPARATE step. Only when
    // BOTH are granted does consent get recorded (setAutoDetection(true), which PATCHes /me and starts sampling).
    // A deny at any step leaves manual mode and NEVER nags (no re-prompt).
    var showDisclosure by rememberSaveable { mutableStateOf(false) }
    val backgroundLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            showDisclosure = false
            if (granted) controllers.parametres.setAutoDetection(true) // deny -> stay manual, no nag
        }
    val fineLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            when {
                !granted -> showDisclosure = false // deny -> stay manual, no nag
                // Android 10+ (API 29) asks for background SEPARATELY, as the disclosure warned.
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> backgroundLauncher.launch(BACKGROUND_LOCATION)
                else -> {
                    showDisclosure = false
                    controllers.parametres.setAutoDetection(true)
                }
            }
        }

    // R323 / PARKAN-36. Turning the evening proposal notification ON asks POST_NOTIFICATIONS on Android 13+
    // (API 33), then enables; below 33 (the S9 is 29) posting needs no grant, so it enables straight away. A deny
    // leaves it off and never nags (the detection flow's discipline, one feature over). OFF is immediate.
    val notificationLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) controllers.parametres.setEveningNotification(true) // deny -> stay off, no nag
        }
    val onToggleEvening: (Boolean) -> Unit = { enable ->
        when {
            !enable -> controllers.parametres.setEveningNotification(false)
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
                notificationLauncher.launch(POST_NOTIFICATIONS_PERMISSION)
            else -> controllers.parametres.setEveningNotification(true) // API < 33: no runtime permission to ask
        }
    }

    // AN-ALERT. Turning the threshold alert ON asks POST_NOTIFICATIONS on Android 13+ (API 33) then enables;
    // below 33 (the S9 is 29) posting needs no grant, so it enables straight away. A deny leaves it off and
    // never nags (the evening reminder's discipline, one feature over). OFF is immediate. It needs no detection.
    val alertNotificationLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) controllers.parametres.setThresholdAlert(true) // deny -> stay off, no nag
        }
    val onToggleThresholdAlert: (Boolean) -> Unit = { enable ->
        when {
            !enable -> controllers.parametres.setThresholdAlert(false)
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
                alertNotificationLauncher.launch(POST_NOTIFICATIONS_PERMISSION)
            else -> controllers.parametres.setThresholdAlert(true) // API < 33: no runtime permission to ask
        }
    }

    // AN-ALERT. The in-app trigger (section 1: recompute on record/rhythm change). The ForecastController
    // already recomputes the projection on every record and rhythm change; keyed on its projected rate and the
    // opt-in, this re-evaluates the crossing off the main thread. maybeAlertThreshold self-gates (opt-in, a new
    // crossing) and posts NOTHING unless a threshold is newly crossed (R340: computing writes nothing). The
    // once-a-day background pass is the SamplingWorker's.
    LaunchedEffect(forecastState.projection?.projectedRate, parametresState.thresholdAlertEnabled) {
        if (parametresState.thresholdAlertEnabled) {
            withContext(Dispatchers.IO) { maybeAlertThreshold(context, clock) }
        }
    }

    // R323 / D16: a notification tap opens Aujourd'hui (and records nothing). The launch intent carries
    // EXTRA_OPEN_AUJOURDHUI; consume it once on composition, select the tab and refresh today's surface.
    LaunchedEffect(Unit) {
        val activity = context as? android.app.Activity
        if (activity?.intent?.getBooleanExtra(EXTRA_OPEN_AUJOURDHUI, false) == true) {
            tab = AppTab.AUJOURDHUI
            controllers.aujourdhui.refresh()
            activity.intent.removeExtra(EXTRA_OPEN_AUJOURDHUI)
        }
        // AN-ALERT: a threshold-alert tap opens the forecast overlay (R340: it records nothing - it only reads).
        if (activity?.intent?.getBooleanExtra(EXTRA_OPEN_FORECAST, false) == true) {
            forecastRoute = ForecastRoute.PREVISION
            activity.intent.removeExtra(EXTRA_OPEN_FORECAST)
        }
    }

    // AN-NOTIF (R339): recording today by ANY in-app path - Aujourd'hui OR the calendar - dismisses today's
    // evening notification (section 3: "recording the day by any path cancels that day's notification"). Both
    // write through the ONE repository, which the Aujourd'hui controller observes, so "today became recorded" is
    // the single signal covering both paths. cancel is idempotent (a no-op when none is showing); the LaunchedEffect
    // key fires it only when the recorded-state flips. A notification BUTTON records through the receiver, which
    // replaces the notification with its confirmation, so that path needs no cancel here.
    val todayRecorded =
        aujourdhuiState.fullDay != null || aujourdhuiState.morning != null || aujourdhuiState.afternoon != null
    LaunchedEffect(todayRecorded) {
        if (todayRecorded) EveningNotifier.cancel(context)
    }

    LaunchedEffect(controllers.releve) {
        controllers.releve.exportEvents.collect { event -> handleExport(context, event) }
    }
    LaunchedEffect(controllers.parametres) {
        controllers.parametres.exportEvents.collect { event -> handleExport(context, event) }
    }
    // R295: when sign-out completes (session revoked, local store wiped), leave the signed-in shell.
    LaunchedEffect(controllers.parametres) {
        controllers.parametres.accountEvents.collect { onSignedOut() }
    }

    // F8 (AN-FIX): on every resume, Aujourd'hui recomputes "today" and the tax year from the clock, so an app
    // held open across midnight shows the new day - and records it - rather than the day it was opened.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) {
                    controllers.aujourdhui.refresh()
                    // R316: the person may have revoked the location permission in system settings while away.
                    // If auto mode is on but the OS no longer grants what sampling needs, fall back to manual,
                    // stop sampling, and say so plainly - no crash, no nag, and NO consent PATCH (they may re-grant).
                    if (controllers.parametres.state.value.autoDetectionEnabled && !locationFullyGranted(context)) {
                        controllers.parametres.onLocationPermissionRevoked()
                        controllers.aujourdhui.refresh()
                        Toast.makeText(context, DisclosureCopy.PERMISSION_REVOKED, Toast.LENGTH_LONG).show()
                    }
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Scaffold(
        bottomBar = {
            AppBottomBar(
                selected = tab,
                onSelect = { selected ->
                    // AN-AUTO: returning to Aujourd'hui re-reads the logging mode (toggled in Parametres) and
                    // today's position, so a mode change made on another tab is reflected at once.
                    // AN-CALENDAR (R475): it re-reads the settings too, now that it reads them at use, and the
                    // calendar does the same - a granularity or activity start changed in Parametres is shown on
                    // arrival, with no restart.
                    if (selected == AppTab.AUJOURDHUI) controllers.aujourdhui.refresh()
                    if (selected == AppTab.CALENDRIER) controllers.calendar.refresh()
                    tab = selected
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                AppTab.AUJOURDHUI ->
                    AujourdhuiScreen(
                        state = aujourdhuiState,
                        actions =
                            AujourdhuiActions(
                                onRecord = controllers.aujourdhui::record,
                                onConfirmDetected = controllers.aujourdhui::confirmDetected,
                                onCorrectDetected = controllers.aujourdhui::correctDetected,
                                // AN-HOME C/E/F (R328): « À traiter »'s link and a week-day tap open the calendar.
                                onNavigateToCalendrier = { tab = AppTab.CALENDRIER },
                                // AN-FORECAST: the year card's « Voir ma prevision » opens the forecast overlay.
                                onNavigateToForecast = { forecastRoute = ForecastRoute.PREVISION },
                                // AN-PULL (R484): the person asks again for the years that failed.
                                onRetryDownload = yearDownload.retry,
                            ),
                        yearDownloadFailed = yearDownloadStatus is YearDownloadStatus.Failed,
                    )
                AppTab.CALENDRIER ->
                    CalendrierScreen(
                        state = calendarState,
                        actions =
                            CalendarActions(
                                onPreviousMonth = controllers.calendar::goPreviousMonth,
                                onNextMonth = controllers.calendar::goNextMonth,
                                onDayClick = controllers.calendar::openDay,
                                onSave = controllers.calendar::save,
                                onDismissSheet = controllers.calendar::closeSheet,
                                // AN-CAL2: the multi-day selection + bulk confirmation seams.
                                onStartSelection = { controllers.calendar.startSelection() },
                                onStartSelectionWithDay = { iso -> controllers.calendar.startSelection(iso) },
                                onToggleDay = controllers.calendar::tapDay,
                                onCancelSelection = controllers.calendar::cancelSelection,
                                onChooseBulk = controllers.calendar::chooseBulk,
                                onConfirmBulk = controllers.calendar::confirmBulk,
                                onCancelConfirmation = controllers.calendar::cancelBulkConfirmation,
                            ),
                    )
                AppTab.RELEVE ->
                    ReleveScreen(
                        state = releveState,
                        actions =
                            ReleveActions(
                                onRetry = controllers.releve::load,
                                onExportPdf = { controllers.releve.export(ExportKind.PDF) },
                                onExportCsv = { controllers.releve.export(ExportKind.CSV) },
                                // PARKAN-26: switch the releve to another year the selector offers (R328 read-only).
                                onSelectYear = controllers.releve::selectYear,
                                // AN-RECON: open the comparison overlay for the year on screen.
                                onCompareEmployer = {
                                    (releveState as? ReleveState.Loaded)?.let { comparisonYear = it.selectedYear }
                                },
                            ),
                    )
                AppTab.PARAMETRES ->
                    ParametresTab(
                        state = parametresState,
                        controller = controllers.parametres,
                        // R316: ON launches the disclosure (then the OS prompt); OFF stops at once, no dialog
                        // (SPEC 13), straight through the controller.
                        onToggleAuto = { enable ->
                            if (enable) showDisclosure = true else controllers.parametres.setAutoDetection(false)
                        },
                        onToggleEvening = onToggleEvening,
                        // AN-ALERT: ON asks POST_NOTIFICATIONS (API 33+) then enables; OFF is immediate.
                        onToggleThresholdAlert = onToggleThresholdAlert,
                        onOpenLegal = { openLegal(context, it) },
                        // AN-FORECAST: « Votre rythme habituel » in the settings list opens the rhythm editor.
                        onOpenRhythm = { forecastRoute = ForecastRoute.RYTHME },
                    )
            }
        }
    }

    // AN-FORECAST: the forecast sub-screens, a full-screen overlay over the shell (hiding the bottom nav, as the
    // design draws them). The on-screen back arrow and the system back both close the overlay to the tab beneath;
    // « Modifier mon rythme » / « Voir ma prevision » move between the two. R340: computing the projection the
    // Prevision screen shows writes nothing; only setting the rhythm (RythmeScreen) persists, through the controller.
    forecastRoute?.let { route ->
        // AN-SIM: system back from the simulator returns to Prevision (the on-screen arrow and "Revenir a ma
        // prevision" both do too), since the simulator is a sub-screen of Prevision; the other routes close to
        // the tab beneath.
        BackHandler { forecastRoute = if (route == ForecastRoute.SIMULATION) ForecastRoute.PREVISION else null }
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when (route) {
                ForecastRoute.RYTHME ->
                    RythmeScreen(
                        state = forecastState,
                        actions =
                            RythmeActions(
                                onSetDay = controllers.forecast::setDay,
                                onViewForecast = { forecastRoute = ForecastRoute.PREVISION },
                                onBack = { forecastRoute = null },
                            ),
                    )
                ForecastRoute.PREVISION ->
                    PrevisionScreen(
                        state = forecastState,
                        actions =
                            PrevisionActions(
                                onModifyRhythm = { forecastRoute = ForecastRoute.RYTHME },
                                // AN-SIM: the live simulator entry point (R85).
                                onTestChange = { forecastRoute = ForecastRoute.SIMULATION },
                                // AN-ALERT: the contextual opt-in offer enables the alert (via the OS prompt).
                                onEnableAlert = { onToggleThresholdAlert(true) },
                                onBack = { forecastRoute = null },
                            ),
                        // AN-ALERT: the offer is shown only while the alert is off (read from Parametres state).
                        alertEnabled = parametresState.thresholdAlertEnabled,
                    )
                // AN-SIM: the simulator. Adopting routes through the ForecastController's setDay (the rhythm's
                // one home, R206/R341) and returns to Prevision so the forecast is seen to change; the rate's
                // link opens Parametres, where R290's before/after confirmation fires. R340: computing writes
                // nothing - the SimulationController has no record seam.
                ForecastRoute.SIMULATION ->
                    SimulationScreen(
                        state = simulationState,
                        actions =
                            SimulationActions(
                                onSelectScenario = controllers.simulation::selectScenario,
                                onInputsChange = controllers.simulation::updateInputs,
                                onAdopt = {
                                    simulationState.inputs.extraWeekday?.let {
                                        controllers.forecast.setDay(it, RhythmChoice.DOMICILE)
                                    }
                                    forecastRoute = ForecastRoute.PREVISION
                                },
                                onChangeRate = {
                                    forecastRoute = null
                                    tab = AppTab.PARAMETRES
                                },
                                onReturn = { forecastRoute = ForecastRoute.PREVISION },
                                onBack = { forecastRoute = ForecastRoute.PREVISION },
                            ),
                    )
            }
        }
    }

    // AN-RECON: the employer comparison, a full-screen overlay over the releve. It reads the releve's current
    // Loaded document for the year it holds (R287: the server's figure, never a phone-side calc) and the
    // employer figure from the phone store (R342). Computing the gap writes nothing (R340); only the person's
    // typed figure is persisted, to the account-scoped phone store. Back closes it; a cause or "voir mes
    // journees" opens the day-by-day record.
    comparisonYear?.let { year ->
        val loaded = releveState as? ReleveState.Loaded
        BackHandler { comparisonYear = null }
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            if (loaded != null) {
                var employerInput by
                    rememberSaveable(year) {
                        mutableStateOf(employerStore.figureFor(year)?.let { formatPercent(it, 2) } ?: "")
                    }
                val employerRate = parseEmployerRate(employerInput)
                val view =
                    remember(loaded.document, loaded.pendingCount, loaded.isCurrentYear, employerRate) {
                        buildComparison(
                            document = loaded.document,
                            isCurrentYear = loaded.isCurrentYear,
                            daysUnsynced = loaded.pendingCount,
                            missionCap = loaded.rules.missionCapDays,
                            simplifiedBasisDays = loaded.rules.simplifiedBasisDays,
                            employerRate = employerRate,
                        )
                    }
                ComparisonScreen(
                    view = view,
                    employerInput = employerInput,
                    employerRate = employerRate,
                    actions =
                        ComparisonActions(
                            onInputChange = { text ->
                                employerInput = text
                                parseEmployerRate(text)?.let { employerStore.save(year, it) }
                            },
                            onViewDays = {
                                comparisonYear = null
                                tab = AppTab.CALENDRIER
                            },
                            onBack = { comparisonYear = null },
                        ),
                )
            }
        }
    }

    // R316/D5: the prominent disclosure, shown BEFORE the OS prompt, as a full-screen overlay over the shell.
    if (showDisclosure) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            DisclosureScreen(
                onAllow = { fineLauncher.launch(FINE_LOCATION) },
                onStayManual = { showDisclosure = false },
            )
        }
    }
}

// AN12 increment 2 (R295): the device-wide erasure. clearAllTables() is derived from @Database, so it sweeps
// every Room table (entry + daily_tally) with no per-DAO list to drift, and runs off the main thread (it
// throws on it). Sign-out clears the record, cache, tokens and queued sync; deletion adds the settings and
// pending sign-in (R289). Extracted from onCreate to keep it within its length budget.
// The erasure's dependency list - these ARE the device's stores (the same reasoning as DeviceLocalStore's
// own suppression); bundling them into a holder would only move the list.
@Suppress("LongParameterList")
private fun buildLocalStore(
    context: Context,
    tokenStore: TokenStore,
    settingsStore: SettingsStore,
    dossierCache: DossierCache,
    pending: PendingSignInStore,
    accountStore: AccountStore,
): LocalStore =
    DeviceLocalStore(
        tokenStore = tokenStore,
        settingsStore = settingsStore,
        dossierCache = dossierCache,
        pendingSignIn = pending,
        accountStore = accountStore,
        // R315: clear the detection logging-mode cache on sign-out/deletion (restored from /me on re-sign-in).
        detectionModeStore = SharedPrefsDetectionModeStore(context),
        clearRecord = {
            // AN-PULL: a year still arriving is stopped BEFORE the record is cleared, so it cannot land in the store
            // this sign-out empties (YearDownloads.stop says why it is a cancel, not a join).
            processYearDownloads.stop()
            withContext(Dispatchers.IO) { MonReleveDatabase.get(context).clearAllTables() }
        },
        cancelSync = { SyncScheduler.cancel(context) },
        clearExports = { java.io.File(context.cacheDir, EXPORTS_DIR).deleteRecursively() },
    )

// AN12: the Parametres screen's callbacks, built from the controller's method references. A top-level helper
// (not inline in MainShell) so the shell composable stays within its length budget; a plain mapping, not a
// Composable, so it carries no state.
// AN12: the Parametres tab. Extracted from MainShell (its own length budget) so the shell's `when (tab)` stays
// a line per destination. Reads the app version from BuildConfig here in the composition root, where it is
// permitted, and hands it to the stateless screen as a formatted string (fence 5 / R181).
// AN-FORECAST adds onOpenRhythm; LongParameterList suppressed as the composition root is (the shell's own
// reasoning): this is a plain pass-through of the screen's callbacks, not tangled logic.
@Suppress("LongParameterList")
@Composable
private fun ParametresTab(
    state: ParametresState,
    controller: ParametresController,
    onToggleAuto: (Boolean) -> Unit,
    onToggleEvening: (Boolean) -> Unit,
    onToggleThresholdAlert: (Boolean) -> Unit,
    onOpenLegal: (LegalPage) -> Unit,
    onOpenRhythm: () -> Unit,
) {
    ParametresScreen(
        state = state,
        actions =
            parametresActions(
                controller,
                onToggleAuto,
                onToggleEvening,
                onToggleThresholdAlert,
                onOpenLegal,
                onOpenRhythm,
            ),
        appVersion = ParametresCopy.version(BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE.toString()),
    )
}

// AN12 increment 4 / AN-LINKS: open a website page from the ONE site origin (Site.ORIGIN, R206) plus the
// LegalPage's own path - never BuildConfig.API_BASE_URL, which is the API base and points at the emulator host
// in debug. Lives in the composition root, where an Intent is permitted.
private fun openLegal(
    context: Context,
    page: LegalPage,
) {
    // R299: a device with no browser (a managed profile, a kiosk) would crash on startActivity; openLegalLink
    // catches that and shows the address instead. The launch and the fallback toast are the seams it wraps.
    openLegalLink(
        url = Site.url(page),
        open = { launchCustomTab(context, it) },
        showAddress = { Toast.makeText(context, ParametresCopy.legalNoHandler(it), Toast.LENGTH_LONG).show() },
    )
}

// AN-LINKS (R136): open a website page in an Android Custom Tab, so it opens inside the app's context with the
// brand colour in the toolbar rather than as a bare browser hand-off. THE FALLBACK CHAIN, in one place:
//   1. A Custom Tab is an ACTION_VIEW intent with extras, so a device that has an ordinary browser but no
//      Custom Tabs provider gets the ordinary browser automatically - CustomTabsIntent does not require one.
//   2. A device with NO browser at all makes startActivity throw ActivityNotFoundException, which openLegalLink
//      (the caller's seam) catches to show the address instead of crashing (R299).
// The toolbar colour is the brand token (DESIGN-SYSTEM), never a raw colour. Lives in the composition root,
// where an Intent is permitted.
private fun launchCustomTab(
    context: Context,
    url: String,
) {
    val colorScheme =
        CustomTabColorSchemeParams.Builder()
            .setToolbarColor(LightColors.brand.toArgb())
            .build()
    CustomTabsIntent.Builder()
        .setDefaultColorSchemeParams(colorScheme)
        .setShowTitle(true)
        .build()
        .launchUrl(context, Uri.parse(url))
}

// AN-ONBOARD: "Ouvrir ma messagerie" on the code screen opens the device's email app. Guarded like
// openLegal (R299): a device with no email app shows the reason rather than crashing. Lives in the
// composition root, where an Intent is permitted.
private fun openMail(context: Context) {
    val intent =
        Intent(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_APP_EMAIL) }
    runCatching { context.startActivity(intent) }.onFailure {
        Toast.makeText(context, ch.monreleve.app.fr.CodeCopy.NO_MAIL_APP, Toast.LENGTH_LONG).show()
    }
}

// LongParameterList suppressed as the composition root's helpers are: a plain pass-through of the screen's
// callbacks (now with the threshold-alert toggle), not tangled logic.
@Suppress("LongParameterList")
private fun parametresActions(
    controller: ParametresController,
    onToggleAuto: (Boolean) -> Unit,
    onToggleEvening: (Boolean) -> Unit,
    onToggleThresholdAlert: (Boolean) -> Unit,
    onOpenLegal: (LegalPage) -> Unit,
    onOpenRhythm: () -> Unit,
): ParametresActions =
    ParametresActions(
        onCantonChange = controller::onCantonChange,
        onEmploymentRateChange = controller::onEmploymentRateChange,
        onDenominatorChange = controller::onDenominatorChange,
        onExactTotalChange = controller::onExactTotalChange,
        onGranularityChange = controller::onGranularityChange,
        onActivityStartDateChange = controller::onActivityStartDateChange,
        onSave = controller::save,
        onConfirmRateChange = controller::confirmSave,
        onCancelRateChange = controller::cancelSave,
        onExportJson = { controller.exportData(AccountExportKind.JSON) },
        onExportCsv = { controller.exportData(AccountExportKind.CSV) },
        onRequestSignOut = controller::requestSignOut,
        onConfirmSignOut = controller::confirmSignOut,
        onCancelSignOut = controller::cancelSignOut,
        onRetrySignOutSync = controller::retrySignOutSync,
        onRequestDelete = controller::requestDelete,
        onConfirmDelete = controller::confirmDelete,
        onCancelDelete = controller::cancelDelete,
        onAcknowledgeDelete = controller::acknowledgeDelete,
        onOpenLegal = onOpenLegal,
        // R316: the toggle is GATED - ON launches the disclosure first (the shell handles it), OFF is immediate.
        onToggleAutoDetection = onToggleAuto,
        // R323: ON asks POST_NOTIFICATIONS (API 33+) then enables; OFF is immediate (the shell handles the ask).
        onToggleEveningNotification = onToggleEvening,
        // AN-ALERT: ON asks POST_NOTIFICATIONS (API 33+) then enables the threshold alert; OFF is immediate.
        onToggleThresholdAlert = onToggleThresholdAlert,
        // AN-FORECAST: open the weekly-rhythm editor (the forecast overlay), from the settings list.
        onOpenRhythm = onOpenRhythm,
    )

// AC2 / R136: hand the server-rendered export to the platform. A Ready event's bytes are written to a
// private cache file and shared through a FileProvider content URI (no storage permission), so a viewer or a
// spreadsheet app opens the PDF/CSV. A connectivity or server failure is surfaced as a toast, never silently
// (SPEC 13.2: the export requires connectivity and says so). Lives in the composition root (not ui/), where
// a Context, an Intent and a FileProvider are permitted.
private fun handleExport(
    context: Context,
    event: ExportEvent,
) {
    when (event) {
        is ExportEvent.Ready -> shareFile(context, event)
        ExportEvent.RequiresConnectivity ->
            Toast.makeText(context, ReleveCopy.EXPORT_REQUIRES_CONNECTIVITY, Toast.LENGTH_LONG).show()
        ExportEvent.Failed ->
            Toast.makeText(context, ReleveCopy.EXPORT_FAILED, Toast.LENGTH_LONG).show()
    }
}

private fun shareFile(
    context: Context,
    event: ExportEvent.Ready,
) {
    val dir = java.io.File(context.cacheDir, EXPORTS_DIR).apply { mkdirs() }
    val file = java.io.File(dir, event.filename)
    file.writeBytes(event.bytes)
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send =
        Intent(Intent.ACTION_SEND).apply {
            type = event.mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    context.startActivity(Intent.createChooser(send, ReleveCopy.EXPORT_CHOOSER_TITLE))
}
