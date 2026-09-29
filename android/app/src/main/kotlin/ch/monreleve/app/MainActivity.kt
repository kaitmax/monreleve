package ch.monreleve.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.SharedPrefsDossierCache
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.releve.ExportKind
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.calendrier.CalendarActions
import ch.monreleve.app.ui.screens.calendrier.CalendrierScreen
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
private enum class Destination { SIGN_IN, ONBOARDING, MAIN }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = applicationContext
        val api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
        val tokenStore = KeystoreTokenStore(context)
        val session = SessionManager(api, tokenStore)
        val settingsStore: SettingsStore = SharedPrefsSettingsStore(context)
        val pending = SharedPrefsPendingSignInStore(context)
        val clock = Clock.systemDefaultZone()
        val repository: EntryRepository = LocalEntryRepository(MonReleveDatabase.get(context).entryDao(), clock)
        // AN11: the Releve reads GET /api/v1/dossier through the session (R210 refresh handling included), and
        // caches the last body per year so an offline reader gets a dated copy rather than a blank screen (R288).
        val dossierApi = DossierApi(session::authenticatedGet, SharedPrefsDossierCache(context))
        // R28: the tax year is the Paris calendar year, not the device's. The composition root is
        // the one place a clock is allowed; the engine and the aggregation stay clock-free.
        val taxYear = Year.now(ZoneId.of("Europe/Paris")).value

        val start =
            when {
                !session.isSignedIn() -> Destination.SIGN_IN
                !settingsStore.isOnboarded() -> Destination.ONBOARDING
                else -> Destination.MAIN
            }

        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    var destination by remember { mutableStateOf(start) }
                    when (destination) {
                        Destination.SIGN_IN -> SignInRoute(api, pending, lifecycleScope)
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
    val controller = remember { SignInController(api, pending, scope) }
    val state by controller.state.collectAsState()
    RequestLinkScreen(
        state = state,
        onEmailChange = controller::onEmailChange,
        onSubmit = controller::submit,
        onRetry = controller::retry,
    )
}

@Composable
private fun OnboardingRoute(
    session: SessionManager,
    store: SettingsStore,
    taxYear: Int,
    scope: CoroutineScope,
    onDone: () -> Unit,
) {
    val controller = remember { OnboardingController(SessionSettingsSaver(session), store, taxYear, scope) }
    val state by controller.state.collectAsState()
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
@Suppress("LongParameterList")
@Composable
private fun MainShell(
    repository: EntryRepository,
    store: SettingsStore,
    taxYear: Int,
    clock: Clock,
    scope: CoroutineScope,
    requestSync: () -> Unit,
    dossierFetch: suspend (Int) -> DossierResult,
    exportBytes: suspend (String) -> BytesOutcome,
    settingsSaver: SettingsSaver,
) {
    // R291: the controllers are built by MainGraph, the ONE construction site MainGraphWiringTest also
    // calls - so the graph the JVM test checks is the graph the app uses. SPEC 13.2: both day-writers are
    // built with requestSync, and the test fails if either is not (the AN10 calendar-never-synced bug,
    // which hid because this wiring lived inside a Composable no JVM test reaches, R176/R204). AN11 adds
    // the Releve controller; AN12 adds the Parametres controller, wired with the /api/v1/me PATCH seam.
    val controllers =
        remember {
            MainGraph.build(
                repository, store, taxYear, clock, scope, requestSync, dossierFetch, exportBytes, settingsSaver,
            )
        }
    var tab by remember { mutableStateOf(AppTab.AUJOURDHUI) }

    val aujourdhuiState by controllers.aujourdhui.state.collectAsState()
    val calendarState by controllers.calendar.state.collectAsState()
    val releveState by controllers.releve.state.collectAsState()
    val parametresState by controllers.parametres.state.collectAsState()

    // AC2 / R136: an export event carries the server-rendered file to the platform share sheet. Handled at
    // the shell level (not inside the Releve tab) so a switch of tab after the tap does not cancel the hand-off.
    val context = LocalContext.current
    LaunchedEffect(controllers.releve) {
        controllers.releve.exportEvents.collect { event -> handleExport(context, event) }
    }

    Scaffold(bottomBar = { AppBottomBar(selected = tab, onSelect = { tab = it }) }) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                AppTab.AUJOURDHUI ->
                    AujourdhuiScreen(state = aujourdhuiState, onRecord = controllers.aujourdhui::record)
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
                    ParametresScreen(state = parametresState, actions = parametresActions(controllers.parametres))
            }
        }
    }
}

// AN12: the Parametres screen's callbacks, built from the controller's method references. A top-level helper
// (not inline in MainShell) so the shell composable stays within its length budget; a plain mapping, not a
// Composable, so it carries no state.
private fun parametresActions(controller: ParametresController): ParametresActions =
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
    val dir = java.io.File(context.cacheDir, "exports").apply { mkdirs() }
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
