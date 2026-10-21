package ch.monreleve.app.ui.screens.prevision

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
import ch.monreleve.app.dossier.forecastResults
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.forecast.Projection
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus
import org.junit.Rule
import org.junit.Test
import java.time.DayOfWeek

// AN-FORECAST. Baselines for the year-end forecast screen (R135/R207), default and 200 % (fontScale 2f).
// A regression guard, not the proof of correctness - the on-device walkthrough is (R176). Every figure comes
// from the REAL engine (forecastResults + ruleSetFor), so the baseline photographs computed numbers, not
// hand-typed rates: the compliant case reproduces the design's own example (70 recorded, Tue+Thu from
// 9 October 2026 -> 29,16 % today, 39,16 % projected).

class PrevisionScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
        )

    private val user = AggregatableUser("GE", 100, "SIMPLIFIED240", null, "DAY", null)

    private fun recordedHome(count: Int): List<AggregatableEntry> {
        val rows = mutableListOf<AggregatableEntry>()
        var day = LocalDate(2026, 1, 1)
        while (rows.size < count) {
            if (day.dayOfWeek.value in 1..5) rows.add(AggregatableEntry(day.toString(), Portion.FULL, EntryKind.HOME))
            day = day.plus(1, DateTimeUnit.DAY)
        }
        return rows
    }

    private fun projection(
        recordedCount: Int,
        rhythm: Map<DayOfWeek, EntryKind>,
        domicileDays: List<Int>,
        today: String,
    ): Projection {
        val results = forecastResults(user, recordedHome(recordedCount), rhythm, LocalDate.parse(today), 2026)!!
        val rules = ruleSetFor(2026)
        return Projection(
            currentRate = results.current.declarableRate,
            projectedRate = results.projected.declarableRate,
            projected = results.projected,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
            imaginedWorkingDays = results.imagined.size,
            totalWorkDays = results.projected.totalWorkDays,
            domicileDays = domicileDays,
            denominatorKind = "SIMPLIFIED240",
            unrecordedPastDays = 0,
        )
    }

    // The design's own example: 70 recorded HOME days, Domicile Tuesday + Thursday, Suisse the other weekdays,
    // from 9 October 2026 - 59 jours ouvres to year-end (24 of them Tuesdays/Thursdays), 29,16 % -> 39,16 %.
    private val compliant =
        ForecastState(
            projection =
                projection(
                    recordedCount = 70,
                    rhythm =
                        mapOf(
                            DayOfWeek.MONDAY to EntryKind.CH,
                            DayOfWeek.TUESDAY to EntryKind.HOME,
                            DayOfWeek.WEDNESDAY to EntryKind.CH,
                            DayOfWeek.THURSDAY to EntryKind.HOME,
                            DayOfWeek.FRIDAY to EntryKind.CH,
                        ),
                    domicileDays = listOf(1, 3),
                    today = "2026-10-09",
                ),
        )

    // A projection over the 40 % fiscal ceiling (but under 49,9 %): the fiscal tile shows a distance ABOVE,
    // red, and the projected figure/rail carry the warning band.
    private val overFiscal =
        ForecastState(
            projection =
                projection(
                    recordedCount = 90,
                    rhythm =
                        mapOf(
                            DayOfWeek.MONDAY to EntryKind.HOME,
                            DayOfWeek.TUESDAY to EntryKind.HOME,
                            DayOfWeek.WEDNESDAY to EntryKind.HOME,
                            DayOfWeek.THURSDAY to EntryKind.HOME,
                            DayOfWeek.FRIDAY to EntryKind.HOME,
                        ),
                    domicileDays = listOf(0, 1, 2, 3, 4),
                    today = "2026-12-01",
                ),
        )

    // Section 2: some past weekdays left unrecorded - the conditional note renders.
    private val withUnrecorded = compliant.copy(projection = compliant.projection?.copy(unrecordedPastDays = 12))

    // No rhythm set: the screen invites setting one rather than drawing an empty projection.
    private val invitation = ForecastState()

    @Composable
    private fun host(
        state: ForecastState,
        alertEnabled: Boolean = false,
    ) {
        FrontierTheme {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                PrevisionScreen(state = state, actions = PrevisionActions(), alertEnabled = alertEnabled)
            }
        }
    }

    @Test
    fun previsionCompliant() {
        paparazzi.snapshot { host(compliant) }
    }

    @Test
    fun previsionCompliantLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(compliant) }
    }

    @Test
    fun previsionOverFiscal() {
        paparazzi.snapshot { host(overFiscal) }
    }

    @Test
    fun previsionWithUnrecorded() {
        paparazzi.snapshot { host(withUnrecorded) }
    }

    // AN-ALERT: the contextual opt-in offer « Me prévenir si mon rythme approche d'un seuil » renders below the
    // forecast while the alert is OFF (the default host above, on compliant/overFiscal/withUnrecorded).
    @Test
    fun previsionAlertEnabled() {
        // With the alert already ON, the offer is NOT shown (it is offered once) - the only diff from
        // previsionCompliant, which proves the offer is present there and absent here.
        paparazzi.snapshot { host(compliant, alertEnabled = true) }
    }

    @Test
    fun previsionInvitation() {
        paparazzi.snapshot { host(invitation) }
    }

    @Test
    fun previsionInvitationLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        paparazzi.snapshot { host(invitation) }
    }
}
