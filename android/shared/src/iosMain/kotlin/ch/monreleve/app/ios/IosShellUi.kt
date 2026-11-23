package ch.monreleve.app.ios

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitInteropProperties
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ch.monreleve.app.ForecastRoute
import ch.monreleve.app.MainTabs
import ch.monreleve.app.ShellRouter
import ch.monreleve.app.data.sync.YearDownloadStatus
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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import platform.CoreGraphics.CGRectMake
import platform.Foundation.NSCalendar
import platform.Foundation.NSCalendarUnitDay
import platform.Foundation.NSCalendarUnitMonth
import platform.Foundation.NSCalendarUnitYear
import platform.Foundation.NSDateComponents
import platform.Foundation.NSLocale
import platform.UIKit.UIColor
import platform.UIKit.UIDatePicker
import platform.UIKit.UIDatePickerMode
import platform.UIKit.UIDatePickerStyle
import platform.UIKit.UIView
import platform.UIKit.UIViewAutoresizingFlexibleHeight
import platform.UIKit.UIViewAutoresizingFlexibleWidth

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
//     and passes it in; iOS passes its own (IOS-SHELL-2): the exports to the share sheet (R1331), the legal pages and
//     the mail app through UIApplication (R1333), a re-plan when the shell opens - a sign-in - and a reminder tap that
//     opens Aujourd'hui (R1330). The threshold alert is hidden in iOS v1 (iOS Ruling 3 Q4): iOS passes NO handler for
//     its two entry points - Parametres' switch and Prevision's offer - so neither is drawn (R1338). The year
//     downloads run as on Android (IOS-SHELL-3 R1371), and the employer comparison is the common overlay (R1372).
//   - THE ROOT (IosShellRoot): one lifecycle observer - a foreground drains the queue and re-plans (R1332, R1330) - and
//     the notice host every Toast-like message is drawn by (R1331).
//   - THE DATE PICKER (G7): a native UIDatePicker in the two common startDatePicker slots, presented in its own layer
//     (a Dialog - the slot's contract, ParametresEditTypes.kt), confirmed with the existing CONTINUE copy.

/** The iOS app's whole content: AppRoot around the common router, over this process's [shell]. */
@Composable
fun IosShellRoot(shell: IosShell) {
    // R1332 / R1330: the ONE place a foreground is seen. Chosen over Swift's scenePhase because it is the lifecycle the
    // ComposeUIViewController itself reports (RESUMED once its view has appeared with the app active - CMP 1.7.3's
    // ViewControllerBasedLifecycleOwner), the same ON_RESUME Android's MainShell observes, and an iosTest drives it
    // through this very root by handing in its own owner (R204) - a Swift call site no iosTest can reach.
    ForegroundEffect(shell::onForeground)
    AppRoot {
        val scope = rememberCoroutineScope()
        val openMail = remember { shell.mailAction() }
        // R1374 (iOS Ruling 15 Q6): the router waits for the notification centre's FIRST answer, so RESOLVING's restore
        // (restoreReminder) reads an answer - never the initial false - and cannot write OFF over the server's ON on a
        // cold launch where /me answers first. Bounded: a centre that never answered would otherwise hold the app
        // blank; past the bound the router starts as it did before (the canvas meanwhile is AppRoot's, no text).
        val ready by
            produceState(initialValue = shell.authorizationKnown.value) {
                withTimeoutOrNull(AUTHORIZATION_WAIT_MILLIS) { shell.authorizationKnown.first { it } }
                value = true
            }
        if (ready) IosNoticeHost(shell.notices) { IosRouter(shell, scope, openMail) }
    }
}

/** R1374: how long the router waits for the centre's first answer before starting regardless. */
private const val AUTHORIZATION_WAIT_MILLIS = 2_000L

/** ON_RESUME of the composition's lifecycle owner -> [onForeground]: the app came (back) to the foreground. */
@Composable
private fun ForegroundEffect(onForeground: () -> Unit) {
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) onForeground() }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
}

/** The common router over this process's [shell], with iOS's own routes in its two slots. */
@Composable
private fun IosRouter(
    shell: IosShell,
    scope: CoroutineScope,
    openMail: (() -> Unit)?,
) {
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
        onOpenLegal = shell::openLegal,
        // R1333: null - no button - when nothing on this phone opens message:// (asked once per root).
        onOpenMail = openMail,
        restoreMode = shell::restoreMode,
        restoreReminder = shell::restoreReminder,
        // R1371 (AN-PULL R481): after a sign-in, both tax years come down - the common coordinator, as on Android.
        afterSignIn = shell::downloadYearsAfterSignIn,
        onboarding = { seed, onDone -> IosOnboardingRoute(shell, scope, seed, onDone) },
        main = { onSignedOut -> IosMainShell(shell, scope, onSignedOut) },
    )
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
                // The shell's evening store re-plans on every write (R1330).
                onReminderSaved = { on ->
                    shell.eveningStore.setEnabled(on)
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
                        shell.onAuthorizationAnswer(granted)
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
    // R1372: the employer comparison's open year (null = closed) - MainShell's state, drawn by the common MainTabs.
    var comparisonYear by rememberSaveable { mutableStateOf<Int?>(null) }

    // R1330: the signed-in shell opened - after a sign-in, after onboarding, at every launch - so the reminders are
    // planned (Android's FallbackReminderScheduling.ensure, at the same moment).
    LaunchedEffect(Unit) { shell.replanSoon() }
    // R1371 (AN-PULL R485): once per process, the years that are empty on the phone come down. A sign-in download
    // already ran in this process makes this a no-op (YearDownloads.atStart) - MainShell's line, on iOS.
    LaunchedEffect(Unit) { shell.downloadYearsAtStart() }
    // R1373 (a), Android's F8 (MainShell's ON_RESUME): every foreground recomputes today and the tax year from the
    // clock, so an app brought back after midnight shows - and records - the new day. Counted by the shell's ONE
    // foreground seam (onForeground), read here where the controllers are.
    val foregrounds by shell.foregrounds.collectAsState()
    LaunchedEffect(foregrounds) { controllers.aujourdhui.refresh() }
    // IOS-AUDIT R1380: a sign-in restore the centre's first answer applied after this shell opened - the Paramètres
    // switch is shown what the store now holds (it read the store once, when built). Sends nothing.
    val lateRestores by shell.lateRestores.collectAsState()
    LaunchedEffect(lateRestores) {
        if (lateRestores > 0) controllers.parametres.reflectEveningOptIn(shell.eveningStore.isEnabled())
    }
    val yearDownloadStatus by shell.yearDownloadStatus.collectAsState()
    // R1330 (R323 / D16 on iOS): a tap on the evening reminder opens Aujourd'hui, refreshed - and records nothing.
    val tapped by shell.taps.openAujourdhui.collectAsState()
    LaunchedEffect(tapped) {
        if (tapped) {
            forecastRoute = null
            tab = AppTab.AUJOURDHUI
            controllers.aujourdhui.refresh()
            shell.taps.consume()
        }
    }
    // R1331 (G5): both exports through the common hand-off - the share sheet, or a notice for a failure.
    LaunchedEffect(controllers.releve) {
        controllers.releve.exportEvents.collect(shell::handleExport)
    }
    LaunchedEffect(controllers.parametres) {
        controllers.parametres.exportEvents.collect(shell::handleExport)
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
        // R1371 (AN-PULL R484): a year that could not come down is said on Aujourd'hui, with the person's retry.
        yearDownloadFailed = yearDownloadStatus is YearDownloadStatus.Failed,
        onRetryDownload = shell::retryYearDownloads,
        // R1372 (iOS Ruling 15 Q1): "Comparer avec mon employeur" opens the common overlay over the figure the person
        // typed, kept in R1334's UserDefaults store (account-tagged; a sign-out or a deletion erases it, R527).
        comparisonYear = comparisonYear,
        onComparisonYearChange = { comparisonYear = it },
        employerStore = shell.employerStore,
        // R1338 (iOS Ruling 3 Q4): no threshold alert in iOS v1 - no handler, so Prevision draws no offer.
        onEnableAlert = null,
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
        overlayBackHandler = {},
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
        onOpenLegal = shell::openLegal,
        // iOS v1 is manual-only (iOS Ruling 2): NO handler, so the screen shows no detection entry point (R1124's
        // rule).
        onToggleAutoDetection = null,
        // R323 on iOS: ON asks the authorization, and turns the opt-in on only if it was granted; OFF is immediate.
        onToggleEveningNotification = { enable ->
            if (!enable) {
                controller.setEveningNotification(false)
            } else {
                shell.centre.requestAuthorization { granted ->
                    shell.onAuthorizationAnswer(granted)
                    if (granted) controller.setEveningNotification(true)
                }
            }
        },
        // R1338 (iOS Ruling 3 Q4): no threshold alert in iOS v1 - no handler, so Parametres draws no switch.
        onToggleThresholdAlert = null,
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
    val background = MaterialTheme.colorScheme.background
    val host = remember { startDatePickerView(initialIsoDay, background) }
    Dialog(onDismissRequest = onDismiss) {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // IOS-AUDIT R1389: the native view reaches VoiceOver itself (CMP 1.7.3's interop default hides it -
                // UIKitInteropProperties.isNativeAccessibilityEnabled = false, which IOS-WALK saw as the picker missing
                // from the tree). The picker is the only native view here, so the one-per-merged-tree limit holds.
                UIKitView(
                    factory = { host.container },
                    modifier = Modifier.fillMaxWidth().height(PICKER_HEIGHT.dp),
                    properties = UIKitInteropProperties(isInteractive = true, isNativeAccessibilityEnabled = true),
                )
                TertiaryButton(
                    label = OnboardingCopy.CONTINUE,
                    onClick = {
                        onPicked(isoDayOf(host.picker))
                        onDismiss()
                    },
                )
            }
        }
    }
}

private const val PICKER_HEIGHT = 360

/**
 * IOS-AUDIT R1389: the language the native picker draws its months and weekdays in - the app's own (every word of its
 * copy is French, and the site declares lang="fr"), never the device's, which drew an English calendar inside a French
 * app (iOS Ruling 18, F6). A language, not a region: the picker shows no number format, and the chosen day is read back
 * through the calendar's components (isoDayOf), not through a formatter.
 */
internal const val PICKER_LANGUAGE = "fr"

/** R1389: the native picker and the opaque view that holds it - the view UIKitView hosts. */
internal class StartDatePickerHost(
    val container: UIView,
    val picker: UIDatePicker,
)

/**
 * IOS-AUDIT R1389: the native picker the slot shows, built in ONE place so an iosTest can read what it is set to
 * (the composed picker cannot be opened in an iosTest - IosStartDatePickerCanaryIosTest). [background] is the dialog
 * surface's own colour, from the theme. The picker sits in an OPAQUE container that fills the slot: run 45175730795
 * measured that a UIDatePicker does not keep a background colour set on it (alpha read back 0.0), so the opacity is
 * the container's, which nothing overrides.
 */
@OptIn(ExperimentalForeignApi::class)
internal fun startDatePickerView(
    initialIsoDay: String?,
    background: Color,
): StartDatePickerHost {
    val opaque =
        UIColor(
            red = background.red.toDouble(),
            green = background.green.toDouble(),
            blue = background.blue.toDouble(),
            alpha = 1.0,
        )
    val picker = pickerOf(initialIsoDay, opaque)
    val container = UIView()
    container.backgroundColor = opaque
    // The picker FILLS the container: its own default frame is zeroed first, then it grows with the container
    // (flexible width and height). Without the zeroing, autoresizing ADDED the container's size to the picker's default
    // frame (walk run 45178578142, 28-datepicker-open.png: the calendar drawn oversized and clipped).
    picker.setFrame(CGRectMake(0.0, 0.0, 0.0, 0.0))
    picker.autoresizingMask = UIViewAutoresizingFlexibleWidth or UIViewAutoresizingFlexibleHeight
    container.addSubview(picker)
    return StartDatePickerHost(container, picker)
}

@OptIn(ExperimentalForeignApi::class)
private fun pickerOf(
    initialIsoDay: String?,
    opaque: UIColor,
): UIDatePicker =
    UIDatePicker().apply {
        datePickerMode = UIDatePickerMode.UIDatePickerModeDate
        preferredDatePickerStyle = UIDatePickerStyle.UIDatePickerStyleInline
        initialIsoDay?.let(::nsDateOf)?.let { date = it }
        // R1389: French months and weekdays whatever the device's language (F6 drew "November 2026", SUN..SAT).
        locale = NSLocale(localeIdentifier = PICKER_LANGUAGE)
        // R1389: asked for an opaque background too (the container is what guarantees it - see above), so the page
        // beneath can never show through the calendar (F6: the Paramètres rows drawn text over text through it).
        backgroundColor = opaque
    }

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
