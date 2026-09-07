// web/tests/unit/calc-engine/boundaries.test.ts
//
// SPEC 7.6 names the boundaries that must be tested: "boundaries at exactly
// 40.0% and 49.9%". Both are strict comparisons in the spec, so both sides of
// each are asserted here - landing exactly on a ceiling is not crossing it.
//
// Also here: the mission cap's round-up at the four employment rates SPEC 7.6
// lists, and a part-time mid-year start, which is the only case where the
// proration, the cap and the ceiling all bind at once.

import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import type { TeleworkInput } from '@/lib/calc-engine';

const BASE: TeleworkInput = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'day',
  teleworkDays: 0,
  missionDaysFrance: 0,
  missionDaysThirdState: 0,
};

const run = (patch: Partial<TeleworkInput>) => calculateTelework({ ...BASE, ...patch });
const value = (patch: Partial<TeleworkInput>) => {
  const result = run(patch);
  if (!result.ok) throw new Error(`expected a result, got ${JSON.stringify(result.error)}`);
  return result.value;
};
const codes = (patch: Partial<TeleworkInput>) =>
  value(patch).warnings.map((warning) => warning.code);

describe('the fiscal ceiling, exactly 40.0 %', () => {
  it('keeps the regime at exactly 96 of 240 days', () => {
    // The spec's test is "teleworkDays > fiscalCeiling", strictly greater.
    const result = value({ teleworkDays: 96 });

    expect(result.declarableRate).toBe(40);
    expect(result.regimeApplies).toBe(true);
    expect(result.remainingToFiscal).toBe(0);
    expect(codes({ teleworkDays: 96 })).not.toContain('FISCAL_CEILING_EXCEEDED');
  });

  it('loses the regime one day above', () => {
    const result = value({ teleworkDays: 97 });

    expect(result.regimeApplies).toBe(false);
    expect(result.declarableRate).toBe(40.41); // 97/240 = 40.4166... truncated
    expect(result.remainingToFiscal).toBe(-1);
    expect(codes({ teleworkDays: 97 })).toContain('FISCAL_CEILING_EXCEEDED');
  });

  it('is comfortably inside one day below', () => {
    const result = value({ teleworkDays: 95 });

    expect(result.declarableRate).toBe(39.58); // 39.5833... truncated
    expect(result.regimeApplies).toBe(true);
    expect(result.remainingToFiscal).toBe(1);
  });
});

describe('the social ceiling, exactly 49.9 %', () => {
  // 49.9 % of 240 is 119.76, not a whole day, so an exact-denominator input
  // is the only way to land precisely on the threshold.
  const exact = (teleworkDays: number): Partial<TeleworkInput> => ({
    denominator: { kind: 'exact', totalWorkDays: 1000 },
    teleworkDays,
  });

  it('does not fire at exactly 49.9 %', () => {
    const result = value(exact(499));

    expect(result.declarableRate).toBe(49.9);
    expect(result.remainingToSocial).toBe(0);
    expect(codes(exact(499))).not.toContain('SOCIAL_CEILING_EXCEEDED');
  });

  it('fires one day above', () => {
    const result = value(exact(500));

    expect(result.declarableRate).toBe(50);
    expect(result.remainingToSocial).toBe(-1);
    expect(codes(exact(500))).toContain('SOCIAL_CEILING_EXCEEDED');
  });

  it('does not fire one day below', () => {
    expect(value(exact(498)).remainingToSocial).toBe(1);
    expect(codes(exact(498))).not.toContain('SOCIAL_CEILING_EXCEEDED');
  });
});

describe('the mission cap rounds UP at every employment rate', () => {
  it.each([
    [1, 1], // ceil(0.1)
    [50, 5],
    [80, 8],
    [100, 10],
  ])('employmentRate %i gives a cap of %i', (employmentRate, cap) => {
    // SPEC 7.2 step 4, the one rule that favours the user.
    expect(value({ employmentRate }).missionCap).toBe(cap);
  });

  it('rounds up on a fractional rate rather than truncating', () => {
    // 10 * 0.45 = 4.5. Truncating would give 4 and quietly cost the user a
    // mission day.
    expect(value({ employmentRate: 45 }).missionCap).toBe(5);
  });
});

describe('missions are excluded from the declared rate above the ceiling (AC3)', () => {
  it('counts telework only, while still taxing the missions in France', () => {
    const result = value({ teleworkDays: 144, missionDaysFrance: 5 });

    expect(result.declarableRate).toBe(60); // 144/240, not 149/240
    expect(result.creditedMissionDays).toBe(0);
    expect(result.frenchTaxedDays).toBe(149);
    // rawRate does count them, which is why both rates are returned.
    expect(result.rawRate).toBe(62.1); // 149/240 = 62.0833... rounded up
  });

  it('credits them the moment the regime survives', () => {
    // One telework day fewer and the same missions become creditable.
    const lost = value({ teleworkDays: 97, missionDaysFrance: 5 });
    const kept = value({ teleworkDays: 90, missionDaysFrance: 5 });

    expect(lost.creditedMissionDays).toBe(0);
    expect(kept.creditedMissionDays).toBe(5);
  });
});

describe('a part-time, mid-year start', () => {
  // employmentRate 45 over 7/12 of a year: the case where the proration, the
  // mission cap and the ceiling all bind at once, and the one that exposed
  // the float defect in FW3.
  const partTime: Partial<TeleworkInput> = {
    employmentRate: 45,
    periodFraction: 7 / 12,
    teleworkDays: 20,
    missionDaysFrance: 8,
  };

  it('prorates the denominator without losing a day to floating point', () => {
    expect(value(partTime).totalWorkDays).toBe(63); // not 64
  });

  it('prorates the ceiling and the cap together', () => {
    const result = value(partTime);

    expect(result.fiscalCeilingDays).toBeCloseTo(25.2, 10); // 63 * 0.40
    expect(result.missionCap).toBe(3); // ceil(10 * 0.45 * 7/12) = ceil(2.625)
  });

  it('lets the cap bind before the headroom', () => {
    const result = value(partTime);

    // Headroom is 5.2 days, the cap is 3, so 3 of the 8 mission days credit.
    expect(result.creditedMissionDays).toBe(3);
    expect(result.frenchTaxedDays).toBe(5);
    expect(result.swissTaxedDays).toBe(58); // 63 - 8 + 3
  });

  it('accounts for every day and truncates the rate', () => {
    const result = value(partTime);

    expect(result.swissTaxedDays + result.frenchTaxedDays).toBe(63);
    expect(result.declarableRate).toBe(36.5); // 23/63 = 36.5079... truncated
  });
});

describe('a residence-1983 canton breaching the ceiling', () => {
  it('warns that the status itself is at risk', () => {
    const warnings = codes({ canton: 'JU', teleworkDays: 144 });

    expect(warnings).toContain('FISCAL_CEILING_EXCEEDED');
    expect(warnings).toContain('FRONTALIER_STATUS_AT_RISK');
  });

  it('reports the regime on the fiscal warning', () => {
    const result = value({ canton: 'JU', teleworkDays: 144 });
    const fiscal = result.warnings.find((w) => w.code === 'FISCAL_CEILING_EXCEEDED');

    expect(fiscal && 'regime' in fiscal ? fiscal.regime : null).toBe('residence-1983');
    expect(result.regime).toBe('residence-1983');
  });
});
