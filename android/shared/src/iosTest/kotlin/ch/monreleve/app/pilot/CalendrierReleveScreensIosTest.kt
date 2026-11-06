package ch.monreleve.app.pilot

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.IdlingResource
import androidx.compose.ui.test.MainTestClock
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isRoot
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
import kotlin.time.TimeSource

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
// IOS-2c-PROBE R801/R802, AFTER RUN 42142576248 (step4's Save never returned). step4 is SPLIT into three variants,
// each with its own 60 s watchdog, a MARK on both sides of every call that can wait for idle, and R802's dump:
//   step4a  the sheet opened, then the SCRIM's own click action (Material3's path: an animated hide(), then
//           onDismissRequest -> controller.closeSheet).
//   step4b  the sheet opened, then controller.closeSheet() from runOnIdle: the abrupt removal of an open sheet, with no
//           click inside its layer.
//   step4c  abbed46's step4, its steps unchanged (day 10, En Suisse, Enregistrer).
// R800's reading of CMP 1.7.3 (the ui-test-uikitsimarm64 1.7.3 sources) decided two things about how they are written:
//   - SkikoComposeUiTest.waitUntil BUILDS its timeout message and never throws it, so a condition that stays false is
//     polled for ever and looks exactly like an idle-wait hang. So every wait in the variants is bounded by its own
//     condition, which throws at TIMEOUT with what it last saw: a false condition fails its variant and the next one
//     still runs. Only a wait that calls nothing back - inside waitForIdle - is left to the watchdog.
//   - the watchdog's block runs on a GCD thread while the main thread is stuck, and from another thread runOnUiThread
//     posts to the main run loop and blocks. So the dump reads PLAIN MEMORY only - never a semantics fetch.

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
    var tag = "R793"
    var generation = 0
    var done = false
}

private const val WATCHDOG_SECONDS = 120L
private const val WATCHDOG_EXIT = 3

@OptIn(ExperimentalForeignApi::class) // the posix stdout flush - function-scoped, as KeychainTokenStore's interop is.
private fun mark(step: String) {
    Progress.step = step
    println("${Progress.tag} MARK ${Progress.test}: $step")
    fflush(stdout)
}

/**
 * IOS-2c-PROBE R801/R802: [seconds] and [dump] are the probe's (60 s, R802's dump at HALF the time and at the FIRE);
 * step1..step3 pass neither, so their watchdog is R793's, unchanged.
 */
@OptIn(ExperimentalForeignApi::class) // GCD and posix, function-scoped (KeychainTokenStore's precedent).
private fun watched(
    test: String,
    seconds: Long = WATCHDOG_SECONDS,
    dump: ((String) -> Unit)? = null,
    body: () -> Unit,
) {
    Progress.generation += 1
    val generation = Progress.generation
    Progress.test = test
    Progress.tag = if (dump == null) "R793" else PROBE_TAG
    Progress.done = false
    mark("started")
    if (dump != null) {
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, seconds / 2 * NSEC_PER_SEC.toLong()),
            dispatch_get_global_queue(0L, 0u),
        ) {
            if (Progress.generation == generation && !Progress.done) {
                dump?.invoke(HALF)
            }
        }
    }
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, seconds * NSEC_PER_SEC.toLong()),
        // 0 = the default-priority global queue (Apple's documented dispatch_get_global_queue(0, 0)).
        dispatch_get_global_queue(0L, 0u),
    ) {
        if (Progress.generation == generation && !Progress.done) {
            println("${Progress.tag} WATCHDOG: $test HUNG after ${seconds}s - last step reached: ${Progress.step}")
            fflush(stdout)
            dump?.invoke(FIRE)
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

private const val PROBE_TAG = "R801"
private const val PROBE_WATCHDOG_SECONDS = 60L
private const val HALF = "HALF"
private const val FIRE = "FIRE"
private const val WAIT_EXPIRED = "WAIT-EXPIRED"

// Material3 1.7.3's scrim announces getString(Strings.CloseSheet) (ModalBottomSheet.kt 412 and 418), which
// Strings.skiko.kt resolves through Locale.current. Its value for the two locales this runner can have, as the
// library's own l10n sources write it (l10n/En.kt:27, l10n/Fr.kt:27) - read there, not guessed. The locale the
// simulator actually resolves is printed with the sheet facts.
private const val M3_CLOSE_SHEET_EN = "Close sheet"
private const val M3_CLOSE_SHEET_FR = "Fermer la feuille"

/** What the probe knows (R802). Written on the main thread by the variant; the watchdog's GCD block only reads it. */
private object SheetProbe {
    val tapsReturned = mutableListOf<String>()
    var repository: RecordingRepository? = null
    var syncs: Syncs? = null
    var controller: CalendarController? = null
    var recompositions = 0
    var idleChecks = 0
    var conditionPolls = 0
    var snapshotApplies = 0
    var clockMs = -1L
    var autoAdvance = true
    var pendingChanges = false
    var applyPending = false
    var lastCondition = "none evaluated"
    var facts = "not read"
    var atHalf = "not reached"

    fun arm(
        repository: RecordingRepository,
        syncs: Syncs,
    ) {
        tapsReturned.clear()
        this.repository = repository
        this.syncs = syncs
        controller = null
        recompositions = 0
        idleChecks = 0
        conditionPolls = 0
        snapshotApplies = 0
        clockMs = -1L
        lastCondition = "none evaluated"
        facts = "not read"
        atHalf = "not reached"
    }

    fun counters(): String {
        val pumped = "idleChecks=$idleChecks conditionPolls=$conditionPolls mainClock.currentTime=${clockMs}ms"
        return "recompositions=$recompositions snapshotApplies=$snapshotApplies $pumped"
    }
}

/**
 * R802 (6). An IdlingResource that is ALWAYS idle, so waitForIdle decides exactly as it would without it (with no
 * resource registered, and with this one, every resource is idle). waitForIdle asks it on the main thread at every
 * iteration, so it counts them and samples there the public terms of SkikoComposeUiTest.shouldPumpTime():
 * Snapshot.current.hasPendingChanges() and Snapshot.isApplyObserverNotificationPending. The third term,
 * scene.hasInvalidations(), and the roots' hasPendingMeasureOrLayout need @InternalComposeUiApi: not read.
 */
private class IdleProbe(
    private val clock: MainTestClock,
) : IdlingResource {
    override val isIdleNow: Boolean
        get() {
            SheetProbe.idleChecks++
            SheetProbe.clockMs = clock.currentTime
            SheetProbe.autoAdvance = clock.autoAdvance
            SheetProbe.pendingChanges = Snapshot.current.hasPendingChanges()
            SheetProbe.applyPending = Snapshot.isApplyObserverNotificationPending
            return true
        }
}

@OptIn(ExperimentalForeignApi::class) // the posix stdout flush, as mark's.
private fun say(line: String) {
    println(line)
    fflush(stdout)
}

/**
 * R802's dump: at HALF the watchdog time (the counters only), at its FIRE, or when a bounded wait expires. PLAIN
 * MEMORY ONLY (see the header), the riskiest read last. Never a code, a token or an address (R574): the fixture's
 * own commands, counts and booleans.
 */
private fun sheetDump(moment: String) {
    val at = "R802 $moment ${Progress.test}"
    if (moment == HALF) {
        SheetProbe.atHalf = SheetProbe.counters()
        say("$at (5) sampled at half the watchdog time: ${SheetProbe.atHalf}; last step: ${Progress.step}")
    } else {
        say("$at (1) the taps that returned: ${runCatching { SheetProbe.tapsReturned.toList() }.getOrNull()}")
        say("$at (2) repository.recorded: ${runCatching { SheetProbe.repository?.recorded?.toList() }.getOrNull()}")
        say("$at (3) syncs.count: ${SheetProbe.syncs?.count}")
        val editingNull = runCatching { SheetProbe.controller?.let { it.state.value.editing == null } }.getOrNull()
        say("$at (4) controller.state.value.editing == null: $editingNull (null = no controller)")
        say("$at (5) at half: ${SheetProbe.atHalf}; now: ${SheetProbe.counters()}")
        val pendingThen = "hasPendingChanges=${SheetProbe.pendingChanges}"
        val applyingThen = "isApplyObserverNotificationPending=${SheetProbe.applyPending}"
        val terms = "$pendingThen $applyingThen autoAdvance=${SheetProbe.autoAdvance}"
        say("$at (6) the idle check's public terms, last read on the main thread by IdleProbe: $terms")
        say("$at the last condition evaluated: ${SheetProbe.lastCondition}")
        say("$at the sheet facts: ${SheetProbe.facts}")
        val pending = runCatching { Snapshot.current.hasPendingChanges() }.getOrNull()
        val applying = runCatching { Snapshot.isApplyObserverNotificationPending }.getOrNull()
        say("$at (6) read now, from this thread: hasPendingChanges=$pending applyNotificationPending=$applying")
    }
}

/** CalendrierHost for the probe: the same controller and actions, plus R802 (5)'s SideEffect and (4)'s handle. */
@Composable
private fun SheetProbeHost(
    repository: RecordingRepository,
    syncs: Syncs,
) {
    val scope = rememberCoroutineScope()
    val controller = remember { calendarController(repository, syncs, scope).also { SheetProbe.controller = it } }
    val state by controller.state.collectAsState()
    SideEffect { SheetProbe.recompositions++ }
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

// The tests are named step1..step4c so that declaration order and alphabetical order agree (whichever the runner
// uses), from the least to the most at risk: the Releve (Buttons only), the large-text list (Checkbox), the bulk
// AlertDialog, the ModalBottomSheet - step4 split by IOS-2c-PROBE into 4a (scrim), 4b (closeSheet), 4c (Save).
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

    // ------------------------------------------------------------------------------------------------------------
    // IOS-2c-PROBE R801/R802. The helpers below are abbed46's calls with a MARK on both sides of each one that can
    // wait for idle (every semantics fetch, performScrollTo's loop, performClick, setContent, runOnIdle, waitUntil).
    // ------------------------------------------------------------------------------------------------------------

    /** Material3's scrim: its click action and the "close sheet" description it announces (EN or FR, above). */
    private fun scrim(): SemanticsMatcher =
        hasClickAction() and (hasContentDescription(M3_CLOSE_SHEET_EN) or hasContentDescription(M3_CLOSE_SHEET_FR))

    /** abbed46's shows(), marked; [label] names the string so the marks stay ASCII. */
    private fun SemanticsNodeInteractionsProvider.showsMarked(
        label: String,
        text: String,
    ): Boolean {
        mark("fetch: shows $label - calling")
        val shown = shows(text)
        mark("fetch: shows $label - returned $shown")
        return shown
    }

    /** abbed46's tapFirst(), marked between its calls; R802 (1)'s flag is set on the line after the click returns. */
    private fun SemanticsNodeInteractionsProvider.tapMarked(
        what: String,
        matcher: SemanticsMatcher,
    ) {
        val node = onAllNodes(matcher).onFirst()
        mark("tap $what: performScrollTo - calling")
        try {
            node.performScrollTo()
            mark("tap $what: performScrollTo - returned")
        } catch (expectedOutsideAScroll: AssertionError) {
            mark("tap $what: performScrollTo - no scroll parent (${expectedOutsideAScroll.message})")
        }
        mark("tap $what: performClick - calling")
        node.performClick()
        SheetProbe.tapsReturned += what
        mark("tap $what: performClick - returned")
    }

    /**
     * waitUntil as abbed46 calls it, BOUNDED by its own condition (R800: in CMP 1.7.3 SkikoComposeUiTest.waitUntil
     * never throws its timeout). Each evaluation is counted; at half the bound it marks what it sees; at the bound it
     * prints R802's dump and throws - a condition that stays false is a FAILED variant with its facts, not a hang.
     */
    private fun ComposeUiTest.waitBounded(
        what: String,
        condition: () -> Boolean,
    ) {
        val started = TimeSource.Monotonic.markNow()
        var halfMarked = false
        mark("wait ($what): waitUntil - calling, bounded at ${TIMEOUT}ms")
        waitUntil(timeoutMillis = TIMEOUT) {
            SheetProbe.conditionPolls++
            val met = condition()
            val elapsed = started.elapsedNow().inWholeMilliseconds
            if (!met && !halfMarked && elapsed >= TIMEOUT / 2) {
                halfMarked = true
                SheetProbe.atHalf = SheetProbe.counters()
                mark("wait ($what): still false at ${elapsed}ms - ${SheetProbe.atHalf} - ${SheetProbe.lastCondition}")
            }
            if (!met && elapsed > TIMEOUT) {
                mark("wait ($what): still false at ${elapsed}ms, the bound - R802's dump, then the variant fails")
                sheetDump(WAIT_EXPIRED)
                throw AssertionError("$what: still false after ${elapsed}ms - ${SheetProbe.lastCondition}")
            }
            met
        }
        mark("wait ($what): waitUntil - returned")
    }

    /** The variants' end condition, its parts noted for R802: the sheet's question gone, [written] commands. */
    private fun SemanticsNodeInteractionsProvider.sheetGone(
        repository: RecordingRepository,
        written: Int,
    ): Boolean {
        val shown = shows(CalendarCopy.SHEET_QUESTION)
        val recorded = repository.recorded.size
        val editingNull = SheetProbe.controller?.let { it.state.value.editing == null }
        SheetProbe.lastCondition = "sheetQuestionShown=$shown recorded=$recorded editingNull=$editingNull"
        return !shown && recorded == written
    }

    /** How many nodes [scrim] matches; when it is not exactly one, the descriptions of the clickable indexed nodes. */
    private fun SemanticsNodeInteractionsProvider.scrimCount(): Int {
        val count = onAllNodes(scrim()).fetchSemanticsNodes().size
        val indexed = hasClickAction() and SemanticsMatcher.keyIsDefined(SemanticsProperties.TraversalIndex)
        val description = SemanticsProperties.ContentDescription
        val seen =
            if (count == 1) {
                "the scrim"
            } else {
                onAllNodes(indexed).fetchSemanticsNodes().map { it.config.getOrNull(description) }
            }
        SheetProbe.lastCondition = "scrim matches=$count ($seen)"
        return count
    }

    private fun SemanticsNodeInteractionsProvider.boundsOf(matcher: SemanticsMatcher) =
        onAllNodes(matcher).fetchSemanticsNodes().map { it.boundsInWindow }

    /** Where the roots, the Save and En Suisse are (window coordinates), and the sheet's value read off its handle. */
    private fun SemanticsNodeInteractionsProvider.readSheetFacts() {
        mark("facts: reading (a fetch per value) - calling")
        val roots = onAllNodes(isRoot()).fetchSemanticsNodes().map { it.boundsInWindow }
        val save = boundsOf(hasText(CalendarCopy.SHEET_SAVE) and hasClickAction())
        val suisse = boundsOf(hasText(AujourdhuiCopy.SUISSE) and hasClickAction())
        val expand = onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.Expand)).fetchSemanticsNodes().size
        val collapse = onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.Collapse)).fetchSemanticsNodes().size
        val where = "roots=$roots save=$save suisse=$suisse"
        val handle = "handleExpand=$expand handleCollapse=$collapse"
        SheetProbe.facts = "locale=${Locale.current.toLanguageTag()} $where $handle"
        mark("facts: ${SheetProbe.facts}")
    }

    /** runComposeUiTest with R802's snapshot-apply counter attached for the variant and detached after it. */
    private fun probed(body: ComposeUiTest.() -> Unit) =
        runComposeUiTest {
            val applies = Snapshot.registerApplyObserver { _, _ -> SheetProbe.snapshotApplies++ }
            try {
                body()
                mark("body done - runComposeUiTest closes the scene next")
            } finally {
                applies.dispose()
            }
        }

    /** abbed46's step4 up to the open sheet (setContent, the month, no sheet, day 10, the sheet), the probe armed. */
    private fun ComposeUiTest.openDayTenProbed(
        repository: RecordingRepository,
        syncs: Syncs,
    ) {
        SheetProbe.arm(repository, syncs)
        registerIdlingResource(IdleProbe(mainClock))
        mark("setContent - calling (it waits for idle)")
        setContent { SheetProbeHost(repository, syncs) }
        mark("setContent - returned")
        waitBounded("the month shown") { shows(formatMonthYear(TAX_YEAR, 6)) }
        mark("the month shown")
        assertTrue(!showsMarked("SHEET_QUESTION", CalendarCopy.SHEET_QUESTION), "no sheet before a day is tapped")
        tapMarked("day 10", missingDay(10))
        waitBounded("the sheet's question shown") { shows(CalendarCopy.SHEET_QUESTION) }
        mark("the ModalBottomSheet OPEN")
        readSheetFacts()
    }

    @Test
    fun step4aTheScrimDismissesTheOpenSheetAndNothingIsWritten() =
        watched("4a-scrim", PROBE_WATCHDOG_SECONDS, ::sheetDump) {
            probed {
                val repository = RecordingRepository()
                val syncs = Syncs()
                openDayTenProbed(repository, syncs)
                waitBounded("exactly one scrim") { scrimCount() == 1 }
                mark("scrim OnClick - calling (Material3's own: an animated hide(), then onDismissRequest)")
                onNode(scrim()).performSemanticsAction(SemanticsActions.OnClick)
                SheetProbe.tapsReturned += "scrim OnClick"
                mark("scrim OnClick - returned")
                waitBounded("the sheet gone, nothing written") { sheetGone(repository, 0) }
                assertTrue(repository.recorded.isEmpty(), "nothing written")
                assertEquals(0, syncs.count)
            }
        }

    @Test
    fun step4bCloseSheetRemovesTheOpenSheetAbruptlyAndNothingIsWritten() =
        watched("4b-closeSheet", PROBE_WATCHDOG_SECONDS, ::sheetDump) {
            probed {
                val repository = RecordingRepository()
                val syncs = Syncs()
                openDayTenProbed(repository, syncs)
                val controller = checkNotNull(SheetProbe.controller) { "the host made no controller" }
                mark("runOnIdle(closeSheet) - calling (waitForIdle, the action, waitForIdle)")
                runOnIdle {
                    mark("runOnIdle: its first waitForIdle returned; controller.closeSheet() - calling")
                    controller.closeSheet()
                    SheetProbe.tapsReturned += "closeSheet()"
                    mark("controller.closeSheet() - returned; runOnIdle's second waitForIdle next")
                }
                mark("runOnIdle(closeSheet) - returned")
                waitBounded("the sheet gone, nothing written") { sheetGone(repository, 0) }
                assertTrue(repository.recorded.isEmpty(), "nothing written")
                assertEquals(0, syncs.count)
            }
        }

    @Test
    fun step4cADayOpensTheModalBottomSheetAndItsSaveWritesTheDay() =
        watched("4c-save", PROBE_WATCHDOG_SECONDS, ::sheetDump) {
            probed {
                val repository = RecordingRepository()
                val syncs = Syncs()
                openDayTenProbed(repository, syncs)
                val noteField = showsMarked("SHEET_NOTE_LABEL", CalendarCopy.SHEET_NOTE_LABEL)
                assertTrue(noteField, "the sheet's OutlinedTextField is composed")
                tapMarked("SUISSE", hasText(AujourdhuiCopy.SUISSE) and hasClickAction())
                mark("fetch: En Suisse selected, and the Save's bounds now - calling")
                val selected = onAllNodes(hasText(AujourdhuiCopy.SUISSE) and isSelected()).fetchSemanticsNodes().size
                val saveNow = boundsOf(hasText(CalendarCopy.SHEET_SAVE) and hasClickAction())
                SheetProbe.facts += " | after En Suisse: selected=$selected saveNow=$saveNow"
                mark("fetch: returned - selected=$selected saveNow=$saveNow")
                mark("SUISSE chosen; saving")
                tapMarked("SAVE", hasText(CalendarCopy.SHEET_SAVE) and hasClickAction())
                waitBounded("the sheet SAVED and closed") { sheetGone(repository, 1) }
                mark("the ModalBottomSheet SAVED and closed")
                assertEquals(listOf(RecordCommand("2026-06-10", EntryKind.CH, Portion.FULL)), repository.recorded)
                assertEquals(1, syncs.count)
            }
        }
}
