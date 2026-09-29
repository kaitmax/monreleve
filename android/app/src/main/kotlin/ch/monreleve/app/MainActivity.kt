package ch.monreleve.app

import android.os.Bundle
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
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.SharedPrefsPendingSignInStore
import ch.monreleve.app.auth.SignInController
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.calendrier.CalendarActions
import ch.monreleve.app.ui.screens.calendrier.CalendrierScreen
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
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
                            MainShell(repository, settingsStore, taxYear, clock, lifecycleScope) {
                                // SPEC 13.2: recording enqueues the drain; WorkManager replays on connectivity.
                                SyncScheduler.requestSync(context)
                            }
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
) {
    // R291: BOTH controllers are built by MainGraph, the ONE construction site MainGraphWiringTest also
    // calls - so the graph the JVM test checks is the graph the app uses. SPEC 13.2: both are built with
    // requestSync, and the test fails if either is not (the AN10 calendar-never-synced bug, which hid
    // because this wiring lived inside a Composable no JVM test reaches, R176/R204).
    val controllers = remember { MainGraph.build(repository, store, taxYear, clock, scope, requestSync) }
    var tab by remember { mutableStateOf(AppTab.AUJOURDHUI) }

    val aujourdhuiState by controllers.aujourdhui.state.collectAsState()
    val calendarState by controllers.calendar.state.collectAsState()

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
            }
        }
    }
}
