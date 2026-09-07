// web/lib/calc-engine/denominator.ts
//
// SPEC section 7.2 step 2. The employer chooses the method and must apply it
// uniformly; the engine mirrors that choice and never invents one.
//
//   'simplified240': totalWorkDays = ceil(240 * employmentRate/100 * periodFraction)
//   'exact':         totalWorkDays = suppliedByUser   // validated, not derived
//
// Under simplified240 there is no calendar arithmetic and no holiday table:
// leave, holidays and sickness are absorbed into the 240 basis.
// Source: circular no. 45 of 12 June 2019, point 7.5.1.

import type { DenominatorMethod, RuleSet, Warning } from './types';

export interface DenominatorOutcome {
  readonly totalWorkDays: number;
  readonly warnings: readonly Warning[];
}

/**
 * The proration is normalised to six decimals before rounding up. Written as
 * 1e6 rather than 10 ** 6 deliberately: the bare 10 would otherwise trip
 * no-magic-thresholds.test.ts, which cannot tell the base of a power of ten
 * from the mission-cap threshold. Naming it here is clearer than exempting
 * the file.
 */
const NORMALISE_FACTOR = 1e6;

/**
 * Percent to fraction. Written 1e2 rather than 100 per ruling R17: powers of
 * ten are scaling factors and are written in exponential notation, which also
 * keeps them clear of the bare-threshold guard.
 */
const PERCENT = 1e2;

/** A rate of 100 %, used where a factor must be neutral. */
const FULL_RATE = 1e2;

/**
 * Prorates a basis in days by employment rate and period, rounding UP.
 *
 * ceil - the simplified basis and the mission cap both round up
 * (SPEC 7.2 steps 2 and 4); for the mission cap that is the one rule which
 * favours the user, per the amicable agreement of 30 June 2023.
 *
 * The normalisation before rounding is float hygiene, NOT a regulatory
 * rounding rule. Percentages and month fractions are not exactly
 * representable in IEEE 754, so a product that is mathematically an integer
 * can arrive as integer + 1e-14 and round up to the next whole day. Measured:
 * 240 * 45/100 * 7/12 is exactly 63, but evaluates to 63.000000000000007 and
 * ceils to 64. Rates 45, 85 and 90 at a 7/12 period are all affected. A
 * one-day error here moves the declarable rate, which is the number filed
 * with the AFC.
 *
 * Multiplying before dividing keeps the intermediate exact wherever it can be.
 */
export function ceilProrated(
  basisDays: number,
  employmentRate: number,
  periodFraction: number,
): number {
  const prorated = (basisDays * employmentRate * periodFraction) / PERCENT;

  return Math.ceil(Math.round(prorated * NORMALISE_FACTOR) / NORMALISE_FACTOR);
}

/**
 * The mission sub-cap, prorated and rounded UP (SPEC 7.2 step 4).
 *
 * ceil - favours the user (amicable agreement of 30 June 2023)
 *
 * PROVISIONAL (ruling R19) - an interpretation, not a source. It goes to the
 * reviewer at Checkpoint A and is listed in docs/regulatory-sources.md.
 *
 * Under 'simplified240' the cap prorates by BOTH employmentRate and
 * periodFraction, because the 240-day basis is a full-time figure that has not
 * yet been reduced.
 *
 * Under 'exact' it prorates by periodFraction ONLY. The employer's supplied
 * total is the actual number of days worked, so it already embodies the
 * working-time rate; prorating the cap by employmentRate as well would count
 * the same reduction twice and would quietly cost a part-timer mission days.
 * The period is a fact about the calendar rather than the rate, so it still
 * applies. EXACT_METHOD_UNVERIFIED already fires on this path.
 */
export function missionCapFor(
  method: DenominatorMethod,
  employmentRate: number,
  periodFraction: number,
  rules: RuleSet,
): number {
  const rateFactor = method.kind === 'exact' ? FULL_RATE : employmentRate;

  return ceilProrated(rules.missionCapDays, rateFactor, periodFraction);
}

/**
 * Resolves the denominator. Mirrors the employer's method; it does not judge
 * the result. A non-positive supplied total is passed through for validate.ts
 * to reject with TOTAL_WORK_DAYS_NOT_POSITIVE, and no division happens here.
 */
export function resolveDenominator(
  method: DenominatorMethod,
  employmentRate: number,
  periodFraction: number,
  rules: RuleSet,
): DenominatorOutcome {
  if (method.kind === 'exact') {
    return {
      totalWorkDays: method.totalWorkDays,
      // The engine cannot verify a number it did not derive (SPEC section 20).
      warnings: [{ code: 'EXACT_METHOD_UNVERIFIED' }],
    };
  }

  return {
    totalWorkDays: ceilProrated(rules.simplifiedBasisDays, employmentRate, periodFraction),
    warnings: [],
  };
}
