@file:OptIn(io.kotest.common.ExperimentalKotest::class)

package ch.monreleve.app.calc

// PropTestConfig's iterations parameter is marked experimental in Kotest
// 5.9.1; the opt-in above is for that constructor, not for anything this
// file does itself.
//
// AN2 increment 5. Matches
// web/tests/unit/calc-engine/properties-5-8.test.ts's own cases exactly -
// SPEC 7.6 invariants 5 to 8, over PROPERTY_RUNS generated cases each, each
// paired with a deliberately broken variant that Kotest must falsify.
//
// Invariant 7 is the one that ruling R16 makes provable: truncation can
// only ever be checked against the exact unrounded value if the exact
// value is computed on integers. Comparing two floats would be comparing
// the defect against itself.

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.PropTestConfig
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlin.math.round

private fun resultOf(input: TeleworkInput): TeleworkResult {
    val result = calculateTelework(input)

    return when (result) {
        is CalcResult.Ok -> result.value
        is CalcResult.Err -> error("generator produced invalid input: ${result.error}")
    }
}

private fun missionTotal(input: TeleworkInput): Double = input.missionDaysFrance + input.missionDaysThirdState

private fun countedDays(
    input: TeleworkInput,
    result: TeleworkResult,
): Double = if (result.regimeApplies) input.teleworkDays + result.creditedMissionDays else input.teleworkDays

private val BLOCKING = PropTestConfig(seed = PROPERTY_SEED, iterations = PROPERTY_RUNS)
private val FALSIFY = PropTestConfig(seed = PROPERTY_SEED, iterations = FALSIFY_RUNS)

private suspend fun expectFalsified(block: suspend () -> Unit) {
    shouldThrow<Throwable> { block() }
}

/** budget - raw France input instead of the credited amount (the invariant 8 break). */
private fun brokenCredit(
    france: Double,
    thirdState: Double,
    budget: Double,
): Double {
    val creditedFrance = minOf(france, budget)

    return creditedFrance + minOf(thirdState, budget - france)
}

class Properties5To8Test : FunSpec({
    context("invariant 5 - rawRate is monotonic in teleworkDays") {
        test("increasing teleworkDays never decreases rawRate, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb, Arb.int(0..40)) { input, bumpSteps ->
                val step = stepFor(input.granularity)
                val bumped = input.copy(teleworkDays = input.teleworkDays + bumpSteps * step)

                // Only compare where the bumped input is still valid: a
                // bump past the total is rejected for a different reason
                // and says nothing about monotonicity.
                val after = calculateTelework(bumped)

                if (after is CalcResult.Ok) {
                    after.value.rawRate shouldBeGreaterThanOrEqual resultOf(input).rawRate
                }
            }
        }

        test("is falsified by a rawRate built from Swiss-taxed days instead of days outside") {
            // The inversion mistake. As telework rises the headroom
            // shrinks, so fewer mission days are credited, so
            // swissTaxedDays FALLS - and a rate built on it falls with it.
            expectFalsified {
                checkAll(FALSIFY, validInputArb, Arb.int(0..40)) { input, bumpSteps ->
                    val step = stepFor(input.granularity)
                    val bumped = input.copy(teleworkDays = input.teleworkDays + bumpSteps * step)

                    val after = calculateTelework(bumped)

                    if (after is CalcResult.Ok) {
                        val before = resultOf(input)
                        val brokenBefore = rawRateFor(before.swissTaxedDays, before.totalWorkDays)
                        val brokenAfter = rawRateFor(after.value.swissTaxedDays, after.value.totalWorkDays)

                        brokenAfter shouldBeGreaterThanOrEqual brokenBefore
                    }
                }
            }
        }
    }

    context("invariant 6 - the declarable rate never exceeds the raw rate") {
        test("declarableRate <= rawRate, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                result.declarableRate shouldBeLessThanOrEqual result.rawRate
            }
        }

        test("is falsified by a rawRate that forgets the mission days") {
            // rawRate is the share of days spent OUTSIDE Switzerland, so it
            // must include missions. Omitting them makes it smaller than
            // the declarable rate whenever any mission day is credited.
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)
                    val brokenRaw = rawRateFor(input.teleworkDays, result.totalWorkDays)

                    result.declarableRate shouldBeLessThanOrEqual brokenRaw
                }
            }
        }
    }

    context("invariant 7 - truncation never overstates") {
        // Tolerance for one float multiplication only. declarableRate is
        // exact by construction (ruling R16), but recovering its
        // hundredths as rate * 1e2 reintroduces representation error -
        // 18.4 * 1e2 is 1840.0000000000002. The tolerance covers that step
        // and nothing else; it is far below the 1-hundredth granularity
        // being asserted.
        val epsilon = 1e-9

        test("declarableRate is never above the exact unrounded value, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)
                val counted = countedDays(input, result)

                // The exact value in hundredths of a percent, on integers.
                val exactHundredths = (counted * 1e4) / result.totalWorkDays

                (result.declarableRate * 1e2) shouldBeLessThanOrEqual (exactHundredths + epsilon)
            }
        }

        test("loses less than one hundredth, so it truncates rather than discards") {
            // The other side of the same rule: a "truncation" that threw
            // away more than the last digit would also satisfy "never
            // above".
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)
                val counted = countedDays(input, result)
                val exactHundredths = (counted * 1e4) / result.totalWorkDays

                (exactHundredths - result.declarableRate * 1e2) shouldBeLessThan (1 + epsilon)
            }
        }

        test("is falsified by rounding to nearest instead of truncating") {
            // 39.1666... rounds to 39.17, which is above the exact value.
            // This is the whole reason SPEC 7.3 specifies truncation.
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)
                    val counted = countedDays(input, result)
                    val exactHundredths = (counted * 1e4) / result.totalWorkDays
                    val rounded = round(exactHundredths)

                    rounded shouldBeLessThanOrEqual (exactHundredths + epsilon)
                }
            }
        }
    }

    context("invariant 8 - swapping the mission split never increases the credit") {
        test("swapping France and third-state never increases creditedMissionDays, over $PROPERTY_RUNS cases") {
            checkAll(BLOCKING, validInputArb) { input ->
                val swapped =
                    input.copy(
                        missionDaysFrance = input.missionDaysThirdState,
                        missionDaysThirdState = input.missionDaysFrance,
                    )

                resultOf(swapped).creditedMissionDays shouldBeLessThanOrEqual resultOf(input).creditedMissionDays
            }
        }

        test("in fact leaves it identical, because the credit is min(total, budget)") {
            // Stronger than the spec asks, and worth pinning: the
            // France-before-third-state order changes WHICH days are
            // credited, never HOW MANY. What the order decides is who
            // collects the tax on the uncredited ones.
            checkAll(BLOCKING, validInputArb) { input ->
                val swapped =
                    input.copy(
                        missionDaysFrance = input.missionDaysThirdState,
                        missionDaysThirdState = input.missionDaysFrance,
                    )

                resultOf(swapped).creditedMissionDays shouldBe resultOf(input).creditedMissionDays
            }
        }

        test("is falsified by imputing against the raw France input instead of the credited amount") {
            expectFalsified {
                checkAll(FALSIFY, validInputArb) { input ->
                    val result = resultOf(input)

                    if (result.regimeApplies) {
                        val budget = minOf(result.missionCap.toDouble(), result.fiscalCeilingDays - input.teleworkDays)

                        val straight = brokenCredit(input.missionDaysFrance, input.missionDaysThirdState, budget)
                        val swapped = brokenCredit(input.missionDaysThirdState, input.missionDaysFrance, budget)

                        swapped shouldBeLessThanOrEqual straight
                    }
                }
            }
        }

        test("never credits more than the mission days actually taken") {
            checkAll(BLOCKING, validInputArb) { input ->
                resultOf(input).creditedMissionDays shouldBeLessThanOrEqual missionTotal(input)
            }
        }
    }

    context("the two rate rules stay separated") {
        test("disagree on at least some generated input, or one of them is dead code") {
            var disagreements = 0

            checkAll(PropTestConfig(seed = PROPERTY_SEED, iterations = 2_000), validInputArb) { input ->
                val result = resultOf(input)
                if (result.declarableRate != result.rawRate) disagreements += 1
            }

            (disagreements > 0) shouldBe true
        }

        test("agree exactly when no mission day is uncredited") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                if (missionTotal(input) == result.creditedMissionDays) {
                    // Same numerator, different rounding: truncation to 2
                    // dp against round-up to 1 dp. They can still differ,
                    // and that is correct - but the declarable one can
                    // never be the larger.
                    result.declarableRate shouldBeLessThanOrEqual result.rawRate
                }
            }
        }
    }

    context("declarableRateFor and rawRateFor in isolation") {
        test("agree with the wired result for the same numerator") {
            checkAll(BLOCKING, validInputArb) { input ->
                val result = resultOf(input)

                declarableRateFor(countedDays(input, result), result.totalWorkDays) shouldBe result.declarableRate
                rawRateFor(
                    input.teleworkDays + missionTotal(input),
                    result.totalWorkDays,
                ) shouldBe result.rawRate
            }
        }
    }
})
