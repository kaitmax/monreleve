// web/lib/calc-engine/allowed-days.ts
//
// SPEC section 7.4. "How much room is there?", answerable before the user has
// entered a single day, so the calculator can show the allowance up front.
//
// atFiscal and atSocial are the ceilings themselves, in days, unrounded:
// SPEC 7.2 step 5 defines fiscalCeiling as totalWorkDays * 0.40 with no
// rounding, and the floor-to-the-half-day rule of SPEC 7.3 governs HEADROOM
// (step 6), which is a different quantity and belongs to FW4.
//
// missionCap rounds UP - SPEC 7.2 step 4, the one rule that favours the user
// (amicable agreement of 30 June 2023).

import { ceilProrated, resolveDenominator } from './denominator';
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
      atFiscal: totalWorkDays * rules.fiscalCeiling,
      atSocial: totalWorkDays * rules.socialCeiling,
      // ceil - favours the user (SPEC 7.2 step 4)
      missionCap: ceilProrated(rules.missionCapDays, input.employmentRate, input.periodFraction),
    },
  };
}
