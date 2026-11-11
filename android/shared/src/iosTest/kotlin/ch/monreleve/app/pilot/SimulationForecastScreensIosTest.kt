package ch.monreleve.app.pilot

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.ComparisonView
import ch.monreleve.app.dossier.buildComparison
import ch.monreleve.app.dossier.parseDossier
import ch.monreleve.app.dossier.parseEmployerRate
import ch.monreleve.app.forecast.ForecastController
import ch.monreleve.app.forecast.RhythmChoice
import ch.monreleve.app.forecast.SimScenario
import ch.monreleve.app.forecast.SimulationController
import ch.monreleve.app.fr.ComparisonCopy
import ch.monreleve.app.fr.DisclosureCopy
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.SimulationCopy
import ch.monreleve.app.fr.text.formatDeclarableRate
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.ui.screens.comparison.ComparisonActions
import ch.monreleve.app.ui.screens.comparison.ComparisonScreen
import ch.monreleve.app.ui.screens.disclosure.DisclosureScreen
import ch.monreleve.app.ui.screens.prevision.PrevisionActions
import ch.monreleve.app.ui.screens.prevision.PrevisionScreen
import ch.monreleve.app.ui.screens.rythme.RythmeActions
import ch.monreleve.app.ui.screens.rythme.RythmeScreen
import ch.monreleve.app.ui.screens.simulation.SimulationActions
import ch.monreleve.app.ui.screens.simulation.SimulationScreen
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.datetime.DayOfWeek
import platform.darwin.DISPATCH_TIME_NOW
import platform.darwin.NSEC_PER_SEC
import platform.darwin.dispatch_after
import platform.darwin.dispatch_get_global_queue
import platform.darwin.dispatch_time
import platform.posix.fflush
import platform.posix.stdout
import kotlin.system.exitProcess
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2d R818/R820. THE SHARED DISCLOSURE, COMPARISON, RYTHME, PREVISION AND SIMULATION SCREENS, COMPOSED AND DRIVEN
// ON THE iOS SIMULATOR, OVER FAKES - the five screens IOS-2d moved to :shared commonMain.
//
// Each screen is hosted the way MainActivity hosts it: the REAL shared ForecastController / SimulationController over
// an in-memory rhythm (which records every save) and a record whose record() throws (R340: a projection is never a
// record), a fixed kotlin.time Clock, InMemorySettingsStore; the Comparison built by the shared buildComparison from
// the Releve test's fixture dossier, as MainActivity builds it from the Releve's loaded document. No server, no
// account, no address. Strings come from fr/ and expected values from the shared code (R181), never retyped.
//
// R818 - USED, NOT ONLY COMPOSED (R624: the date picker compiled and threw only when run; R791 (2) made the same point
// for the sheet). The one Material3 container no shared screen used before is the Simulation's weekday DropdownMenu
// with its DropdownMenuItems: step5 OPENS it (a pointer tap on the field), asserts its items, and PICKS one - and the
// choice must reach the controller and close the menu. The pick is the item's own OnClick semantics action (the one
// VoiceOver offers; IOS-2c-FIX's path for the sheet's handle and scrim), NOT a pointer tap: inside a Popup layer the
// node's boundsInRoot is local to the menu while boundsInWindow is absolute, so R806's tap-point-in-window guard cannot
// be read the way it was for the sheet's Dialog layer and could fail on a correctly placed item. The item's geometry is
// RECORDED (boundsInRoot, boundsInWindow, positionInWindow) and its having area in the window is asserted; a pointer
// tap on a popup item is left to a probe (REPORT-IOS-2d, PARKED).
// The new modifiers run as composed: PrevisionRail's offset and fillMaxHeight (step4, a projection drawn) and
// Comparison's rotate (step2, the chevron of the tapped cause row). Every text field touched is typed into, every
// toggle and chip tapped.
//
// R807/R809's DISCIPLINE: EVERY WAIT goes through waitBounded (BoundedWait.kt), so a condition that stays false fails
// at TIMEOUT naming itself; a MARK on both sides of every call that can wait without a bound; each test armed with the
// R793-shaped 120 s watchdog. This file is NOT on IosTestRawWaitUntilFenceTest's allowlist: it calls no raw wait.
//
// NAMED TO SORT AFTER EVERY OTHER PILOT CLASS, and its tests step1..step5 from the least to the most at risk
// (Disclosure: Buttons; Comparison: a text field; Rythme: toggles; Prevision: the rail and glyphs; Simulation: the
// popup), so that if anything here ever hangs, every other class of the run has already been reached.

private const val TAX_YEAR = 2026
private const val TIMEOUT = 10_000L
private const val NOW = "2026-06-15T10:00:00Z"
private const val EMPLOYER_RATE_TYPED = "41,25"
private const val TARGET_RATE_TYPED = "80"
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

/** Tuesday and Thursday at home, the other weekdays in Switzerland. */
private val TUE_THU_HOME =
    WeeklyRhythm(RhythmKind.SUISSE, RhythmKind.DOMICILE, RhythmKind.SUISSE, RhythmKind.DOMICILE, RhythmKind.SUISSE)

/** The rhythm in memory: every save recorded, in order; it re-emits what it saved, as Room does. */
private class RecordingRhythms(initial: WeeklyRhythm) : RhythmRepository {
    val source = MutableStateFlow(initial)
    val saved = mutableListOf<WeeklyRhythm>()

    override fun observe(): Flow<WeeklyRhythm> = source

    override suspend fun save(rhythm: WeeklyRhythm) {
        saved += rhythm
        source.value = rhythm
    }

    override suspend fun clear() = Unit
}

/** The record in memory, read-only: the forecast reads it; a write would throw (R340). */
private class ReadOnlyRecord(seed: List<EntryEntity>) : EntryRepository {
    val rows = MutableStateFlow(seed)
    var records = 0

    override suspend fun record(command: RecordCommand): RecordResult {
        records++
        throw UnsupportedOperationException("a projection never records a day (R340)")
    }

    override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = rows
}

/** What the hosts hand the screens' callbacks, counted. */
private class Taps {
    var allow = 0
    var stayManual = 0
    var viewDays = 0
    var alert = 0
    var testChange = 0
    var adopt = 0
}

/** The controllers a host built, held so the test can read their state. */
private class Held {
    var forecast: ForecastController? = null
    var simulation: SimulationController? = null
}

private fun homeRow(day: String) =
    EntryEntity(
        clientMutationId = "ios-$day",
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        syncState = SyncState.SYNCED,
    )

private val RECORDED = listOf("2026-01-05", "2026-01-06", "2026-02-02", "2026-03-02", "2026-04-07").map(::homeRow)

/** The two shared forecast controllers over the fakes, on a fixed kotlin.time Clock at NOW - the one opt-in site. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: a fixed kotlin.time Clock for the controllers - on the allowlist.
private fun controllers(
    rhythms: RecordingRhythms,
    record: ReadOnlyRecord,
    scope: CoroutineScope,
): Pair<ForecastController, SimulationController> {
    val at = Instant.parse(NOW)
    val clock =
        object : Clock {
            override fun now(): Instant = at
        }
    val store = InMemorySettingsStore(SETTINGS)
    val forecast = ForecastController(rhythms, record, store, TAX_YEAR, clock, scope)
    val simulation = SimulationController(rhythms, record, store, TAX_YEAR, clock, scope)
    return forecast to simulation
}

/** MainActivity's ForecastRoute.RYTHME branch, reduced to its calls. */
@Composable
private fun RythmeHost(
    rhythms: RecordingRhythms,
    record: ReadOnlyRecord,
    held: Held,
) {
    val scope = rememberCoroutineScope()
    val forecast = remember { controllers(rhythms, record, scope).first.also { held.forecast = it } }
    val state by forecast.state.collectAsState()
    FrontierTheme { RythmeScreen(state = state, actions = RythmeActions(onSetDay = forecast::setDay)) }
}

/** MainActivity's ForecastRoute.PREVISION branch, reduced: the alert offer shown (the alert is off). */
@Composable
private fun PrevisionHost(
    rhythms: RecordingRhythms,
    record: ReadOnlyRecord,
    held: Held,
    taps: Taps,
) {
    val scope = rememberCoroutineScope()
    val forecast = remember { controllers(rhythms, record, scope).first.also { held.forecast = it } }
    val state by forecast.state.collectAsState()
    FrontierTheme {
        PrevisionScreen(
            state = state,
            actions = PrevisionActions(onTestChange = { taps.testChange++ }, onEnableAlert = { taps.alert++ }),
            alertEnabled = false,
        )
    }
}

/** MainActivity's ForecastRoute.SIMULATION branch, reduced: the scenario and the inputs go to the controller. */
@Composable
private fun SimulationHost(
    rhythms: RecordingRhythms,
    record: ReadOnlyRecord,
    held: Held,
    taps: Taps,
) {
    val scope = rememberCoroutineScope()
    val simulation = remember { controllers(rhythms, record, scope).second.also { held.simulation = it } }
    val state by simulation.state.collectAsState()
    FrontierTheme {
        SimulationScreen(
            state = state,
            actions =
                SimulationActions(
                    onSelectScenario = simulation::selectScenario,
                    onInputsChange = simulation::updateInputs,
                    onAdopt = { taps.adopt++ },
                ),
        )
    }
}

/** The comparison as MainActivity builds it from the Releve's loaded document - a completed year, a typed figure. */
private fun comparisonFor(employerRate: Double?): ComparisonView {
    val document = parseDossier(FIXTURE_DOSSIER)
    val rules = ruleSetFor(document.taxYear)
    return buildComparison(
        document = document,
        isCurrentYear = false,
        daysUnsynced = 0,
        missionCap = rules.missionCapDays,
        simplifiedBasisDays = rules.simplifiedBasisDays,
        employerRate = employerRate,
    )
}

/** MainActivity's comparison overlay, reduced: the typed figure held, parsed, and the comparison rebuilt from it. */
@Composable
private fun ComparisonHost(taps: Taps) {
    var employerInput by remember { mutableStateOf("") }
    val employerRate = parseEmployerRate(employerInput)
    val view = remember(employerRate) { comparisonFor(employerRate) }
    FrontierTheme {
        ComparisonScreen(
            view = view,
            employerInput = employerInput,
            employerRate = employerRate,
            actions = ComparisonActions(onInputChange = { employerInput = it }, onViewDays = { taps.viewDays++ }),
        )
    }
}

/** The watchdog's view of the test (R793's shape). Not "Progress": a class name is the package's, private or not. */
private object ForecastProgress {
    var test = ""
    var step = ""
    var generation = 0
    var done = false
}

private const val WATCHDOG_SECONDS = 120L
private const val WATCHDOG_EXIT = 3

@OptIn(ExperimentalForeignApi::class) // the posix stdout flush - function-scoped, as KeychainTokenStore's interop is.
private fun mark(step: String) {
    ForecastProgress.step = step
    println("R820 MARK ${ForecastProgress.test}: $step")
    fflush(stdout)
}

@OptIn(ExperimentalForeignApi::class) // GCD and posix, function-scoped (KeychainTokenStore's precedent).
private fun watched(
    test: String,
    body: () -> Unit,
) {
    ForecastProgress.generation += 1
    val generation = ForecastProgress.generation
    ForecastProgress.test = test
    ForecastProgress.done = false
    mark("started")
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, WATCHDOG_SECONDS * NSEC_PER_SEC.toLong()),
        // 0 = the default-priority global queue (Apple's documented dispatch_get_global_queue(0, 0)).
        dispatch_get_global_queue(0L, 0u),
    ) {
        if (ForecastProgress.generation == generation && !ForecastProgress.done) {
            val last = ForecastProgress.step
            println("R820 WATCHDOG: $test HUNG after ${WATCHDOG_SECONDS}s - last step reached: $last")
            fflush(stdout)
            exitProcess(WATCHDOG_EXIT)
        }
    }
    try {
        body()
        mark("finished")
    } finally {
        ForecastProgress.done = true
    }
}

@OptIn(ExperimentalTestApi::class)
class SimulationForecastScreensIosTest {
    private fun SemanticsNodeInteractionsProvider.count(matcher: SemanticsMatcher): Int =
        onAllNodes(matcher, useUnmergedTree = false).fetchSemanticsNodes().size

    private fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
        onAllNodesWithText(text, substring = true, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    private fun ComposeUiTest.waitMarked(
        what: String,
        condition: () -> Boolean,
    ) {
        mark("wait ($what) - calling, bounded at ${TIMEOUT}ms")
        waitBounded(what, TIMEOUT, condition)
        mark("wait ($what) - returned")
    }

    /** performScrollTo where there is a scroll parent (a button in a popup has none), marked on both sides. */
    private fun SemanticsNodeInteraction.scrollToMarked(what: String) {
        mark("tap $what: performScrollTo - calling")
        try {
            performScrollTo()
            mark("tap $what: performScrollTo - returned")
        } catch (expectedOutsideAScroll: AssertionError) {
            mark("tap $what: performScrollTo - no scroll parent")
        }
    }

    private fun SemanticsNodeInteractionsProvider.tapMarked(
        what: String,
        matcher: SemanticsMatcher,
    ) {
        val node = onAllNodes(matcher).onFirst()
        node.scrollToMarked(what)
        mark("tap $what: performClick - calling")
        node.performClick()
        mark("tap $what: performClick - returned")
    }

    /**
     * A popup item PICKED by its own OnClick semantics action (see the header): its geometry recorded in a mark, its
     * having area in the window asserted, then the action - which runs the item's onClick, the one VoiceOver offers.
     */
    private fun SemanticsNodeInteractionsProvider.pickMarked(
        what: String,
        matcher: SemanticsMatcher,
    ) {
        val node = onAllNodes(matcher).onFirst()
        val target = node.fetchSemanticsNode()
        val inWindow = target.boundsInWindow
        mark("pick $what: boundsInRoot=${target.boundsInRoot} boundsInWindow=$inWindow at ${target.positionInWindow}")
        assertTrue(!inWindow.isEmpty, "R818: $what has no area in the window (boundsInWindow $inWindow)")
        mark("pick $what: OnClick - calling (the item's own click action)")
        node.performSemanticsAction(SemanticsActions.OnClick)
        mark("pick $what: OnClick - returned")
    }

    private fun SemanticsNodeInteractionsProvider.typeMarked(
        what: String,
        text: String,
    ) {
        mark("type $what: performTextReplacement - calling")
        onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(text)
        mark("type $what: performTextReplacement - returned")
    }

    @Test
    fun step1TheDisclosureShowsItsTwoEqualChoicesAndEachAnswers() =
        watched("disclosure") {
            runComposeUiTest {
                val taps = Taps()
                mark("setContent - calling")
                setContent {
                    FrontierTheme {
                        DisclosureScreen(onAllow = { taps.allow++ }, onStayManual = { taps.stayManual++ })
                    }
                }
                mark("setContent - returned")
                waitMarked("the disclosure shown") { shows(DisclosureCopy.TITLE) }
                assertTrue(shows(DisclosureCopy.WHAT_IS_KEPT), "the disclosure says what is kept")
                tapMarked("ALLOW", hasText(DisclosureCopy.ALLOW) and hasClickAction())
                waitMarked("allow answered") { taps.allow == 1 }
                tapMarked("STAY MANUAL", hasText(DisclosureCopy.STAY_MANUAL) and hasClickAction())
                waitMarked("stay manual answered") { taps.stayManual == 1 }
                assertEquals(1 to 1, taps.allow to taps.stayManual)
            }
        }

    @Test
    fun step2TheComparisonTakesATypedFigureShowsTheGapAndACauseOpensTheDays() =
        watched("comparison") {
            runComposeUiTest {
                val taps = Taps()
                mark("setContent - calling")
                setContent { ComparisonHost(taps) }
                mark("setContent - returned")
                waitMarked("the comparison shown") { shows(ComparisonCopy.TITLE) }
                val before = comparisonFor(null)
                assertTrue(shows(ComparisonCopy.employerRateLabel(before.year)), "the attestation field's label")
                typeMarked("the employer's figure", EMPLOYER_RATE_TYPED)
                val gap = assertNotNull(comparisonFor(parseEmployerRate(EMPLOYER_RATE_TYPED)).gap, "a gap")
                waitMarked("the gap shown") { shows(ComparisonCopy.gapHeadline(gap.points)) }
                mark("the typed figure gave the gap")
                assertTrue(shows(ComparisonCopy.CAUSE_MISSIONS_TITLE), "the fixture logs missions: a cause row")
                tapMarked("the missions cause", hasText(ComparisonCopy.CAUSE_MISSIONS_TITLE) and hasClickAction())
                waitMarked("the cause opened the days") { taps.viewDays == 1 }
            }
        }

    @Test
    fun step3TheRythmeShowsTheRhythmAndATapStoresTheDay() =
        watched("rythme") {
            runComposeUiTest {
                val rhythms = RecordingRhythms(TUE_THU_HOME)
                val record = ReadOnlyRecord(RECORDED)
                val held = Held()
                mark("setContent - calling")
                setContent { RythmeHost(rhythms, record, held) }
                mark("setContent - returned")
                waitMarked("the rhythm shown") { shows(RythmeCopy.TITLE) && shows(RythmeCopy.weeklyDomicile(2)) }
                val homeToggle = hasText(RythmeCopy.DOMICILE) and hasClickAction()
                assertEquals(2, count(homeToggle and isSelected()), "Tuesday and Thursday shown at home")
                tapMarked("Lundi: Domicile", homeToggle)
                waitMarked("Monday stored at home") { rhythms.saved.size == 1 }
                val monday = TUE_THU_HOME.copy(monday = RhythmKind.DOMICILE)
                assertEquals(listOf(monday), rhythms.saved, "one save, Monday's field")
                waitMarked("the helper line follows") { shows(RythmeCopy.weeklyDomicile(3)) }
                assertEquals(3, count(homeToggle and isSelected()))
                assertEquals(0, record.records, "nothing recorded (R340)")
                val forecast = assertNotNull(held.forecast)
                assertEquals(
                    listOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.THURSDAY),
                    forecast.state.value.rhythmDays.filterValues { it == RhythmChoice.DOMICILE }.keys
                        .sorted(),
                )
            }
        }

    @Test
    fun step4ThePrevisionShowsTheFixtureForecastAndItsTwoActionsAnswer() =
        watched("prevision") {
            runComposeUiTest {
                val rhythms = RecordingRhythms(TUE_THU_HOME)
                val record = ReadOnlyRecord(RECORDED)
                val held = Held()
                val taps = Taps()
                mark("setContent - calling")
                setContent { PrevisionHost(rhythms, record, held, taps) }
                mark("setContent - returned")
                waitMarked("the projection shown") {
                    shows(PrevisionCopy.TITLE) && held.forecast?.state?.value?.projection != null
                }
                val projection = assertNotNull(assertNotNull(held.forecast).state.value.projection)
                waitMarked("the two figures shown") {
                    shows(formatDeclarableRate(projection.projectedRate)) &&
                        shows(formatDeclarableRate(projection.currentRate))
                }
                mark("the fixture forecast shown: ${formatDeclarableRate(projection.projectedRate)}")
                assertTrue(shows(PrevisionCopy.PROJECTION_BADGE), "the projection chip")
                assertTrue(shows(PrevisionCopy.R340_NOTE), "the lock line (Glyph.LOCK)")
                tapMarked("the alert offer", hasText(PrevisionCopy.ALERT_OFFER) and hasClickAction())
                waitMarked("the alert offer answered") { taps.alert == 1 }
                tapMarked("Tester un changement", hasText(PrevisionCopy.TEST_CHANGE) and hasClickAction())
                waitMarked("the simulator asked for") { taps.testChange == 1 }
                assertEquals(0 to 0, rhythms.saved.size to record.records, "showing a projection writes nothing")
            }
        }

    @Test
    fun step5TheSimulationsDropdownOpensAWeekdayIsPickedAndTheRateIsTyped() =
        watched("simulation") {
            runComposeUiTest {
                val rhythms = RecordingRhythms(TUE_THU_HOME)
                val record = ReadOnlyRecord(RECORDED)
                val held = Held()
                val taps = Taps()
                mark("setContent - calling")
                setContent { SimulationHost(rhythms, record, held, taps) }
                mark("setContent - returned")
                waitMarked("the simulator shown") {
                    shows(SimulationCopy.TITLE) && held.simulation?.state?.value?.view != null
                }
                val simulation = assertNotNull(held.simulation)
                assertEquals(DayOfWeek.MONDAY, simulation.state.value.inputs.extraWeekday, "seeded: Monday")
                pickFriday(simulation)
                tapMarked("ADOPT", hasText(SimulationCopy.ADOPT) and hasClickAction())
                waitMarked("adopt answered") { taps.adopt == 1 }
                tapMarked("the rate chip", hasText(SimulationCopy.SCENARIO_RATE) and hasClickAction())
                waitMarked("the rate scenario shown") {
                    simulation.state.value.scenario == SimScenario.RATE && shows(SimulationCopy.RATE_LABEL)
                }
                assertEquals(1, count(hasText(SimulationCopy.SCENARIO_RATE) and isSelected()), "the chip selected")
                typeMarked("the new rate", TARGET_RATE_TYPED)
                waitMarked("the rate reached the controller") {
                    simulation.state.value.inputs.targetRate == TARGET_RATE_TYPED
                }
                assertNotNull(simulation.state.value.view, "the simulated view")
                assertEquals(0 to 0, rhythms.saved.size to record.records, "simulating writes nothing (R340)")
            }
        }

    /** R818: the DropdownMenu OPENED, its items asserted, one PICKED by its OnClick action, the choice reaching it. */
    private fun ComposeUiTest.pickFriday(simulation: SimulationController) {
        val monday = RythmeCopy.DAYS[DayOfWeek.MONDAY.ordinal]
        val wednesday = RythmeCopy.DAYS[DayOfWeek.WEDNESDAY.ordinal]
        val friday = RythmeCopy.DAYS[DayOfWeek.FRIDAY.ordinal]
        assertEquals(0, count(hasText(friday) and hasClickAction()), "no Friday item before the menu opens")
        tapMarked("the weekday field", hasText(monday) and hasClickAction())
        waitMarked("the DropdownMenu open") { count(hasText(friday) and hasClickAction()) == 1 }
        mark("the DropdownMenu OPEN")
        assertEquals(2, count(hasText(monday) and hasClickAction()), "Monday: the field and its item")
        assertEquals(1, count(hasText(wednesday) and hasClickAction()), "Wednesday offered")
        val home = listOf(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY).map { RythmeCopy.DAYS[it.ordinal] }
        assertTrue(home.none { count(hasText(it) and hasClickAction()) > 0 }, "a home day is never offered")
        pickMarked("the Friday item", hasText(friday) and hasClickAction())
        waitMarked("Friday chosen and the menu closed") {
            simulation.state.value.inputs.extraWeekday == DayOfWeek.FRIDAY && !shows(wednesday)
        }
        mark("the DropdownMenuItem PICKED: Friday")
        assertTrue(simulation.state.value.canAdopt, "an extra weekday can be adopted")
    }
}
