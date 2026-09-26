package ch.monreleve.app.calc

// AN2 increment 5. Generators for the property suites, matching
// web/tests/unit/calc-engine/arbitraries.ts's own design exactly - not a
// test file, no assertions here.
//
// The design goal is that a generated input is VALID BY CONSTRUCTION,
// because calculateTelework returns errors for invalid input and an
// invariant about the result cannot be asserted on an error. Building valid
// inputs directly beats generating freely and discarding, which would spend
// most of the 10 000 runs on inputs the engine refuses.
//
// AC3 requires the generators to cover part-time, mid-year periods, the
// exact method and all three granularities. Each is a dimension below.

import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.constant
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.map
import io.kotest.property.arbitrary.of
import kotlin.math.floor

val PROPERTY_RULES: RuleSet = ruleSetFor(2026)

private val ALL_CANTONS = Canton.entries

/**
 * The smallest day increment a granularity permits. Every value is a binary
 * fraction, so the arithmetic below is exact and a generated input can
 * never fail DaysExceedTotal through representation error alone.
 *
 * HOURS uses a quarter day rather than a tenth for that reason: 0.1 is not
 * representable, and a sum of tenths can exceed the total by 1e-13 and be
 * rejected for a reason that has nothing to do with the property under
 * test.
 */
fun stepFor(granularity: Granularity): Double =
    when (granularity) {
        Granularity.DAY -> 1.0
        Granularity.HALF_DAY -> 0.5
        Granularity.HOURS -> 0.25
    }

/** Splits a whole number of steps into three parts that cannot exceed it. */
fun splitSteps(
    maxSteps: Int,
    weights: Triple<Int, Int, Int>,
): Triple<Int, Int, Int> {
    val bounded =
        Triple(
            weights.first % (maxSteps + 1),
            weights.second % (maxSteps + 1),
            weights.third % (maxSteps + 1),
        )
    val sum = bounded.first + bounded.second + bounded.third

    if (sum <= maxSteps) return bounded

    // Scale down and floor: the sum of floors of a partition can only
    // shrink.
    return Triple(
        floor((bounded.first.toDouble() * maxSteps) / sum).toInt(),
        floor((bounded.second.toDouble() * maxSteps) / sum).toInt(),
        floor((bounded.third.toDouble() * maxSteps) / sum).toInt(),
    )
}

private data class Seed(
    val canton: Canton,
    val granularity: Granularity,
    val employmentRate: Int,
    val periodMonths: Int,
    val useExactMethod: Boolean,
    val exactTotal: Int,
    val taxYear: Int,
    val weights: Triple<Int, Int, Int>,
)

/** An employer-supplied total, including the 125-multiples that expose the rate float defect. */
private val exactTotalArb: Arb<Int> =
    Arb.choice(
        Arb.int(1..400),
        Arb.constant(125),
        Arb.constant(250),
        Arb.constant(375),
        Arb.constant(500),
    )

/**
 * Built from two 4-argument binds rather than one 8-argument bind: Kotest's
 * Arb.bind overloads do not extend to eight parameters, found by a failed
 * compile rather than assumed from the TypeScript side's single fc.record
 * call.
 */
private val seedGroupAArb: Arb<Seed> =
    Arb.bind(
        Arb.of(ALL_CANTONS),
        Arb.of(Granularity.entries),
        // Part-time across the whole legal range, 1% to 100%.
        Arb.int(1..100),
        // Mid-year starts as twelfths, which is how a real period arrives,
        // plus the full year at 12/12.
        Arb.int(1..12),
    ) { canton, granularity, employmentRate, periodMonths ->
        Seed(canton, granularity, employmentRate, periodMonths, false, 0, 2026, Triple(0, 0, 0))
    }

private val seedGroupBArb: Arb<Triple<Boolean, Int, Int>> =
    Arb.bind(
        Arb.boolean(),
        exactTotalArb,
        // Both a known rule set and an unknown one, so the fallback path
        // is exercised too (ruling R11).
        Arb.of(2026, 2027),
    ) { useExactMethod, exactTotal, taxYear -> Triple(useExactMethod, exactTotal, taxYear) }

private val weightsArb: Arb<Triple<Int, Int, Int>> =
    Arb.bind(Arb.int(0..2000), Arb.int(0..2000), Arb.int(0..2000)) { a, b, c -> Triple(a, b, c) }

val validInputArb: Arb<TeleworkInput> =
    Arb.bind(seedGroupAArb, seedGroupBArb, weightsArb) { groupA, groupB, weights ->
        groupA.copy(
            useExactMethod = groupB.first,
            exactTotal = groupB.second,
            taxYear = groupB.third,
            weights = weights,
        )
    }.map { seed ->
        val periodFraction = seed.periodMonths / 12.0
        val denominator =
            if (seed.useExactMethod) {
                DenominatorMethod.Exact(seed.exactTotal)
            } else {
                DenominatorMethod.Simplified240
            }

        val totalWorkDays =
            resolveDenominator(denominator, seed.employmentRate, periodFraction, PROPERTY_RULES).totalWorkDays

        val step = stepFor(seed.granularity)
        val maxSteps = floor(totalWorkDays / step).toInt()
        val (telework, france, thirdState) = splitSteps(maxSteps, seed.weights)

        TeleworkInput(
            taxYear = seed.taxYear,
            canton = seed.canton,
            employmentRate = seed.employmentRate,
            periodFraction = periodFraction,
            denominator = denominator,
            granularity = seed.granularity,
            teleworkDays = telework * step,
            missionDaysFrance = france * step,
            missionDaysThirdState = thirdState * step,
        )
    }

/**
 * The blocking path: 10 000 cases at a FIXED seed (ruling R24), matching
 * the TS side's own reproducibility argument - a rotating seed on a
 * blocking check goes red on a case nobody can reproduce, training people
 * to re-run rather than read.
 */
const val PROPERTY_RUNS = 10_000
const val PROPERTY_SEED = 20260907L

/**
 * Fewer runs, for the deliberately-broken variants that must be falsified.
 * Running a known-broken variant 10 000 times proves nothing the first
 * failure did not.
 */
const val FALSIFY_RUNS = 2_000
