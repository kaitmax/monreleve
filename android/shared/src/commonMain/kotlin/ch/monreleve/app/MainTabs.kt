package ch.monreleve.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.dossier.buildComparison
import ch.monreleve.app.dossier.parseEmployerRate
import ch.monreleve.app.forecast.RhythmChoice
import ch.monreleve.app.fr.text.formatPercent
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.releve.ExportKind
import ch.monreleve.app.releve.ReleveState
import ch.monreleve.app.settings.EmployerFigureStore
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiActions
import ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreen
import ch.monreleve.app.ui.screens.calendrier.CalendarActions
import ch.monreleve.app.ui.screens.calendrier.CalendrierScreen
import ch.monreleve.app.ui.screens.comparison.ComparisonActions
import ch.monreleve.app.ui.screens.comparison.ComparisonScreen
import ch.monreleve.app.ui.screens.prevision.PrevisionActions
import ch.monreleve.app.ui.screens.prevision.PrevisionScreen
import ch.monreleve.app.ui.screens.releve.ReleveActions
import ch.monreleve.app.ui.screens.releve.ReleveScreen
import ch.monreleve.app.ui.screens.rythme.RythmeActions
import ch.monreleve.app.ui.screens.rythme.RythmeScreen
import ch.monreleve.app.ui.screens.simulation.SimulationActions
import ch.monreleve.app.ui.screens.simulation.SimulationScreen
import ch.monreleve.app.ui.shell.AppBottomBar
import ch.monreleve.app.ui.shell.AppTab

// IOS-MOVE-TABS R1360 (iOS Ruling 13 Q1). THE FOUR-TAB WIRING HAS ONE HOME: the bottom bar, the `when (tab)` over the
// four tabs and the forecast overlays, moved from :app's MainShell (MainActivity.kt), which IosMainShell (iosMain
// ios/IosShellUi.kt) had repeated. BOTH shells call this; iOS's copy is deleted (R206).
//
// What stays OUT, and reaches this as a parameter, is each platform's own:
//   - the STATE: the selected tab and the open forecast route are held by the calling shell (Android writes both from
//     outside this wiring - a notification's extras, the employer comparison), and passed in with their setters;
//   - the PARAMETRES TAB, a slot: Android's goes through its ParametresTab (BuildConfig's version, the :app overload's
//     Material date picker, the permission launchers behind the detection, evening and alert switches); iOS's through
//     its own actions and the native date picker. The slot is handed the tab's state and the way to the rhythm editor;
//   - the SYSTEM BACK of the forecast overlay, a slot: Android's BackHandler (there is no common one - iOS Ruling 3);
//     iOS passes none, as before, and its overlays close through their own back arrows;
//   - the year-download retry and its failure flag, and the threshold alert's opt-in offer (hidden in iOS v1, iOS
//     Ruling 3 Q4 - iOS passes null, R1338).
//
// IOS-SHELL-3 R1372 (iOS Ruling 15 Q1): THE EMPLOYER COMPARISON'S OVERLAY moved here from :app's MainShell, as the
// forecast overlay did, so both shells draw it: the open year is the calling shell's state (comparisonYear - Android
// saves it across a rotation, R310) and the figure store is each platform's (Android's SharedPrefs, iOS's
// UserDefaults - R342 / R1334). The system back that closes an overlay is ONE slot for both overlays
// (overlayBackHandler, formerly forecastBackHandler): Android's BackHandler, nothing on iOS.
//
// Nothing here is new behaviour: every line below was MainShell's, and the comments that explain them came with them.
// The forecast route itself is in ForecastRoute.kt, beside this file.

// LongParameterList: the platform seams listed in the header, each a parameter rather than a bundle that would only
// move the list. LongMethod and CyclomaticComplexMethod: the two `when`s are branches of wiring, a line per
// destination, not tangled logic - MainShell carried the same suppression for the same body.

/**
 * The signed-in shell's tabs: the bottom bar over the four common tabs, the forecast overlays above them and the
 * employer comparison above those. The calling shell holds [tab], [forecastRoute] and [comparisonYear] and composes
 * anything of its own (Android's detection disclosure) after this, so that still stacks above it.
 */
@Suppress("LongParameterList", "LongMethod", "CyclomaticComplexMethod")
@Composable
fun MainTabs(
    controllers: MainControllers,
    tab: AppTab,
    onTabChange: (AppTab) -> Unit,
    forecastRoute: ForecastRoute?,
    onForecastRouteChange: (ForecastRoute?) -> Unit,
    yearDownloadFailed: Boolean,
    onRetryDownload: () -> Unit,
    // IOS-SHELL-3 R1372: the comparison's open year (null = closed), held by the calling shell, and the figure store.
    comparisonYear: Int?,
    onComparisonYearChange: (Int?) -> Unit,
    employerStore: EmployerFigureStore,
    // IOS-SHELL-2 (R1338): null where the threshold alert is not offered (iOS v1) - Prevision then draws no offer.
    onEnableAlert: (() -> Unit)?,
    parametresTab: @Composable (state: ParametresState, onOpenRhythm: () -> Unit) -> Unit,
    overlayBackHandler: @Composable (onBack: () -> Unit) -> Unit,
) {
    val forecastState by controllers.forecast.state.collectAsState()
    val simulationState by controllers.simulation.state.collectAsState()
    // AN-CALENDAR (R475): opening the forecast (or the rhythm editor, or the simulator) re-reads the settings, so a
    // projection is never drawn from an employment rate or a method Parametres has since changed. Both refreshes
    // existed (F8) and nothing called them.
    LaunchedEffect(forecastRoute) {
        if (forecastRoute != null) {
            controllers.forecast.refresh()
            controllers.simulation.refresh()
        }
    }
    val aujourdhuiState by controllers.aujourdhui.state.collectAsState()
    val calendarState by controllers.calendar.state.collectAsState()
    val releveState by controllers.releve.state.collectAsState()
    val parametresState by controllers.parametres.state.collectAsState()

    Scaffold(
        bottomBar = {
            AppBottomBar(
                selected = tab,
                onSelect = { selected ->
                    // AN-AUTO: returning to Aujourd'hui re-reads the logging mode (toggled in Parametres) and
                    // today's position, so a mode change made on another tab is reflected at once.
                    // AN-CALENDAR (R475): it re-reads the settings too, now that it reads them at use, and the
                    // calendar does the same - a granularity or activity start changed in Parametres is shown on
                    // arrival, with no restart.
                    if (selected == AppTab.AUJOURDHUI) controllers.aujourdhui.refresh()
                    if (selected == AppTab.CALENDRIER) controllers.calendar.refresh()
                    onTabChange(selected)
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                AppTab.AUJOURDHUI ->
                    AujourdhuiScreen(
                        state = aujourdhuiState,
                        actions =
                            AujourdhuiActions(
                                onRecord = controllers.aujourdhui::record,
                                onConfirmDetected = controllers.aujourdhui::confirmDetected,
                                onCorrectDetected = controllers.aujourdhui::correctDetected,
                                // AN-HOME C/E/F (R328): « À traiter »'s link and a week-day tap open the calendar.
                                onNavigateToCalendrier = { onTabChange(AppTab.CALENDRIER) },
                                // AN-FORECAST: the year card's « Voir ma prevision » opens the forecast overlay.
                                onNavigateToForecast = { onForecastRouteChange(ForecastRoute.PREVISION) },
                                // AN-PULL (R484): the person asks again for the years that failed.
                                onRetryDownload = onRetryDownload,
                            ),
                        yearDownloadFailed = yearDownloadFailed,
                    )
                AppTab.CALENDRIER ->
                    CalendrierScreen(
                        state = calendarState,
                        actions =
                            CalendarActions(
                                onPreviousMonth = controllers.calendar::goPreviousMonth,
                                onNextMonth = controllers.calendar::goNextMonth,
                                onDayClick = controllers.calendar::openDay,
                                onSave = controllers.calendar::save,
                                onDismissSheet = controllers.calendar::closeSheet,
                                // AN-CAL2: the multi-day selection + bulk confirmation seams.
                                onStartSelection = { controllers.calendar.startSelection() },
                                onStartSelectionWithDay = { iso -> controllers.calendar.startSelection(iso) },
                                onToggleDay = controllers.calendar::tapDay,
                                onCancelSelection = controllers.calendar::cancelSelection,
                                onChooseBulk = controllers.calendar::chooseBulk,
                                onConfirmBulk = controllers.calendar::confirmBulk,
                                onCancelConfirmation = controllers.calendar::cancelBulkConfirmation,
                            ),
                    )
                AppTab.RELEVE -> {
                    // AN-RELEVE-FRESH (R560): opening the tab refreshes a year the last sync made stale (R559);
                    // leaving it stops a sync that lands meanwhile from fetching for a screen nobody is looking at.
                    DisposableEffect(controllers.releve) {
                        controllers.releve.onOpened()
                        onDispose { controllers.releve.onClosed() }
                    }
                    ReleveScreen(
                        state = releveState,
                        actions =
                            ReleveActions(
                                onRetry = controllers.releve::load,
                                onExportPdf = { controllers.releve.export(ExportKind.PDF) },
                                onExportCsv = { controllers.releve.export(ExportKind.CSV) },
                                // PARKAN-26: switch the releve to another year the selector offers (R328 read-only).
                                onSelectYear = controllers.releve::selectYear,
                                // AN-RECON: open the comparison overlay for the year on screen.
                                onCompareEmployer = {
                                    (releveState as? ReleveState.Loaded)?.let {
                                        onComparisonYearChange(it.selectedYear)
                                    }
                                },
                            ),
                    )
                }
                AppTab.PARAMETRES ->
                    // AN-FORECAST: « Votre rythme habituel » in the settings list opens the rhythm editor.
                    parametresTab(parametresState) { onForecastRouteChange(ForecastRoute.RYTHME) }
            }
        }
    }

    // AN-FORECAST: the forecast sub-screens, a full-screen overlay over the shell (hiding the bottom nav, as the
    // design draws them). The on-screen back arrow and the system back both close the overlay to the tab beneath;
    // « Modifier mon rythme » / « Voir ma prevision » move between the two. R340: computing the projection the
    // Prevision screen shows writes nothing; only setting the rhythm (RythmeScreen) persists, through the controller.
    forecastRoute?.let { route ->
        // AN-SIM: system back from the simulator returns to Prevision (the on-screen arrow and "Revenir a ma
        // prevision" both do too), since the simulator is a sub-screen of Prevision; the other routes close to
        // the tab beneath.
        overlayBackHandler {
            onForecastRouteChange(if (route == ForecastRoute.SIMULATION) ForecastRoute.PREVISION else null)
        }
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when (route) {
                ForecastRoute.RYTHME ->
                    RythmeScreen(
                        state = forecastState,
                        actions =
                            RythmeActions(
                                onSetDay = controllers.forecast::setDay,
                                onViewForecast = { onForecastRouteChange(ForecastRoute.PREVISION) },
                                onBack = { onForecastRouteChange(null) },
                            ),
                    )
                ForecastRoute.PREVISION ->
                    PrevisionScreen(
                        state = forecastState,
                        actions =
                            PrevisionActions(
                                onModifyRhythm = { onForecastRouteChange(ForecastRoute.RYTHME) },
                                // AN-SIM: the live simulator entry point (R85).
                                onTestChange = { onForecastRouteChange(ForecastRoute.SIMULATION) },
                                // AN-ALERT: the contextual opt-in offer enables the alert (via the OS prompt).
                                onEnableAlert = onEnableAlert,
                                onBack = { onForecastRouteChange(null) },
                            ),
                        // AN-ALERT: the offer is shown only while the alert is off (read from Parametres state).
                        alertEnabled = parametresState.thresholdAlertEnabled,
                    )
                // AN-SIM: the simulator. Adopting routes through the ForecastController's setDay (the rhythm's
                // one home, R206/R341) and returns to Prevision so the forecast is seen to change; the rate's
                // link opens Parametres, where R290's before/after confirmation fires. R340: computing writes
                // nothing - the SimulationController has no record seam.
                ForecastRoute.SIMULATION ->
                    SimulationScreen(
                        state = simulationState,
                        actions =
                            SimulationActions(
                                onSelectScenario = controllers.simulation::selectScenario,
                                onInputsChange = controllers.simulation::updateInputs,
                                onAdopt = {
                                    simulationState.inputs.extraWeekday?.let {
                                        controllers.forecast.setDay(it, RhythmChoice.DOMICILE)
                                    }
                                    onForecastRouteChange(ForecastRoute.PREVISION)
                                },
                                onChangeRate = {
                                    onForecastRouteChange(null)
                                    onTabChange(AppTab.PARAMETRES)
                                },
                                onReturn = { onForecastRouteChange(ForecastRoute.PREVISION) },
                                onBack = { onForecastRouteChange(ForecastRoute.PREVISION) },
                            ),
                    )
            }
        }
    }

    // AN-RECON: the employer comparison, a full-screen overlay over the releve. It reads the releve's current
    // Loaded document for the year it holds (R287: the server's figure, never a phone-side calc) and the
    // employer figure from the phone store (R342). Computing the gap writes nothing (R340); only the person's
    // typed figure is persisted, to the account-scoped phone store. Back closes it; a cause or "voir mes
    // journees" opens the day-by-day record.
    // MainShell's block, moved whole (IOS-SHELL-3 R1372) - inline, so its screen stays under MainTabs, the hosted route
    // (fences/EdgeToEdgeCensusTest); BackHandler became the overlay slot, the two state writes the caller's setters.
    comparisonYear?.let { year ->
        val loaded = releveState as? ReleveState.Loaded
        overlayBackHandler { onComparisonYearChange(null) }
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            if (loaded != null) {
                var employerInput by
                    rememberSaveable(year) {
                        mutableStateOf(employerStore.figureFor(year)?.let { formatPercent(it, 2) } ?: "")
                    }
                val employerRate = parseEmployerRate(employerInput)
                val view =
                    remember(loaded.document, loaded.pendingCount, loaded.isCurrentYear, employerRate) {
                        buildComparison(
                            document = loaded.document,
                            isCurrentYear = loaded.isCurrentYear,
                            daysUnsynced = loaded.pendingCount,
                            missionCap = loaded.rules.missionCapDays,
                            simplifiedBasisDays = loaded.rules.simplifiedBasisDays,
                            employerRate = employerRate,
                        )
                    }
                ComparisonScreen(
                    view = view,
                    employerInput = employerInput,
                    employerRate = employerRate,
                    actions =
                        ComparisonActions(
                            onInputChange = { text ->
                                employerInput = text
                                parseEmployerRate(text)?.let { employerStore.save(year, it) }
                            },
                            onViewDays = {
                                onComparisonYearChange(null)
                                onTabChange(AppTab.CALENDRIER)
                            },
                            onBack = { onComparisonYearChange(null) },
                        ),
                )
            }
        }
    }
}
