package ch.monreleve.app

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.calendar.CalendarSnapshot
import ch.monreleve.app.data.local.TallyEntity
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.detection.InMemoryNearBorderNoticeStore
import ch.monreleve.app.detection.NearBorderNoticeStore
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.forecast.ForecastController
import ch.monreleve.app.forecast.SimulationController
import ch.monreleve.app.forecast.SimulationSnapshot
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresSnapshot
import ch.monreleve.app.parametres.ParametresWire
import ch.monreleve.app.releve.ReleveController
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.EveningNotificationStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import ch.monreleve.app.settings.InMemoryThresholdAlertStore
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.ThresholdAlertStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.datetime.TimeZone
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

// AN10b increment 2 (R291). The composition root's controller wiring, moved OUT of the MainShell
// Composable so a plain JVM test can reach it.
//
// WHY THIS FILE EXISTS. AN10's walkthrough found a calendar that recorded to Room but never synced:
// MainShell built CalendarController WITHOUT requestSync (SPEC 13.2), inside a Composable, where no JVM
// test reaches - only driving the app end to end caught it (R176/R204). The controller's own unit test
// passed because it injects requestSync; the bug lived in the WIRING, not the controller. A wiring that
// lives in a Composable is a wiring no gate can check.
//
// IOS-MOVE-GRAPH (R1310): THE ONE GRAPH, IN :shared commonMain - every platform's shell builds its controllers here, so
// the wiring pins run against the graph iOS gets as well as Android's. It moved from :app with one change of
// signature: the clock is kotlin.time's, and the device's zone (which a java.time Clock used to carry) is passed
// beside it, so the controllers are built with their own constructors. Android converts its java.time Clock at its
// call site (ShellState.kt), with the same converters :app's JavaTime* factories use - the same instant source and
// the same zone they handed over before. MainGraphWiringPinTest (commonTest) pins the sync wiring on the JVM and the
// iOS simulator; MainGraphDayWriterCensusTest stays in :app because its census is JVM reflection.

/** The controllers the main shell drives, built once by [MainGraph.build]. */
class MainControllers(
    val aujourdhui: AujourdhuiController,
    val calendar: CalendarController,
    // AN11: the Releve controller. NOT a DayWriter (it reads the server's document, it records nothing), so
    // the requestSync census (MainGraphDayWriterCensusTest) is unaffected - it filters by the DayWriter type.
    val releve: ReleveController,
    // AN12: the Parametres controller. NOT a DayWriter either (it edits settings and account state, it never
    // records a day), so it is outside the requestSync census by the same DayWriter filter.
    val parametres: ParametresController,
    // AN-FORECAST: the forecast controller. NOT a DayWriter - it writes only the local weekly rhythm (a
    // planning preference, R341), never a day record (R340), so the requestSync census does not include it.
    val forecast: ForecastController,
    // AN-SIM: the simulation controller. NOT a DayWriter - it has NO save/record seam at all (R340); adopting a
    // weekday is the ForecastController's setDay, so the requestSync census does not include it either.
    val simulation: SimulationController,
)

/**
 * The one construction site for the shell's controllers. MainShell calls [build]; MainGraphWiringPinTest and
 * MainGraphDayWriterCensusTest call [build]; so the graph the tests check IS the graph the app uses. A controller
 * wired here without requestSync fails the test AND breaks the app - the two cannot diverge, which is the whole
 * point: the AN10 bug lived where no test could see it.
 */
object MainGraph {
    // The composition root's dependency list, moved here verbatim from MainShell (which carries the same
    // suppression for the same reason): these ARE the graph's dependencies, and bundling them into a
    // holder would only move the list. The point of R291 is that this list is now in a plain object a
    // JVM test can build, not that it is shorter.
    // KMP-DT R590: the kotlin.time.Clock seam handed to four controllers - function scope, on the allowlist.
    // LongMethod (IOS-MOVE-GRAPH R1310): the body is one expression, a constructor per controller with its arguments
    // NAMED - same-typed neighbours (startSampling/stopSampling, revokeServer/syncNow) cannot swap unseen.
    @Suppress("LongParameterList", "LongMethod")
    @OptIn(ExperimentalTime::class)
    fun build(
        repository: EntryRepository,
        // AN-FORECAST: the account-tagged weekly-rhythm store (R341), built in the composition root with the
        // SAME account tag as [repository] so the rhythm is scoped to the account signed in now (R303).
        rhythmRepository: RhythmRepository,
        settingsStore: SettingsStore,
        taxYear: Int,
        // IOS-MOVE-GRAPH (R1310): the instant source and the device's zone - the two things a java.time Clock carried.
        // The zone reaches only Aujourd'hui, where the device's claimed time is written (its JavaTime factory's split).
        clock: Clock,
        deviceZone: TimeZone,
        scope: CoroutineScope,
        requestSync: () -> Unit,
        // AN11: the Releve controller's fetch seam (DossierApi::fetch in the app; a stub in tests), the same
        // lambda-seam idiom as requestSync. It reads GET /api/v1/dossier through the session.
        dossierFetch: suspend (Int) -> DossierResult,
        // AN-RELEVE-FRESH (R560): the cached copy of a year the last sync made stale (DossierApi::staleCopy in the
        // app), or null when no refresh is due. No default: forgetting it is the PARK-X5 defect again (R291).
        dossierStaleCopy: (Int) -> DossierDocument?,
        // AN11: the export seam (SessionManager::authenticatedGetBytes in the app), for the PDF and CSV.
        exportBytes: suspend (String) -> BytesOutcome,
        // AN12: the /api/v1/me PATCH seam (SessionSettingsSaver(session) in the app; a stub in tests), the
        // same seam onboarding uses - so the settings write has no second transport (R206).
        settingsSaver: SettingsSaver,
        // AN12 increment 2: the server-side session revoke (SessionManager::revokeServerSession) and the
        // device-wide erasure (R295). The Parametres export reuses the same exportBytes seam the Releve uses.
        revokeServer: suspend () -> Unit,
        localStore: LocalStore,
        // AN12 increment 3 (R289): the authenticated POST (SessionManager::authenticatedPost) the account
        // delete uses. The controller supplies the path and the body.
        authenticatedPost: suspend (String, String) -> PostOutcome,
        // AN-POLISH (R440): the bounded drain sign-out attempts BEFORE it discards anything. Defaulted to a
        // no-op so the wiring and controller tests need not name it; the app injects SyncWorker's own
        // buildSyncEngine, which is the one construction site for the drain (R206).
        syncNow: suspend () -> Unit = {},
        // IOS-MOVE-GRAPH (R1310): the Parametres controller's wire (ParametresWire - the PATCH, consent, reminder and
        // delete bodies and the delete receipt's parse). It was supplied by :app's org.json factory of the controller,
        // which a common graph cannot call, so the composition root passes it: Android hands in that factory's own
        // object (orgJsonParametresWire), so the controller is built exactly as before. No default (R291): a graph
        // built without a wire would be the PARK-X5 shape again - a seam forgotten where no test looks.
        parametresWire: ParametresWire,
        // AN-STATE (R310): the restorable state seeds, held by the composition root in rememberSaveable and
        // passed here so the ONE construction site (R291) also decides each controller's restore. Defaulted to
        // null (a fresh build) so the wiring test and the controller tests need not name them.
        restoredCalendar: CalendarSnapshot? = null,
        restoredParametres: ParametresSnapshot? = null,
        // PARKAN-26 (R310): the releve's restorable selected year, held by the composition root in rememberSaveable
        // and passed here so the ONE construction site (R291) also decides its restore. Null = a fresh build (opens
        // on the current year). The screen's figures are re-fetched for that year, never stored (R328 read-only).
        restoredSelectedYear: Int? = null,
        // AN-SIM (R310): the simulator's restorable selection (scenario + inputs), held by the composition root in
        // rememberSaveable and passed here so the ONE construction site (R291) also decides its restore. Defaulted
        // to null (a fresh build) so the wiring and controller tests need not name it. The computed view is NOT
        // restored - it is recomputed from the record and the rhythm (R181).
        restoredSimulation: SimulationSnapshot? = null,
        // AN-AUTO increment 2 (R315): the device's logging-mode cache and the sampler-stop seam for the
        // auto-detection toggle. Defaulted (in-memory / no-op) so the wiring and controller tests need not name
        // them; the app injects the SharedPreferences store (ShellState) and the real stop arrives in increment 4.
        detectionModeStore: DetectionModeStore = InMemoryDetectionModeStore(),
        startSampling: () -> Unit = {},
        stopSampling: () -> Unit = {},
        // AN-AUTO increment 5: the day's tally stream (Room's daily_tally, coordinate-free) and the near-border
        // "told once" flag, which the Aujourd'hui auto surface reads. Defaulted so the wiring test builds; the
        // app injects the DAO flow and the SharedPreferences store (ShellState, where a Context is available).
        detectionTallies: Flow<List<TallyEntity>> = emptyFlow(),
        nearBorderNoticeStore: NearBorderNoticeStore = InMemoryNearBorderNoticeStore(),
        // R323 / PARKAN-36 (AN-NEXT): the evening proposal notification's opt-in store, read by the Parametres
        // toggle. Defaulted in-memory so the wiring and controller tests build; the app injects the
        // SharedPreferences store (ShellState, where a Context is available).
        eveningNotificationStore: EveningNotificationStore = InMemoryEveningNotificationStore(),
        // AN-ALERT: the threshold alert's opt-in store, read by the Parametres toggle and the Prevision offer.
        // Defaulted in-memory so the wiring and controller tests build; the app injects the SharedPreferences
        // store (ShellState, where a Context is available).
        thresholdAlertStore: ThresholdAlertStore = InMemoryThresholdAlertStore(),
    ): MainControllers =
        MainControllers(
            // IOS-MOVE-GRAPH (R1310): each controller by its class's own constructor, named argument for named argument
            // as :app's JavaTime* factory body built it, the converted clock and zone now arriving from the call site.
            aujourdhui =
                AujourdhuiController(
                    repository = repository,
                    settingsStore = settingsStore,
                    taxYear = taxYear,
                    clock = clock,
                    deviceZone = deviceZone,
                    scope = scope,
                    requestSync = requestSync,
                    detectionModeStore = detectionModeStore,
                    detectionTallies = detectionTallies,
                    nearBorderNoticeStore = nearBorderNoticeStore,
                ),
            calendar =
                CalendarController(
                    repository = repository,
                    settingsStore = settingsStore,
                    taxYear = taxYear,
                    clock = clock,
                    scope = scope,
                    requestSync = requestSync,
                    restored = restoredCalendar,
                ),
            releve =
                ReleveController(
                    dossierFetch,
                    exportBytes,
                    repository,
                    taxYear,
                    scope,
                    restoredSelectedYear,
                    staleCopy = dossierStaleCopy,
                ),
            // IOS-MOVE-GRAPH (R1310): the class's own constructor, named argument for named argument as :app's
            // OrgJsonParametres.kt factory built it, with the wire passed in rather than taken from that factory.
            parametres =
                ParametresController(
                    saver = settingsSaver,
                    store = settingsStore,
                    repository = repository,
                    taxYear = taxYear,
                    scope = scope,
                    exportBytes = exportBytes,
                    revokeServer = revokeServer,
                    syncNow = syncNow,
                    localStore = localStore,
                    authenticatedPost = authenticatedPost,
                    modeStore = detectionModeStore,
                    startSampling = startSampling,
                    stopSampling = stopSampling,
                    eveningNotificationStore = eveningNotificationStore,
                    thresholdAlertStore = thresholdAlertStore,
                    restored = restoredParametres,
                    wire = parametresWire,
                ),
            forecast =
                ForecastController(
                    rhythmRepo = rhythmRepository,
                    entryRepo = repository,
                    settingsStore = settingsStore,
                    taxYear = taxYear,
                    clock = clock,
                    scope = scope,
                ),
            // AN-SIM: shares the rhythm (the repo flow) and the record with the forecast; computes in memory,
            // writes nothing (R340). Reads the SAME rhythmRepository and repository as the forecast controller.
            // Seeded with restoredSimulation so the open scenario and its inputs survive a rebuild (R310).
            simulation =
                SimulationController(
                    rhythmRepo = rhythmRepository,
                    entryRepo = repository,
                    settingsStore = settingsStore,
                    taxYear = taxYear,
                    clock = clock,
                    scope = scope,
                    restored = restoredSimulation,
                ),
        )
}
