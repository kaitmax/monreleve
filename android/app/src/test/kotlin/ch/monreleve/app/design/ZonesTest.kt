package ch.monreleve.app.design

// AN3 increment 2. Kotlin port of web/tests/unit/ui-core/zones.test.ts.
//
// SPEC 6.2. "Zones and statuses are different things." Zone is the rail's
// position; Status is the badge's consequence. This suite tests them
// separately - including the cases where they deliberately disagree,
// which is the whole reason there are two.

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.RuleSet
import ch.monreleve.app.calc.TeleworkInput
import ch.monreleve.app.calc.TeleworkResult
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calc.ruleSetFor
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe

private val RULES: RuleSet = ruleSetFor(2026)

/** Geneva, full time, full year: 240 days, a 96-day ceiling, a 10-day cap. */
private val BASE =
    TeleworkInput(
        taxYear = 2026,
        canton = Canton.GE,
        employmentRate = 100,
        periodFraction = 1.0,
        denominator = DenominatorMethod.Simplified240,
        granularity = Granularity.DAY,
        teleworkDays = 0.0,
        missionDaysFrance = 0.0,
        missionDaysThirdState = 0.0,
    )

private fun resultOf(patch: TeleworkInput.() -> TeleworkInput = { this }): TeleworkResult {
    val outcome = calculateTelework(BASE.patch())

    return when (outcome) {
        is CalcResult.Ok -> outcome.value
        is CalcResult.Err -> error("invalid fixture input: ${outcome.error}")
    }
}

class ZonesTest : FunSpec({
    context("zoneFor - the rail bands (SPEC 6.2)") {
        test("places a rate below the fiscal ceiling on the compliant band") {
            zoneFor(0.0, RULES) shouldBe Zone.COMPLIANT
            zoneFor(30.0, RULES) shouldBe Zone.COMPLIANT
            zoneFor(39.16, RULES) shouldBe Zone.COMPLIANT
        }

        test("treats exactly 40.00 as COMPLIANT, and 40.01 as fiscal-exposure (R32)") {
            zoneFor(40.0, RULES) shouldBe Zone.COMPLIANT
            zoneFor(40.01, RULES) shouldBe Zone.FISCAL_EXPOSURE
        }

        test("treats exactly 49.90 as fiscal-exposure, and 49.91 as social-switch (R32)") {
            zoneFor(49.89, RULES) shouldBe Zone.FISCAL_EXPOSURE
            zoneFor(49.9, RULES) shouldBe Zone.FISCAL_EXPOSURE
            zoneFor(49.91, RULES) shouldBe Zone.SOCIAL_SWITCH
        }

        test("places anything above on the social band") {
            zoneFor(60.0, RULES) shouldBe Zone.SOCIAL_SWITCH
            zoneFor(100.0, RULES) shouldBe Zone.SOCIAL_SWITCH
        }

        test("reads the thresholds from the RuleSet, not from constants of its own") {
            val shifted = ZoneThresholds(fiscalCeiling = 0.5, socialCeiling = 0.6)

            zoneFor(45.0, shifted) shouldBe Zone.COMPLIANT
            zoneFor(55.0, shifted) shouldBe Zone.FISCAL_EXPOSURE
            zoneFor(65.0, shifted) shouldBe Zone.SOCIAL_SWITCH
        }

        test("does not confuse the fraction in the RuleSet with the percentage it is given") {
            RULES.fiscalCeiling shouldBe 0.4
            RULES.socialCeiling shouldBe 0.499
            zoneFor(30.0, RULES) shouldBe Zone.COMPLIANT
        }
    }

    context("statusFor - the badge (SPEC 6.2)") {
        test("is compliant when the regime holds and no mission day is taxed in France") {
            val result = resultOf { copy(teleworkDays = 72.0) }

            result.regimeApplies shouldBe true
            result.frenchTaxedDays shouldBe 0.0
            statusFor(result) shouldBe Status.COMPLIANT
        }

        test("is mission-exposure when the regime holds but mission days spill into France") {
            val result = resultOf { copy(teleworkDays = 84.0, missionDaysFrance = 24.0) }

            result.regimeApplies shouldBe true
            result.frenchTaxedDays shouldBe 14.0
            statusFor(result) shouldBe Status.MISSION_EXPOSURE
        }

        test("is regime-lost above the fiscal ceiling but inside the social one") {
            val result = resultOf { copy(teleworkDays = 100.0) }

            result.regimeApplies shouldBe false
            result.remainingToSocial shouldBeGreaterThanOrEqual 0.0
            statusFor(result) shouldBe Status.REGIME_LOST
        }

        test("is social-switch once the social ceiling is exceeded") {
            val result = resultOf { copy(teleworkDays = 144.0, missionDaysFrance = 5.0) }

            result.remainingToSocial shouldBeLessThan 0.0
            statusFor(result) shouldBe Status.SOCIAL_SWITCH
        }

        test("prefers social-switch over regime-lost, because the first implies the second") {
            val result = resultOf { copy(teleworkDays = 144.0, missionDaysFrance = 5.0) }

            result.regimeApplies shouldBe false
            statusFor(result) shouldBe Status.SOCIAL_SWITCH
        }

        test("does not read mission exposure from the regime-lost branch") {
            val result = resultOf { copy(teleworkDays = 100.0, missionDaysFrance = 4.0) }

            (result.frenchTaxedDays > 0) shouldBe true
            statusFor(result) shouldBe Status.REGIME_LOST
        }

        test("reaches all four states across the four cases above") {
            val states =
                setOf(
                    statusFor(resultOf { copy(teleworkDays = 72.0) }),
                    statusFor(resultOf { copy(teleworkDays = 84.0, missionDaysFrance = 24.0) }),
                    statusFor(resultOf { copy(teleworkDays = 100.0) }),
                    statusFor(resultOf { copy(teleworkDays = 144.0, missionDaysFrance = 5.0) }),
                )

            states shouldBe setOf(Status.COMPLIANT, Status.MISSION_EXPOSURE, Status.REGIME_LOST, Status.SOCIAL_SWITCH)
        }
    }

    context("the Zone and Status of one result are independent (SPEC 6.2)") {
        test("mission-exposure sits on the COMPLIANT band - Geneva case c") {
            val result = resultOf { copy(teleworkDays = 84.0, missionDaysFrance = 24.0) }

            statusFor(result) shouldBe Status.MISSION_EXPOSURE
            zoneFor(result.declarableRate, RULES) shouldBe Zone.COMPLIANT
        }

        test("mission-exposure sits on the COMPLIANT band at exactly 40.00 too - Geneva case b (R32)") {
            val result = resultOf { copy(teleworkDays = 91.0, missionDaysFrance = 8.0) }

            result.declarableRate shouldBe 40.0
            result.regimeApplies shouldBe true
            statusFor(result) shouldBe Status.MISSION_EXPOSURE
            zoneFor(result.declarableRate, RULES) shouldBe Zone.COMPLIANT
        }

        test("agrees at exactly 49.9: neither the band nor the badge claims a breach (R32)") {
            val result =
                resultOf {
                    copy(denominator = DenominatorMethod.Exact(1000), teleworkDays = 499.0)
                }

            result.declarableRate shouldBe 49.9
            result.remainingToSocial shouldBe 0.0
            result.warnings.any { it is ch.monreleve.app.calc.Warning.SocialCeilingExceeded } shouldBe false

            zoneFor(result.declarableRate, RULES) shouldBe Zone.FISCAL_EXPOSURE
            statusFor(result) shouldBe Status.REGIME_LOST
        }

        test("agrees one day later, when the ceiling is actually crossed") {
            val result =
                resultOf {
                    copy(denominator = DenominatorMethod.Exact(1000), teleworkDays = 500.0)
                }

            result.warnings.any { it is ch.monreleve.app.calc.Warning.SocialCeilingExceeded } shouldBe true
            zoneFor(result.declarableRate, RULES) shouldBe Zone.SOCIAL_SWITCH
            statusFor(result) shouldBe Status.SOCIAL_SWITCH
        }
    }

    context("zoneFor compares exactly, and must not be hardened into rounding") {
        test("scales both ceilings without float error") {
            RULES.fiscalCeiling * 100 shouldBe 40.0
            RULES.socialCeiling * 100 shouldBe 49.9
        }

        test("keeps a rate finer than a hundredth on the right side of the line") {
            zoneFor(40.001, RULES) shouldBe Zone.FISCAL_EXPOSURE
            zoneFor(49.901, RULES) shouldBe Zone.SOCIAL_SWITCH
            zoneFor(39.999, RULES) shouldBe Zone.COMPLIANT
            zoneFor(49.8999, RULES) shouldBe Zone.FISCAL_EXPOSURE
        }
    }

    context("zoneFor refuses a rate that is not a number") {
        listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY).forEach { bad ->
            test("throws on $bad rather than painting the success band") {
                runCatching { zoneFor(bad, RULES) }.isFailure shouldBe true
            }
        }

        test("still accepts the ordinary range") {
            runCatching { zoneFor(0.0, RULES) }.isFailure shouldBe false
            runCatching { zoneFor(100.0, RULES) }.isFailure shouldBe false
        }
    }

    context("the badge agrees with the engine's own warnings, across a sweep") {
        fun statusFromWarnings(result: TeleworkResult): Status {
            val codes = result.warnings
            val missionWarning =
                codes.any {
                    it is ch.monreleve.app.calc.Warning.MissionCapExceeded ||
                        it is ch.monreleve.app.calc.Warning.MissionsExceedHeadroom
                }

            return when {
                codes.any { it is ch.monreleve.app.calc.Warning.SocialCeilingExceeded } -> Status.SOCIAL_SWITCH
                !result.regimeApplies -> Status.REGIME_LOST
                missionWarning -> Status.MISSION_EXPOSURE
                else -> Status.COMPLIANT
            }
        }

        val sweep = mutableListOf<TeleworkResult>()
        var telework = 0.0
        while (telework <= 240.0) {
            var missions = 0.0
            while (missions <= 20.0) {
                val outcome =
                    calculateTelework(
                        BASE.copy(
                            granularity = Granularity.HALF_DAY,
                            teleworkDays = telework,
                            missionDaysFrance = missions,
                        ),
                    )
                if (outcome is CalcResult.Ok) sweep.add(outcome.value)
                missions += 0.5
            }
            telework += 0.5
        }

        test("sweeps a meaningful number of results") {
            (sweep.size > 10_000) shouldBe true
        }

        test("reaches all four states, so the agreement below is not vacuous") {
            sweep.map { statusFor(it) }.toSet().size shouldBe 4
        }

        test("agrees with the warning codes on every swept result") {
            val disagreements = sweep.filter { statusFor(it) != statusFromWarnings(it) }

            disagreements shouldBe emptyList()
        }
    }

    context("regime lost AND missions over the cap - the precedence the fixtures cannot reach") {
        val result = resultOf { copy(teleworkDays = 100.0, missionDaysFrance = 12.0) }

        test("really does breach the cap with the regime already gone") {
            result.regimeApplies shouldBe false
            result.warnings.any { it is ch.monreleve.app.calc.Warning.MissionCapExceeded } shouldBe true
            result.remainingToSocial shouldBeGreaterThanOrEqual 0.0
        }

        test("is regime-lost, not mission-exposure") {
            statusFor(result) shouldBe Status.REGIME_LOST
        }
    }
})
