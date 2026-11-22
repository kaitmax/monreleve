package ch.monreleve.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calendar.CalendarSnapshot
import ch.monreleve.app.calendar.SelectionSnapshot
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.detection.DetectionScheduling
import ch.monreleve.app.detection.SharedPrefsNearBorderNoticeStore
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.forecast.SimulationSnapshot
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.ParametresSnapshot
import ch.monreleve.app.parametres.orgJsonParametresWire
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import ch.monreleve.app.settings.SharedPrefsThresholdAlertStore
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

// AN-FORCED-SIGNOUT (R521). THE DESTINATION'S SAVER RECONCILES AS IT RESTORES. sessionReconciled ran only in a
// LaunchedEffect - AFTER the first frame had composed the restored destination. A MAIN restored with no session then
// built the shell's controllers for one frame, and ParametresController requires settings (checkNotNull): R521 clears
// them on a sign-out nobody asked for, so a session the worker ended in the background, then a process death, would
// restore MAIN onto no settings and crash before the reconcile ran. Reconciled here, the first frame is already right.
internal fun destinationSaver(start: Destination): Saver<Destination, Destination> =
    Saver(save = { it }, restore = { sessionReconciled(saved = it, start = start) })

// The destination decided once at launch, from two facts - is there a session, and is this device onboarded. Moved
// out of MainActivity.onCreate unchanged (AN-FORCED-SIGNOUT, R521) so a JVM test can ask it: PARK-T2's link half was a
// sign-in by link on a phone whose settings had survived a forced sign-out, which this sent straight to MAIN on them.
internal fun startDestination(
    signedIn: Boolean,
    onboarded: Boolean,
): Destination =
    when {
        !signedIn -> Destination.SIGN_IN
        onboarded -> Destination.MAIN
        // R297: signed in but no local settings - a fresh account, or a re-sign-in after a sign-out cleared them.
        // Consult the server (GET /api/v1/me) before onboarding, so settings the server holds are restored rather
        // than re-asked.
        else -> Destination.RESOLVING
    }

// AN-FORCED-SIGNOUT (R520). WHERE THE PERSON GOES WHEN THE SERVER ENDS THE SESSION WHILE THE APP IS OPEN: to sign-in,
// from any screen - the shell, onboarding, RESOLVING - never left on a signed-in screen whose only way out was the
// voluntary sign-out that wipes the days this keeps (PARK-T1). `start` above decides it at launch; this decides it on
// the process's session-end signal, which arrives while the app is already open. Still signed in by the time the
// signal is read (a new sign-in saved its pair first) leaves the person where they are. Pure, so
// SessionReconciledTest's shape covers it on the JVM.
internal fun destinationAfterSessionEnd(
    current: Destination,
    signedIn: Boolean,
): Destination = if (signedIn) current else Destination.SIGN_IN

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
 *
 * LongMethod suppressed as MainShell is (MainActivity): this is the composition root's state holder - the
 * rememberSaveable seeds and the snapshot collectors, one per controller - not tangled logic. Each feature
 * (calendar, parametres, simulation, the releve's year) adds a seed + a collector here by construction.
 */
@Suppress("LongParameterList", "LongMethod")
@Composable
fun rememberMainControllers(
    repository: EntryRepository,
    rhythmRepository: RhythmRepository,
    store: SettingsStore,
    taxYear: Int,
    clock: Clock,
    scope: kotlinx.coroutines.CoroutineScope,
    requestSync: () -> Unit,
    dossierFetch: suspend (Int) -> DossierResult,
    dossierStaleCopy: (Int) -> DossierDocument?,
    exportBytes: suspend (String) -> BytesOutcome,
    settingsSaver: SettingsSaver,
    revokeServer: suspend () -> Unit,
    localStore: LocalStore,
    authenticatedPost: suspend (String, String) -> PostOutcome,
    // AN-POLISH (R440): the bounded drain sign-out attempts before it discards anything.
    syncNow: suspend () -> Unit,
): MainControllers {
    // AN-STATE (R310): the restorable state the controllers are seeded with, held here in rememberSaveable so it
    // survives rotation, a text-size change, a dark-mode switch AND a background kill (the Bundle outlives
    // process death). Int?/String? are stored by the default autoSaver, so no custom Saver is needed.
    var savedMonth by rememberSaveable { mutableStateOf<Int?>(null) }
    var savedEditingDay by rememberSaveable { mutableStateOf<String?>(null) }
    // AN-CAL2 (R310): the multi-day selection. SelectionSnapshot is Serializable, so the default autoSaver
    // stores it in the Bundle, which outlives both a config change and a background kill (C2). Null = not selecting.
    var savedSelection by rememberSaveable { mutableStateOf<SelectionSnapshot?>(null) }
    // ParametresSnapshot is Serializable, so the default autoSaver stores it (no custom Saver).
    var savedParametres by rememberSaveable { mutableStateOf<ParametresSnapshot?>(null) }
    // AN-SIM (R310): the simulator's open scenario and its inputs. SimulationSnapshot is Serializable, so the
    // default autoSaver stores it in the Bundle, which outlives a config change AND a background kill. Null = the
    // simulator has not been opened (or its state has not settled). The computed view is NOT stored (R181).
    var savedSimulation by rememberSaveable { mutableStateOf<SimulationSnapshot?>(null) }
    // PARKAN-26 (R310): the releve's selected year. An Int? stored by the default autoSaver, so it survives a
    // rotation, a text-size change, a dark-mode switch AND a background kill (the Bundle outlives process death).
    // Null = a fresh build opens on the current year.
    var savedSelectedYear by rememberSaveable { mutableStateOf<Int?>(null) }
    // AN-AUTO increment 2 (R315): the device's logging-mode cache, built at the composition boundary where a
    // Context is available (ui/ and the controllers may not touch one). Persistent across rebuilds by itself
    // (SharedPreferences), so it needs no rememberSaveable.
    val context = LocalContext.current
    val controllers =
        remember {
            MainGraph.build(
                repository, rhythmRepository, store, taxYear, clock, scope, requestSync, dossierFetch, dossierStaleCopy,
                exportBytes, settingsSaver, revokeServer, localStore, authenticatedPost, syncNow,
                restoredCalendar = CalendarSnapshot(savedMonth, savedEditingDay, savedSelection),
                restoredParametres = savedParametres,
                restoredSimulation = savedSimulation,
                restoredSelectedYear = savedSelectedYear,
                detectionModeStore = SharedPrefsDetectionModeStore(context),
                // R315/incr 4: enabling auto mode starts the WorkManager sampler; disabling stops it at once
                // and clears the day's cursor. The permission that lets a wake get a fix is granted by R316's
                // flow before the enable call.
                startSampling = { DetectionScheduling.startSampling(context) },
                stopSampling = { DetectionScheduling.stopSampling(context) },
                // AN-AUTO increment 5: the Aujourd'hui auto surface reads the day's tally (coordinate-free, Room's
                // daily_tally) and the near-border "told once" flag. The DAO flow emits as the background sampler
                // writes, so ETAT A becomes ETAT B without a manual refresh.
                detectionTallies = MonReleveDatabase.get(context).tallyDao().observeAll(),
                nearBorderNoticeStore = SharedPrefsNearBorderNoticeStore(context),
                // R323 / PARKAN-36: the evening proposal notification's opt-in store (shares monreleve.detection,
                // so sign-out's clear sweeps it). The Parametres toggle reads/writes it; the worker reads it too.
                eveningNotificationStore = SharedPrefsEveningNotificationStore(context),
                // AN-ALERT: the threshold alert's store (shares monreleve.detection, so sign-out sweeps the
                // opt-in and the crossing state). The Parametres toggle and Prevision offer read/write it; the
                // alert evaluation reads it too.
                thresholdAlertStore = SharedPrefsThresholdAlertStore(context),
                // IOS-MOVE-GRAPH (R1310): the Parametres wire, the object :app's controller factory always used.
                parametresWire = orgJsonParametresWire,
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
            // AN-CAL2 (R310): snapshot the selection while it is active, null when not - so a rebuild restores
            // the chosen days and the anchor, and a cancelled selection restores as not-selecting.
            savedSelection =
                if (s.selection.active) SelectionSnapshot(s.selection.days.toList(), s.selection.anchor) else null
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
    // AN-SIM (R310): snapshot the simulator's chosen scenario and its raw inputs, so a rebuild reopens the same
    // scenario with the same half-entered values. The computed view is left out by construction - it is recomputed
    // from the record and the rhythm on restore (R181), never stored.
    LaunchedEffect(controllers) {
        controllers.simulation.state.collect { s ->
            savedSimulation = SimulationSnapshot(scenario = s.scenario, inputs = s.inputs)
        }
    }
    // PARKAN-26 (R310): snapshot the releve's selected year from its own flow, so a rebuild reopens the same year.
    // Read from the controller's flow (not the Loaded state) so it is captured even while the document is Loading.
    LaunchedEffect(controllers) {
        controllers.releve.selectedYear.collect { savedSelectedYear = it }
    }
    return controllers
}
