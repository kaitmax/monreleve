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
import ch.monreleve.app.aujourdhui.PendingLateness
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
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
        )

    private val halfDay =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.HALF_DAY,
            morning = DayEntry(kind = RecordedKind.DOMICILE, absence = null, pending = false, failed = false),
        )

    // R198: a sync the server refused, held and SAID so (not silently dropped).
    private val syncFailed =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = false, failed = true),
        )

    // A real engine result, so the year panel photographs the same figures the device would compute,
    // not a hand-typed rate. 30 telework days -> a compliant ~12,5 %; 110 -> over the 40 % ceiling.
    private fun sampleYear(
        teleworkDays: Double,
        pendingLateness: PendingLateness = PendingLateness.NONE,
    ): YearPanel {
        val input =
            TeleworkInput(
                taxYear = 2026,
                canton = Canton.GE,
                employmentRate = 100,
                periodFraction = 1.0,
                denominator = DenominatorMethod.Simplified240,
                granularity = Granularity.DAY,
                teleworkDays = teleworkDays,
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
            pendingLateness = pendingLateness,
            partialYear = false,
            fallbackYear = null,
        )
    }

    private val withYear =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
            year = sampleYear(teleworkDays = 30.0),
        )

    // R286: the pending line escalating. APPROACHING as the oldest unsynced day nears the threshold;
    // OVERDUE once it would be flagged on sync (R216: a prediction, not the record's flag).
    private val pendingApproaching =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
            year = sampleYear(teleworkDays = 30.0, pendingLateness = PendingLateness.APPROACHING),
        )

    private val pendingOverdue =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            fullDay = DayEntry(kind = RecordedKind.SUISSE, absence = null, pending = true, failed = false),
            year = sampleYear(teleworkDays = 30.0, pendingLateness = PendingLateness.OVERDUE),
        )

    // A year over the fiscal ceiling: the rate is red, the badge REGIME_LOST, the fiscal tile a
    // distance ABOVE the threshold (never a negative, R73/SPEC 7.2 step 6).
    private val overCeiling =
        AujourdhuiState(
            today = "2026-06-15",
            granularity = GranularityChoice.DAY,
            year = sampleYear(teleworkDays = 110.0),
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

    @Test
    fun aujourdhuiSyncFailed() {
        paparazzi.snapshot { host(syncFailed) }
    }

    @Test
    fun aujourdhuiPendingApproaching() {
        paparazzi.snapshot { host(pendingApproaching) }
    }

    @Test
    fun aujourdhuiPendingOverdue() {
        paparazzi.snapshot { host(pendingOverdue) }
    }

    @Test
    fun aujourdhuiPendingOverdueLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(pendingOverdue) }
    }

    @Test
    fun aujourdhuiOverCeiling() {
        paparazzi.snapshot { host(overCeiling) }
    }

    @Test
    fun aujourdhuiOverCeilingLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(overCeiling) }
    }
}
