package ch.monreleve.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calendar.CalendarSnapshot
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.ParametresSnapshot
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.ui.shell.AppTab
import java.time.Clock

// AN-STATE (R310). The main shell's STATE-HOLDING, moved OUT of the MainShell Composable into named seams -
// the same move R291 made for the WIRING, now for the state. WHY: the operator's finding was that rotating
// (or any rebuild - a text-size change, a dark-mode switch, a background kill) returned the app to its home
// screen. The cause was `var tab by remember { mutableStateOf(AUJOURDHUI) }` and `remember { MainGraph.build }`
// in MainShell: `remember` dies with the composition, so every rebuild reset the tab to the start screen and
// rebuilt the controllers from scratch, dropping the open sheet, the chosen month and every half-entered value.
//
// A seam a test can render. MainShell is a Composable no JVM test reaches (the AN10 bug lived there for the
// same reason); these seams are what StatePreservationInstrumentedTest drives under StateRestorationTester, so
// the regression the operator saw has a test that FAILS on the broken version and passes on the fixed one -
// the RED DEVICE-LOOP's D5 could never produce (it only asked "does rotation crash", on the start screen).
//
// R291 PRESERVED. rememberMainControllers still builds through MainGraph.build - the ONE construction site the
// wiring test also calls - so the DayWriter/requestSync census is unaffected; the seam only decides the state's
// LIFETIME, not the graph's shape.

// AN-STATE (R310): a destination restored across a rebuild, reconciled against the current session. A saved
// MAIN restored after a sign-out-while-backgrounded (or an expiry) would land an unsigned shell, so when the
// recomputed `start` says SIGN_IN (no session) that wins. A restored in-flight RESOLVING is re-decided. A
// saved ONBOARDING/MAIN is honoured while signed in - so a rotation mid-onboarding stays on onboarding rather
// than re-running the RESOLVING network round-trip. Pure, so SessionReconciledTest covers it on the JVM.
internal fun sessionReconciled(
    saved: Destination,
    start: Destination,
): Destination = if (start == Destination.SIGN_IN || saved == Destination.RESOLVING) start else saved

/**
 * The selected bottom-navigation tab. The operator's finding: with `remember` this reset to Aujourd'hui on
 * every rebuild. rememberSaveable keeps it across ALL FOUR triggers - rotation, a text-size change, a
 * dark-mode switch and a background kill - because AppTab is an enum (Serializable), so the default autoSaver
 * stores it in the saved-instance-state Bundle, which survives process death, not only a config change. No
 * ViewModel is needed: the tab is pure UI selection, and saved state outlives the activity by construction.
 */
@Composable
fun rememberShellTab(): MutableState<AppTab> = rememberSaveable { mutableStateOf(AppTab.AUJOURDHUI) }

/**
 * The shell's controllers, built once through MainGraph.build (R291 - the construction site the wiring test
 * checks). Held here so their state's lifetime is decided in one testable place rather than inline in MainShell.
 */
@Suppress("LongParameterList")
@Composable
fun rememberMainControllers(
    repository: EntryRepository,
    store: SettingsStore,
    taxYear: Int,
    clock: Clock,
    scope: kotlinx.coroutines.CoroutineScope,
    requestSync: () -> Unit,
    dossierFetch: suspend (Int) -> DossierResult,
    exportBytes: suspend (String) -> BytesOutcome,
    settingsSaver: SettingsSaver,
    revokeServer: suspend () -> Unit,
    localStore: LocalStore,
    authenticatedPost: suspend (String, String) -> PostOutcome,
): MainControllers {
    // AN-STATE (R310): the restorable state the controllers are seeded with, held here in rememberSaveable so it
    // survives rotation, a text-size change, a dark-mode switch AND a background kill (the Bundle outlives
    // process death). Int?/String? are stored by the default autoSaver, so no custom Saver is needed.
    var savedMonth by rememberSaveable { mutableStateOf<Int?>(null) }
    var savedEditingDay by rememberSaveable { mutableStateOf<String?>(null) }
    // ParametresSnapshot is Serializable, so the default autoSaver stores it (no custom Saver).
    var savedParametres by rememberSaveable { mutableStateOf<ParametresSnapshot?>(null) }
    // AN-AUTO increment 2 (R315): the device's logging-mode cache, built at the composition boundary where a
    // Context is available (ui/ and the controllers may not touch one). Persistent across rebuilds by itself
    // (SharedPreferences), so it needs no rememberSaveable.
    val context = LocalContext.current
    val controllers =
        remember {
            MainGraph.build(
                repository, store, taxYear, clock, scope, requestSync, dossierFetch, exportBytes, settingsSaver,
                revokeServer, localStore, authenticatedPost,
                restoredCalendar = CalendarSnapshot(savedMonth, savedEditingDay),
                restoredParametres = savedParametres,
                detectionModeStore = SharedPrefsDetectionModeStore(context),
            )
        }
    // Keep the saved snapshots current from the controllers' observed state, so the LATEST month, open sheet,
    // edited fields and open confirmation are what a rebuild restores. Writing a snapshot MutableState from the
    // collector is thread-safe. The parametres snapshot carries WHICH confirmation is open (a flag), never the
    // computed before/after or a count - those are re-derived on restore (R181).
    LaunchedEffect(controllers) {
        controllers.calendar.state.collect { s ->
            savedMonth = s.monthView?.month
            savedEditingDay = s.editing?.isoDate
        }
    }
    LaunchedEffect(controllers) {
        controllers.parametres.state.collect { s ->
            savedParametres =
                ParametresSnapshot(
                    canton = s.canton,
                    employmentRate = s.employmentRate,
                    denominator = s.denominator,
                    exactTotalWorkDays = s.exactTotalWorkDays,
                    granularity = s.granularity,
                    activityStartDate = s.activityStartDate,
                    saveConfirmOpen = s.pendingRateChange != null,
                    signOutOpen = s.signOutPrompt != null,
                    deleteOpen = s.deletePrompt != null,
                )
        }
    }
    return controllers
}
