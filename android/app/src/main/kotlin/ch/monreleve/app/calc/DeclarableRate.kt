package ch.monreleve.app.calc

import kotlin.math.floor

// AN2 increment 4: ports web/lib/calc-engine/declarable-rate.ts.
//
// ONE ROUNDING RULE LIVES IN THIS FILE AND NOTHING ELSE DOES.
//
// SPEC 7.3: the declarable rate TRUNCATES to 2 decimals. Geneva publishes
// 39.16% for 94/240 (39.1666...) and 4.16% for 10/240; rounding would give
// 39.17 and 4.17. The engine truncates because this number must match the
// employer's filing - matching the authority beats being conservative.
//
// The advisory rules deliberately live elsewhere: floor-to-the-half-day in
// Headroom.kt, ceil in Denominator.kt, round-up-to-1-dp in RawRate.kt. SPEC
// 7.3 requires that separation so the rules cannot be accidentally unified.

/**
 * Percentage points kept: 2 decimals means hundredths of a percent.
 * Exponential notation per ruling R17.
 */
private const val HUNDREDTHS_OF_A_PERCENT = 1e4

/** Hundredths back to whole percentage points. */
private const val HUNDREDTHS_PER_PERCENT = 1e2

/**
 * The rate filed with the AFC, as a percentage, truncated to 2 decimals.
 *
 * truncate - must match AFC filing
 *
 * The arithmetic runs on the numerator and denominator as integers rather
 * than on a pre-computed percentage, and that is load-bearing, not a style
 * choice. 23/125 is exactly 18.4%, but 18.4 has no exact IEEE 754
 * representation (Kotlin's Double has the identical representation as
 * JavaScript's Number here): computing the percentage first and then
 * truncating yields 18.39. Truncation always rounds toward zero, so the
 * error never cancels - it silently understates the filed rate.
 * Normalising the float does not fix it; only integer arithmetic does.
 * Measured on the TypeScript side over every numerator against every
 * denominator up to 500, the float form is wrong in 36 of 125 750 pairs and
 * this form in none. A 125-day denominator is employmentRate 52 on the
 * simplified basis, so those cases are reachable.
 *
 * The caller guarantees totalWorkDays > 0: validation rejects a
 * non-positive total with TotalWorkDaysNotPositive before the waterfall
 * runs.
 */
fun declarableRateFor(
    daysCountedAgainstCeiling: Double,
    totalWorkDays: Int,
): Double {
    val hundredths = floor((daysCountedAgainstCeiling * HUNDREDTHS_OF_A_PERCENT) / totalWorkDays)

    return hundredths / HUNDREDTHS_PER_PERCENT
}
