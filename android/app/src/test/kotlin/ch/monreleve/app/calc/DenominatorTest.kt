package ch.monreleve.app.calc

// AN2 increment 2. Matches web/tests/unit/calc-engine/denominator.test.ts's
// own cases - SPEC section 7.2 step 2.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

private val RULES = ruleSetFor(2026)

private fun simplified(
    rate: Int,
    fraction: Double,
) = resolveDenominator(DenominatorMethod.Simplified240, rate, fraction, RULES)

class DenominatorTest : FunSpec({
    context("resolveDenominator, Simplified240 (SPEC 7.2 step 2)") {
        // Triple(1, 1.0, 3) is ceil(2.4).
        listOf(
            Triple(1, 1.0, 3),
            Triple(50, 1.0, 120),
            Triple(80, 1.0, 192),
            Triple(100, 1.0, 240),
        ).forEach { (rate, fraction, expected) ->
            test("employmentRate $rate over a full year gives $expected days") {
                simplified(rate, fraction).totalWorkDays shouldBe expected
            }
        }

        // Triple(1, 0.5, 2) is ceil(1.2). Triple(100, 7/12, 140) is a June start.
        listOf(
            Triple(100, 0.5, 120),
            Triple(80, 0.5, 96),
            Triple(1, 0.5, 2),
            Triple(100, 7.0 / 12, 140),
            Triple(50, 7.0 / 12, 70),
        ).forEach { (rate, fraction, expected) ->
            test("employmentRate $rate over periodFraction $fraction gives $expected days") {
                simplified(rate, fraction).totalWorkDays shouldBe expected
            }
        }

        test("rounds a fractional basis up, never down") {
            // 240 * 0.01 = 2.4 -> 3. The basis absorbs leave and holidays, so
            // a partial day of entitlement is still a working day of
            // denominator.
            simplified(1, 1.0).totalWorkDays shouldBe 3
            simplified(3, 1.0).totalWorkDays shouldBe 8 // 7.2 -> 8
        }

        test("does not lose a day to binary floating point") {
            // Regression. 240 * 45/100 * 7/12 is exactly 63, but evaluated
            // naively in IEEE 754 it is 63.000000000000007, which ceils to
            // 64. A one-day error in the denominator moves the declarable
            // rate, which is the number filed with the AFC. Three such cases
            // exist across rate 1-100 crossed with the common period
            // fractions: rates 45, 85 and 90 at 7/12.
            simplified(45, 7.0 / 12).totalWorkDays shouldBe 63
            simplified(85, 7.0 / 12).totalWorkDays shouldBe 119
            simplified(90, 7.0 / 12).totalWorkDays shouldBe 126
        }

        test("emits no warning: the simplified basis is the sourced default") {
            simplified(100, 1.0).warnings shouldBe emptyList()
        }
    }

    context("resolveDenominator, Exact (SPEC 7.2 step 2)") {
        test("returns the supplied total unchanged") {
            val outcome = resolveDenominator(DenominatorMethod.Exact(217), 100, 1.0, RULES)

            outcome.totalWorkDays shouldBe 217
        }

        test("ignores employmentRate and periodFraction entirely") {
            // "validated, not derived" - the engine must not second-guess a
            // total the employer supplied, even one that looks inconsistent
            // with the rate.
            val outcome = resolveDenominator(DenominatorMethod.Exact(217), 50, 0.5, RULES)

            outcome.totalWorkDays shouldBe 217
        }

        test("surfaces ExactMethodUnverified") {
            // SPEC section 20: emit EXACT_METHOD_UNVERIFIED for
            // user-supplied denominators. The engine cannot verify a number
            // it did not derive.
            val outcome = resolveDenominator(DenominatorMethod.Exact(217), 100, 1.0, RULES)

            outcome.warnings shouldBe listOf(Warning.ExactMethodUnverified)
        }

        test("passes a non-positive supplied total through for validation to reject") {
            // resolveDenominator mirrors; it does not judge.
            // TotalWorkDaysNotPositive is the validation pass's, and no
            // division happens before that check.
            resolveDenominator(DenominatorMethod.Exact(0), 100, 1.0, RULES).totalWorkDays shouldBe 0
            resolveDenominator(DenominatorMethod.Exact(-5), 100, 1.0, RULES).totalWorkDays shouldBe -5
        }
    }
})
