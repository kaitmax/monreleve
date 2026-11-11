package ch.monreleve.app.pilot

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.intl.Locale
import androidx.compose.ui.unit.Density
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.RecordQuality
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.dossier.parseDossier
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.DayCellCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.fr.text.formatMonthYear
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.releve.ExportKind
import ch.monreleve.app.releve.ReleveController
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.ui.screens.calendrier.CalendarActions
import ch.monreleve.app.ui.screens.calendrier.CalendrierScreen
import ch.monreleve.app.ui.screens.calendrier.LIST_FONT_SCALE_THRESHOLD
import ch.monreleve.app.ui.screens.releve.ReleveActions
import ch.monreleve.app.ui.screens.releve.ReleveScreen
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
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
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2c R793. THE SHARED RELEVE AND CALENDRIER SCREENS, COMPOSED AND DRIVEN ON THE iOS SIMULATOR, OVER FAKES.
//
// Each screen is hosted the way MainActivity hosts it (the controller's state -> the screen, the actions bound to the
// controller's methods), with the REAL shared controller over scripted seams: no server, no account, no address.
//
// R791 (2), said as R624 taught it: a Material3 composable can COMPILE for iOS and still throw IrLinkageError the
// moment it RUNS (the DatePicker did). So these tests do not stop at composing the screen - they OPEN the
// ModalBottomSheet (a day tapped), type nothing but compose its OutlinedTextField, SAVE through it, OPEN the bulk
// AlertDialog and CONFIRM it, and compose the large-text list's Checkbox and TAP it. The Releve's export button is
// tapped too; the platform share sheet is the host's, so the event is collected here instead. Strings come from fr/
// and expected values from the shared formatters (R181).
//
// IOS-2c-FIX R806-R809, AFTER IOS-2c-PROBE (run 42202057374, REPORT-IOS-2c-PROBE.txt). The probe found no product hang.
// In CMP 1.7.3 the library's wait never throws (R800), so abbed46's wait on a condition that stayed false polled for
// ever; and in this 1024 x 768 test window the sheet opens PARTIALLY expanded with its Save below the window
// (boundsInWindow = Rect.Zero), so abbed46's Save tap never reached the Save - nothing was written and the sheet
// closed by a dismiss path. So:
//   - EVERY WAIT IN THIS FILE goes through waitBounded (BoundedWait.kt, R807): a condition that stays false FAILS at
//     TIMEOUT, naming itself, instead of running to the job's timeout. step1-step3's steps and assertions are as
//     abbed46 wrote them; only their waits now end.
//   - step4c brings the Save into the window the way a user can - the drag handle's Expand action, the one VoiceOver
//     offers - and ASSERTS that the tap will land inside the window before it taps (R806).
//   - step4a (the scrim closes the sheet and writes nothing: the app never records a day by itself) is kept as a
//     plain behaviour test; the probe's step4b (a programmatic close, not a user path) is dropped and the probe's
//     R802 instrumentation is stripped (R809). The marks and the watchdog stay: performScrollTo's loop and every
//     fetch's wait for idle have no bound in 1.7.3 (R800), and nothing else bounds them.

private const val TAX_YEAR = 2026
private const val TIMEOUT = 10_000L
private const val NOW = "2026-06-15T10:00:00Z"
private const val LARGE_TEXT = 2f

// A fixture dossier in the server's wire shape, read by the shared parser (DossierWireGoldenTest's richer body).
// IOS-2d R820: internal, not private - SimulationForecastScreensIosTest's Comparison host reads the same dossier
// (one text, one home - R206), as MainActivity builds the comparison from the Releve's loaded document.
internal val FIXTURE_DOSSIER =
    """
    {
      "taxYear": 2026,
      "period": { "fraction": 0.5, "startDate": "2026-07-01" },
      "titulaire": "Dupont",
      "generatedAt": "2026-06-18T18:04:00.000Z",
      "canton": "VD",
      "employmentRate": 80,
      "denominatorKind": "EXACT",
      "tiles": { "workedDays": 120, "swissDays": 40, "teleworkDays": 20, "missionDays": 2 },
      "zone": {
        "declarableRate": 39.16, "rawRate": 39.16, "ratesDiffer": false,
        "fiscalCeilingDays": 48, "remainingToFiscal": 8, "remainingToSocial": 12,
        "warnings": [ { "code": "EXACT_METHOD_UNVERIFIED" } ]
      },
      "months": [
        { "month": 7, "swissDays": 10, "teleworkDays": 5, "missionDaysFrance": 1,
          "missionDaysThirdState": 0, "absenceDays": 1, "cumulativeDeclarableRate": 33.3 }
      ],
      "annex": [
        { "dayDate": "2026-07-01", "recorded": true, "portion": "FULL", "kind": "HOME",
          "absenceReason": null, "note": "domicile", "provenance": "MANUAL", "detectedKind": null,
          "firstRecordedAt": "2026-07-01T10:00:00.000Z", "lastModifiedAt": null,
          "clientClaimedAt": null, "late": false }
      ],
      "absenceDays": 1,
      "recordedEntries": 1,
      "creditedMissionDays": 2,
      "rateWithoutMissions": 35.0
    }
    """.trimIndent()

/** The calendar's repository, in memory: it writes what it is asked, in order, and the controller observes it. */
private class RecordingRepository : EntryRepository {
    val rows = MutableStateFlow<List<EntryEntity>>(emptyList())
    val recorded = mutableListOf<RecordCommand>()

    override suspend fun record(command: RecordCommand): RecordResult {
        recorded += command
        val row =
            EntryEntity(
                clientMutationId = "ios-${recorded.size}",
                dayDate = command.dayDate,
                portion = command.portion,
                kind = command.kind,
                absenceReason = command.absenceReason,
                note = command.note,
                provenance = command.provenance,
                detectedKind = null,
                detectedAt = null,
                clientClaimedAt = null,
                serverId = null,
                firstRecordedAt = null,
                lastModifiedAt = null,
                syncState = SyncState.PENDING,
            )
        rows.value = rows.value.filterNot { it.dayDate == command.dayDate && it.portion == command.portion } + row
        return RecordResult.Recorded(row)
    }

    override fun observePending(): Flow<List<EntryEntity>> =
        rows.map { all -> all.filter { it.syncState == SyncState.PENDING } }

    override fun observeAll(): Flow<List<EntryEntity>> = rows
}

private class Syncs {
    var count = 0
}

/** The shared CalendarController over [repository], on a fixed kotlin.time Clock at NOW - the one opt-in site. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: a fixed kotlin.time Clock for the controller - on the allowlist.
private fun calendarController(
    repository: RecordingRepository,
    syncs: Syncs,
    scope: CoroutineScope,
): CalendarController {
    val at = Instant.parse(NOW)
    return CalendarController(
        repository = repository,
        settingsStore = InMemorySettingsStore(Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)),
        taxYear = TAX_YEAR,
        clock =
            object : Clock {
                override fun now(): Instant = at
            },
        scope = scope,
        requestSync = { syncs.count++ },
    )
}

/** MainActivity's AppTab.CALENDRIER branch, reduced to its calls: the same controller methods behind each action. */
@Composable
private fun CalendrierHost(
    repository: RecordingRepository,
    syncs: Syncs,
) {
    val scope = rememberCoroutineScope()
    val controller = remember { calendarController(repository, syncs, scope) }
    val state by controller.state.collectAsState()
    FrontierTheme {
        CalendrierScreen(
            state = state,
            actions =
                CalendarActions(
                    onPreviousMonth = controller::goPreviousMonth,
                    onNextMonth = controller::goNextMonth,
                    onDayClick = controller::openDay,
                    onSave = controller::save,
                    onDismissSheet = controller::closeSheet,
                    onStartSelection = { controller.startSelection() },
                    onStartSelectionWithDay = { iso -> controller.startSelection(iso) },
                    onToggleDay = controller::tapDay,
                    onCancelSelection = controller::cancelSelection,
                    onChooseBulk = controller::chooseBulk,
                    onConfirmBulk = controller::confirmBulk,
                    onCancelConfirmation = controller::cancelBulkConfirmation,
                ),
        )
    }
}

/** MainActivity's AppTab.RELEVE branch, reduced: the export event the host hands to the share sheet is collected. */
@Composable
private fun ReleveHost(
    fetches: MutableList<Int>,
    exports: MutableList<String>,
    events: MutableList<ExportEvent>,
    script: (Int) -> DossierResult,
) {
    val scope = rememberCoroutineScope()
    val controller =
        remember {
            ReleveController(
                fetch = { year ->
                    fetches += year
                    script(year)
                },
                exportBytes = { path ->
                    exports += path
                    BytesOutcome.Ok(200, ExportBytes(byteArrayOf(1, 2, 3), null))
                },
                repository = RecordingRepository(),
                taxYear = TAX_YEAR,
                scope = scope,
            )
        }
    LaunchedEffect(controller) { controller.exportEvents.collect { events += it } }
    val state by controller.state.collectAsState()
    FrontierTheme {
        ReleveScreen(
            state = state,
            actions =
                ReleveActions(
                    onRetry = controller::load,
                    onExportPdf = { controller.export(ExportKind.PDF) },
                    onExportCsv = { controller.export(ExportKind.CSV) },
                    onSelectYear = controller::selectYear,
                ),
        )
    }
}

/**
 * IOS-2c R793, AFTER RUN 42135274188 HUNG. That run compiled and linked this file for the simulator, then stopped
 * producing output inside this class for 26 minutes until it was cancelled - with no way to say which step. So every
 * step now prints a MARK, and each test arms a WATCHDOG: a GCD block on a global queue (it fires even if the main
 * thread is blocked) that, if the test has not finished within WATCHDOG_SECONDS, prints the test and the last step
 * reached and ends the process. A hang is then a named finding in minutes, not a silent 50-minute timeout.
 */
private object Progress {
    var test = ""
    var step = ""
    var generation = 0
    var done = false
}

private const val WATCHDOG_SECONDS = 120L
private const val WATCHDOG_EXIT = 3

@OptIn(ExperimentalForeignApi::class) // the posix stdout flush - function-scoped, as KeychainTokenStore's interop is.
private fun mark(step: String) {
    Progress.step = step
    println("R793 MARK ${Progress.test}: $step")
    fflush(stdout)
}

@OptIn(ExperimentalForeignApi::class) // GCD and posix, function-scoped (KeychainTokenStore's precedent).
private fun watched(
    test: String,
    body: () -> Unit,
) {
    Progress.generation += 1
    val generation = Progress.generation
    Progress.test = test
    Progress.done = false
    mark("started")
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, WATCHDOG_SECONDS * NSEC_PER_SEC.toLong()),
        // 0 = the default-priority global queue (Apple's documented dispatch_get_global_queue(0, 0)).
        dispatch_get_global_queue(0L, 0u),
    ) {
        if (Progress.generation == generation && !Progress.done) {
            println("R793 WATCHDOG: $test HUNG after ${WATCHDOG_SECONDS}s - last step reached: ${Progress.step}")
            fflush(stdout)
            exitProcess(WATCHDOG_EXIT)
        }
    }
    try {
        body()
        mark("finished")
    } finally {
        Progress.done = true
    }
}

// Material3 1.7.3's own strings, as the library's l10n sources write them (material3-uikitsimarm64-1.7.3-sources.jar,
// skikoMain/androidx/compose/material3/l10n/, the "en" and "fr" maps that Strings.skiko.kt's getString resolves
// through Locale.current) - read there, not guessed; the run prints the locale the simulator resolved.
//   - the SCRIM announces Strings.CloseSheet (ModalBottomSheet.kt 412 and 418): En.kt:27, Fr.kt:27;
//   - the DRAG HANDLE labels its Expand action Strings.BottomSheetExpandDescription (ModalBottomSheet.kt 306 and 319,
//     offered only while the sheet is PartiallyExpanded): En.kt:73, Fr.kt:73.
private const val M3_CLOSE_SHEET_EN = "Close sheet"
private const val M3_CLOSE_SHEET_FR = "Fermer la feuille"
private const val M3_EXPAND_SHEET_EN = "Expand bottom sheet"
private const val M3_EXPAND_SHEET_FR = "Développer la bottom sheet"

// The tests are named step1..step4c so that declaration order and alphabetical order agree (whichever the runner
// uses), from the least to the most at risk: the Releve (Buttons only), the large-text list (Checkbox), the bulk
// AlertDialog, the ModalBottomSheet - 4a dismissed by its scrim, 4c saved through its Save. There is no 4b: the
// probe's programmatic close was dropped (R809), and its name is not reused for something else.
@OptIn(ExperimentalTestApi::class)
class CalendrierReleveScreensIosTest {
    private fun SemanticsNodeInteractionsProvider.shows(text: String): Boolean =
        onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    private fun SemanticsNodeInteractionsProvider.tap(label: String) = tapFirst(hasText(label) and hasClickAction())

    private fun SemanticsNodeInteractionsProvider.tapFirst(matcher: SemanticsMatcher) {
        val node = onAllNodes(matcher).onFirst()
        try {
            node.performScrollTo()
        } catch (expectedOutsideAScroll: AssertionError) {
            // a button in a dialog or a sheet is not in the screen's scroll; nothing to scroll
        }
        node.performClick()
    }

    /** An unanswered past working day's grid cell, found by what it announces (the shared DayCellCopy, R181). */
    private fun missingDay(dayOfMonth: Int): SemanticsMatcher =
        hasClickAction() and
            hasContentDescription(
                DayCellCopy.contentDescription(dayOfMonth, null, RecordQuality.MISSING.name, false),
            )

    @Test
    fun step1TheReleveShowsAFixtureDossierAfterARetryAndItsExportButtonExports() =
        watched("releve") {
            runComposeUiTest {
                val document = parseDossier(FIXTURE_DOSSIER)
                val fetches = mutableListOf<Int>()
                val exports = mutableListOf<String>()
                val events = mutableListOf<ExportEvent>()
                var first = true
                setContent {
                    ReleveHost(fetches, exports, events) { year ->
                        when {
                            year != TAX_YEAR -> DossierResult.Unreadable
                            first -> DossierResult.NetworkError.also { first = false }
                            else -> DossierResult.Loaded(document)
                        }
                    }
                }
                waitBounded("the network failure shown", TIMEOUT) { shows(ReleveCopy.ERROR_NETWORK) }
                mark("the network failure shown; retry")
                tap(SignInCopy.RETRY)
                waitBounded("the fixture dossier shown", TIMEOUT) { shows(document.titulaire) }
                mark("the fixture dossier shown")
                assertTrue(shows(ReleveCopy.TITLE), "the document's title")
                assertEquals(listOf(TAX_YEAR, TAX_YEAR - 1, TAX_YEAR), fetches)
                tap(ReleveCopy.EXPORT_PDF)
                waitBounded("the PDF export event received", TIMEOUT) { events.isNotEmpty() }
                mark("the PDF export event received")
                assertEquals(listOf("/api/v1/export/pdf?year=$TAX_YEAR"), exports)
                val ready = ExportEvent.Ready(byteArrayOf(1, 2, 3), "releve-$TAX_YEAR.pdf", "application/pdf")
                assertEquals(listOf<ExportEvent>(ready), events)
            }
        }

    @Test
    fun step2AtLargeTextTheListsCheckboxSelectsADay() =
        watched("checkbox") {
            runComposeUiTest {
                val repository = RecordingRepository()
                setContent {
                    val density = LocalDensity.current
                    CompositionLocalProvider(LocalDensity provides Density(density.density, LARGE_TEXT)) {
                        CalendrierHost(repository, Syncs())
                    }
                }
                assertTrue(LARGE_TEXT >= LIST_FONT_SCALE_THRESHOLD, "the list is what large text shows")
                waitBounded("the month shown as a list", TIMEOUT) { shows(formatMonthYear(TAX_YEAR, 6)) }
                mark("the month shown as a list")
                assertTrue(onAllNodes(isToggleable()).fetchSemanticsNodes().isEmpty(), "no Checkbox before selecting")
                tap(CalendarCopy.SELECT_MULTIPLE)
                waitBounded("the Checkboxes composed", TIMEOUT) {
                    onAllNodes(isToggleable()).fetchSemanticsNodes().isNotEmpty()
                }
                mark("the Checkboxes composed")
                tapFirst(isToggleable())
                waitBounded("one day selected", TIMEOUT) { shows(CalendarCopy.selectedCount(1)) }
                mark("a Checkbox tapped: one day selected")
                assertTrue(repository.recorded.isEmpty(), "selecting writes nothing")
            }
        }

    @Test
    fun step3TheBulkAlertDialogOpensAndItsConfirmationWritesEachDay() =
        watched("dialog") {
            runComposeUiTest {
                val repository = RecordingRepository()
                val syncs = Syncs()
                setContent { CalendrierHost(repository, syncs) }
                waitBounded("the month shown", TIMEOUT) { shows(formatMonthYear(TAX_YEAR, 6)) }
                mark("the month shown")
                tap(CalendarCopy.SELECT_MULTIPLE)
                tapFirst(missingDay(1))
                waitBounded("one day selected", TIMEOUT) { shows(CalendarCopy.selectedCount(1)) }
                tapFirst(missingDay(3))
                waitBounded("three days selected", TIMEOUT) { shows(CalendarCopy.selectedCount(3)) }
                mark("three days selected; DOMICILE chosen")
                tap(AujourdhuiCopy.DOMICILE)
                waitBounded("the AlertDialog open", TIMEOUT) { shows(CalendarCopy.CONFIRM_HEADING) }
                mark("the AlertDialog OPEN")
                assertTrue(
                    shows(CalendarCopy.bulkLateNotice(3, LatenessForecast.BACKFILL_DAYS)),
                    "the dialog states the late days",
                )
                tap(CalendarCopy.SHEET_SAVE)
                waitBounded("the AlertDialog confirmed and closed, three days written", TIMEOUT) {
                    !shows(CalendarCopy.CONFIRM_HEADING) && repository.recorded.size == 3
                }
                mark("the AlertDialog CONFIRMED and closed")
                val days = listOf("2026-06-01", "2026-06-02", "2026-06-03")
                val bulk = days.map { RecordCommand(it, EntryKind.HOME, Portion.FULL) }
                assertEquals(bulk, repository.recorded)
                assertEquals(1, syncs.count)
            }
        }

    // ------------------------------------------------------------------------------------------------------------
    // step4 - THE MODALBOTTOMSHEET. A MARK on both sides of every call that can wait without a bound (R809): the
    // fetches, performScrollTo, performClick, the semantics actions, setContent - so if the watchdog ever fires, the
    // last mark names the call that did not return.
    // ------------------------------------------------------------------------------------------------------------

    /** waitBounded at this file's TIMEOUT, marked on both sides. */
    private fun ComposeUiTest.waitMarked(
        what: String,
        condition: () -> Boolean,
    ) {
        mark("wait ($what) - calling, bounded at ${TIMEOUT}ms")
        waitBounded(what, TIMEOUT, condition)
        mark("wait ($what) - returned")
    }

    /** performScrollTo as abbed46's tapFirst calls it (no scroll parent is not an error), marked on both sides. */
    private fun SemanticsNodeInteraction.scrollToMarked(what: String) {
        mark("tap $what: performScrollTo - calling")
        try {
            performScrollTo()
            mark("tap $what: performScrollTo - returned")
        } catch (expectedOutsideAScroll: AssertionError) {
            mark("tap $what: performScrollTo - no scroll parent")
        }
    }

    /** abbed46's tapFirst, marked between its calls. */
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
     * R806's GUARD, then the tap. performClick injects its touch at the CENTRE OF THE NODE'S boundsInRoot (R800 (3):
     * InjectionScope.kt 146, MultiModalInjectionScope.kt 99-117) - clipped by the node's ancestors, NOT by the window.
     * abbed46's Save tap aimed there while the Save had no area inside the 1024 x 768 window (the probe's Rect.Zero),
     * and the sheet closed by another path with nothing written. So before tapping, the tap point must lie inside the
     * node's boundsInWindow, which must be non-empty; otherwise the test fails HERE, saying where the tap would land.
     */
    private fun SemanticsNodeInteractionsProvider.tapInsideTheWindow(
        what: String,
        matcher: SemanticsMatcher,
    ) {
        val node = onAllNodes(matcher).onFirst()
        node.scrollToMarked(what)
        mark("tap $what: its bounds - reading")
        val target = node.fetchSemanticsNode()
        val inRoot = target.boundsInRoot
        val inWindow = target.boundsInWindow
        mark("tap $what: boundsInRoot=$inRoot tapPoint=${inRoot.center} boundsInWindow=$inWindow")
        assertTrue(
            !inWindow.isEmpty && inWindow.contains(inRoot.center),
            "R806: $what is not inside the window - its tap would land at ${inRoot.center} (the centre of its " +
                "boundsInRoot $inRoot), outside its boundsInWindow $inWindow",
        )
        mark("tap $what: the tap point is inside the window; performClick - calling")
        node.performClick()
        mark("tap $what: performClick - returned")
    }

    /** Material3's scrim: its click action and the "close sheet" description it announces (EN or FR, above). */
    private fun scrim(): SemanticsMatcher =
        hasClickAction() and (hasContentDescription(M3_CLOSE_SHEET_EN) or hasContentDescription(M3_CLOSE_SHEET_FR))

    /** The sheet's Save, as abbed46's tap(CalendarCopy.SHEET_SAVE) found it. */
    private fun saveButton(): SemanticsMatcher = hasText(CalendarCopy.SHEET_SAVE) and hasClickAction()

    private fun offersExpand(): SemanticsMatcher = SemanticsMatcher.keyIsDefined(SemanticsActions.Expand)

    private fun offersCollapse(): SemanticsMatcher = SemanticsMatcher.keyIsDefined(SemanticsActions.Collapse)

    /**
     * R806: WHERE THE SAVE IS, recorded - its boundsInRoot and positionInRoot (root coordinates; the tap point is the
     * centre of boundsInRoot) and its boundsInWindow (the part inside the window; Rect.Zero = no part) - and what the
     * sheet's drag handle offers, by action label: Expand while PartiallyExpanded, Collapse once Expanded.
     */
    private fun SemanticsNodeInteractionsProvider.markSaveBounds(moment: String) {
        mark("the Save's bounds $moment - reading")
        val save = onNode(saveButton()).fetchSemanticsNode()
        val expand =
            onAllNodes(offersExpand()).fetchSemanticsNodes().map { it.config.getOrNull(SemanticsActions.Expand)?.label }
        val collapse =
            onAllNodes(offersCollapse())
                .fetchSemanticsNodes()
                .map { it.config.getOrNull(SemanticsActions.Collapse)?.label }
        val where = "boundsInRoot=${save.boundsInRoot} positionInRoot=${save.positionInRoot}"
        val tapPoint = "tapPoint=${save.boundsInRoot.center} boundsInWindow=${save.boundsInWindow}"
        mark("the Save's bounds $moment: $where $tapPoint | the handle offers Expand=$expand Collapse=$collapse")
    }

    /** abbed46's step4 up to the open sheet: the calendar hosted, the month, no sheet yet, day 10 tapped, the sheet. */
    private fun ComposeUiTest.openDayTen(
        repository: RecordingRepository,
        syncs: Syncs,
    ) {
        mark("setContent - calling")
        setContent { CalendrierHost(repository, syncs) }
        mark("setContent - returned")
        waitMarked("the month shown") { shows(formatMonthYear(TAX_YEAR, 6)) }
        mark("fetch: no sheet before a day is tapped - calling")
        assertTrue(!shows(CalendarCopy.SHEET_QUESTION), "no sheet before a day is tapped")
        mark("fetch: no sheet before a day is tapped - returned")
        tapMarked("day 10", missingDay(10))
        waitMarked("the sheet's question shown") { shows(CalendarCopy.SHEET_QUESTION) }
        mark("the ModalBottomSheet OPEN (locale ${Locale.current.toLanguageTag()})")
    }

    @Test
    fun step4aTheScrimDismissesTheOpenSheetAndNothingIsWritten() =
        watched("4a-scrim") {
            runComposeUiTest {
                val repository = RecordingRepository()
                val syncs = Syncs()
                openDayTen(repository, syncs)
                waitMarked("exactly one scrim") { onAllNodes(scrim()).fetchSemanticsNodes().size == 1 }
                mark("scrim OnClick - calling (Material3's own: an animated hide(), then onDismissRequest)")
                onNode(scrim()).performSemanticsAction(SemanticsActions.OnClick)
                mark("scrim OnClick - returned")
                waitMarked("the sheet gone, nothing written") {
                    !shows(CalendarCopy.SHEET_QUESTION) && repository.recorded.isEmpty()
                }
                assertTrue(repository.recorded.isEmpty(), "nothing written")
                assertEquals(0, syncs.count)
            }
        }

    @Test
    fun step4cADayOpensTheModalBottomSheetAndItsSaveWritesTheDay() =
        watched("4c-save") {
            runComposeUiTest {
                val repository = RecordingRepository()
                val syncs = Syncs()
                openDayTen(repository, syncs)
                mark("fetch: the sheet's OutlinedTextField - calling")
                assertTrue(shows(CalendarCopy.SHEET_NOTE_LABEL), "the sheet's OutlinedTextField is composed")
                mark("fetch: the sheet's OutlinedTextField - returned")
                markSaveBounds("as found")
                // R806: the Save brought into the window the way a user can - the drag handle's Expand action, which
                // VoiceOver offers and which runs Material3's own sheetState.expand(). Chosen over a swipeUp: a swipe's
                // outcome rests on injected velocity and the anchored draggable's thresholds, and its start point on
                // a geometry guess near the window's edge - where a press outside the dialog's layer dismisses.
                waitMarked("exactly one node offering Expand") {
                    onAllNodes(offersExpand()).fetchSemanticsNodes().size == 1
                }
                val label = onNode(offersExpand()).fetchSemanticsNode().config.getOrNull(SemanticsActions.Expand)?.label
                assertTrue(
                    label == M3_EXPAND_SHEET_EN || label == M3_EXPAND_SHEET_FR,
                    "the node offering Expand is the sheet's drag handle, by Material3's own label: $label",
                )
                mark("the handle's Expand ($label) - calling")
                onNode(offersExpand()).performSemanticsAction(SemanticsActions.Expand)
                mark("the handle's Expand - returned")
                waitMarked("the sheet expanded: its handle offers Collapse, no longer Expand") {
                    onAllNodes(offersCollapse()).fetchSemanticsNodes().size == 1 &&
                        onAllNodes(offersExpand()).fetchSemanticsNodes().isEmpty()
                }
                markSaveBounds("after expansion")
                tapMarked("SUISSE", hasText(AujourdhuiCopy.SUISSE) and hasClickAction())
                waitMarked("En Suisse selected") {
                    onAllNodes(hasText(AujourdhuiCopy.SUISSE) and isSelected()).fetchSemanticsNodes().size == 1
                }
                mark("SUISSE chosen; saving")
                tapInsideTheWindow("SAVE", saveButton())
                waitMarked("the sheet saved and closed: one command written, one sync") {
                    !shows(CalendarCopy.SHEET_QUESTION) && repository.recorded.size == 1 && syncs.count == 1
                }
                mark("the ModalBottomSheet SAVED and closed")
                assertEquals(listOf(RecordCommand("2026-06-10", EntryKind.CH, Portion.FULL)), repository.recorded)
                assertEquals(1, syncs.count)
            }
        }
}
