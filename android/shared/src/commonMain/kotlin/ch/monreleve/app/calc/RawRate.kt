package ch.monreleve.app.calc

import kotlin.math.ceil

// AN2 increment 4: ports web/lib/calc-engine/raw-rate.ts.
//
// ONE ROUNDING RULE LIVES IN THIS FILE AND NOTHING ELSE DOES.
//
// SPEC 7.3 and 7.4: rawRate rounds UP to 1 decimal, and is returned
// alongside declarableRate because the two legitimately differ. Geneva case
// (c): 45.0% of days were spent outside Switzerland, 39.16% is declarable.
// Showing only one of those would mislead.
//
// It is a separate file from DeclarableRate.kt on purpose (SPEC 7.3): the
// rules conflict by design and must not be accidentally unified.

/** Tenths of a percent: 1 decimal place. Exponential notation per ruling R17. */
private const val TENTHS_OF_A_PERCENT = 1e3

/** Ten tenths to the unit. */
private const val TENTHS_PER_UNIT = 1e1

/**
 * The share of working days spent outside Switzerland, as a percentage,
 * rounded UP to 1 decimal.
 *
 * round up - display value, never understate the exposure
 *
 * Integer arithmetic on the numerator and denominator, for the same reason
 * DeclarableRate.kt does it: an exact tenth that floats a hair above would
 * gain 0.1 from the ceiling. See that file for the measurement.
 *
 * The caller guarantees totalWorkDays > 0.
 */
fun rawRateFor(
    daysOutsideSwitzerland: Double,
    totalWorkDays: Int,
): Double {
    val tenths = ceil((daysOutsideSwitzerland * TENTHS_OF_A_PERCENT) / totalWorkDays)

    return tenths / TENTHS_PER_UNIT
}
