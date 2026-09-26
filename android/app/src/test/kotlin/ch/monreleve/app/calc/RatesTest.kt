package ch.monreleve.app.calc

// AN2 increment 4. Matches web/tests/unit/calc-engine/rates.test.ts's own
// cases - SPEC 7.3, two rules that conflict by design, in two files, so
// they cannot be accidentally unified: declarableRate truncates to 2 dp
// (must match the AFC filing), rawRate rounds up to 1 dp (for display).

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class RatesTest : FunSpec({
    context("declarableRateFor - truncates to 2 dp (SPEC 7.3)") {
        test("reproduces the two published truncations") {
            declarableRateFor(94.0, 240) shouldBe 39.16 // not 39.17
            declarableRateFor(10.0, 240) shouldBe 4.16 // not 4.17
        }

        test("truncates rather than rounding, even when rounding is nearer") {
            // 39.1666... rounds to 39.17 and truncates to 39.16. The AFC
            // publishes 39.16, so truncation is the rule.
            declarableRateFor(94.0, 240) shouldNotBe 39.17
            declarableRateFor(10.0, 240) shouldNotBe 4.17
        }

        test("leaves an exact value alone") {
            declarableRateFor(72.0, 240) shouldBe 30.0
            declarableRateFor(96.0, 240) shouldBe 40.0
            declarableRateFor(144.0, 240) shouldBe 60.0
            declarableRateFor(0.0, 240) shouldBe 0.0
        }

        test("does not understate an exact value through binary floating point") {
            // Regression, and the sharpest float trap in the engine. 23/125
            // is exactly 18.4%, but 18.4 is not representable in IEEE 754:
            // computing the percentage as a float and truncating gives
            // 18.39. Truncation always rounds toward zero, so the error
            // never cancels - it silently understates the rate filed with
            // the AFC.
            //
            // A 125-day denominator is not exotic: it is employmentRate 52
            // on the simplified basis, ceil(240 * 0.52) = 125.
            declarableRateFor(23.0, 125) shouldBe 18.4
            declarableRateFor(51.0, 125) shouldBe 40.8
            declarableRateFor(97.0, 125) shouldBe 77.6
        }

        test("matters at the threshold: 51/125 is 40.8 and the regime is lost") {
            // Understating this to 40.79 would still be above 40, so it
            // would not flip the regime - but it would put a wrong number
            // on a filing, and the same class of error at 40.00 exactly
            // would flip it.
            declarableRateFor(51.0, 125) shouldBeGreaterThan 40.0
        }

        test("handles half-day granularity") {
            // 94.5/240 is 39.375%, which truncates to 39.37.
            declarableRateFor(94.5, 240) shouldBe 39.37
        }
    }

    context("rawRateFor - rounds UP to 1 dp (SPEC 7.3)") {
        test("gives 45.0 for Geneva case c, against 39.16 declarable") {
            // The reason both rates are returned. 108 of 240 days were
            // spent outside Switzerland; only 94 of them are declarable.
            // Showing one number would mislead (SPEC 7.4).
            rawRateFor(108.0, 240) shouldBe 45.0
            declarableRateFor(94.0, 240) shouldBe 39.16
        }

        test("rounds up, never down") {
            rawRateFor(99.0, 240) shouldBe 41.3 // 41.25 -> 41.3
            rawRateFor(106.0, 240) shouldBe 44.2 // 44.1666... -> 44.2
            rawRateFor(149.0, 240) shouldBe 62.1 // 62.0833... -> 62.1
        }

        test("leaves an exact one-decimal value alone") {
            rawRateFor(30.0, 240) shouldBe 12.5
            rawRateFor(72.0, 240) shouldBe 30.0
            rawRateFor(0.0, 240) shouldBe 0.0
        }

        test("does not overstate an exact value through binary floating point") {
            // The mirror of the truncation trap: ceiling on a float that
            // landed a hair above an exact tenth would add 0.1.
            rawRateFor(108.0, 240) shouldBe 45.0
            rawRateFor(23.0, 125) shouldBe 18.4
        }
    }

    context("the two rules are independent") {
        test("declarableRate never exceeds rawRate on the published cases") {
            // Invariant 6 of SPEC 7.6. Truncating down and rounding up
            // cannot cross.
            listOf(
                Triple(72.0, 72.0, 240),
                Triple(96.0, 99.0, 240),
                Triple(94.0, 108.0, 240),
                Triple(96.0, 106.0, 240),
                Triple(144.0, 149.0, 240),
                Triple(10.0, 30.0, 240),
            ).forEach { (declarableDays, rawDays, total) ->
                declarableRateFor(declarableDays, total) shouldBeLessThanOrEqual rawRateFor(rawDays, total)
            }
        }

        test("disagrees on the same input, which is why they are separate functions") {
            // 41.25: truncation gives 41.25 at 2 dp, ceiling gives 41.3 at 1 dp.
            declarableRateFor(99.0, 240) shouldBe 41.25
            rawRateFor(99.0, 240) shouldBe 41.3
        }
    }
})
