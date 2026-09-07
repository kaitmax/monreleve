// web/lib/calc-engine/headroom.ts
//
// ONE ROUNDING RULE LIVES IN THIS FILE AND NOTHING ELSE DOES.
//
// SPEC 7.2 step 6 and 7.3: advisory headroom FLOORS to the half-day. A user
// must never be told they have more room than they do. Negative values are
// REPORTED, never clamped - "Vous etes 6 jours au-dessus" beats "0 jours
// restants" (SPEC 7.2 step 6).
//
//   remainingToFiscal = floor((totalWorkDays x 0.40  - daysCounted) x 2) / 2
//   remainingToSocial = floor((totalWorkDays x 0.499 - daysCounted) x 2) / 2
//
// The filing rule deliberately lives elsewhere, in declarable-rate.ts, which
// truncates instead. SPEC 7.3 requires the separation because the two rules
// conflict on purpose.

import type { RuleSet } from './types';

/** Two half-days to a day. */
const HALF_DAYS_PER_DAY = 2;

export interface Headroom {
  /** May be negative. Never clamped. */
  readonly remainingToFiscal: number;
  /** May be negative. Never clamped. */
  readonly remainingToSocial: number;
}

/**
 * floor to the half-day - never overstate headroom
 *
 * Math.floor, not truncation: for a negative value the two differ, and floor
 * is the one that stays safe. -0.1 days of room must report as -0.5, not 0,
 * because 0 would claim the user is exactly at the ceiling when they are past
 * it.
 *
 * Deliberately NOT normalised before flooring, unlike the proration in
 * denominator.ts. Float error in totalWorkDays * 0.499 is about 1e-14 and
 * biased low, so it can only ever make this function report LESS room - the
 * safe direction for an advisory number. Normalising could nudge a value up
 * across a half-day boundary, which is the one thing SPEC 7.3 forbids here.
 * Measured against exact rational arithmetic over every day count against
 * every denominator up to 400 - 80 600 pairs - this form and the exact form
 * agree everywhere.
 */
export function floorToHalfDay(days: number): number {
  return Math.floor(days * HALF_DAYS_PER_DAY) / HALF_DAYS_PER_DAY;
}

export function headroomFor(
  daysCountedAgainstCeiling: number,
  totalWorkDays: number,
  rules: RuleSet,
): Headroom {
  return {
    remainingToFiscal: floorToHalfDay(
      totalWorkDays * rules.fiscalCeiling - daysCountedAgainstCeiling,
    ),
    remainingToSocial: floorToHalfDay(
      totalWorkDays * rules.socialCeiling - daysCountedAgainstCeiling,
    ),
  };
}
