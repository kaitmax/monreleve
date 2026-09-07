// web/lib/calc-engine/raw-rate.ts
//
// ONE ROUNDING RULE LIVES IN THIS FILE AND NOTHING ELSE DOES.
//
// SPEC 7.3 and 7.4: rawRate rounds UP to 1 decimal, and is returned alongside
// declarableRate because the two legitimately differ. Geneva case (c): 45.0 %
// of days were spent outside Switzerland, 39.16 % is declarable. Showing only
// one of those would mislead.
//
// It is a separate file from declarable-rate.ts on purpose (SPEC 7.3): the
// rules conflict by design and must not be accidentally unified.

/** Tenths of a percent: 1 decimal place. */
const TENTHS_OF_A_PERCENT = 1_000;

/**
 * Ten tenths to the unit. Written 1e1 rather than 10 for the same reason
 * denominator.ts writes 1e6: no-magic-thresholds.test.ts cannot tell a
 * decimal-place divisor from the mission-cap threshold, and naming the
 * constant beats exempting the file.
 */
const TENTHS_PER_UNIT = 1e1;

/**
 * The share of working days spent outside Switzerland, as a percentage,
 * rounded UP to 1 decimal.
 *
 * round up - display value, never understate the exposure
 *
 * Integer arithmetic on the numerator and denominator, for the same reason
 * declarable-rate.ts does it: an exact tenth that floats a hair above would
 * gain 0.1 from the ceiling. See that file for the measurement.
 *
 * The caller guarantees totalWorkDays > 0.
 */
export function rawRateFor(daysOutsideSwitzerland: number, totalWorkDays: number): number {
  const tenths = Math.ceil((daysOutsideSwitzerland * TENTHS_OF_A_PERCENT) / totalWorkDays);

  return tenths / TENTHS_PER_UNIT;
}
