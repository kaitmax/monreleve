package ch.monreleve.app.calc

// AN2 increment 3. Matches web/tests/unit/calc-engine/waterfall.test.ts's
// own cases - SPEC 7.2 step 5, "the core; not a threshold test". The spec
// calls out two details as easy to get wrong and both matter, so each gets
// its own named test below: missions are EXCLUDED from the declared
// numerator when telework alone exceeds the ceiling, and France missions
// are imputed BEFORE third-state ones.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe

private val RULES = ruleSetFor(2026)

/** Full time, full year: 240 days, a 96-day ceiling, a 10-day mission cap. */
private fun run(
    teleworkDays: Double,
    missionDaysFrance: Double,
    missionDaysThirdState: Double,
    totalWorkDays: Int = 240,
    missionCap: Int = 10,
) = runWaterfall(
    WaterfallInput(totalWorkDays, missionCap, teleworkDays, missionDaysFrance, missionDaysThirdState),
    RULES,
)

class WaterfallTest : FunSpec({
    context("runWaterfall - the ceiling") {
        test("computes the fiscal ceiling in days from the rule set") {
            run(0.0, 0.0, 0.0).fiscalCeilingDays shouldBe 96.0 // 240 * 0.40
        }

        test("applies the regime at exactly the ceiling") {
            // "teleworkDays > fiscalCeiling" is strictly greater, so landing
            // exactly on 96 keeps the regime.
            run(96.0, 0.0, 0.0).regimeApplies shouldBe true
        }

        test("loses the regime one day above the ceiling") {
            run(97.0, 0.0, 0.0).regimeApplies shouldBe false
        }
    }

    context("runWaterfall - the regime-lost branch") {
        test("EXCLUDES mission days from the declared numerator") {
            // The detail SPEC 7.2 step 5 warns about. Geneva is explicit:
            // the regime does not apply, so missions must not be folded
            // into the rate filed with the AFC, even though they are taxed
            // in France. Case e's shape.
            val outcome = run(144.0, 5.0, 0.0)

            outcome.regimeApplies shouldBe false
            outcome.daysCountedAgainstCeiling shouldBe 144.0 // not 149
            outcome.creditedMissionDays shouldBe 0.0
        }

        test("still taxes the mission days in France") {
            val outcome = run(144.0, 5.0, 0.0)

            outcome.frenchTaxedDays shouldBe 149.0 // 144 + 5
            outcome.swissTaxedDays shouldBe 91.0 // 240 - 144 - 5
        }

        test("accounts for every day") {
            val outcome = run(144.0, 3.0, 2.0)

            (outcome.swissTaxedDays + outcome.frenchTaxedDays) shouldBe 240.0
        }
    }

    context("runWaterfall - the budget") {
        test("is limited by the cap when headroom is wider") {
            // 96 - 84 = 12 days of room, but the cap is 10. Case c's shape.
            val outcome = run(84.0, 24.0, 0.0)

            outcome.headroomDays shouldBe 12.0
            outcome.creditedMissionDays shouldBe 10.0
        }

        test("is limited by headroom when the cap is wider") {
            // 96 - 91 = 5 days of room against a 10-day cap. Case b's shape.
            val outcome = run(91.0, 8.0, 0.0)

            outcome.headroomDays shouldBe 5.0
            outcome.creditedMissionDays shouldBe 5.0
        }

        test("credits nothing when there is no headroom at all") {
            val outcome = run(96.0, 8.0, 0.0)

            outcome.headroomDays shouldBe 0.0
            outcome.creditedMissionDays shouldBe 0.0
            outcome.frenchTaxedDays shouldBe 8.0
        }

        test("credits every mission day when both cap and headroom are wider") {
            val outcome = run(10.0, 3.0, 0.0)

            outcome.creditedMissionDays shouldBe 3.0
            outcome.frenchTaxedDays shouldBe 0.0
        }
    }

    context("runWaterfall - France missions are imputed BEFORE third-state") {
        // The second detail SPEC 7.2 step 5 warns about. The order changes
        // who pays how: excess France missions are collected by French
        // withholding via the Swiss employer, excess third-state missions
        // are declared and paid by the employee directly. So the split of
        // what remains uncredited matters even when the credited total is
        // identical.

        test("fills the budget from France first") {
            // telework 90 -> headroom 6, cap 10, budget 6.
            val outcome = run(90.0, 4.0, 8.0)

            outcome.creditedFranceDays shouldBe 4.0 // all of France fits
            outcome.creditedThirdStateDays shouldBe 2.0 // then 2 of the 8
            outcome.creditedMissionDays shouldBe 6.0
        }

        test("leaves third-state missions uncredited before France ones") {
            // Same 12 mission days, same budget of 6, split the other way.
            val outcome = run(90.0, 8.0, 4.0)

            outcome.creditedFranceDays shouldBe 6.0 // France exhausts the budget
            outcome.creditedThirdStateDays shouldBe 0.0 // nothing left
            outcome.creditedMissionDays shouldBe 6.0
        }

        test("gives the same credited total either way, but a different composition") {
            val franceLight = run(90.0, 4.0, 8.0)
            val franceHeavy = run(90.0, 8.0, 4.0)

            // Invariant 8 of SPEC 7.6: swapping never increases the credited
            // total.
            franceHeavy.creditedMissionDays shouldBe franceLight.creditedMissionDays
            franceHeavy.frenchTaxedDays shouldBe franceLight.frenchTaxedDays

            // But the composition differs, which is the whole point of two
            // fields.
            (franceLight.creditedFranceDays == franceHeavy.creditedFranceDays) shouldBe false
        }

        test("never credits more third-state days than the remaining budget") {
            val outcome = run(91.0, 5.0, 5.0) // budget 5, France takes all of it

            outcome.creditedFranceDays shouldBe 5.0
            outcome.creditedThirdStateDays shouldBe 0.0
        }
    }

    context("runWaterfall - the day split when the regime applies") {
        test("returns missions to Switzerland as they are credited") {
            // swissTaxedDays = totalWorkDays - missionDaysTotal + creditedMissions
            val outcome = run(84.0, 24.0, 0.0)

            outcome.swissTaxedDays shouldBe 226.0 // 240 - 24 + 10
            outcome.frenchTaxedDays shouldBe 14.0 // 24 - 10
        }

        test("accounts for every day") {
            val outcome = run(84.0, 12.0, 12.0)

            (outcome.swissTaxedDays + outcome.frenchTaxedDays) shouldBe 240.0
        }

        test("counts telework plus credited missions against the ceiling") {
            val outcome = run(84.0, 24.0, 0.0)

            outcome.daysCountedAgainstCeiling shouldBe 94.0 // 84 + 10
        }
    }

    context("runWaterfall - part-time proration") {
        test("scales the ceiling with the denominator") {
            // A 63-day denominator: ceiling 25.2, cap prorated to 5 by the
            // caller.
            val outcome = run(20.0, 8.0, 0.0, totalWorkDays = 63, missionCap = 5)

            outcome.fiscalCeilingDays shouldBe (25.2 plusOrMinus 1e-10)
            outcome.headroomDays shouldBe (5.2 plusOrMinus 1e-10)
            outcome.creditedMissionDays shouldBe 5.0 // cap binds
            outcome.swissTaxedDays shouldBe 60.0 // 63 - 8 + 5
        }
    }
})
