package ch.monreleve.app.ui.screens.simulation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.dossier.AggregatableEntry
import ch.monreleve.app.dossier.AggregatableUser
import ch.monreleve.app.dossier.SimChange
import ch.monreleve.app.dossier.simulationResults
import ch.monreleve.app.forecast.SimInputs
import ch.monreleve.app.forecast.SimScenario
import ch.monreleve.app.forecast.SimulationState
import ch.monreleve.app.forecast.SimulationView
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus
import org.junit.Rule
import org.junit.Test
import java.time.DayOfWeek

// AN-SIM. Baselines for the simulator (R135/R207), default and 200 % (fontScale 2f). A regression guard, not
// the proof of correctness - the on-device walkthrough is (R176). Every figure comes from the REAL engine
// (simulationResults + ruleSetFor), so the baseline photographs computed numbers, not hand-typed rates: the
// extra-weekday case reproduces the design's own example (70 recorded, Tue+Thu rhythm, adding Friday as a home
// day from 9 October 2026 -> 39,16 % projected becomes 43,75 %, 9 days over the fiscal ceiling, 14,5 before social).

class SimulationScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private val user = AggregatableUser("GE", 100, "SIMPLIFIED240", null, "DAY", null)

    private val rhythm =
        mapOf(
            DayOfWeek.MONDAY to EntryKind.CH,
            DayOfWeek.TUESDAY to EntryKind.HOME,
            DayOfWeek.WEDNESDAY to EntryKind.CH,
            DayOfWeek.THURSDAY to EntryKind.HOME,
            DayOfWeek.FRIDAY to EntryKind.CH,
        )

    private val available = listOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY)

    private fun recordedHome(count: Int): List<AggregatableEntry> {
        val rows = mutableListOf<AggregatableEntry>()
        var day = LocalDate(2026, 1, 1)
        while (rows.size < count) {
            if (day.dayOfWeek.value in 1..5) rows.add(AggregatableEntry(day.toString(), Portion.FULL, EntryKind.HOME))
            day = day.plus(1, DateTimeUnit.DAY)
        }
        return rows
    }

    private fun view(change: SimChange): SimulationView {
        val results = simulationResults(user, recordedHome(70), rhythm, change, LocalDate.parse("2026-10-09"), 2026)!!
        val rules = ruleSetFor(2026)
        return SimulationView(
            recordedRate = results.recorded.declarableRate,
            currentRate = results.baseline.declarableRate,
            simulatedRate = results.simulated.declarableRate,
            simulated = results.simulated,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
        )
    }

    // The design's own example: one more home day a week (Friday), 39,16 % -> 43,75 %, over the fiscal ceiling,
    // with the « Adopter ce rythme » button.
    private val extraWeekday =
        SimulationState(
            scenario = SimScenario.EXTRA_WEEKDAY,
            inputs = SimInputs(extraWeekday = DayOfWeek.FRIDAY, targetRate = "100"),
            availableWeekdays = available,
            view = view(SimChange.ExtraWeekday(DayOfWeek.FRIDAY)),
            canAdopt = true,
        )

    // A different employment rate: the number field and the « Modifier mon taux dans les Paramètres » link.
    private val rate =
        SimulationState(
            scenario = SimScenario.RATE,
            inputs = SimInputs(extraWeekday = DayOfWeek.MONDAY, targetRate = "80"),
            availableWeekdays = available,
            view = view(SimChange.Rate(80)),
            canAdopt = false,
        )

    // Missions: the two mission fields (France and a third state).
    private val missions =
        SimulationState(
            scenario = SimScenario.MISSIONS,
            inputs = SimInputs(extraWeekday = DayOfWeek.MONDAY, targetRate = "100", missionsFrance = "5"),
            availableWeekdays = available,
            view = view(SimChange.Missions(5, 0)),
            canAdopt = false,
        )

    // Extra telework days this month: the number field.
    private val extraDays =
        SimulationState(
            scenario = SimScenario.EXTRA_MONTH_DAYS,
            inputs = SimInputs(extraWeekday = DayOfWeek.MONDAY, targetRate = "100", extraMonthDays = "10"),
            availableWeekdays = available,
            view = view(SimChange.ExtraMonthDays(10)),
            canAdopt = false,
        )

    // No rhythm set: the screen invites setting one rather than drawing an empty simulation.
    private val invitation = SimulationState()

    @Composable
    private fun host(state: SimulationState) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                SimulationScreen(state = state, actions = SimulationActions())
            }
        }
    }

    @Test
    fun simExtraWeekday() {
        paparazzi.snapshot { host(extraWeekday) }
    }

    @Test
    fun simExtraWeekdayLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(extraWeekday) }
    }

    @Test
    fun simRate() {
        paparazzi.snapshot { host(rate) }
    }

    @Test
    fun simMissions() {
        paparazzi.snapshot { host(missions) }
    }

    @Test
    fun simExtraDays() {
        paparazzi.snapshot { host(extraDays) }
    }

    @Test
    fun simInvitation() {
        paparazzi.snapshot { host(invitation) }
    }

    @Test
    fun simInvitationLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(invitation) }
    }
}
