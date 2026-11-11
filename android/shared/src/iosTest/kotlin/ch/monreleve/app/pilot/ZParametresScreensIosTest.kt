package ch.monreleve.app.pilot

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.remote.ExportBytes
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.LicencesCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.text.formatDate
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.AccountExportKind
import ch.monreleve.app.parametres.DeleteOutcome
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.ParametresWire
import ch.monreleve.app.releve.ExportEvent
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.ui.screens.parametres.ParametresActions
import ch.monreleve.app.ui.screens.parametres.ParametresScreen
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
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

// IOS-2e R833 / R835. THE PARAMETRES SCREEN AND ITS LICENCES, COMPOSED AND DRIVEN ON THE iOS SIMULATOR - the last
// screen moved to shared code. Named with a leading Z so it sorts after every other pilot class (IOS-2d DEVIATION
// 9's reason: a hang here, ended by its watchdog, leaves every other class already run).
//
// The screen is hosted the way MainActivity hosts it: the REAL shared ParametresController over a wire that RECORDS
// what it is asked to encode (the org.json one is :app's), a saver that records each PATCH body and answers 200, an
// in-memory settings store holding a completed onboarding, an empty record, and an export that records its path. The
// date slot holds a FAKE picker (no native iOS picker is built here, R830) that shows the initial value it was handed.
// No server, no account, no address. Strings come from fr/ and values from shared code (R181).
//
// R833 - USED, NOT ONLY COMPOSED. The Material3 composables no shared screen used before (measured: Switch, ListItem,
// ListItemDefaults - REPORT-IOS-2e R833) are interacted with: a Switch is TOGGLED by a pointer tap and the action and
// the state are asserted; ListItem rows are TAPPED (the rate, the start date, « En savoir plus », the export row, the
// licences). Each of the three ModalBottomSheets - the edit sheet, « En savoir plus », the export chooser - is OPENED,
// EXPANDED through its drag handle's Expand action when the handle offers one (IOS-2c-FIX R806's way; if the sheet
// opened fully expanded the handle offers none, and the mark says so), its confirm's tap point asserted inside the
// window (R806's guard), and its confirm TAPPED. The date slot is opened, and the fake's pick lands in the field.
//
// R807/R809's DISCIPLINE: every wait goes through waitBounded (BoundedWait.kt); a MARK on both sides of every call that
// can wait without a bound; each test armed with the R793-shaped 120 s watchdog. NOT on IosTestRawWaitUntilFenceTest's
// allowlist: it calls no raw wait.

private const val TIMEOUT = 10_000L
private const val SETTLE_MILLIS = 3_000L
private const val TAX_YEAR = 2026
private const val PICKED_DAY = "2026-03-02"
private const val FAKE_PICKER_PICK = "fake parametres picker: pick 2026-03-02"
private const val FAKE_PICKER_CANCEL = "fake parametres picker: cancel"
private const val FAKE_PICKER_INITIAL = "fake parametres picker: initial="
private const val APP_VERSION_NAME = "pilot"
private const val APP_VERSION_CODE = "1"
private const val EXPORT_JSON_PATH = "/api/v1/account/export"
private const val TYPED_RATE = "80"
private val STORED = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null, name = "Camille")

// Material3 1.7.3's drag-handle labels, as CalendrierReleveScreensIosTest reads them from the library's l10n source.
private const val M3_EXPAND_EN = "Expand bottom sheet"
private const val M3_EXPAND_FR = "Développer la bottom sheet"

/** Records what the controller asks the wire to encode; answers with plain markers (the org.json wire is :app's). */
private class PzWire : ParametresWire {
    val patched = mutableListOf<Settings>()
    val consents = mutableListOf<Boolean>()

    override fun patchBody(settings: Settings): String {
        patched += settings
        return "patch#${patched.size}"
    }

    override fun consentBody(enable: Boolean): String {
        consents += enable
        return "consent:$enable"
    }

    override fun deleteBody(): String = "delete"

    override fun parseReceipt(body: String): DeleteOutcome.Done = DeleteOutcome.Done(0, false)
}

private class PzSaver : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return PostOutcome.Ok(200, "{}")
    }
}

private class PzNoRows : EntryRepository {
    override suspend fun record(command: RecordCommand): RecordResult =
        throw UnsupportedOperationException("Parametres never records a day")

    override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())
}

/** What the host saw: the controller, the export paths and events, the legal pages and the picker's initial values. */
private class PzHeld {
    var controller: ParametresController? = null
    val exportPaths = mutableListOf<String>()
    val exportEvents = mutableListOf<ExportEvent>()
    val legal = mutableListOf<LegalPage>()
    val pickerInitials = mutableListOf<String?>()
}

/** The date slot's fake (R830): shows the initial value it was handed; pick lands PICKED_DAY, cancel closes. */
@Composable
private fun PzFakeDatePicker(
    initialIsoDay: String?,
    onPicked: (String) -> Unit,
    onDismiss: () -> Unit,
    held: PzHeld,
) {
    LaunchedEffect(Unit) { held.pickerInitials += initialIsoDay }
    Text(FAKE_PICKER_INITIAL + initialIsoDay)
    TextButton(onClick = onDismiss) { Text(FAKE_PICKER_CANCEL) }
    TextButton(onClick = {
        onPicked(PICKED_DAY)
        onDismiss()
    }) { Text(FAKE_PICKER_PICK) }
}

/** MainActivity's ParametresTab, reduced: the toggles go straight to the controller (no OS permission on iOS here). */
@Composable
private fun ParametresHost(
    wire: PzWire,
    saver: PzSaver,
    held: PzHeld,
) {
    val scope = rememberCoroutineScope()
    val controller =
        remember {
            ParametresController(
                saver = saver,
                store = InMemorySettingsStore(STORED),
                repository = PzNoRows(),
                taxYear = TAX_YEAR,
                scope = scope,
                exportBytes = { path ->
                    held.exportPaths += path
                    BytesOutcome.Ok(200, ExportBytes(byteArrayOf(1, 2, 3), null))
                },
                wire = wire,
            ).also { held.controller = it }
        }
    LaunchedEffect(controller) { controller.exportEvents.collect { held.exportEvents += it } }
    val state by controller.state.collectAsState()
    FrontierTheme {
        ParametresScreen(
            state = state,
            actions = pzActions(controller, held),
            appVersion = ParametresCopy.version(APP_VERSION_NAME, APP_VERSION_CODE),
            startDatePicker = { initial, onPicked, onDismiss ->
                PzFakeDatePicker(initial, onPicked, onDismiss, held)
            },
        )
    }
}

private fun pzActions(
    controller: ParametresController,
    held: PzHeld,
): ParametresActions =
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
        onExportJson = { controller.exportData(AccountExportKind.JSON) },
        onExportCsv = { controller.exportData(AccountExportKind.CSV) },
        onRequestSignOut = controller::requestSignOut,
        onConfirmSignOut = controller::confirmSignOut,
        onCancelSignOut = controller::cancelSignOut,
        onRetrySignOutSync = controller::retrySignOutSync,
        onRequestDelete = controller::requestDelete,
        onConfirmDelete = controller::confirmDelete,
        onCancelDelete = controller::cancelDelete,
        onAcknowledgeDelete = controller::acknowledgeDelete,
        onOpenLegal = { held.legal += it },
        onToggleAutoDetection = controller::setAutoDetection,
        onToggleEveningNotification = controller::setEveningNotification,
        onToggleThresholdAlert = controller::setThresholdAlert,
    )

/** The watchdog's view of the test (R793's shape). Not "Progress": a class name is the package's, private or not. */
private object ParametresProgress {
    var test = ""
    var step = ""
    var generation = 0
    var done = false
}

private const val WATCHDOG_SECONDS = 120L
private const val WATCHDOG_EXIT = 3

@OptIn(ExperimentalForeignApi::class) // the posix stdout flush - function-scoped, as KeychainTokenStore's interop is.
private fun mark(step: String) {
    ParametresProgress.step = step
    println("R835 MARK ${ParametresProgress.test}: $step")
    fflush(stdout)
}

@OptIn(ExperimentalForeignApi::class) // GCD and posix, function-scoped (KeychainTokenStore's precedent).
private fun watched(
    test: String,
    body: () -> Unit,
) {
    ParametresProgress.generation += 1
    val generation = ParametresProgress.generation
    ParametresProgress.test = test
    ParametresProgress.done = false
    mark("started")
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, WATCHDOG_SECONDS * NSEC_PER_SEC.toLong()),
        // 0 = the default-priority global queue (Apple's documented dispatch_get_global_queue(0, 0)).
        dispatch_get_global_queue(0L, 0u),
    ) {
        if (ParametresProgress.generation == generation && !ParametresProgress.done) {
            val last = ParametresProgress.step
            println("R835 WATCHDOG: $test HUNG after ${WATCHDOG_SECONDS}s - last step reached: $last")
            fflush(stdout)
            exitProcess(WATCHDOG_EXIT)
        }
    }
    try {
        body()
        mark("finished")
    } finally {
        ParametresProgress.done = true
    }
}

@OptIn(ExperimentalTestApi::class)
class ZParametresScreensIosTest {
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

    /** performScrollTo where there is a scroll parent, marked on both sides. */
    private fun SemanticsNodeInteraction.scrollToMarked(what: String) {
        mark("tap $what: performScrollTo - calling")
        try {
            performScrollTo()
            mark("tap $what: performScrollTo - returned")
        } catch (expectedOutsideAScroll: AssertionError) {
            mark("tap $what: performScrollTo - no scroll parent")
        }
    }

    /**
     * R806's GUARD, then a POINTER TAP: performClick injects its touch at the centre of the node's boundsInRoot (R800
     * (3)), so that point must lie inside the node's non-empty boundsInWindow - otherwise the test fails HERE, saying
     * where the tap would land.
     */
    private fun SemanticsNodeInteractionsProvider.tapInsideTheWindow(
        what: String,
        matcher: SemanticsMatcher,
        index: Int = 0,
    ) {
        val node = onAllNodes(matcher)[index]
        node.scrollToMarked(what)
        val target = node.fetchSemanticsNode()
        val inRoot = target.boundsInRoot
        val inWindow = target.boundsInWindow
        mark("tap $what: boundsInRoot=$inRoot tapPoint=${inRoot.center} boundsInWindow=$inWindow")
        assertTrue(
            !inWindow.isEmpty && inWindow.contains(inRoot.center),
            "R806/R833: $what is not inside the window - its tap would land at ${inRoot.center} (the centre of its " +
                "boundsInRoot $inRoot), outside its boundsInWindow $inWindow",
        )
        mark("tap $what: performClick - calling")
        node.performClick()
        mark("tap $what: performClick - returned")
    }

    private fun isSwitch(): SemanticsMatcher = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Switch)

    private fun SemanticsNodeInteractionsProvider.switches() = onAllNodes(isSwitch()).fetchSemanticsNodes()

    private fun SemanticsNodeInteractionsProvider.switchState(index: Int): ToggleableState? =
        switches()[index].config.getOrNull(SemanticsProperties.ToggleableState)

    private fun saveButton(): SemanticsMatcher = hasText(CalendarCopy.SHEET_SAVE) and hasClickAction()

    private fun exportJson(): SemanticsMatcher = hasText(ParametresCopy.EXPORT_JSON) and hasClickAction()

    private fun pickButton(): SemanticsMatcher = hasText(ParametresCopy.START_DATE_PICK) and hasClickAction()

    private fun offersExpand(): SemanticsMatcher = SemanticsMatcher.keyIsDefined(SemanticsActions.Expand)

    private fun offersCollapse(): SemanticsMatcher = SemanticsMatcher.keyIsDefined(SemanticsActions.Collapse)

    /**
     * R833: the open sheet EXPANDED through its drag handle's Expand action, IOS-2c-FIX R806's way - when the handle
     * offers one. A sheet whose content fits opens fully expanded and its handle offers no Expand; that is recorded in
     * a mark, not forced. Either way the caller's confirm tap goes through R806's guard.
     */
    private fun ComposeUiTest.expandTheSheet(sheet: String) {
        mark("$sheet: settling - calling, bounded at ${SETTLE_MILLIS}ms")
        val settled =
            runCatching {
                waitBounded("$sheet: the handle offers Expand or Collapse", SETTLE_MILLIS) {
                    count(offersExpand()) + count(offersCollapse()) > 0
                }
            }.isSuccess
        val expand = onAllNodes(offersExpand()).fetchSemanticsNodes()
        val labels = expand.map { it.config.getOrNull(SemanticsActions.Expand)?.label }
        mark("$sheet: settled=$settled, the handle offers Expand=$labels Collapse=${count(offersCollapse())}")
        if (expand.size != 1) {
            mark("$sheet: NO Expand offered - the sheet opened fully expanded; nothing to expand")
            return
        }
        assertTrue(
            labels.single() == M3_EXPAND_EN || labels.single() == M3_EXPAND_FR,
            "$sheet: the node offering Expand is the sheet's drag handle, by Material3's own label: $labels",
        )
        mark("$sheet: the handle's Expand - calling")
        onNode(offersExpand()).performSemanticsAction(SemanticsActions.Expand)
        mark("$sheet: the handle's Expand - returned")
        waitMarked("$sheet expanded: its handle offers Collapse, no longer Expand") {
            count(offersCollapse()) == 1 && count(offersExpand()) == 0
        }
        mark("$sheet: EXPANDED through the handle's Expand action")
    }

    private fun ComposeUiTest.showParametres(
        wire: PzWire,
        saver: PzSaver,
        held: PzHeld,
    ): ParametresController {
        mark("setContent - calling")
        setContent { ParametresHost(wire, saver, held) }
        mark("setContent - returned")
        waitMarked("Parametres shown with its fixture") {
            shows(ParametresCopy.TITLE) && shows(CantonCopy.name(Canton.GE)) && held.controller != null
        }
        return assertNotNull(held.controller)
    }

    @Test
    fun step1ParametresIsShownWithItsFixture() =
        watched("1-shown") {
            runComposeUiTest {
                val held = PzHeld()
                val controller = showParametres(PzWire(), PzSaver(), held)
                assertTrue(shows(OnboardingCopy.RATE_LABEL), "the rate row")
                assertTrue(shows(ParametresCopy.START_DATE_EMPTY), "the start date row: the whole year")
                assertEquals(2, switches().size, "two switches: detection and the alert (the evening one hidden)")
                assertEquals(listOf(ToggleableState.Off, ToggleableState.Off), listOf(switchState(0), switchState(1)))
                assertEquals(ParametresPhase.EDITING, controller.state.value.phase)
            }
        }

    @Test
    fun step2TheSwitchesToggleAndTheirActionsReachTheController() =
        watched("2-switches") {
            runComposeUiTest {
                val wire = PzWire()
                val saver = PzSaver()
                val held = PzHeld()
                val controller = showParametres(wire, saver, held)
                tapInsideTheWindow("the alert Switch", isSwitch(), index = 1)
                waitMarked("the alert on: the action fired and the state changed") {
                    controller.state.value.thresholdAlertEnabled && switchState(1) == ToggleableState.On
                }
                tapInsideTheWindow("the detection Switch", isSwitch(), index = 0)
                waitMarked("detection on through the wire's consent body; the evening Switch offered") {
                    controller.state.value.autoDetectionEnabled && switches().size == 3
                }
                assertEquals(listOf(true), wire.consents, "one consent, enabling")
                assertEquals(listOf("consent:true"), saver.bodies, "one PATCH, the wire's body")
                tapInsideTheWindow("the evening Switch", isSwitch(), index = 1)
                waitMarked("the evening reminder on") {
                    controller.state.value.eveningNotificationEnabled && switchState(1) == ToggleableState.On
                }
                assertEquals(ToggleableState.On, switchState(2), "the alert still on")
            }
        }

    @Test
    fun step3TheRateRowOpensTheEditSheetAndItsSaveSaves() =
        watched("3-edit-sheet") {
            runComposeUiTest {
                val wire = PzWire()
                val saver = PzSaver()
                val held = PzHeld()
                val controller = showParametres(wire, saver, held)
                tapInsideTheWindow("the rate ListItem", hasText(OnboardingCopy.RATE_LABEL) and hasClickAction())
                waitMarked("the edit sheet open") { count(saveButton()) == 1 }
                mark("the edit ModalBottomSheet OPEN")
                expandTheSheet("the edit sheet")
                mark("type the rate: performTextReplacement - calling")
                onAllNodes(hasSetTextAction()).onFirst().performTextReplacement(TYPED_RATE)
                mark("type the rate: performTextReplacement - returned")
                waitMarked("the rate reached the controller") { controller.state.value.employmentRate == TYPED_RATE }
                tapInsideTheWindow("the edit sheet's SAVE", saveButton())
                waitMarked("saved and the sheet closed") {
                    controller.state.value.phase == ParametresPhase.SAVED && count(saveButton()) == 0
                }
                mark("the edit ModalBottomSheet SAVED and closed")
                assertEquals(listOf(STORED.copy(employmentRate = 80, name = null)), wire.patched, "one patch")
                assertEquals(listOf("patch#1"), saver.bodies, "one PATCH, the wire's body")
            }
        }

    @Test
    fun step4TheLearnMoreSheetOpensExpandsAndCloses() =
        watched("4-learn-more") {
            runComposeUiTest {
                showParametres(PzWire(), PzSaver(), PzHeld())
                assertTrue(!shows(ParametresCopy.AUTO_DESCRIPTION), "the disclosure is in the sheet, not the list")
                tapInsideTheWindow("the learn-more ListItem", hasText(ParametresCopy.LEARN_MORE) and hasClickAction())
                waitMarked("the learn-more sheet open") { shows(ParametresCopy.AUTO_DESCRIPTION) }
                mark("the learn-more ModalBottomSheet OPEN")
                expandTheSheet("the learn-more sheet")
                tapInsideTheWindow("the learn-more sheet's CLOSE", hasText(ParametresCopy.CLOSE) and hasClickAction())
                waitMarked("the learn-more sheet closed") { count(hasText(ParametresCopy.AUTO_DESCRIPTION)) == 0 }
                mark("the learn-more ModalBottomSheet CLOSED by its own button")
            }
        }

    @Test
    fun step5TheExportSheetOpensExpandsAndItsJsonExportRuns() =
        watched("5-export") {
            runComposeUiTest {
                val held = PzHeld()
                showParametres(PzWire(), PzSaver(), held)
                tapInsideTheWindow("the export ListItem", hasText(ParametresCopy.DATA_EXPORT_ROW) and hasClickAction())
                waitMarked("the export sheet open") { count(exportJson()) == 1 }
                mark("the export ModalBottomSheet OPEN")
                expandTheSheet("the export sheet")
                tapInsideTheWindow("the export sheet's JSON", exportJson())
                waitMarked("the JSON export ran and the sheet closed") {
                    held.exportEvents.size == 1 && count(exportJson()) == 0
                }
                mark("the export ModalBottomSheet's JSON export ran")
                assertEquals(listOf(EXPORT_JSON_PATH), held.exportPaths, "one export, the JSON path")
                val ready = held.exportEvents.single() as? ExportEvent.Ready
                assertEquals("application/json", ready?.mimeType, "a Ready event for the share hand-off")
            }
        }

    @Test
    fun step6TheDateSlotOpensWithTheCurrentValueAndThePickLandsInTheField() =
        watched("6-date-slot") {
            runComposeUiTest {
                val wire = PzWire()
                val held = PzHeld()
                val controller = showParametres(wire, PzSaver(), held)
                val label = OnboardingCopy.START_DATE_LABEL
                tapInsideTheWindow("the start date ListItem", hasText(label) and hasClickAction())
                waitMarked("the date sheet open") { count(pickButton()) == 1 }
                expandTheSheet("the date sheet")
                assertTrue(!shows(FAKE_PICKER_PICK), "the picker slot is not composed until it is asked for")
                tapInsideTheWindow("the date sheet's pick button", pickButton())
                waitMarked("the fake picker shown with no initial day") { shows(FAKE_PICKER_PICK) }
                assertEquals(listOf<String?>(null), held.pickerInitials, "an empty field hands the slot null")
                tapInsideTheWindow("the fake's pick", hasText(FAKE_PICKER_PICK) and hasClickAction())
                waitMarked("the pick landed in the field") {
                    controller.state.value.activityStartDate == PICKED_DAY && shows(formatDate(PICKED_DAY)) &&
                        !shows(FAKE_PICKER_PICK)
                }
                tapInsideTheWindow("the date sheet's SAVE", saveButton())
                waitMarked("saved and closed") {
                    controller.state.value.phase == ParametresPhase.SAVED && count(saveButton()) == 0
                }
                assertEquals(listOf<String?>(PICKED_DAY), wire.patched.map { it.activityStartDate }, "sent")
                // Reopened: the slot is handed the CURRENT value (R830's initial date), then cancelled.
                tapInsideTheWindow("the start date ListItem again", hasText(label) and hasClickAction())
                waitMarked("the date sheet open again") { count(pickButton()) == 1 }
                expandTheSheet("the date sheet, again")
                tapInsideTheWindow("the pick button again", pickButton())
                waitMarked("the fake picker shown with the saved day") { shows(FAKE_PICKER_INITIAL + PICKED_DAY) }
                assertEquals(listOf<String?>(null, PICKED_DAY), held.pickerInitials, "handed the current day")
                tapInsideTheWindow("the fake's cancel", hasText(FAKE_PICKER_CANCEL) and hasClickAction())
                waitMarked("the fake picker closed, the day unchanged") {
                    !shows(FAKE_PICKER_CANCEL) && controller.state.value.activityStartDate == PICKED_DAY
                }
            }
        }

    @Test
    fun step7TheLicencesRowOpensLicencesAndBackReturns() =
        watched("7-licences") {
            runComposeUiTest {
                showParametres(PzWire(), PzSaver(), PzHeld())
                tapInsideTheWindow("the Licences ListItem", hasText(ParametresCopy.LICENCES_ROW) and hasClickAction())
                waitMarked("Licences shown") { shows(LicencesCopy.OSM_ATTRIBUTION) && !shows(ParametresCopy.TITLE) }
                mark("LicencesScreen SHOWN")
                tapInsideTheWindow("Licences' BACK", hasText(LicencesCopy.BACK) and hasClickAction())
                waitMarked("Parametres back") { shows(ParametresCopy.TITLE) && !shows(LicencesCopy.OSM_ATTRIBUTION) }
            }
        }
}
