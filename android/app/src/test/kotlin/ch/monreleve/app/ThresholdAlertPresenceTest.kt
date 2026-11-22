package ch.monreleve.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.cash.paparazzi.Snapshot
import app.cash.paparazzi.SnapshotHandler
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.AggregatableEntry
import ch.monreleve.app.dossier.AggregatableUser
import ch.monreleve.app.dossier.forecastResults
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.forecast.Projection
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.parametres.ParametresController
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.ui.screens.parametres.ParametresScreen
import ch.monreleve.app.ui.screens.parametres.defaultParametresState
import ch.monreleve.app.ui.screens.prevision.PrevisionActions
import ch.monreleve.app.ui.screens.prevision.PrevisionScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.plus
import org.junit.Rule
import org.junit.Test
import java.lang.reflect.Proxy
import java.time.Clock
import kotlin.test.assertTrue

// IOS-SHELL-3 R1375 (iOS Ruling 15): THE PRESENCE CONTROL R1338 OWED. IOS-SHELL-2 proved the threshold alert's two
// entry points ABSENT on iOS (iOS passes no handler); their PRESENCE on Android rested on unchanged call sites and a
// baseline (previsionCompliant.png) that shows only the top edge of the offer's row - an absence proven without its
// presence (R169's corollary). This renders both screens on ANDROID's renderer (Paparazzi's layoutlib, on the JVM)
// with ANDROID's handlers and asserts both entry points are drawn, by their own copy:
//   - Paramètres: through parametresActions - MainShell's ONE mapping of the controller and its toggles to the
//     screen's actions, the function ParametresTab calls - so a mapping that dropped the alert's toggle fails here;
//   - Prévision: through thresholdAlertOffer - the handler MainShell hands MainTabs for Prevision's offer.
// The toggles MainShell passes in are built over its permission launchers, which only an Activity has; their place is
// taken by recorders - the mapping under them is Android's own.
//
// IT READS SEMANTICS, NOT PIXELS. The rule renders through layoutlib exactly as the screenshot tests do, at zero
// tolerance (fences/PaparazziZeroToleranceTest), but its snapshot handler keeps no image: nothing is compared,
// recorded or written, so no baseline exists for this class and none is created (R135/R207). What the composition
// drew is read off the Compose view's semantics tree once it has been laid out; a render that drew nothing fails on
// its presence guard before any entry point is looked for (R169).

/** Renders, keeps no image: this class reads the semantics tree, never the pixels (see the header). */
private object NoImages : SnapshotHandler {
    override fun newFrameHandler(
        snapshot: Snapshot,
        frameCount: Int,
        fps: Int,
    ): SnapshotHandler.FrameHandler =
        // A proxy whose every call does nothing: handle(image) would name java.awt's BufferedImage, which the
        // Android unit-test compile classpath does not carry (it exists at runtime, where layoutlib renders).
        Proxy.newProxyInstance(
            SnapshotHandler.FrameHandler::class.java.classLoader,
            arrayOf(SnapshotHandler.FrameHandler::class.java),
        ) { _, _, _ -> null } as SnapshotHandler.FrameHandler

    override fun close() = Unit
}

private val USER = AggregatableUser("GE", 100, "SIMPLIFIED240", null, "DAY", null)

/** PrevisionScreenScreenshotTest's compliant case: 70 HOME days, Tuesday and Thursday at home, from 9 October 2026. */
private fun compliantForecast(): ForecastState {
    val recorded = mutableListOf<AggregatableEntry>()
    var day = LocalDate(2026, 1, 1)
    while (recorded.size < 70) {
        if (day.dayOfWeek.isoDayNumber in 1..5) {
            recorded += AggregatableEntry(day.toString(), Portion.FULL, EntryKind.HOME)
        }
        day = day.plus(1, DateTimeUnit.DAY)
    }
    val rhythm =
        mapOf(
            DayOfWeek.MONDAY to EntryKind.CH,
            DayOfWeek.TUESDAY to EntryKind.HOME,
            DayOfWeek.WEDNESDAY to EntryKind.CH,
            DayOfWeek.THURSDAY to EntryKind.HOME,
            DayOfWeek.FRIDAY to EntryKind.CH,
        )
    val results = checkNotNull(forecastResults(USER, recorded, rhythm, LocalDate.parse("2026-10-09"), 2026))
    val rules = ruleSetFor(2026)
    return ForecastState(
        projection =
            Projection(
                currentRate = results.current.declarableRate,
                projectedRate = results.projected.declarableRate,
                projected = results.projected,
                fiscalCeiling = rules.fiscalCeiling,
                socialCeiling = rules.socialCeiling,
                imaginedWorkingDays = results.imagined.size,
                totalWorkDays = results.projected.totalWorkDays,
                domicileDays = listOf(1, 3),
                denominatorKind = "SIMPLIFIED240",
                unrecordedPastDays = 0,
            ),
    )
}

/** Every Text in the tree under [node], unmerged. */
private fun SemanticsNode.texts(): List<String> =
    config.getOrNull(SemanticsProperties.Text).orEmpty().map { it.text } + children.flatMap { it.texts() }

class ThresholdAlertPresenceTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 6000),
            theme = "android:Theme.Material.Light.NoActionBar",
            // R626 (R345): zero, stated - the fence reads this value. No image is kept (NoImages): it governs nothing.
            maxPercentDifference = 0.0,
            snapshotHandler = NoImages,
        )

    /** What [content] drew, read off the semantics tree once laid out (every pass, so the last layout is in). */
    private fun drawn(content: @Composable () -> Unit): Set<String> {
        val seen = mutableSetOf<String>()
        paparazzi.snapshot {
            val view = LocalView.current
            Box(
                modifier =
                    Modifier.fillMaxSize().onGloballyPositioned {
                        seen += (view as ViewRootForTest).semanticsOwner.unmergedRootSemanticsNode.texts()
                    },
            ) {
                FrontierTheme {
                    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        content()
                    }
                }
            }
        }
        return seen
    }

    @Test
    fun parametresDrawsTheThresholdAlertSwitchWithAndroidsHandlers() {
        val toggles = mutableListOf<Boolean>()
        val controller =
            ParametresController(
                saver =
                    object : SettingsSaver {
                        override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.NoSession
                    },
                // The screen is reached only once onboarding saved settings: a complete set.
                store = InMemorySettingsStore(Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)),
                repository = LocalEntryRepository(FakeEntryDao(), Clock.systemUTC()),
                taxYear = 2026,
                scope = CoroutineScope(Dispatchers.Unconfined),
            )
        val actions =
            parametresActions(
                controller = controller,
                onToggleAuto = null,
                onToggleEvening = {},
                onToggleThresholdAlert = { toggles += it },
                onOpenLegal = {},
                onOpenRhythm = {},
            )
        val texts = drawn { ParametresScreen(state = defaultParametresState, actions = actions, appVersion = "1.0.0") }

        assertTrue(ParametresCopy.EVENING_LABEL in texts, "the presence guard: its card was drawn ($texts)")
        assertTrue(ParametresCopy.ALERT_LABEL in texts, "R1375: Android draws the threshold alert's switch")
        assertTrue(ParametresCopy.ALERT_DESCRIPTION in texts, "and its description")
    }

    @Test
    fun previsionDrawsTheThresholdAlertOfferWithAndroidsHandler() {
        val toggles = mutableListOf<Boolean>()
        val texts =
            drawn {
                PrevisionScreen(
                    state = compliantForecast(),
                    actions = PrevisionActions(onEnableAlert = thresholdAlertOffer { toggles += it }),
                    alertEnabled = false,
                )
            }

        assertTrue(PrevisionCopy.TITLE in texts, "the presence guard: a projection was drawn ($texts)")
        assertTrue(PrevisionCopy.ALERT_OFFER in texts, "R1375: Android draws Prevision's threshold alert offer")
    }
}
