package ch.monreleve.app.pilot

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.runComposeUiTest
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

private const val TAX_YEAR = 2026
private const val TIMEOUT = 10_000L
private const val NOW = "2026-06-15T10:00:00Z"
private const val LARGE_TEXT = 2f

// A fixture dossier in the server's wire shape, read by the shared parser (DossierWireGoldenTest's richer body).
private val FIXTURE_DOSSIER =
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

// The tests are named step1..step4 so that declaration order and alphabetical order agree (whichever the runner
// uses), from the least to the most at risk: the Releve (Buttons only), the large-text list (Checkbox), the bulk
// AlertDialog, the ModalBottomSheet.
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
                waitUntil(timeoutMillis = TIMEOUT) { shows(ReleveCopy.ERROR_NETWORK) }
                mark("the network failure shown; retry")
                tap(SignInCopy.RETRY)
                waitUntil(timeoutMillis = TIMEOUT) { shows(document.titulaire) }
                mark("the fixture dossier shown")
                assertTrue(shows(ReleveCopy.TITLE), "the document's title")
                assertEquals(listOf(TAX_YEAR, TAX_YEAR - 1, TAX_YEAR), fetches)
                tap(ReleveCopy.EXPORT_PDF)
                waitUntil(timeoutMillis = TIMEOUT) { events.isNotEmpty() }
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
                waitUntil(timeoutMillis = TIMEOUT) { shows(formatMonthYear(TAX_YEAR, 6)) }
                mark("the month shown as a list")
                assertTrue(onAllNodes(isToggleable()).fetchSemanticsNodes().isEmpty(), "no Checkbox before selecting")
                tap(CalendarCopy.SELECT_MULTIPLE)
                waitUntil(timeoutMillis = TIMEOUT) { onAllNodes(isToggleable()).fetchSemanticsNodes().isNotEmpty() }
                mark("the Checkboxes composed")
                tapFirst(isToggleable())
                waitUntil(timeoutMillis = TIMEOUT) { shows(CalendarCopy.selectedCount(1)) }
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
                waitUntil(timeoutMillis = TIMEOUT) { shows(formatMonthYear(TAX_YEAR, 6)) }
                mark("the month shown")
                tap(CalendarCopy.SELECT_MULTIPLE)
                tapFirst(missingDay(1))
                waitUntil(timeoutMillis = TIMEOUT) { shows(CalendarCopy.selectedCount(1)) }
                tapFirst(missingDay(3))
                waitUntil(timeoutMillis = TIMEOUT) { shows(CalendarCopy.selectedCount(3)) }
                mark("three days selected; DOMICILE chosen")
                tap(AujourdhuiCopy.DOMICILE)
                waitUntil(timeoutMillis = TIMEOUT) { shows(CalendarCopy.CONFIRM_HEADING) }
                mark("the AlertDialog OPEN")
                assertTrue(
                    shows(CalendarCopy.bulkLateNotice(3, LatenessForecast.BACKFILL_DAYS)),
                    "the dialog states the late days",
                )
                tap(CalendarCopy.SHEET_SAVE)
                waitUntil(timeoutMillis = TIMEOUT) {
                    !shows(CalendarCopy.CONFIRM_HEADING) && repository.recorded.size == 3
                }
                mark("the AlertDialog CONFIRMED and closed")
                val days = listOf("2026-06-01", "2026-06-02", "2026-06-03")
                val bulk = days.map { RecordCommand(it, EntryKind.HOME, Portion.FULL) }
                assertEquals(bulk, repository.recorded)
                assertEquals(1, syncs.count)
            }
        }

    @Test
    fun step4ADayOpensTheModalBottomSheetAndItsSaveWritesTheDay() =
        watched("sheet") {
            runComposeUiTest {
                val repository = RecordingRepository()
                val syncs = Syncs()
                setContent { CalendrierHost(repository, syncs) }
                waitUntil(timeoutMillis = TIMEOUT) { shows(formatMonthYear(TAX_YEAR, 6)) }
                mark("the month shown")
                assertTrue(!shows(CalendarCopy.SHEET_QUESTION), "no sheet before a day is tapped")
                tapFirst(missingDay(10))
                waitUntil(timeoutMillis = TIMEOUT) { shows(CalendarCopy.SHEET_QUESTION) }
                mark("the ModalBottomSheet OPEN")
                assertTrue(shows(CalendarCopy.SHEET_NOTE_LABEL), "the sheet's OutlinedTextField is composed")
                tap(AujourdhuiCopy.SUISSE)
                mark("SUISSE chosen; saving")
                tap(CalendarCopy.SHEET_SAVE)
                waitUntil(timeoutMillis = TIMEOUT) {
                    !shows(CalendarCopy.SHEET_QUESTION) && repository.recorded.size == 1
                }
                mark("the ModalBottomSheet SAVED and closed")
                assertEquals(listOf(RecordCommand("2026-06-10", EntryKind.CH, Portion.FULL)), repository.recorded)
                assertEquals(1, syncs.count)
            }
        }
}
