// web/tests/unit/calc-engine/denominator.test.ts
//
// SPEC section 7.2 step 2. The employer chooses the method and must apply it
// uniformly; the engine mirrors it and never invents one.
//
//   simplified240: totalWorkDays = ceil(240 * employmentRate/100 * periodFraction)
//   exact:         totalWorkDays = suppliedByUser   // validated, not derived

import { describe, expect, it } from 'vitest';
import { resolveDenominator } from '@/lib/calc-engine/denominator';
import { ruleSetFor } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);
const simplified = (rate: number, fraction: number) =>
  resolveDenominator({ kind: 'simplified240' }, rate, fraction, RULES);

describe('resolveDenominator, simplified240 (SPEC 7.2 step 2)', () => {
  it.each([
    [1, 1, 3], // ceil(2.4)
    [50, 1, 120],
    [80, 1, 192],
    [100, 1, 240],
  ])('employmentRate %i over a full year gives %i days', (rate, fraction, expected) => {
    expect(simplified(rate, fraction).totalWorkDays).toBe(expected);
  });

  it.each([
    [100, 0.5, 120],
    [80, 0.5, 96],
    [1, 0.5, 2], // ceil(1.2)
    [100, 7 / 12, 140], // a June start
    [50, 7 / 12, 70],
  ])('employmentRate %i over periodFraction %f gives %i days', (rate, fraction, expected) => {
    expect(simplified(rate, fraction).totalWorkDays).toBe(expected);
  });

  it('rounds a fractional basis up, never down', () => {
    // 240 * 0.01 = 2.4 -> 3. The basis absorbs leave and holidays, so a
    // partial day of entitlement is still a working day of denominator.
    expect(simplified(1, 1).totalWorkDays).toBe(3);
    expect(simplified(3, 1).totalWorkDays).toBe(8); // 7.2 -> 8
  });

  it('does not lose a day to binary floating point', () => {
    // Regression. 240 * 45/100 * 7/12 is exactly 63, but evaluated naively in
    // IEEE 754 it is 63.000000000000007, which ceils to 64. A one-day error
    // in the denominator moves the declarable rate, which is the number filed
    // with the AFC. Three such cases exist across rate 1-100 crossed with the
    // common period fractions: rates 45, 85 and 90 at 7/12.
    expect(simplified(45, 7 / 12).totalWorkDays).toBe(63);
    expect(simplified(85, 7 / 12).totalWorkDays).toBe(119);
    expect(simplified(90, 7 / 12).totalWorkDays).toBe(126);
  });

  it('emits no warning: the simplified basis is the sourced default', () => {
    expect(simplified(100, 1).warnings).toEqual([]);
  });
});

describe('resolveDenominator, exact (SPEC 7.2 step 2)', () => {
  it('returns the supplied total unchanged', () => {
    const outcome = resolveDenominator({ kind: 'exact', totalWorkDays: 217 }, 100, 1, RULES);

    expect(outcome.totalWorkDays).toBe(217);
  });

  it('ignores employmentRate and periodFraction entirely', () => {
    // "validated, not derived" - the engine must not second-guess a total the
    // employer supplied, even one that looks inconsistent with the rate.
    const outcome = resolveDenominator({ kind: 'exact', totalWorkDays: 217 }, 50, 0.5, RULES);

    expect(outcome.totalWorkDays).toBe(217);
  });

  it('surfaces EXACT_METHOD_UNVERIFIED', () => {
    // SPEC section 20: "emit EXACT_METHOD_UNVERIFIED for user-supplied
    // denominators". The engine cannot verify a number it did not derive.
    const outcome = resolveDenominator({ kind: 'exact', totalWorkDays: 217 }, 100, 1, RULES);

    expect(outcome.warnings).toEqual([{ code: 'EXACT_METHOD_UNVERIFIED' }]);
  });

  it('passes a non-positive supplied total through for validation to reject', () => {
    // resolveDenominator mirrors; it does not judge. TOTAL_WORK_DAYS_NOT_POSITIVE
    // is validate.ts's, and no division happens before that check.
    expect(resolveDenominator({ kind: 'exact', totalWorkDays: 0 }, 100, 1, RULES).totalWorkDays).toBe(0);
    expect(resolveDenominator({ kind: 'exact', totalWorkDays: -5 }, 100, 1, RULES).totalWorkDays).toBe(-5);
  });
});
