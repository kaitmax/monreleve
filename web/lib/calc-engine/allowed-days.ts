// web/lib/calc-engine/allowed-days.ts
//
// SPEC section 7.4. "How much room is there?", answerable before the user has
// entered a single day, so the calculator can show the allowance up front.
//
// atFiscal and atSocial FLOOR to the half-day, per ruling R12. FW3 returned
// them unrounded, on the reading that SPEC 7.2 step 5 defines fiscalCeiling
// without rounding. R12 overrides that: this function answers "how many days
// may I take", so it is advisory and must never overstate, which is the same
// rule as headroom. 119.76 was wrong for atSocial at a 240-day denominator;
// 119.5 is right. The exact unrounded ceiling stays available as
// fiscalCeilingDays on TeleworkResult.
//
// missionCap still rounds UP - SPEC 7.2 step 4, the one rule that favours the
// user (amicable agreement of 30 June 2023).
//
// Three rounding behaviours therefore meet in this file's neighbourhood, and
// each names its own rule at its own site: floor-to-the-half-day here (via
// headroom.ts), ceil in denominator.ts, truncate in declarable-rate.ts.

import { ceilProrated, resolveDenominator } from './denominator';
import { floorToHalfDay } from './headroom';
import { ruleSetFor } from './rules';
import { validateInput } from './validate';
import type {
  AllowedTeleworkDays,
  Result,
  TeleworkInput,
  ValidationError,
} from './types';

export type AllowedTeleworkDaysInput = Omit<
  TeleworkInput,
  'teleworkDays' | 'missionDaysFrance' | 'missionDaysThirdState'
>;

export function allowedTeleworkDays(
  input: AllowedTeleworkDaysInput,
): Result<AllowedTeleworkDays, readonly ValidationError[]> {
  const rules = ruleSetFor(input.taxYear);

  // Validation is shared with calculateTelework rather than duplicated. The
  // day fields are zero here, which passes the negative, granularity and
  // total-exceeded checks, so only the rate, period and total errors can
  // surface - exactly the ones that apply to this question.
  const errors = validateInput(
    { ...input, teleworkDays: 0, missionDaysFrance: 0, missionDaysThirdState: 0 },
    rules,
  );

  if (errors.length > 0) return { ok: false, error: errors };

  const { totalWorkDays } = resolveDenominator(
    input.denominator,
    input.employmentRate,
    input.periodFraction,
    rules,
  );

  return {
    ok: true,
    value: {
      // floor to the half-day - advisory, never overstate (R12)
      atFiscal: floorToHalfDay(totalWorkDays * rules.fiscalCeiling),
      atSocial: floorToHalfDay(totalWorkDays * rules.socialCeiling),
      // ceil - favours the user (SPEC 7.2 step 4)
      missionCap: ceilProrated(rules.missionCapDays, input.employmentRate, input.periodFraction),
    },
  };
}
