package ch.monreleve.app.pilot

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
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
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.ComparisonView
import ch.monreleve.app.dossier.buildComparison
import ch.monreleve.app.dossier.parseDossier
import ch.monreleve.app.dossier.parseEmployerRate
import ch.monreleve.app.forecast.ForecastController
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.ComparisonCopy
import ch.monreleve.app.fr.DisclosureCopy
import ch.monreleve.app.fr.LicencesCopy
import ch.monreleve.app.fr.NavCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.SimulationCopy
import ch.monreleve.app.fr.text.formatDeclarableRate
import ch.monreleve.app.ios.RecordingTransport
import ch.monreleve.app.ios.SHELL_COMPLETE_ME
import ch.monreleve.app.ios.SHELL_COMPLETE_SETTINGS
import ch.monreleve.app.ios.SHELL_NOW
import ch.monreleve.app.ios.SHELL_PAIR
import ch.monreleve.app.ios.ShellRig
import ch.monreleve.app.ios.emptyYearAnswer
import ch.monreleve.app.ios.setShellContent
import ch.monreleve.app.ios.yearOf
import ch.monreleve.app.ui.screens.disclosure.DisclosureScreen
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
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
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2d R818/R820. THE SHARED DISCLOSURE, COMPARISON, RYTHME, PREVISION AND SIMULATION SCREENS, DRIVEN ON THE iOS
// SIMULATOR.
//
// IOS-AUDIT R1352 (iOS Ruling 14 Q2): THE HAND-WRITTEN REDUCTIONS ARE GONE. Until this task the comparison, the rhythm,
// the forecast and the simulator were each composed by a host that copied MainActivity's wiring "reduced to its calls"
// (ComparisonHost, RythmeHost, PrevisionHost, SimulationHost) - so the iOS run never exercised the wiring the app runs.
// That wiring is now ONE common function, MainTabs (IOS-MOVE-TABS R1360), and every step below except the disclosure
// drives it through the REAL iOS shell (IosShellRoot over startIosShell, ShellRig's doubles - R204): the person's taps
// on the bottom bar, Paramètres' rhythm row, the Rythme screen's « Voir ma prévision », Prévision's « Tester un
// changement », the overlays' back arrows. What the reductions read from a controller they held is read where the
// shell keeps it - the iOS database's rhythm, the record - or derived from the shared code over the same inputs (R181).
//
// THE CASE MAP (R268) - every check of the reduced steps, and where it lives now:
//   step1 disclosure   UNCHANGED: the disclosure is the detection flow's, which iOS v1 does not have (manual only,
//                      iOS Ruling 2), so MainTabs never draws it; it stays composed directly.
//   step2 comparison   -> step2 below, through the shell: Relevé, the year before, « Comparer avec mon employeur »,
//                      the field's label, a typed figure giving the derived gap, the missions cause row, and the cause
//                      tapped - which on the real wiring closes the overlay onto the CALENDRIER (the reduction only
//                      counted the tap). IosShellComparisonIosTest keeps the stored figure and the back arrow.
//   step3 rythme       -> step3: the seeded rhythm shown (2 home toggles selected, the helper line), Monday tapped,
//                      Monday's field saved - read back from the iOS database - the helper line and the selected
//                      count following, nothing recorded (R340).
//   step4 prevision    -> step4: the title, both figures (derived from a ForecastController over the shell's own
//                      stores and clock), the projection chip, the R340 lock line, « Tester un changement » opening
//                      the simulator, nothing written. The ALERT OFFER's tap is NOT reachable on iOS (hidden, iOS
//                      Ruling 3 Q4): its absence on iOS is IosShellFacilitiesIosTest r1338's, and Android's offer is
//                      ThresholdAlertPresenceTest's (:app, R1375).
//   step5 simulation   -> step5: the DropdownMenu opened from Monday, its items (Monday twice, Wednesday, no home
//                      day), Friday PICKED by its OnClick action, the menu closed; « Adopter ce rythme » - which on
//                      the real wiring writes Friday at home and returns to Prévision (the reduction only counted it);
//                      the rate chip selected, its field shown, « 80 » typed into it; nothing recorded.
//   step6 R836         -> step6: the same Friday item picked by a POINTER TAP behind R806's in-window guard, the menu
//                      closed, nothing adopted, nothing written.
//   NEW, R1352         step0: each of the four tabs selected and its own screen shown; the forecast opened, the
//                      simulator opened, back, back; Calendrier and Relevé reached again.
//
// R807/R809's DISCIPLINE, kept: EVERY WAIT goes through waitBounded (BoundedWait.kt), a MARK on both sides of every
// call that can wait without a bound, each test armed with the R793-shaped 120 s watchdog. This file is NOT on
// IosTestRawWaitUntilFenceTest's allowlist: it calls no raw wait.
//
// NAMED TO SORT AFTER EVERY OTHER PILOT CLASS, so that if anything here ever hangs, every other class of the run has
// already been reached.

private const val TIMEOUT = 20_000L
private const val EMPLOYER_RATE_TYPED = "41,25"
private const val TARGET_RATE_TYPED = "80"
private const val ACCOUNT = "this-install"
private const val COMPARED_YEAR = 2025

/** Tuesday and Thursday at home, the other weekdays in Switzerland. */
private val TUE_THU_HOME =
    WeeklyRhythm(RhythmKind.SUISSE, RhythmKind.DOMICILE, RhythmKind.SUISSE, RhythmKind.DOMICILE, RhythmKind.SUISSE)

/** The pilot's dossier, served for whichever year is asked (IosShellComparisonIosTest's server, R206). */
private fun dossierServer() =
    RecordingTransport(
        route = { request, path ->
            val year = yearOf(request)
            if (request.method.name == "GET" && path == "/api/v1/dossier" && year != null) {
                HttpResponse(200, FIXTURE_DOSSIER.replace("2026", year.toString()))
            } else {
                emptyYearAnswer(request, path)
            }
        },
        answer = { method, path ->
            when {
                method == "GET" && path == "/api/v1/me" -> HttpResponse(200, SHELL_COMPLETE_ME)
                else -> HttpResponse(200, "{}")
            }
        },
    )

/** A signed-in, onboarded phone over the dossier server, its rhythm seeded Tuesday and Thursday at home. */
private fun signedInWithRhythm(): ShellRig {
    val rig =
        ShellRig(
            marked = true,
            pair = SHELL_PAIR,
            pendingAddress = null,
            account = ACCOUNT,
            settings = SHELL_COMPLETE_SETTINGS,
            transport = dossierServer(),
        )
    runBlocking { rig.shell.rhythmRepository.save(TUE_THU_HOME) }
    return rig
}

private fun ShellRig.rhythmNow(): WeeklyRhythm = runBlocking { shell.rhythmRepository.observe().first() }

private fun ShellRig.recordedDays(): Int = runBlocking { database.entryDao().all() }.size

/** The comparison as MainTabs builds it from the Relevé's loaded document for [COMPARED_YEAR] (R181: derived). */
private fun comparisonFor(employerRate: Double?): ComparisonView {
    val document = parseDossier(FIXTURE_DOSSIER.replace("2026", COMPARED_YEAR.toString()))
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

/**
 * The forecast the shell's own controller computes, derived by the SAME shared controller over the shell's stores, at
 * the shell's clock (R181: the figures are never typed) - the one ExperimentalTime opt-in site of this file.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: the shell's fixed kotlin.time Clock, for the derived forecast.
private fun derivedForecast(
    rig: ShellRig,
    scope: CoroutineScope,
): ForecastController {
    val at = Instant.parse(SHELL_NOW)
    val clock =
        object : Clock {
            override fun now(): Instant = at
        }
    val shell = rig.shell
    return ForecastController(shell.rhythmRepository, shell.repository, rig.settings, shell.taxYear, clock, scope)
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

/** IOS-2e R836: every failure of the pointer-tap test starts with this, so a red run reads without the logs. */
private const val R836 = "R836 popup pointer tap"

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

    /** A bottom-bar tab, waited for and tapped. */
    private fun ComposeUiTest.selectTab(label: String) {
        waitMarked("the bottom bar's $label") { count(hasText(label) and hasClickAction()) > 0 }
        tapMarked("the tab $label", hasText(label) and hasClickAction())
    }

    /** An overlay's on-screen back arrow (the forecast screens and the comparison carry LicencesCopy.BACK). */
    private fun SemanticsNodeInteractionsProvider.backMarked(what: String) =
        tapMarked(what, hasContentDescription(LicencesCopy.BACK) and hasClickAction())

    /** Paramètres -> « Votre rythme habituel » -> the Rythme overlay, through the shell. */
    private fun ComposeUiTest.openRythme() {
        selectTab(NavCopy.PARAMETRES)
        waitMarked("Paramètres' rhythm row") { count(hasText(RythmeCopy.TITLE) and hasClickAction()) > 0 }
        tapMarked("the rhythm row", hasText(RythmeCopy.TITLE) and hasClickAction())
        waitMarked("the Rythme overlay") { shows(RythmeCopy.weeklyDomicile(2)) }
    }

    /** ... -> « Voir ma prévision » -> Prévision, with a projection drawn. */
    private fun ComposeUiTest.openPrevision() {
        openRythme()
        tapMarked("Voir ma prévision", hasText(RythmeCopy.VIEW_FORECAST) and hasClickAction())
        waitMarked("Prévision, a projection drawn") { shows(PrevisionCopy.TITLE) }
    }

    /** ... -> « Tester un changement » -> the simulator. */
    private fun ComposeUiTest.openSimulation() {
        openPrevision()
        tapMarked("Tester un changement", hasText(PrevisionCopy.TEST_CHANGE) and hasClickAction())
        waitMarked("the simulator") {
            shows(SimulationCopy.TITLE) && shows(RythmeCopy.DAYS[DayOfWeek.MONDAY.ordinal])
        }
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

    /**
     * IOS-2e R836: a popup item PICKED BY A POINTER TAP, behind R806's guard. performClick injects its touch at the
     * centre of the node's boundsInRoot (R800 (3)); before it does, that point must lie inside the node's non-empty
     * boundsInWindow - otherwise the test fails HERE, naming R836 and where the tap would have landed.
     */
    private fun SemanticsNodeInteractionsProvider.pointerTapMarked(
        what: String,
        matcher: SemanticsMatcher,
    ) {
        val node = onAllNodes(matcher).onFirst()
        val target = node.fetchSemanticsNode()
        val inRoot = target.boundsInRoot
        val inWindow = target.boundsInWindow
        mark("$R836 $what: boundsInRoot=$inRoot tapPoint=${inRoot.center} boundsInWindow=$inWindow")
        assertTrue(
            !inWindow.isEmpty && inWindow.contains(inRoot.center),
            "$R836: $what is not inside the window - its tap would land at ${inRoot.center} (the centre of its " +
                "boundsInRoot $inRoot), outside its boundsInWindow $inWindow",
        )
        mark("$R836 $what: the tap point is inside the window; performClick (a pointer tap) - calling")
        node.performClick()
        mark("$R836 $what: performClick - returned")
    }

    private fun SemanticsNodeInteractionsProvider.typeMarked(
        what: String,
        text: String,
    ) {
        mark("type $what: performTextReplacement - calling")
        onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(text)
        mark("type $what: performTextReplacement - returned")
    }

    private fun SemanticsNodeInteractionsProvider.calendarShown(): Boolean =
        count(hasContentDescription(CalendarCopy.PREVIOUS_MONTH)) > 0

    private fun SemanticsNodeInteractionsProvider.parametresShown(): Boolean =
        count(hasText(ParametresCopy.SIGN_OUT) and hasClickAction()) > 0

    @Test
    fun step0EachTabThenTheForecastTheSimulatorBackAndBackThroughMainTabs() =
        watched("R1352 tabs") {
            runComposeUiTest {
                val rig = signedInWithRhythm()
                try {
                    setShellContent(rig)
                    waitMarked("R1352: Aujourd'hui, where a signed-in launch opens") { shows(AujourdhuiCopy.QUESTION) }
                    selectTab(NavCopy.CALENDRIER)
                    waitMarked("R1352: Calendrier selected - its month arrows") { calendarShown() }
                    selectTab(NavCopy.RELEVE)
                    waitMarked("R1352: Relevé selected - the document's title") { shows(ReleveCopy.TITLE) }
                    selectTab(NavCopy.PARAMETRES)
                    waitMarked("R1352: Paramètres selected - its sign-out row") { parametresShown() }
                    selectTab(NavCopy.AUJOURDHUI)
                    waitMarked("R1352: back on Aujourd'hui") { shows(AujourdhuiCopy.QUESTION) }

                    openSimulation()
                    backMarked("the simulator's back arrow")
                    waitMarked("R1352: back from the simulator is Prévision (AN-SIM)") {
                        shows(PrevisionCopy.TITLE) && !shows(SimulationCopy.TITLE)
                    }
                    backMarked("Prévision's back arrow")
                    waitMarked("R1352: back from Prévision closes the overlay onto the tab beneath (Paramètres)") {
                        !shows(PrevisionCopy.TITLE) && parametresShown()
                    }
                    selectTab(NavCopy.CALENDRIER)
                    waitMarked("R1352: Calendrier reached after the overlays") { calendarShown() }
                    selectTab(NavCopy.RELEVE)
                    waitMarked("R1352: Relevé reached after the overlays") { shows(ReleveCopy.TITLE) }
                    assertEquals(0, rig.recordedDays(), "moving between tabs and overlays records nothing (R340)")
                } finally {
                    rig.close()
                }
            }
        }

    @Test
    fun step1TheDisclosureShowsItsTwoEqualChoicesAndEachAnswers() =
        watched("disclosure") {
            runComposeUiTest {
                var allow = 0
                var stayManual = 0
                mark("setContent - calling")
                setContent {
                    FrontierTheme {
                        DisclosureScreen(onAllow = { allow++ }, onStayManual = { stayManual++ })
                    }
                }
                mark("setContent - returned")
                waitMarked("the disclosure shown") { shows(DisclosureCopy.TITLE) }
                assertTrue(shows(DisclosureCopy.WHAT_IS_KEPT), "the disclosure says what is kept")
                tapMarked("ALLOW", hasText(DisclosureCopy.ALLOW) and hasClickAction())
                waitMarked("allow answered") { allow == 1 }
                tapMarked("STAY MANUAL", hasText(DisclosureCopy.STAY_MANUAL) and hasClickAction())
                waitMarked("stay manual answered") { stayManual == 1 }
                assertEquals(1 to 1, allow to stayManual)
            }
        }

    @Test
    fun step2TheComparisonThroughTheShellTakesATypedFigureShowsTheGapAndACauseOpensTheCalendar() =
        watched("comparison") {
            runComposeUiTest {
                val rig = signedInWithRhythm()
                try {
                    setShellContent(rig)
                    selectTab(NavCopy.RELEVE)
                    val year = ReleveCopy.yearLabel(COMPARED_YEAR)
                    waitMarked("the Relevé offers $COMPARED_YEAR") { count(hasText(year) and hasClickAction()) > 0 }
                    tapMarked("the year $COMPARED_YEAR", hasText(year) and hasClickAction())
                    waitMarked("the Relevé shows $COMPARED_YEAR") { count(hasText(year) and isSelected()) > 0 }
                    waitForIdle()
                    tapMarked("Comparer avec mon employeur", hasText(ReleveCopy.COMPARE_EMPLOYER) and hasClickAction())
                    waitMarked("the comparison shown") { shows(ComparisonCopy.TITLE) }
                    assertTrue(
                        shows(ComparisonCopy.employerRateLabel(COMPARED_YEAR)),
                        "the attestation field's label",
                    )
                    typeMarked("the employer's figure", EMPLOYER_RATE_TYPED)
                    val gap = assertNotNull(comparisonFor(parseEmployerRate(EMPLOYER_RATE_TYPED)).gap, "a gap")
                    waitMarked("the gap shown") { shows(ComparisonCopy.gapHeadline(gap.points)) }
                    assertTrue(shows(ComparisonCopy.CAUSE_MISSIONS_TITLE), "the fixture logs missions: a cause row")
                    tapMarked("the missions cause", hasText(ComparisonCopy.CAUSE_MISSIONS_TITLE) and hasClickAction())
                    waitMarked("the cause closed the comparison onto the Calendrier (MainTabs' onViewDays)") {
                        !shows(ComparisonCopy.TITLE) && calendarShown()
                    }
                } finally {
                    rig.close()
                }
            }
        }

    @Test
    fun step3TheRythmeShowsTheRhythmAndATapStoresTheDay() =
        watched("rythme") {
            runComposeUiTest {
                val rig = signedInWithRhythm()
                try {
                    setShellContent(rig)
                    openRythme()
                    assertTrue(shows(RythmeCopy.TITLE), "the Rythme overlay's title")
                    val homeToggle = hasText(RythmeCopy.DOMICILE) and hasClickAction()
                    assertEquals(2, count(homeToggle and isSelected()), "Tuesday and Thursday shown at home")
                    tapMarked("Lundi: Domicile", homeToggle)
                    val monday = TUE_THU_HOME.copy(monday = RhythmKind.DOMICILE)
                    waitMarked("Monday stored at home, in the iOS database") { rig.rhythmNow() == monday }
                    waitMarked("the helper line follows") { shows(RythmeCopy.weeklyDomicile(3)) }
                    assertEquals(3, count(homeToggle and isSelected()))
                    assertEquals(0, rig.recordedDays(), "nothing recorded (R340)")
                } finally {
                    rig.close()
                }
            }
        }

    @Test
    fun step4ThePrevisionShowsTheDerivedForecastAndOpensTheSimulator() =
        watched("prevision") {
            runComposeUiTest {
                val rig = signedInWithRhythm()
                val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
                try {
                    val derived = derivedForecast(rig, scope)
                    setShellContent(rig)
                    openPrevision()
                    waitMarked("the derived forecast computed") { derived.state.value.projection != null }
                    val projection = assertNotNull(derived.state.value.projection)
                    waitMarked("the two figures shown") {
                        shows(formatDeclarableRate(projection.projectedRate)) &&
                            shows(formatDeclarableRate(projection.currentRate))
                    }
                    mark("the forecast shown: ${formatDeclarableRate(projection.projectedRate)}")
                    assertTrue(shows(PrevisionCopy.PROJECTION_BADGE), "the projection chip")
                    assertTrue(shows(PrevisionCopy.R340_NOTE), "the lock line (Glyph.LOCK)")
                    assertFalse(shows(PrevisionCopy.ALERT_OFFER), "iOS Ruling 3 Q4: no alert offer on iOS")
                    tapMarked("Tester un changement", hasText(PrevisionCopy.TEST_CHANGE) and hasClickAction())
                    waitMarked("the simulator opened") { shows(SimulationCopy.TITLE) }
                    assertEquals(TUE_THU_HOME to 0, rig.rhythmNow() to rig.recordedDays(), "showing writes nothing")
                } finally {
                    scope.cancel()
                    rig.close()
                }
            }
        }

    @Test
    fun step5TheSimulationsDropdownOpensAWeekdayIsPickedAdoptedAndTheRateIsTyped() =
        watched("simulation") {
            runComposeUiTest {
                val rig = signedInWithRhythm()
                try {
                    setShellContent(rig)
                    openSimulation()
                    pickFriday()
                    tapMarked("ADOPT", hasText(SimulationCopy.ADOPT) and hasClickAction())
                    val friday = TUE_THU_HOME.copy(friday = RhythmKind.DOMICILE)
                    waitMarked("adopted: Friday at home in the iOS database, and back on Prévision (AN-SIM)") {
                        rig.rhythmNow() == friday && shows(PrevisionCopy.TITLE) && !shows(SimulationCopy.TITLE)
                    }
                    tapMarked("Tester un changement", hasText(PrevisionCopy.TEST_CHANGE) and hasClickAction())
                    waitMarked("the simulator again") { shows(SimulationCopy.TITLE) }
                    tapMarked("the rate chip", hasText(SimulationCopy.SCENARIO_RATE) and hasClickAction())
                    waitMarked("the rate scenario shown") { shows(SimulationCopy.RATE_LABEL) }
                    assertEquals(1, count(hasText(SimulationCopy.SCENARIO_RATE) and isSelected()), "the chip selected")
                    typeMarked("the new rate", TARGET_RATE_TYPED)
                    waitMarked("the rate reached the field") {
                        count(hasSetTextAction() and hasText(TARGET_RATE_TYPED)) > 0
                    }
                    assertEquals(0, rig.recordedDays(), "simulating records nothing (R340)")
                } finally {
                    rig.close()
                }
            }
        }

    /**
     * IOS-2e R836: the same DropdownMenu, its Friday item picked by a POINTER TAP behind R806's in-window guard, now
     * inside the real shell. Every assertion and every wait names R836, so a red run is readable from its first line.
     */
    @Test
    fun step6TheSimulationsDropdownItemIsPickedByAPointerTap() =
        watched("R836-pointer-tap") {
            runComposeUiTest {
                val rig = signedInWithRhythm()
                try {
                    setShellContent(rig)
                    openSimulation()
                    val monday = RythmeCopy.DAYS[DayOfWeek.MONDAY.ordinal]
                    val wednesday = RythmeCopy.DAYS[DayOfWeek.WEDNESDAY.ordinal]
                    val friday = RythmeCopy.DAYS[DayOfWeek.FRIDAY.ordinal]
                    tapMarked("the weekday field", hasText(monday) and hasClickAction())
                    waitMarked("$R836: the DropdownMenu open") { count(hasText(friday) and hasClickAction()) == 1 }
                    pointerTapMarked("the Friday item", hasText(friday) and hasClickAction())
                    waitMarked("$R836: Friday chosen by the pointer tap and the menu closed") {
                        !shows(wednesday) && count(hasText(friday) and hasClickAction()) == 1 &&
                            count(hasText(monday) and hasClickAction()) == 0
                    }
                    mark("$R836: the DropdownMenuItem PICKED by a pointer tap: Friday")
                    assertEquals(TUE_THU_HOME, rig.rhythmNow(), "$R836: nothing adopted")
                    assertEquals(0, rig.recordedDays(), "$R836: nothing written (R340)")
                } finally {
                    rig.close()
                }
            }
        }

    /** R818: the DropdownMenu OPENED, its items asserted, one PICKED by its OnClick action, the choice reaching it. */
    private fun ComposeUiTest.pickFriday() {
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
            !shows(wednesday) && count(hasText(friday) and hasClickAction()) == 1 &&
                count(hasText(monday) and hasClickAction()) == 0
        }
        mark("the DropdownMenuItem PICKED: Friday")
    }
}
