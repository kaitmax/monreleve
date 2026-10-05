package ch.monreleve.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
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
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.PendingSignInStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.auth.SignInSnapshot
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.SharedPrefsDossierCache
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.detection.BACKGROUND_LOCATION
import ch.monreleve.app.detection.EXTRA_OPEN_AUJOURDHUI
import ch.monreleve.app.detection.FINE_LOCATION
import ch.monreleve.app.detection.POST_NOTIFICATIONS_PERMISSION
import ch.monreleve.app.detection.locationFullyGranted
import ch.monreleve.app.fr.DisclosureCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.AccountExportKind
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.openLegalLink
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.releve.ExportKind
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.startup.StartDestination
import ch.monreleve.app.startup.decideStartAfterSignIn
import ch.monreleve.app.startup.meFetchOf
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiActions
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.calendrier.CalendarActions
import ch.monreleve.app.ui.screens.calendrier.CalendrierScreen
import ch.monreleve.app.ui.screens.disclosure.DisclosureScreen
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
import ch.monreleve.app.ui.screens.parametres.ParametresActions
import ch.monreleve.app.ui.screens.parametres.ParametresScreen
import ch.monreleve.app.ui.screens.releve.ReleveActions
import ch.monreleve.app.ui.screens.releve.ReleveScreen
import ch.monreleve.app.ui.screens.signin.RequestLinkScreen
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

// AN12: the cacheDir subdirectory an export is written to before the share sheet. ONE home (R206): shareFile
// writes here and the device erasure deletes here, so a rendered export - the account JSON is the whole record
// - cannot outlive the account it belongs to (R289).
private const val EXPORTS_DIR = "exports"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = applicationContext
        val api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
        val tokenStore = KeystoreTokenStore(context)
        val session = SessionManager(api, tokenStore)
        val settingsStore: SettingsStore = SharedPrefsSettingsStore(context)
        val pending = SharedPrefsPendingSignInStore(context)
        val accountStore = SharedPrefsAccountStore(context)
        val clock = Clock.systemDefaultZone()
        // AN-FIX F4 / R303: the record is scoped to the account signed in RIGHT NOW. A new account signs in
        // through CallbackActivity, which restarts this activity, so onCreate re-reads the current tag; an
        // expired session has no current account, so the shell shows nothing rather than the previous
        // account's days.
        val repository: EntryRepository =
            LocalEntryRepository(MonReleveDatabase.get(context).entryDao(), clock, accountStore.current())
        // AN11: the Releve reads GET /api/v1/dossier through the session (R210 refresh handling included), and
        // caches the last body per year so an offline reader gets a dated copy rather than a blank screen (R288).
        val dossierCache = SharedPrefsDossierCache(context)
        val dossierApi = DossierApi(session::authenticatedGet, dossierCache)
        // AN12 increment 2 (R295): the device-wide erasure (built by buildLocalStore, below).
        val localStore = buildLocalStore(context, tokenStore, settingsStore, dossierCache, pending, accountStore)
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
                    LaunchedEffect(Unit) { destination = sessionReconciled(destination, start) }
                    when (destination) {
                        Destination.SIGN_IN -> SignInRoute(api, pending, lifecycleScope)
                        Destination.RESOLVING ->
                            ResolvingRoute(session, settingsStore) { destination = it }
                        Destination.ONBOARDING ->
                            OnboardingRoute(session, settingsStore, taxYear, lifecycleScope) {
                                destination = Destination.MAIN
                            }
                        Destination.MAIN ->
                            MainShell(
                                repository,
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
                                localStore = localStore,
                                authenticatedPost = session::authenticatedPost,
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

@Composable
private fun SignInRoute(
    api: AuthApi,
    pending: SharedPrefsPendingSignInStore,
    scope: CoroutineScope,
) {
    // AN-STATE (R310): the typed email (and a stable phase) survive a rebuild. The snapshot is held in
    // rememberSaveable and kept current from the controller's state; the seed re-creates the controller with it.
    var saved by rememberSaveable { mutableStateOf<SignInSnapshot?>(null) }
    val controller = remember { SignInController(api, pending, scope, restored = saved) }
    val state by controller.state.collectAsState()
    LaunchedEffect(controller) {
        controller.state.collect { saved = SignInSnapshot(it.email, it.phase) }
    }
    RequestLinkScreen(
        state = state,
        onEmailChange = controller::onEmailChange,
        onSubmit = controller::submit,
        onRetry = controller::retry,
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
    onResolved: (Destination) -> Unit,
) {
    LaunchedEffect(Unit) {
        val decision = decideStartAfterSignIn({ meFetchOf(session.authenticatedGet(ME_PATH)) }, settingsStore)
        onResolved(
            when (decision) {
                StartDestination.MAIN -> Destination.MAIN
                StartDestination.ONBOARDING -> Destination.ONBOARDING
                StartDestination.SIGN_IN -> Destination.SIGN_IN
            },
        )
    }
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
private fun OnboardingRoute(
    session: SessionManager,
    store: SettingsStore,
    taxYear: Int,
    scope: CoroutineScope,
    onDone: () -> Unit,
) {
    // AN-STATE (R310): the values entered so far survive a rebuild (rememberSaveable snapshot kept current from
    // the controller's state; the seed re-creates the controller with it).
    var saved by rememberSaveable { mutableStateOf<OnboardingSnapshot?>(null) }
    val controller =
        remember { OnboardingController(SessionSettingsSaver(session), store, taxYear, scope, restored = saved) }
    val state by controller.state.collectAsState()
    LaunchedEffect(controller) {
        controller.state.collect {
            saved =
                OnboardingSnapshot(
                    it.canton, it.employmentRate, it.denominator, it.exactTotalWorkDays, it.granularity,
                    it.activityStartDate,
                )
        }
    }
    LaunchedEffect(state.phase) {
        if (state.phase == OnboardingPhase.SAVED) onDone()
    }
    OnboardingScreen(
        state = state,
        actions =
            OnboardingActions(
                onCantonChange = controller::onCantonChange,
                onEmploymentRateChange = controller::onEmploymentRateChange,
                onDenominatorChange = controller::onDenominatorChange,
                onExactTotalChange = controller::onExactTotalChange,
                onGranularityChange = controller::onGranularityChange,
                onActivityStartDateChange = controller::onActivityStartDateChange,
                onSubmit = controller::submit,
            ),
    )
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
    store: SettingsStore,
    taxYear: Int,
    clock: Clock,
    scope: CoroutineScope,
    requestSync: () -> Unit,
    dossierFetch: suspend (Int) -> DossierResult,
    exportBytes: suspend (String) -> BytesOutcome,
    settingsSaver: SettingsSaver,
    revokeServer: suspend () -> Unit,
    localStore: LocalStore,
    authenticatedPost: suspend (String, String) -> PostOutcome,
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
            repository, store, taxYear, clock, scope, requestSync, dossierFetch, exportBytes, settingsSaver,
            revokeServer, localStore, authenticatedPost,
        )
    var tab by rememberShellTab()

    val aujourdhuiState by controllers.aujourdhui.state.collectAsState()
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

    // R323 / D16: a notification tap opens Aujourd'hui (and records nothing). The launch intent carries
    // EXTRA_OPEN_AUJOURDHUI; consume it once on composition, select the tab and refresh today's surface.
    LaunchedEffect(Unit) {
        val activity = context as? android.app.Activity
        if (activity?.intent?.getBooleanExtra(EXTRA_OPEN_AUJOURDHUI, false) == true) {
            tab = AppTab.AUJOURDHUI
            controllers.aujourdhui.refresh()
            activity.intent.removeExtra(EXTRA_OPEN_AUJOURDHUI)
        }
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
                    if (selected == AppTab.AUJOURDHUI) controllers.aujourdhui.refresh()
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
                            ),
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
                        onOpenLegal = { openLegal(context, it) },
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
        clearRecord = { withContext(Dispatchers.IO) { MonReleveDatabase.get(context).clearAllTables() } },
        cancelSync = { SyncScheduler.cancel(context) },
        clearExports = { java.io.File(context.cacheDir, EXPORTS_DIR).deleteRecursively() },
    )

// AN12: the Parametres screen's callbacks, built from the controller's method references. A top-level helper
// (not inline in MainShell) so the shell composable stays within its length budget; a plain mapping, not a
// Composable, so it carries no state.
// AN12: the Parametres tab. Extracted from MainShell (its own length budget) so the shell's `when (tab)` stays
// a line per destination. Reads the app version from BuildConfig here in the composition root, where it is
// permitted, and hands it to the stateless screen as a formatted string (fence 5 / R181).
@Composable
private fun ParametresTab(
    state: ParametresState,
    controller: ParametresController,
    onToggleAuto: (Boolean) -> Unit,
    onToggleEvening: (Boolean) -> Unit,
    onOpenLegal: (LegalPage) -> Unit,
) {
    ParametresScreen(
        state = state,
        actions = parametresActions(controller, onToggleAuto, onToggleEvening, onOpenLegal),
        appVersion = ParametresCopy.version(BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE.toString()),
    )
}

// AN12 increment 4: open a legal page in the browser from the configured site URL. The host is
// BuildConfig.API_BASE_URL - the emulator's host in debug, monreleve.ch in release - and the path is the
// LegalPage's (a verified live web route). Lives in the composition root, where an Intent is permitted.
private fun openLegal(
    context: Context,
    page: LegalPage,
) {
    // R299: a device with no browser (a managed profile, a kiosk) would crash on startActivity; openLegalLink
    // catches that and shows the address instead. The launch and the fallback toast are the seams it wraps.
    openLegalLink(
        url = "${BuildConfig.API_BASE_URL}${page.path}",
        open = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) },
        showAddress = { Toast.makeText(context, ParametresCopy.legalNoHandler(it), Toast.LENGTH_LONG).show() },
    )
}

private fun parametresActions(
    controller: ParametresController,
    onToggleAuto: (Boolean) -> Unit,
    onToggleEvening: (Boolean) -> Unit,
    onOpenLegal: (LegalPage) -> Unit,
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
        onRequestDelete = controller::requestDelete,
        onConfirmDelete = controller::confirmDelete,
        onCancelDelete = controller::cancelDelete,
        onAcknowledgeDelete = controller::acknowledgeDelete,
        onOpenLegal = onOpenLegal,
        // R316: the toggle is GATED - ON launches the disclosure first (the shell handles it), OFF is immediate.
        onToggleAutoDetection = onToggleAuto,
        // R323: ON asks POST_NOTIFICATIONS (API 33+) then enables; OFF is immediate (the shell handles the ask).
        onToggleEveningNotification = onToggleEvening,
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
