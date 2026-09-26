package ch.monreleve.app.calc

// AN2 increment 5. Matches web/tests/unit/calc-engine/calculate.test.ts's
// own cases - calculateTelework end to end. The published Geneva cases live
// in GenevaConformanceTest.kt, which reads the shared JSON; this covers the
// wiring around them - the CalcResult contract and the fields the fixtures
// do not assert.
//
// Ruling R14 (NOT_IMPLEMENTED is gone) has no Kotlin equivalent to test:
// there was never a NotImplemented variant in this port's ValidationError
// to begin with, so there is nothing to prove absent.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe

private val VALID =
    TeleworkInput(
        taxYear = 2026,
        canton = Canton.GE,
        employmentRate = 100,
        periodFraction = 1.0,
        denominator = DenominatorMethod.Simplified240,
        granularity = Granularity.DAY,
        teleworkDays = 84.0,
        missionDaysFrance = 24.0,
        missionDaysThirdState = 0.0,
    )

class CalculateTest : FunSpec({
    context("calculateTelework - the CalcResult contract") {
        test("returns validation errors rather than throwing") {
            // Simply reaching this assertion IS the "does not throw" proof -
            // a thrown exception would fail the test before shouldBe runs.
            (calculateTelework(VALID.copy(employmentRate = 0)) is CalcResult.Err) shouldBe true
        }

        test("never returns an empty error list, which was the old TS sentinel") {
            val result = calculateTelework(VALID)

            (result is CalcResult.Ok) shouldBe true
        }

        test("emits only the six spec variants") {
            val result = calculateTelework(VALID.copy(employmentRate = 0, periodFraction = 2.0, teleworkDays = -1.0))

            (result is CalcResult.Err) shouldBe true
            if (result is CalcResult.Err) {
                val permitted =
                    setOf(
                        ValidationError.RateOutOfRange::class,
                        ValidationError.PeriodOutOfRange::class,
                        ValidationError.NegativeDays::class,
                        ValidationError.GranularityMismatch::class,
                        ValidationError.DaysExceedTotal::class,
                        ValidationError.TotalWorkDaysNotPositive::class,
                    )

                result.error.forEach { error -> (error::class in permitted) shouldBe true }
            }
        }
    }

    context("calculateTelework - the fields the fixtures do not assert") {
        test("reports both rates for Geneva case c, which is why there are two") {
            val result = calculateTelework(VALID)

            (result is CalcResult.Ok) shouldBe true
            if (result is CalcResult.Ok) {
                result.value.declarableRate shouldBe 39.16
                result.value.rawRate shouldBe 45.0 // 108 of 240 days outside Switzerland
            }
        }

        test("reports the ceiling, the cap and the credited missions") {
            val result = calculateTelework(VALID)

            if (result is CalcResult.Ok) {
                result.value.totalWorkDays shouldBe 240
                result.value.fiscalCeilingDays shouldBe 96.0
                result.value.missionCap shouldBe 10
                result.value.creditedMissionDays shouldBe 10.0
            }
        }

        test("reports headroom floored to the half-day") {
            val result = calculateTelework(VALID)

            if (result is CalcResult.Ok) {
                result.value.remainingToFiscal shouldBe 2.0 // 96 - 94
                result.value.remainingToSocial shouldBe 25.5 // 119.76 - 94 -> 25.5
            }
        }

        test("derives the regime from the canton without being asked") {
            val geneva = calculateTelework(VALID)
            val vaud = calculateTelework(VALID.copy(canton = Canton.VD))

            (geneva is CalcResult.Ok && geneva.value.regime == Regime.SOURCE) shouldBe true
            (vaud is CalcResult.Ok && vaud.value.regime == Regime.RESIDENCE_1983) shouldBe true
        }
    }

    context("calculateTelework - warnings reach the caller") {
        test("emits RuleSetFallback for an unknown tax year (R11)") {
            val result = calculateTelework(VALID.copy(taxYear = 2027))

            (result is CalcResult.Ok) shouldBe true
            if (result is CalcResult.Ok) {
                val fallback = result.value.warnings.filterIsInstance<Warning.RuleSetFallback>().firstOrNull()

                fallback?.requestedYear shouldBe 2027
                fallback?.appliedYear shouldBe 2026
            }
        }

        test("emits ExactMethodUnverified for a supplied denominator") {
            val result = calculateTelework(VALID.copy(denominator = DenominatorMethod.Exact(217)))

            if (result is CalcResult.Ok) {
                result.value.warnings shouldContain Warning.ExactMethodUnverified
                result.value.totalWorkDays shouldBe 217
            }
        }

        test("emits FrontalierStatusAtRisk only for a 1983 canton over the ceiling") {
            val overCeiling = VALID.copy(teleworkDays = 144.0, missionDaysFrance = 5.0, missionDaysThirdState = 0.0)

            val vaud = calculateTelework(overCeiling.copy(canton = Canton.VD))
            val geneva = calculateTelework(overCeiling.copy(canton = Canton.GE))

            (vaud is CalcResult.Ok && vaud.value.warnings.contains(Warning.FrontalierStatusAtRisk)) shouldBe true
            (geneva is CalcResult.Ok && geneva.value.warnings.contains(Warning.FrontalierStatusAtRisk)) shouldBe false
        }
    }
})
