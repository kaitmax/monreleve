// web/tests/unit/calc-engine/validate.test.ts
//
// Invalid input is the expected output of a form (SPEC section 7), so
// validation returns a list and the engine never throws. It returns EVERY
// applicable error, not the first: a form shows all its problems at once.

import { describe, expect, it } from 'vitest';
import { validateInput } from '@/lib/calc-engine/validate';
import { ruleSetFor } from '@/lib/calc-engine';
import type { TeleworkInput } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);

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

const withInput = (patch: Partial<TeleworkInput>): TeleworkInput => ({ ...VALID, ...patch });
const codesFor = (patch: Partial<TeleworkInput>): string[] =>
  validateInput(withInput(patch), RULES).map((error) => error.code);

describe('validateInput', () => {
  it('accepts a valid input', () => {
    expect(validateInput(VALID, RULES)).toEqual([]);
  });

  describe('employmentRate, valid 1-100', () => {
    it.each([0, -1, 101, 1000, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects %p with RATE_OUT_OF_RANGE',
      (employmentRate) => {
        expect(codesFor({ employmentRate })).toContain('RATE_OUT_OF_RANGE');
      },
    );

    it.each([1, 50, 80, 100])('accepts %i', (employmentRate) => {
      expect(codesFor({ employmentRate })).not.toContain('RATE_OUT_OF_RANGE');
    });
  });

  describe('periodFraction, valid 0 < f <= 1', () => {
    it.each([0, -0.5, 1.0001, 2, Number.NaN])(
      'rejects %p with PERIOD_OUT_OF_RANGE',
      (periodFraction) => {
        expect(codesFor({ periodFraction })).toContain('PERIOD_OUT_OF_RANGE');
      },
    );

    it.each([1, 0.5, 7 / 12, 0.0001])('accepts %f', (periodFraction) => {
      expect(codesFor({ periodFraction })).not.toContain('PERIOD_OUT_OF_RANGE');
    });
  });

  describe('negative day counts', () => {
    it.each(['teleworkDays', 'missionDaysFrance', 'missionDaysThirdState'] as const)(
      'rejects a negative %s and names the field',
      (field) => {
        const errors = validateInput(withInput({ [field]: -1 }), RULES);
        const negative = errors.find((error) => error.code === 'NEGATIVE_DAYS');

        expect(negative).toBeDefined();
        expect(negative && 'field' in negative ? negative.field : null).toBe(field);
      },
    );

    it('rejects a negative supplied total and names the denominator', () => {
      const errors = validateInput(
        withInput({ denominator: { kind: 'exact', totalWorkDays: -5 }, teleworkDays: 0, missionDaysFrance: 0, missionDaysThirdState: 0 }),
        RULES,
      );
      const negative = errors.find((error) => error.code === 'NEGATIVE_DAYS');

      expect(negative && 'field' in negative ? negative.field : null).toBe('denominator');
    });
  });

  describe('granularity mismatch', () => {
    it.each(['teleworkDays', 'missionDaysFrance', 'missionDaysThirdState'] as const)(
      "rejects a half-day %s under granularity 'day'",
      (field) => {
        const errors = validateInput(withInput({ granularity: 'day', [field]: 10.5 }), RULES);
        const mismatch = errors.find((error) => error.code === 'GRANULARITY_MISMATCH');

        expect(mismatch).toBeDefined();
        expect(mismatch && 'field' in mismatch ? mismatch.field : null).toBe(field);
      },
    );

    it("accepts a half-day value under granularity 'halfDay'", () => {
      expect(codesFor({ granularity: 'halfDay', teleworkDays: 10.5 })).not.toContain(
        'GRANULARITY_MISMATCH',
      );
    });

    it("rejects a quarter-day value under granularity 'halfDay'", () => {
      expect(codesFor({ granularity: 'halfDay', teleworkDays: 10.3 })).toContain(
        'GRANULARITY_MISMATCH',
      );
    });

    it("accepts any non-negative value under granularity 'hours'", () => {
      expect(codesFor({ granularity: 'hours', teleworkDays: 10.3 })).not.toContain(
        'GRANULARITY_MISMATCH',
      );
    });
  });

  describe('the total', () => {
    it.each([0, -1])('rejects a supplied total of %i with TOTAL_WORK_DAYS_NOT_POSITIVE', (total) => {
      const codes = codesFor({
        denominator: { kind: 'exact', totalWorkDays: total },
        teleworkDays: 0,
        missionDaysFrance: 0,
        missionDaysThirdState: 0,
      });

      expect(codes).toContain('TOTAL_WORK_DAYS_NOT_POSITIVE');
    });

    it('does not report DAYS_EXCEED_TOTAL when the total is not positive', () => {
      // The comparison would be meaningless, and reporting both would send a
      // form two contradictory messages about the same field.
      const codes = codesFor({
        denominator: { kind: 'exact', totalWorkDays: 0 },
        teleworkDays: 5,
      });

      expect(codes).toContain('TOTAL_WORK_DAYS_NOT_POSITIVE');
      expect(codes).not.toContain('DAYS_EXCEED_TOTAL');
    });

    it('rejects days summing above the total with DAYS_EXCEED_TOTAL', () => {
      // 240 available; 200 + 30 + 30 = 260.
      const codes = codesFor({
        teleworkDays: 200,
        missionDaysFrance: 30,
        missionDaysThirdState: 30,
      });

      expect(codes).toContain('DAYS_EXCEED_TOTAL');
    });

    it('accepts days summing exactly to the total', () => {
      expect(codesFor({ teleworkDays: 200, missionDaysFrance: 20, missionDaysThirdState: 20 })).toEqual(
        [],
      );
    });
  });

  it('returns every applicable error, not just the first', () => {
    const codes = codesFor({
      employmentRate: 0,
      periodFraction: 2,
      teleworkDays: -1,
      missionDaysFrance: 10.5,
      granularity: 'day',
    });

    expect(codes).toContain('RATE_OUT_OF_RANGE');
    expect(codes).toContain('PERIOD_OUT_OF_RANGE');
    expect(codes).toContain('NEGATIVE_DAYS');
    expect(codes).toContain('GRANULARITY_MISMATCH');
    expect(codes.length).toBeGreaterThanOrEqual(4);
  });

  it('never throws, whatever it is handed', () => {
    const nonsense = {
      taxYear: Number.NaN,
      canton: 'GE',
      employmentRate: Number.NaN,
      periodFraction: Number.NaN,
      denominator: { kind: 'exact', totalWorkDays: Number.NaN },
      granularity: 'day',
      teleworkDays: Number.NaN,
      missionDaysFrance: Number.NaN,
      missionDaysThirdState: Number.NaN,
    } as TeleworkInput;

    expect(() => validateInput(nonsense, RULES)).not.toThrow();
    expect(validateInput(nonsense, RULES).length).toBeGreaterThan(0);
  });
});
