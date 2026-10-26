package ch.monreleve.app.dossier

import ch.monreleve.app.calc.Warning
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.plus

// AN-SIM (R340, R281). THE SIMULATOR'S ENGINE PATH, hand-checked against the design's own example.
//
// Each scenario is a change to the imagined year, run through the EXISTING engine path (forecastResults,
// which binds to fixtures/forecast-cases.json, R281). simulationResults runs it twice - the current
// projection (baseline) and the projection with the change (simulated) - from ONE input snapshot, so the
// two figures a reader compares are always consistent (FW12: never a second derivation in the UI).
//
// THE DESIGN'S EXAMPLE IS REPRODUCED FROM THE ENGINE, not typed (design/decide/Simulation.dc.html and
// README.md): 70 recorded HOME days by 9 October 2026, rhythm Suisse except Domicile Tuesday + Thursday =
// 94 days = 39,16 % projected; adding the 11 remaining Fridays as a home day = 105 days = 43,75 %, which is
// 9 days over the 40 % ceiling (remainingToFiscal -9) and 14,5 days below 49,9 % (remainingToSocial 14,5).
// Those are the exact figures the mock-up draws, so the baseline here is the real arithmetic.

private val USER = AggregatableUser("GE", 100, "SIMPLIFIED240", null, "DAY", null)
private val TODAY = LocalDate.parse("2026-10-09")
private const val TAX_YEAR = 2026

// The design's rhythm: Suisse Monday/Wednesday/Friday, Domicile Tuesday/Thursday.
private val RHYTHM =
    mapOf(
        DayOfWeek.MONDAY to EntryKind.CH,
        DayOfWeek.TUESDAY to EntryKind.HOME,
        DayOfWeek.WEDNESDAY to EntryKind.CH,
        DayOfWeek.THURSDAY to EntryKind.HOME,
        DayOfWeek.FRIDAY to EntryKind.CH,
    )

private fun recordedHome(count: Int): List<AggregatableEntry> {
    val rows = mutableListOf<AggregatableEntry>()
    var day = LocalDate(TAX_YEAR, 1, 1)
    while (rows.size < count) {
        if (day.dayOfWeek.isoDayNumber in 1..5) {
            rows.add(
                AggregatableEntry(day.toString(), Portion.FULL, EntryKind.HOME),
            )
        }
        day = day.plus(1, DateTimeUnit.DAY)
    }
    return rows
}

class SimulationConformanceTest : FunSpec({
    val recorded = recordedHome(70)

    test("one more day at home each week reproduces the design: 39,16 % -> 43,75 %, 9 over, 14,5 before social") {
        val results =
            simulationResults(USER, recorded, RHYTHM, SimChange.ExtraWeekday(DayOfWeek.FRIDAY), TODAY, TAX_YEAR)
        results.shouldNotBeNull()
        results.baseline.declarableRate shouldBe (39.16 plusOrMinus 0.005)
        results.simulated.declarableRate shouldBe (43.75 plusOrMinus 0.005)
        results.simulated.remainingToFiscal shouldBe (-9.0 plusOrMinus 0.001)
        results.simulated.remainingToSocial shouldBe (14.5 plusOrMinus 0.001)
    }

    test("extra telework days this month add to the telework count: +10 -> 43,33 %") {
        val results = simulationResults(USER, recorded, RHYTHM, SimChange.ExtraMonthDays(10), TODAY, TAX_YEAR)
        results.shouldNotBeNull()
        // Baseline 94 telework days of 240; +10 = 104 / 240 = 43,33 %.
        results.baseline.declarableRate shouldBe (39.16 plusOrMinus 0.005)
        results.simulated.declarableRate shouldBe (43.33 plusOrMinus 0.005)
    }

    test("a lower employment rate raises the declarable rate because the basis shrinks") {
        val results = simulationResults(USER, recorded, RHYTHM, SimChange.Rate(80), TODAY, TAX_YEAR)
        results.shouldNotBeNull()
        // 80 % of the 240-day basis = 192 days; the same telework days now divide by less, so the rate rises.
        (results.simulated.declarableRate > results.baseline.declarableRate) shouldBe true
    }

    test("the engine applies the 10-day mission cap - the simulator never applies it itself (France first)") {
        val belowCap = simulationResults(USER, recorded, RHYTHM, SimChange.Missions(5, 0), TODAY, TAX_YEAR)
        belowCap.shouldNotBeNull()
        belowCap.simulated.warnings.any { it is Warning.MissionCapExceeded } shouldBe false

        val overCap = simulationResults(USER, recorded, RHYTHM, SimChange.Missions(12, 0), TODAY, TAX_YEAR)
        overCap.shouldNotBeNull()
        // 12 France missions exceed the 10-day/year cap (SPEC 7.2): the engine raises the cap warning.
        overCap.simulated.warnings.any { it is Warning.MissionCapExceeded } shouldBe true

        // A third-state mission also feeds the engine (France is counted first, then the third state).
        val third = simulationResults(USER, recorded, RHYTHM, SimChange.Missions(0, 3), TODAY, TAX_YEAR)
        third.shouldNotBeNull()
        (third.simulated.declarableRate >= third.baseline.declarableRate) shouldBe true
    }
})
