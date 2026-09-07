// web/tests/unit/calc-engine/allowed-days.test.ts
//
// SPEC section 7.4. allowedTeleworkDays answers "how much room is there?"
// without being told anything about days already taken, so the calculator can
// show the allowance before the user has entered a single day.
//
// atFiscal and atSocial FLOOR to the half-day (ruling R12): this function is
// advisory - it answers "how many days may I take" - so it must never
// overstate. FW3 returned them unrounded; R12 overrode that. The mission cap
// still rounds UP (SPEC 7.2 step 4).

import { describe, expect, it } from 'vitest';
import { allowedTeleworkDays } from '@/lib/calc-engine';
import type { TeleworkInput } from '@/lib/calc-engine';

type AllowedInput = Omit<
  TeleworkInput,
  'teleworkDays' | 'missionDaysFrance' | 'missionDaysThirdState'
>;

const BASE: AllowedInput = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'day',
};

const at = (patch: Partial<AllowedInput> = {}) => allowedTeleworkDays({ ...BASE, ...patch });

describe('allowedTeleworkDays (SPEC 7.4)', () => {
  it('gives the fiscal and social ceilings and the mission cap at full time', () => {
    const result = at();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.atFiscal).toBe(96); // 240 * 0.40, already a whole day
    // R12: floored to the half-day. 240 * 0.499 = 119.76 -> 119.5.
    expect(result.value.atSocial).toBe(119.5);
    expect(result.value.missionCap).toBe(10);
  });

  it.each([
    [1, 1], // ceil(0.1)
    [50, 5],
    [80, 8],
    [100, 10],
  ])('rounds the mission cap UP at employmentRate %i, giving %i', (employmentRate, cap) => {
    // SPEC 7.2 step 4: "rounded up, the one rule that favours the user".
    const result = at({ employmentRate });

    expect(result.ok && result.value.missionCap).toBe(cap);
  });

  it('rounds the mission cap up on a fractional part-time rate too', () => {
    // 10 * 45/100 = 4.5 -> 5, not 4.
    expect(at({ employmentRate: 45 }).ok && at({ employmentRate: 45 }).ok).toBe(true);

    const result = at({ employmentRate: 45 });
    expect(result.ok && result.value.missionCap).toBe(5);
  });

  it('prorates by period as well as rate', () => {
    const result = at({ employmentRate: 100, periodFraction: 0.5 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.atFiscal).toBe(48); // 120 * 0.40
    expect(result.value.missionCap).toBe(5); // ceil(10 * 1 * 0.5)
  });

  it('needs no telework or mission input to answer', () => {
    // The type already forbids them; this records the intent behind that.
    const result = at();

    expect(result.ok && Object.keys(result.value).sort()).toEqual([
      'atFiscal',
      'atSocial',
      'missionCap',
    ]);
  });

  it('honours an exact denominator', () => {
    const result = at({ denominator: { kind: 'exact', totalWorkDays: 200 } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.atFiscal).toBe(80); // 200 * 0.40
    // R12: 200 * 0.499 = 99.8 -> floored to 99.5.
    expect(result.value.atSocial).toBe(99.5);
  });

  it('always leaves more social room than fiscal room', () => {
    // Invariant 4 of SPEC 7.6, at the ceiling level: 49.9% > 40%.
    const result = at();

    expect(result.ok && result.value.atSocial > result.value.atFiscal).toBe(true);
  });

  it('returns validation errors rather than a result for a bad rate', () => {
    const result = at({ employmentRate: 0 });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.map((error) => error.code)).toContain('RATE_OUT_OF_RANGE');
  });

  it('returns TOTAL_WORK_DAYS_NOT_POSITIVE and never divides', () => {
    const result = at({ denominator: { kind: 'exact', totalWorkDays: 0 } });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.map((error) => error.code)).toContain(
      'TOTAL_WORK_DAYS_NOT_POSITIVE',
    );
  });

  it('never throws, whatever it is handed', () => {
    expect(() => at({ employmentRate: Number.NaN, periodFraction: Number.NaN })).not.toThrow();
  });
});
