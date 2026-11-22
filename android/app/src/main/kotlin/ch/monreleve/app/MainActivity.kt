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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.account.EXPORTS_DIR
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.account.deviceLocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.auth.processSessionEnds
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.SharedPrefsDossierCache
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.remote.DossierResult
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
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.detection.BACKGROUND_LOCATION
import ch.monreleve.app.detection.DetectionScheduling
import ch.monreleve.app.detection.EXTRA_OPEN_AUJOURDHUI
import ch.monreleve.app.detection.EXTRA_OPEN_FORECAST
import ch.monreleve.app.detection.EveningNotifier
import ch.monreleve.app.detection.FINE_LOCATION
import ch.monreleve.app.detection.POST_NOTIFICATIONS_PERMISSION
import ch.monreleve.app.detection.applyServerLoggingMode
import ch.monreleve.app.detection.detectionAvailable
import ch.monreleve.app.detection.locationFullyGranted
import ch.monreleve.app.detection.maybeAlertThreshold
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.fr.DisclosureCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.onboarding.ModeChoice
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.onboarding.onboardingSeedFor
import ch.monreleve.app.parametres.AccountExportKind
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.Site
import ch.monreleve.app.parametres.openLegalLink
import ch.monreleve.app.push.notificationsPermitted
import ch.monreleve.app.push.syncPush
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.reminder.FallbackReminderScheduling
import ch.monreleve.app.reminder.restoredEveningOptIn
import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsEmployerFigureStore
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.ui.screens.disclosure.DisclosureScreen
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
import ch.monreleve.app.ui.screens.onboarding.PretScreen
import ch.monreleve.app.ui.screens.parametres.ParametresActions
import ch.monreleve.app.ui.screens.parametres.ParametresScreen
import ch.monreleve.app.ui.screens.update.UpdateRequiredScreen
import ch.monreleve.app.ui.shell.AppRoot
import ch.monreleve.app.ui.shell.AppTab
import ch.monreleve.app.update.openPlayListingFrom
import ch.monreleve.app.update.processUpdateGate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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
        // AN12 increment 2 (R295): the device-wide erasure - the ONE construction the process's session uses too, for
        // a session the server ended (AN-FORCED-SIGNOUT, R521; account/DeviceLocalStores.kt).
        val localStore: LocalStore = deviceLocalStore(context)
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

        val start = startDestination(signedIn = session.isSignedIn(), onboarded = settingsStore.isOnboarded())

        // AN-FORCE-UPDATE (R1111): ask the minimum supported version on launch AND on every return to the foreground
        // (ON_START), beside the first paint, never before it - the gate starts open and a slow or failed answer
        // changes nothing (fail open).
        lifecycle.addObserver(
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_START) lifecycleScope.launch { processUpdateGate.check() }
            },
        )

        setContent {
            // AN-EDGE-INSETS (R1170): AppRoot is the theme, the canvas and the system-bar insets for every destination
            // below, consumed once - so the Scaffold in MainShell pads nothing more (fences/EdgeToEdgeCensusTest).
            AppRoot {
                // AN-FORCE-UPDATE (R1111): the process's gate (update/PlayListing.kt), asked on every start below. It
                // starts open, so the app below shows at once; only a usable answer naming a minimum above this build
                // replaces everything with the update screen, from which nothing else is reachable.
                val updateRequired by processUpdateGate.required.collectAsState()
                if (updateRequired) {
                    val activity = LocalContext.current
                    UpdateRequiredScreen(onUpdate = { openPlayListingFrom(activity) })
                } else {
                    // IOS-SHELL-1 (R1328): the destination switch, the sign-in flow and RESOLVING are COMMON now
                    // (ShellRoutes.kt, :shared commonMain) - moved from this file with their comments. What was
                    // Android's in them is handed in here: the activity's context for the legal pages, the mail app
                    // and the sign-in's drain; RESOLVING's two phone-side writes; the year download; and the two
                    // routes that stay Android's (OnboardingRoute, MainShell) as slots.
                    val activityContext = LocalContext.current
                    ShellRouter(
                        start = start,
                        session = session,
                        api = api,
                        tokenStore = tokenStore,
                        pending = pending,
                        accountStore = accountStore,
                        repository = repository,
                        settingsStore = settingsStore,
                        scope = lifecycleScope,
                        sessionEnds = processSessionEnds,
                        // AN-TOKEN-RACE (R509): the sign-in sends the account's held days through the worker's own
                        // drain (R206).
                        syncNow = { buildSyncEngine(activityContext).sync() },
                        onOpenLegal = { openLegal(activityContext, it) },
                        onOpenMail = { openMail(activityContext) },
                        restoreMode = { serverMode -> restoreLoggingMode(activityContext, serverMode) },
                        // AN-MANUAL-REMINDER (R1147): the evening opt-in the server holds, applied where this phone
                        // may notify.
                        restoreReminder = { serverOn ->
                            SharedPrefsEveningNotificationStore(activityContext)
                                .setEnabled(
                                    restoredEveningOptIn(serverOn, notificationsPermitted(activityContext)),
                                )
                        },
                        afterSignIn = {
                            processYearDownloads.afterSignIn(entriesDownload, taxYearsToDownload(clock))
                        },
                        onboarding = { seed, onDone ->
                            OnboardingRoute(
                                session,
                                settingsStore,
                                taxYear,
                                lifecycleScope,
                                seed = seed,
                                onDone = onDone,
                            )
                        },
                        main = { onSignedOut ->
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
                                // AN-RELEVE-FRESH (R560): the same cache the sync worker marks stale (R559).
                                dossierStaleCopy = dossierApi::staleCopy,
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
                                onSignedOut = onSignedOut,
                            )
                        },
                    )
                }
            }
        }
    }
}

// AN-SIGNIN-RESOLVE (R1162, PARK-E3): the mode the server holds, applied on THIS phone - AUTO_DETECT with the sampler
// started only where the location permission is held, MANUAL with the sampler stopped otherwise (LoggingModeRestore).
// The one call both moments use: RESOLVING's restore, and onboarding's accepted automatic choice.
private fun restoreLoggingMode(
    context: Context,
    serverMode: LoggingMode,
) {
    applyServerLoggingMode(
        serverMode,
        locationFullyGranted(context),
        SharedPrefsDetectionModeStore(context),
        startSampling = { DetectionScheduling.startSampling(context) },
        stopSampling = { DetectionScheduling.stopSampling(context) },
    )
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
    // AN-PLAY-PACK (R1124): a build without detection (the manual-only fallback) does not ask the mode step.
    var saved by rememberSaveable { mutableStateOf(onboardingSeedFor(seed, detectionAvailable(context))) }
    val controller =
        remember {
            OnboardingController(
                SessionSettingsSaver(session),
                store,
                taxYear,
                scope,
                restored = saved,
                // R1162 (PARK-E3): the automatic choice the server accepted reaches this phone.
                onModeSaved = { serverMode -> restoreLoggingMode(context, serverMode) },
                // AN-MANUAL-REMINDER (R1145): the evening answer reaches this phone only once the server TOOK the save
                // that carried it - a refused save leaves the opt-in as it was.
                onReminderSaved = { on -> eveningStore.setEnabled(on) },
            )
        }
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
    // away), then saves with the reminder on; a deny saves with the reminder off. AN-MANUAL-REMINDER (R1145): nothing
    // here writes the phone's opt-in - the save carries the answer, and onReminderSaved writes it once the server
    // took it.
    val notificationLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            controller.onReminderChange(granted)
            controller.next()
        }
    val onReminderYes: () -> Unit = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationLauncher.launch(POST_NOTIFICATIONS_PERMISSION)
        } else {
            controller.onReminderChange(true)
            controller.next()
        }
    }
    val onReminderNo: () -> Unit = {
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
    dossierStaleCopy: (Int) -> DossierDocument?,
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
    // R291: the controllers are built by MainGraph, the ONE construction site the wiring pins also call
    // (MainGraphWiringPinTest, MainGraphDayWriterCensusTest) - so the graph the JVM tests check is the graph the app
    // uses. SPEC 13.2: both day-writers are built with requestSync, and the tests fail if either is not (the AN10
    // calendar-never-synced bug, which hid because this wiring lived inside a Composable no JVM test reaches,
    // R176/R204). AN11 adds the Releve controller; AN12 adds the Parametres controller with the PATCH, export and
    // erasure seams.
    // AN-STATE (R310): the controllers and the selected tab are held by named seams (ShellState.kt) whose
    // lifetime a test can drive, instead of inline `remember` that died with each rebuild and dropped the
    // person back on Aujourd'hui. rememberMainControllers still builds through MainGraph.build (R291).
    val controllers =
        rememberMainControllers(
            repository, rhythmRepository, store, taxYear, clock, scope, requestSync, dossierFetch, dossierStaleCopy,
            exportBytes, settingsSaver, revokeServer, localStore, authenticatedPost, syncNow,
        )
    var tab by rememberShellTab()
    // AN-FORECAST: the two forecast sub-screens (not bottom-nav tabs) are a nullable overlay over the shell,
    // held in rememberSaveable so a rotation or a background kill keeps the open screen (R310). Null = on a tab.
    var forecastRoute by rememberSaveable { mutableStateOf<ForecastRoute?>(null) }
    // AN-RECON: the employer comparison, a full-screen overlay over the releve for the year it holds. Null = not
    // open; held in rememberSaveable so a rotation or a background kill keeps it open on the same year (R310).
    var comparisonYear by rememberSaveable { mutableStateOf<Int?>(null) }
    // IOS-MOVE-TABS R1360: read here for the threshold-alert pass below. The forecast screens, the simulator's state
    // and the refresh on opening the forecast (AN-CALENDAR R475) are MainTabs's (:shared commonMain MainTabs.kt).
    val forecastState by controllers.forecast.state.collectAsState()

    val aujourdhuiState by controllers.aujourdhui.state.collectAsState()
    // AN-PULL (R485): once per process, the years that are empty on the phone come down. A sign-in download
    // already ran in this process makes this a no-op (YearDownloads.atStart).
    LaunchedEffect(Unit) { yearDownload.atStart() }
    val yearDownloadStatus by yearDownload.status.collectAsState()
    val parametresState by controllers.parametres.state.collectAsState()

    // AC2 / R136: an export event carries the server-rendered file to the platform share sheet. Handled at
    // the shell level (not inside a tab) so a switch of tab after the tap does not cancel the hand-off. Both
    // the Releve exports and the Parametres account export share the one hand-off (R206).
    val context = LocalContext.current
    // AN-PLAY-PACK (R1124): whether this build declares detection's permissions - read from the installed package,
    // so the manual-only fallback (no location permission) shows no detection entry point.
    val hasDetection = remember(context) { detectionAvailable(context) }

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

    // AN-FCM-CLIENT (R1151). One push registration pass on every launch of the signed-in shell (docs/api-v1.md
    // section 10: "made after sign-in and on every launch afterwards"), and again whenever the evening opt-in or the
    // alert opt-in changes - turning either on may just have granted POST_NOTIFICATIONS, and the evening opt-in is
    // what the server's reminderEnabled follows. An unconfigured build returns NOT_CONFIGURED at once and sends
    // nothing (push/PushRegistration.kt).
    LaunchedEffect(parametresState.eveningNotificationEnabled, parametresState.thresholdAlertEnabled) {
        withContext(Dispatchers.IO) { syncPush(context) }
    }

    // AN-MANUAL-REMINDER (R1140). The 19:00 fallback is planned whenever a signed-in shell opens - after a sign-in (by
    // code or by link), after onboarding, at every launch - and KEPT if a link is already pending, so this never moves
    // it. Each wake reads the mode, the opt-in and push for itself (reminder/FallbackReminderRuntime.kt).
    LaunchedEffect(Unit) { FallbackReminderScheduling.ensure(context) }

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
                        toastNotices(context).show(DisclosureCopy.PERMISSION_REVOKED)
                    }
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // IOS-MOVE-TABS R1360: the bottom bar, the four tabs and the forecast overlays are the common MainTabs (:shared
    // commonMain MainTabs.kt), which iOS's shell calls too. What is Android's reaches it as a parameter: the tab and
    // forecast state held above, the year download's retry, the comparison's year and store, the alert's OS prompt, the
    // Parametres tab (BuildConfig, the permission launchers, the Material date picker) and the system back.
    MainTabs(
        controllers = controllers,
        tab = tab,
        onTabChange = { tab = it },
        forecastRoute = forecastRoute,
        onForecastRouteChange = { forecastRoute = it },
        yearDownloadFailed = yearDownloadStatus is YearDownloadStatus.Failed,
        // AN-PULL (R484): the person asks again for the years that failed.
        onRetryDownload = yearDownload.retry,
        // AN-RECON: the comparison overlay - drawn by MainTabs since IOS-SHELL-3 R1372 - for the year held above.
        comparisonYear = comparisonYear,
        onComparisonYearChange = { comparisonYear = it },
        employerStore = employerStore,
        // AN-ALERT: the contextual opt-in offer enables the alert (via the OS prompt).
        onEnableAlert = thresholdAlertOffer(onToggleThresholdAlert),
        parametresTab = { state, onOpenRhythm ->
            ParametresTab(
                state = state,
                controller = controllers.parametres,
                // R316: ON launches the disclosure (then the OS prompt); OFF stops at once, no dialog
                // (SPEC 13), straight through the controller.
                // AN-PLAY-PACK (R1124): no handler in a build without detection, so no detection entry point.
                onToggleAuto =
                    if (hasDetection) {
                        { enable ->
                            if (enable) {
                                showDisclosure = true
                            } else {
                                controllers.parametres.setAutoDetection(
                                    false,
                                )
                            }
                        }
                    } else {
                        null
                    },
                onToggleEvening = onToggleEvening,
                // AN-ALERT: ON asks POST_NOTIFICATIONS (API 33+) then enables; OFF is immediate.
                onToggleThresholdAlert = onToggleThresholdAlert,
                onOpenLegal = { openLegal(context, it) },
                onOpenRhythm = onOpenRhythm,
            )
        },
        // AN-SIM: system back from the simulator returns to Prevision; the other routes close to the tab beneath.
        overlayBackHandler = { onBack -> BackHandler(onBack = onBack) },
    )

    // AN-RECON: the employer comparison's overlay is drawn by MainTabs (IOS-SHELL-3 R1372 moved it there, unchanged,
    // so iOS draws the same one); its open year is held above, its back is the overlay slot's BackHandler.

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
    onToggleAuto: ((Boolean) -> Unit)?,
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
        showAddress = { toastNotices(context).show(ParametresCopy.legalNoHandler(it)) },
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
        toastNotices(context).show(ch.monreleve.app.fr.CodeCopy.NO_MAIL_APP)
    }
}

/**
 * AN-ALERT: Prevision's contextual offer turns the threshold alert ON through the same toggle as the Parametres switch
 * (the OS prompt first). IOS-SHELL-3 R1375: named, and internal with parametresActions below, so the presence control
 * (ThresholdAlertPresenceTest) renders both entry points with the handlers MainShell actually builds.
 */
internal fun thresholdAlertOffer(onToggleThresholdAlert: (Boolean) -> Unit): (() -> Unit)? =
    { onToggleThresholdAlert(true) }

// LongParameterList suppressed as the composition root's helpers are: a plain pass-through of the screen's
// callbacks (now with the threshold-alert toggle), not tangled logic. Internal for R1375's presence control.
@Suppress("LongParameterList")
internal fun parametresActions(
    controller: ParametresController,
    onToggleAuto: ((Boolean) -> Unit)?,
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
// IOS-SHELL-2 (R1331): the mapping from the event to what the person meets is the common handleExportEvent
// (:shared NoticeSink.kt), which iOS calls too; Android's share and its Toast are passed in, unchanged.
private fun handleExport(
    context: Context,
    event: ExportEvent,
) = handleExportEvent(event, share = { shareFile(context, it) }, notices = toastNotices(context))

// IOS-SHELL-2 (R1331): Android's side of the ONE notice seam (NoticeSink, :shared NoticeSink.kt) - the Toast every
// site here showed, unchanged (LENGTH_LONG). iOS puts its own transient notice behind the same seam.
private fun toastNotices(context: Context): NoticeSink =
    NoticeSink { message -> Toast.makeText(context, message, Toast.LENGTH_LONG).show() }

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
