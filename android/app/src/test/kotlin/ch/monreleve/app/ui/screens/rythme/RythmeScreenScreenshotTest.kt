package ch.monreleve.app.ui.screens.rythme

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.forecast.RhythmChoice
import kotlinx.datetime.DayOfWeek
import org.junit.Rule
import org.junit.Test

// AN-FORECAST (R341). Baselines for the weekly-rhythm screen (R135/R207), default and 200 % (fontScale 2f).
// The first-time state has NOTHING preselected (the five days show both toggles outlined); the set state is
// the design's own example (Domicile Tuesday + Thursday, Suisse otherwise).

class RythmeScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
            // IOS-1b-A R626 (R345): zero, stated - never Paparazzi 1.3.5's default 0.1. Guarded by
            // fences/PaparazziZeroToleranceTest, which reads the VALUE off this rule.
            maxPercentDifference = 0.0,
        )

    private val empty = ForecastState()

    private val set =
        ForecastState(
            rhythmDays =
                mapOf(
                    DayOfWeek.MONDAY to RhythmChoice.SUISSE,
                    DayOfWeek.TUESDAY to RhythmChoice.DOMICILE,
                    DayOfWeek.WEDNESDAY to RhythmChoice.SUISSE,
                    DayOfWeek.THURSDAY to RhythmChoice.DOMICILE,
                    DayOfWeek.FRIDAY to RhythmChoice.SUISSE,
                ),
        )

    @Composable
    private fun host(state: ForecastState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                RythmeScreen(state = state, actions = RythmeActions(onSetDay = { _, _ -> }))
            }
        }
    }

    @Test
    fun rythmeEmpty() {
        paparazzi.snapshot { host(empty) }
    }

    @Test
    fun rythmeEmptyLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(empty) }
    }

    @Test
    fun rythmeSet() {
        paparazzi.snapshot { host(set) }
    }

    @Test
    fun rythmeSetLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(set) }
    }
}
