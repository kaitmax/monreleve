// web/tests/unit/calc-engine/calculate-seam.test.ts
//
// calculateTelework is FW4's. This asserts the seam is deliberate rather than
// accidental: it exists, it validates, it does not throw, and it does not
// pretend to have computed anything.
//
// When FW4 lands the waterfall, the last test here fails, which is the point.
// A failing test is how the seam announces that it has been closed.

import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import type { TeleworkInput } from '@/lib/calc-engine';

const VALID: TeleworkInput = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'day',
  teleworkDays: 84,
  missionDaysFrance: 12,
  missionDaysThirdState: 12,
};

describe('calculateTelework - the FW4 seam', () => {
  it('is exported, so consumers can already type against it', () => {
    expect(calculateTelework).toBeTypeOf('function');
  });

  it('never throws, on valid or invalid input', () => {
    expect(() => calculateTelework(VALID)).not.toThrow();
    expect(() => calculateTelework({ ...VALID, employmentRate: 0 })).not.toThrow();
  });

  it('returns FW3 validation errors through the public API today', () => {
    const result = calculateTelework({ ...VALID, employmentRate: 0, periodFraction: 2 });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const codes = result.error.map((error) => error.code);
    expect(codes).toContain('RATE_OUT_OF_RANGE');
    expect(codes).toContain('PERIOD_OUT_OF_RANGE');
  });

  it('does not yet produce a result for valid input, and says so', () => {
    // ok:false with an empty error list means "your input is fine, and the
    // waterfall does not exist yet". FW4 replaces this with ok:true and a
    // TeleworkResult, at which point this test fails and is deleted.
    const result = calculateTelework(VALID);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toEqual([]);
  });
});
