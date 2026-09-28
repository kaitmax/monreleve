package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.onboarding.GranularityChoice
import org.junit.Rule
import org.junit.Test

/**
 * AN5b increment 3: baselines for the Aujourd'hui recording screen (SPEC 11.2). A regression guard,
 * not the proof of correctness (the walkthrough is, increment 6, R176/R177/R135). Captured at default
 * and 200 percent (fontScale 2f).
 *
 * States: today not yet recorded (DAY), today recorded En Suisse and pending sync (DAY), and the
 * half-day layout (HALF_DAY). Replaces AN1's placeholder baseline, which the real screen supersedes.
 */
class AujourdhuiScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private val dayEmpty = AujourdhuiState(today = "2026-06-15", granularity = GranularityChoice.DAY)

    private val dayRecorded =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true),
        )

    private val halfDay =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.HALF_DAY,
            morning = DayEntry(kind = RecordedKind.DOMICILE, absence = null, pending = false),
        )

    @Composable
    private fun host(state: AujourdhuiState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                AujourdhuiScreen(state = state, onRecord = { _, _, _ -> })
            }
        }
    }

    @Test
    fun aujourdhuiEmpty() {
        paparazzi.snapshot { host(dayEmpty) }
    }

    @Test
    fun aujourdhuiEmptyLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(dayEmpty) }
    }

    @Test
    fun aujourdhuiRecordedPending() {
        paparazzi.snapshot { host(dayRecorded) }
    }

    @Test
    fun aujourdhuiHalfDay() {
        paparazzi.snapshot { host(halfDay) }
    }
}
