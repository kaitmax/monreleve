package ch.monreleve.app.calc

// AN2 increment 4. Matches web/tests/unit/calc-engine/headroom.test.ts's
// own cases - SPEC 7.2 step 6 and 7.3. Advisory headroom FLOORS to the
// half-day: a user must never be told they have more room than they do.
// Negative values are REPORTED, never clamped.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe

private val RULES = ruleSetFor(2026)

private fun at(
    daysCounted: Double,
    totalWorkDays: Int = 240,
) = headroomFor(daysCounted, totalWorkDays, RULES)

class HeadroomTest : FunSpec({
    context("floorToHalfDay") {
        listOf(
            0.0 to 0.0,
            0.4 to 0.0,
            0.5 to 0.5,
            0.9 to 0.5,
            1.0 to 1.0,
            1.4 to 1.0,
            1.5 to 1.5,
            23.9 to 23.5,
            47.76 to 47.5,
        ).forEach { (value, expected) ->
            test("floors $value to $expected") {
                floorToHalfDay(value) shouldBe expected
            }
        }

        test("floors negatives away from zero, so it never overstates") {
            // -0.1 must not become 0: that would report room the user does
            // not have.
            floorToHalfDay(-0.1) shouldBe -0.5
            floorToHalfDay(-0.5) shouldBe -0.5
            floorToHalfDay(-0.6) shouldBe -1.0
            floorToHalfDay(-24.24) shouldBe -24.5
        }
    }

    context("headroomFor (SPEC 7.2 step 6)") {
        test("reports room to both ceilings at Geneva case a") {
            // 96 - 72 = 24 exactly. 119.76 - 72 = 47.76, floored to 47.5.
            val headroom = at(72.0)

            headroom.remainingToFiscal shouldBe 24.0
            headroom.remainingToSocial shouldBe 47.5
        }

        test("reports room at Geneva case c") {
            // 96 - 94 = 2. 119.76 - 94 = 25.76 -> 25.5.
            val headroom = at(94.0)

            headroom.remainingToFiscal shouldBe 2.0
            headroom.remainingToSocial shouldBe 25.5
        }

        test("reports zero fiscal room exactly at the ceiling") {
            at(96.0).remainingToFiscal shouldBe 0.0
        }

        test("REPORTS negative values rather than clamping them") {
            // Geneva case e: 144 days counted against a 96-day ceiling.
            val headroom = at(144.0)

            headroom.remainingToFiscal shouldBe -48.0
            headroom.remainingToSocial shouldBe -24.5 // 119.76 - 144 = -24.24
        }

        test("never reports more social room than the exact value") {
            // 119.76 - 94 = 25.76. Reporting 25.76 or 26 would overstate;
            // 25.5 does not. The floor is what makes the advice safe.
            at(94.0).remainingToSocial shouldBeLessThanOrEqual 25.76
        }

        test("always leaves at least as much social room as fiscal room") {
            // Invariant 4 of SPEC 7.6, which must hold for negatives too.
            listOf(0.0, 50.0, 72.0, 94.0, 96.0, 100.0, 119.0, 120.0, 144.0, 240.0).forEach { days ->
                val headroom = at(days)

                (headroom.remainingToSocial >= headroom.remainingToFiscal) shouldBe true
            }
        }

        test("scales with a part-time denominator") {
            // A 63-day denominator, which is employmentRate 45 over a 7/12
            // period. Fiscal ceiling 63 * 0.40 = 25.2, social
            // 63 * 0.499 = 31.437.
            val headroom = at(20.0, 63)

            headroom.remainingToFiscal shouldBe 5.0 // 25.2 - 20 = 5.2 -> 5
            headroom.remainingToSocial shouldBe 11.0 // 31.437 - 20 = 11.437 -> 11
        }
    }
})
