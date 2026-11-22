package ch.monreleve.app.ios

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.Dialog
import ch.monreleve.app.ForecastRoute
import ch.monreleve.app.MainTabs
import ch.monreleve.app.ShellRouter
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.ModeChoice
import ch.monreleve.app.onboarding.OnboardingController
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.OnboardingSnapshot
import ch.monreleve.app.onboarding.SessionSettingsSaver
import ch.monreleve.app.onboarding.onboardingSeedFor
import ch.monreleve.app.parametres.AccountExportKind
import ch.monreleve.app.settings.mePatchBody
import ch.monreleve.app.ui.screens.onboarding.OnboardingActions
import ch.monreleve.app.ui.screens.onboarding.OnboardingScreen
import ch.monreleve.app.ui.screens.onboarding.PretScreen
import ch.monreleve.app.ui.screens.onboarding.TertiaryButton
import ch.monreleve.app.ui.screens.parametres.ParametresActions
import ch.monreleve.app.ui.screens.parametres.ParametresScreen
import ch.monreleve.app.ui.shell.AppRoot
import ch.monreleve.app.ui.shell.AppTab
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import platform.Foundation.NSCalendar
import platform.Foundation.NSCalendarUnitDay
import platform.Foundation.NSCalendarUnitMonth
import platform.Foundation.NSCalendarUnitYear
import platform.Foundation.NSDateComponents
import platform.UIKit.UIDatePicker
import platform.UIKit.UIDatePickerMode
import platform.UIKit.UIDatePickerStyle

// IOS-SHELL-1 (R1320, R1325). THE iOS SHELL'S COMPOSABLES: the root the scene hosts, and iOS's own ONBOARDING and MAIN
// routes in the common router's two slots.
//
// IosShellRoot is AppRoot (theme, canvas, the system-bar insets consumed once - R1170) around the COMMON ShellRouter
// (ShellRoutes.kt, R1328), driven by this process's IosShell. So the sign-in flow, RESOLVING and the destination
// switch are the very code Android runs; iOS supplies only what is iOS's:
//   - ONBOARDING (IosOnboardingRoute, R1325): the common wizard on its common controller, MANUAL-ONLY (iOS Ruling 2 -
//     onboardingSeedFor(seed, detectionAvailable = false) drops the mode step; detection consent does not exist here);
//     the reminder's "Oui" asks the notification authorization and then re-plans; a refusal saves the reminder off,
//     which the summary then states with the existing copy. Android's OnboardingRoute is not moved: its three OS
//     permission launchers and the disclosure overlay are interleaved with this same controller, so the common part
//     was not separable without bending it (R1328 - named in the report).
//   - MAIN (IosMainShell): the COMMON MainTabs (MainTabs.kt, IOS-MOVE-TABS R1360: the bottom bar, the four tabs and
//     the forecast overlays - the wiring Android's MainShell calls too) over the common graph (buildControllers).
//     Android's MainShell keeps what is Android's (permission launchers, Toasts, Intents, the push and alert passes)
//     and passes it in; iOS passes its own. What IOS-SHELL-2 owes is stubbed by name, never silently: the share sheet
//     (exports are logged and dropped), legal links, the employer comparison (EmployerFigureStore), the foreground
//     refresh and sync, and the reminder triggers beyond onboarding. The threshold alert is hidden in iOS v1 (iOS
// Ruling
//     3 Q4); until the common screens can hide its two entry points, its handlers are named no-ops.
//   - THE DATE PICKER (G7): a native UIDatePicker in the two common startDatePicker slots, presented in its own layer
//     (a Dialog - the slot's contract, ParametresEditTypes.kt), confirmed with the existing CONTINUE copy.

/** The iOS app's whole content: AppRoot around the common router, over this process's [shell]. */
@Composable
fun IosShellRoot(shell: IosShell) {
    AppRoot {
        val scope = rememberCoroutineScope()
        ShellRouter(
            start = shell.start,
            session = shell.session,
            api = shell.api,
            tokenStore = shell.tokenStore,
            pending = shell.pending,
            accountStore = shell.accountStore,
            repository = shell.repository,
            settingsStore = shell.settingsStore,
            scope = scope,
            sessionEnds = shell.sessionEnds,
            syncNow = shell.syncNow,
            onOpenLegal = { shell.notYetOnIos("legal page $it (G7)") },
            onOpenMail = { shell.notYetOnIos("message:// (G7, iOS Ruling 3 Q5)") },
            restoreMode = shell::restoreMode,
            restoreReminder = shell::restoreReminder,
            // NAMED STUB: the year downloads (Android's processYearDownloads, AN-PULL) are not built on iOS yet.
            afterSignIn = { shell.notYetOnIos("the year downloads after a sign-in") },
            onboarding = { seed, onDone -> IosOnboardingRoute(shell, scope, seed, onDone) },
            main = { onSignedOut -> IosMainShell(shell, scope, onSignedOut) },
        )
    }
}

/** R1325: the common onboarding wizard, manual-only, its reminder answer asked of the notification centre. */
@Suppress("LongMethod")
@Composable
internal fun IosOnboardingRoute(
    shell: IosShell,
    scope: CoroutineScope,
    seed: OnboardingSnapshot?,
    onDone: () -> Unit,
) {
    var saved by rememberSaveable { mutableStateOf(onboardingSeedFor(seed, detectionAvailable = false)) }
    val controller =
        remember {
            OnboardingController(
                saver = SessionSettingsSaver(shell.session),
                store = shell.settingsStore,
                taxYear = shell.taxYear,
                scope = scope,
                restored = saved,
                patchBody = { settings, reminderEnabled -> settings.mePatchBody(reminderEnabled) },
                onModeSaved = shell::restoreMode,
                // R1145: the opt-in reaches this phone once the server TOOK the save that carried it - then the plan.
                onReminderSaved = { on ->
                    shell.eveningStore.setEnabled(on)
                    scope.launch { shell.replanReminders() }
                },
            )
        }
    val state by controller.state.collectAsState()
    LaunchedEffect(controller) {
        controller.state.collect {
            saved =
                OnboardingSnapshot(
                    it.step, it.name, it.canton, it.rateChoice, it.customRate, it.denominator,
                    it.exactTotalWorkDays, it.allYear, it.activityStartDate, it.mode, it.reminder,
                    it.granularity, it.steps,
                )
        }
    }
    if (state.phase == OnboardingPhase.READY) {
        val settings = shell.settingsStore.load()
        if (settings == null) {
            onDone()
        } else {
            PretScreen(settings = settings, taxYear = shell.taxYear, onContinue = onDone)
        }
        return
    }
    OnboardingScreen(
        state = state,
        actions =
            OnboardingActions(
                onNameChange = controller::onNameChange,
                onCantonChange = controller::onCantonChange,
                onRateChoiceChange = controller::onRateChoiceChange,
                onCustomRateChange = controller::onCustomRateChange,
                onDenominatorChange = controller::onDenominatorChange,
                onExactTotalChange = controller::onExactTotalChange,
                onGranularityChange = controller::onGranularityChange,
                onAllYearChange = controller::onAllYearChange,
                onActivityStartDateChange = controller::onActivityStartDateChange,
                onChooseManual = { controller.onModeChange(ModeChoice.MANUAL) },
                // Unreachable: the manual-only seed has no mode step. MANUAL, never a detection path.
                onChooseAuto = { controller.onModeChange(ModeChoice.MANUAL) },
                // R1325: "Oui" asks the authorization (the alert prompt), then saves with what the person answered.
                onReminderYes = {
                    shell.centre.requestAuthorization { granted ->
                        shell.notificationsPermitted.value = granted
                        controller.onReminderChange(granted)
                        controller.next()
                    }
                },
                onReminderNo = {
                    controller.onReminderChange(false)
                    controller.next()
                },
                onNext = controller::next,
                onBack = controller::back,
            ),
        startDatePicker = { onPicked, onDismiss -> IosStartDatePicker(null, onPicked, onDismiss) },
    )
}

/**
 * The iOS main shell: the common MainTabs (IOS-MOVE-TABS R1360 - the bar, the four tabs and the forecast overlays, the
 * same wiring Android's MainShell calls) over the common graph, with iOS's own seams (see the header).
 */
@Composable
internal fun IosMainShell(
    shell: IosShell,
    scope: CoroutineScope,
    onSignedOut: () -> Unit,
) {
    val controllers = remember { shell.buildControllers(scope) }
    var tab by rememberSaveable { mutableStateOf(AppTab.AUJOURDHUI) }
    var forecastRoute by rememberSaveable { mutableStateOf<ForecastRoute?>(null) }

    // NAMED STUB (IOS-SHELL-2, G5): the share sheet. The export events are read so none is left waiting, and logged.
    LaunchedEffect(controllers.releve) {
        controllers.releve.exportEvents.collect { shell.notYetOnIos("the share sheet for a releve export") }
    }
    LaunchedEffect(controllers.parametres) {
        controllers.parametres.exportEvents.collect { shell.notYetOnIos("the share sheet for an account export") }
    }
    // R295: when sign-out or deletion completes (session revoked, local store wiped), leave the signed-in shell.
    LaunchedEffect(controllers.parametres) {
        controllers.parametres.accountEvents.collect { onSignedOut() }
    }

    MainTabs(
        controllers = controllers,
        tab = tab,
        onTabChange = { tab = it },
        forecastRoute = forecastRoute,
        onForecastRouteChange = { forecastRoute = it },
        // NAMED STUB: the year downloads (Android's AN-PULL) are not built on iOS yet - never failed, retry logged.
        yearDownloadFailed = false,
        onRetryDownload = { shell.notYetOnIos("the year downloads' retry") },
        onCompareEmployer = { shell.notYetOnIos("the employer comparison (EmployerFigureStore)") },
        onEnableAlert = { shell.notYetOnIos("the threshold alert (hidden in iOS v1)") },
        parametresTab = { state, onOpenRhythm ->
            ParametresScreen(
                state = state,
                actions = iosParametresActions(shell, controllers.parametres, onOpenRhythm),
                appVersion = shell.appVersion,
                startDatePicker = { initial, onPicked, onDismiss ->
                    IosStartDatePicker(initial, onPicked, onDismiss)
                },
            )
        },
        // No system back on iOS: the overlays close through their own back arrows, as before the move.
        forecastBackHandler = {},
    )
}

/** The Parametres tab's callbacks on iOS: no detection entry point (manual-only), the reminder asked of the centre. */
private fun iosParametresActions(
    shell: IosShell,
    controller: ch.monreleve.app.parametres.ParametresController,
    onOpenRhythm: () -> Unit,
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
        onOpenLegal = { shell.notYetOnIos("legal page $it (G7)") },
        // iOS v1 is manual-only (iOS Ruling 2): NO handler, so the screen shows no detection entry point (R1124's
        // rule).
        onToggleAutoDetection = null,
        // R323 on iOS: ON asks the authorization, and turns the opt-in on only if it was granted; OFF is immediate.
        onToggleEveningNotification = { enable ->
            if (!enable) {
                controller.setEveningNotification(false)
            } else {
                shell.centre.requestAuthorization { granted ->
                    shell.notificationsPermitted.value = granted
                    if (granted) controller.setEveningNotification(true)
                }
            }
        },
        onToggleThresholdAlert = { shell.notYetOnIos("the threshold alert (hidden in iOS v1)") },
        onOpenRhythm = onOpenRhythm,
    )

/**
 * G7: the native date picker in the common startDatePicker slots - a UIDatePicker (inline calendar, date only) in its
 * own layer, confirmed with the onboarding's existing CONTINUE; dismissing it changes nothing.
 */
@OptIn(ExperimentalForeignApi::class)
@Composable
internal fun IosStartDatePicker(
    initialIsoDay: String?,
    onPicked: (isoDay: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val picker =
        remember {
            UIDatePicker().apply {
                datePickerMode = UIDatePickerMode.UIDatePickerModeDate
                preferredDatePickerStyle = UIDatePickerStyle.UIDatePickerStyleInline
                initialIsoDay?.let(::nsDateOf)?.let { date = it }
            }
        }
    Dialog(onDismissRequest = onDismiss) {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(modifier = Modifier.fillMaxWidth()) {
                UIKitView(factory = { picker }, modifier = Modifier.fillMaxWidth().height(PICKER_HEIGHT.dp))
                TertiaryButton(
                    label = OnboardingCopy.CONTINUE,
                    onClick = {
                        onPicked(isoDayOf(picker))
                        onDismiss()
                    },
                )
            }
        }
    }
}

private const val PICKER_HEIGHT = 360

/** The picker's day in the device's calendar, as an ISO day (yyyy-MM-dd). */
private fun isoDayOf(picker: UIDatePicker): String {
    val parts =
        NSCalendar.currentCalendar.components(
            NSCalendarUnitYear or NSCalendarUnitMonth or NSCalendarUnitDay,
            fromDate = picker.date,
        )
    val year = parts.year.toString().padStart(4, '0')
    val month = parts.month.toString().padStart(2, '0')
    val day = parts.day.toString().padStart(2, '0')
    return "$year-$month-$day"
}

/** An ISO day as a date in the device's calendar, or null for anything that is not one. */
private fun nsDateOf(iso: String): platform.Foundation.NSDate? {
    val parts = iso.split('-').mapNotNull { it.toLongOrNull() }
    if (parts.size != 3) return null
    val components = NSDateComponents()
    components.year = parts[0]
    components.month = parts[1]
    components.day = parts[2]
    return NSCalendar.currentCalendar.dateFromComponents(components)
}
