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
import ch.monreleve.app.aujourdhui.YearPanel
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.TeleworkInput
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calc.ruleSetFor
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

    // A real engine result (30 telework days on the 240 basis -> a compliant ~12,5 %), so the year
    // panel photographs the same figures the device would compute, not a hand-typed rate.
    private fun sampleYear(): YearPanel {
        val input =
            TeleworkInput(
                taxYear = 2026,
                canton = Canton.GE,
                employmentRate = 100,
                periodFraction = 1.0,
                denominator = DenominatorMethod.Simplified240,
                granularity = Granularity.DAY,
                teleworkDays = 30.0,
                missionDaysFrance = 0.0,
                missionDaysThirdState = 0.0,
            )
        val result = (calculateTelework(input) as CalcResult.Ok).value
        val rules = ruleSetFor(2026)
        return YearPanel(
            result = result,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
            unsyncedDays = 3,
            partialYear = false,
            fallbackYear = null,
        )
    }

    private val withYear =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true),
            year = sampleYear(),
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

    @Test
    fun aujourdhuiWithYear() {
        paparazzi.snapshot { host(withYear) }
    }

    @Test
    fun aujourdhuiWithYearLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(withYear) }
    }
}
