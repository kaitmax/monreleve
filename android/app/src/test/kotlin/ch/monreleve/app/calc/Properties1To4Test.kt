@file:OptIn(io.kotest.common.ExperimentalKotest::class)

package ch.monreleve.app.calc

// PropTestConfig's iterations parameter is marked experimental in Kotest
// 5.9.1; the opt-in above is for that constructor, not for anything this
// file does itself.
//
// AN2 increment 5. Matches
// web/tests/unit/calc-engine/properties-1-4.test.ts's own cases exactly -
// SPEC 7.6 invariants 1 to 4, over PROPERTY_RUNS generated cases each.
//
// Every invariant is paired with a DELIBERATELY BROKEN variant that Kotest
// must FALSIFY. A property that has never failed has not been tested: it
// might be asserting something vacuous, or the generator might never reach
// the region where it could break.
//
// No snapshots anywhere in this module (SPEC 7.6).

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.property.PropTestConfig
import io.kotest.property.checkAll

/** Only valid inputs carry a result; the generator produces those by design. */
private fun resultOf(input: TeleworkInput): TeleworkResult {
    val result = calculateTelework(input)

    return when (result) {
        is CalcResult.Ok -> result.value
        is CalcResult.Err -> error("generator produced invalid input: ${result.error}")
    }
}

/** The declarable numerator, which TeleworkResult does not expose directly. */
private fun countedDays(
    input: TeleworkInput,
    result: TeleworkResult,
): Double = if (result.regimeApplies) input.teleworkDays + result.creditedMissionDays else input.teleworkDays

private fun missionTotal(input: TeleworkInput): Double = input.missionDaysFrance + input.missionDaysThirdState

private val CEILING_PERCENT = PROPERTY_RULES.fiscalCeiling * 1e2

private val BLOCKING = PropTestConfig(seed = PROPERTY_SEED, iterations = PROPERTY_RUNS)
private val FALSIFY = PropTestConfig(seed = PROPERTY_SEED, iterations = FALSIFY_RUNS)

/** Asserts that Kotest finds a counterexample - i.e. the break is real. */
private suspend fun expectFalsified(block: suspend () -> Unit) {
    shouldThrow<Throwable> { block() }
}

class Properties1To4Test : FunSpec({
    context("invariant 1 - the day partition is exact") {
        test("swissTaxedDays + frenchTaxedDays === totalWorkDays, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                (result.swissTaxedDays + result.frenchTaxedDays) shouldBe result.totalWorkDays.toDouble()
            }
        }

        test("is falsified by a waterfall that forgets to return credited missions to Switzerland") {
            // The likeliest real mistake in the regime-applies branch:
            // writing swissTaxedDays = total - missionDaysTotal and
            // omitting + credited.
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)
                    val brokenSwiss = result.totalWorkDays - missionTotal(input)

                    (brokenSwiss + result.frenchTaxedDays) shouldBe result.totalWorkDays.toDouble()
                }
            }
        }
    }

    context("invariant 2 - the declarable rate cannot exceed the ceiling") {
        test("declarableRate <= 40 whenever regimeApplies, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                if (result.regimeApplies) {
                    result.declarableRate shouldBeLessThanOrEqual CEILING_PERCENT
                }
            }
        }

        test("is falsified by a budget that ignores the headroom") {
            // Note what does NOT break this invariant, because it is worth
            // recording: rounding the rate up instead of truncating cannot
            // push it past 40, since the numerator is already capped at the
            // ceiling and ceil(4000)/100 is 40. The only way to exceed the
            // ceiling is to credit more mission days than the headroom
            // allows, which is why this break is the same one invariant 3
            // catches - the two invariants guard one mistake from opposite
            // ends.
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)

                    if (result.regimeApplies) {
                        val brokenCredited = minOf(missionTotal(input), result.missionCap.toDouble())
                        val brokenRate = declarableRateFor(input.teleworkDays + brokenCredited, result.totalWorkDays)

                        brokenRate shouldBeLessThanOrEqual CEILING_PERCENT
                    }
                }
            }
        }
    }

    context("invariant 3 - credited missions respect both limits") {
        test(
            "creditedMissionDays <= missionCap AND <= fiscalCeilingDays - teleworkDays, " +
                "over $PROPERTY_RUNS cases",
        ) {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                result.creditedMissionDays shouldBeLessThanOrEqual result.missionCap.toDouble()

                if (result.regimeApplies) {
                    result.creditedMissionDays shouldBeLessThanOrEqual (result.fiscalCeilingDays - input.teleworkDays)
                }
            }
        }

        test("is falsified by a budget that ignores the headroom") {
            // budget = missionCap, dropping the min() with headroom. This
            // is the mistake that would make Geneva case d credit 10 days
            // instead of 2.
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)

                    if (result.regimeApplies) {
                        val brokenCredited = minOf(missionTotal(input), result.missionCap.toDouble())

                        brokenCredited shouldBeLessThanOrEqual (result.fiscalCeilingDays - input.teleworkDays)
                    }
                }
            }
        }
    }

    context("invariant 4 - there is always at least as much social room as fiscal") {
        test("remainingToSocial >= remainingToFiscal, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                result.remainingToSocial shouldBeGreaterThanOrEqual result.remainingToFiscal
            }
        }

        test("holds for negative headroom too, which is where clamping would break it") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                if (result.remainingToFiscal < 0) {
                    result.remainingToSocial shouldBeGreaterThanOrEqual result.remainingToFiscal
                }
            }
        }

        test("is falsified by swapping the two ceilings") {
            // The copy-paste mistake: measuring social room against the
            // fiscal ceiling and vice versa.
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)
                    val counted = countedDays(input, result)

                    val brokenSocial =
                        floorToHalfDay(result.totalWorkDays * PROPERTY_RULES.fiscalCeiling - counted)
                    val brokenFiscal =
                        floorToHalfDay(result.totalWorkDays * PROPERTY_RULES.socialCeiling - counted)

                    brokenSocial shouldBeGreaterThanOrEqual brokenFiscal
                }
            }
        }
    }

    context("the generator itself") {
        test("produces only inputs the engine accepts") {
            checkAll(BLOCKING, validInputArb) { input ->
                (calculateTelework(input) is CalcResult.Ok) shouldBe true
            }
        }

        test("reaches every granularity, both denominator methods and both regimes") {
            val seenGranularity = mutableSetOf<Granularity>()
            val seenDenominator = mutableSetOf<String>()
            val seenRegimeApplies = mutableSetOf<Boolean>()
            var partTime = false
            var midYear = false
            var fallbackYear = false

            checkAll(PropTestConfig(seed = PROPERTY_SEED, iterations = 2_000), validInputArb) { input ->
                seenGranularity.add(input.granularity)
                seenDenominator.add(
                    when (input.denominator) {
                        is DenominatorMethod.Exact -> "exact"
                        is DenominatorMethod.Simplified240 -> "simplified240"
                    },
                )
                seenRegimeApplies.add(resultOf(input).regimeApplies)
                if (input.employmentRate < 100) partTime = true
                if (input.periodFraction < 1) midYear = true
                if (input.taxYear != 2026) fallbackYear = true
            }

            // A property suite that never reaches the interesting region
            // proves nothing, so the reach of the generator is itself
            // asserted. AC1 names part-time, mid-year, the exact method
            // and all three granularities.
            seenGranularity shouldBe setOf(Granularity.DAY, Granularity.HALF_DAY, Granularity.HOURS)
            seenDenominator shouldBe setOf("exact", "simplified240")
            seenRegimeApplies shouldBe setOf(false, true)
            partTime shouldBe true
            midYear shouldBe true
            fallbackYear shouldBe true
        }
    }
})
