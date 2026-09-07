// web/lib/calc-engine/validate.ts
//
// Invalid input is the expected output of a form (SPEC section 7), so this
// returns a list of errors and never throws. It returns EVERY applicable
// error rather than the first, because a form should show all its problems at
// once. Each ValidationError code maps one-to-one onto a message in lib/fr
// (SPEC section 7.4).

import { resolveDenominator } from './denominator';
import type { RuleSet, TeleworkInput, ValidationError } from './types';

/** The day-count fields, which share the negative and granularity checks. */
const DAY_FIELDS = ['teleworkDays', 'missionDaysFrance', 'missionDaysThirdState'] as const;

const MIN_EMPLOYMENT_RATE = 1;
const MAX_EMPLOYMENT_RATE = 100;

/** A value is a legal count under the granularity if it lands on its step. */
function isOnGranularityStep(value: number, step: number): boolean {
  const quotient = value / step;

  return Number.isFinite(quotient) && Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

export function validateInput(
  input: TeleworkInput,
  rules: RuleSet,
): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  const { employmentRate, periodFraction, granularity } = input;

  if (
    !Number.isFinite(employmentRate) ||
    employmentRate < MIN_EMPLOYMENT_RATE ||
    employmentRate > MAX_EMPLOYMENT_RATE
  ) {
    errors.push({ code: 'RATE_OUT_OF_RANGE' });
  }

  if (!Number.isFinite(periodFraction) || periodFraction <= 0 || periodFraction > 1) {
    errors.push({ code: 'PERIOD_OUT_OF_RANGE' });
  }

  for (const field of DAY_FIELDS) {
    const value = input[field];

    if (!Number.isFinite(value) || value < 0) {
      errors.push({ code: 'NEGATIVE_DAYS', field });
      continue;
    }

    // 'day' counts whole days; 'halfDay' counts halves; 'hours' was already
    // converted by classifyTeleworkHours and may be any non-negative number.
    if (granularity === 'day' && !isOnGranularityStep(value, 1)) {
      errors.push({ code: 'GRANULARITY_MISMATCH', field });
    } else if (granularity === 'halfDay' && !isOnGranularityStep(value, 0.5)) {
      errors.push({ code: 'GRANULARITY_MISMATCH', field });
    }
  }

  if (input.denominator.kind === 'exact') {
    const supplied = input.denominator.totalWorkDays;

    if (!Number.isFinite(supplied) || supplied < 0) {
      errors.push({ code: 'NEGATIVE_DAYS', field: 'denominator' });
    }
  }

  // The denominator is resolved, never divided by, so this is safe even when
  // the rate or the period is already invalid.
  const { totalWorkDays } = resolveDenominator(
    input.denominator,
    employmentRate,
    periodFraction,
    rules,
  );

  if (!Number.isFinite(totalWorkDays) || totalWorkDays <= 0) {
    errors.push({ code: 'TOTAL_WORK_DAYS_NOT_POSITIVE' });

    // DAYS_EXCEED_TOTAL is deliberately not also reported: comparing against
    // a non-positive total is meaningless, and a form would be shown two
    // contradictory messages about the same field.
    return errors;
  }

  const claimed =
    input.teleworkDays + input.missionDaysFrance + input.missionDaysThirdState;

  if (Number.isFinite(claimed) && claimed > totalWorkDays) {
    errors.push({ code: 'DAYS_EXCEED_TOTAL' });
  }

  return errors;
}
