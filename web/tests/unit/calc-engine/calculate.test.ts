// web/tests/unit/calc-engine/calculate.test.ts
//
// calculateTelework end to end. The published cases live in
// fixtures.test.ts, which reads the shared JSON; this covers the wiring
// around them - validation, the Result contract, the fields the fixtures do
// not assert, and ruling R14.
//
// This file replaces calculate-seam.test.ts, whose last test was written to
// fail the moment the waterfall landed. It did: "expected true to be false",
// because calculateTelework now returns ok:true for valid input.

import { describe, expect, expectTypeOf, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import type { TeleworkInput, ValidationError } from '@/lib/calc-engine';

const VALID: TeleworkInput = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'day',
  teleworkDays: 84,
  missionDaysFrance: 24,
  missionDaysThirdState: 0,
};

const with_ = (patch: Partial<TeleworkInput>): TeleworkInput => ({ ...VALID, ...patch });

describe('ruling R14 - NOT_IMPLEMENTED is gone', () => {
  it('is absent from the ValidationError union', () => {
    // FW3 never added it: rather than change the public union, its seam
    // returned ok:false with an empty error list. So R14's removal is a
    // no-op on the type, and this assertion is what makes it stay one -
    // a NOT_IMPLEMENTED member would make Extract resolve to something
    // other than never and fail typecheck.
    type NotImplemented = Extract<ValidationError, { code: 'NOT_IMPLEMENTED' }>;

    expectTypeOf<NotImplemented>().toEqualTypeOf<never>();
  });

  it('never returns an empty error list, which was the old sentinel', () => {
    // ok:false with no errors was the FW3 seam's way of saying "valid input,
    // no result yet". If it ever reappears, something has silently stopped
    // computing.
    const result = calculateTelework(VALID);

    expect(result.ok).toBe(true);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('emits only the six spec codes', () => {
    const result = calculateTelework(
      with_({ employmentRate: 0, periodFraction: 2, teleworkDays: -1 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const permitted = [
      'RATE_OUT_OF_RANGE',
      'PERIOD_OUT_OF_RANGE',
      'NEGATIVE_DAYS',
      'GRANULARITY_MISMATCH',
      'DAYS_EXCEED_TOTAL',
      'TOTAL_WORK_DAYS_NOT_POSITIVE',
    ];

    for (const error of result.error) expect(permitted).toContain(error.code);
  });
});

describe('calculateTelework - the Result contract', () => {
  it('returns validation errors rather than throwing', () => {
    expect(() => calculateTelework(with_({ employmentRate: 0 }))).not.toThrow();
    expect(calculateTelework(with_({ employmentRate: 0 })).ok).toBe(false);
  });

  it('never throws on input that is NaN throughout', () => {
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

    expect(() => calculateTelework(nonsense)).not.toThrow();
    expect(calculateTelework(nonsense).ok).toBe(false);
  });
});

describe('calculateTelework - the fields the fixtures do not assert', () => {
  it('reports both rates for Geneva case c, which is why there are two', () => {
    const result = calculateTelework(VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.declarableRate).toBe(39.16);
    expect(result.value.rawRate).toBe(45); // 108 of 240 days outside Switzerland
  });

  it('reports the ceiling, the cap and the credited missions', () => {
    const result = calculateTelework(VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.totalWorkDays).toBe(240);
    expect(result.value.fiscalCeilingDays).toBe(96);
    expect(result.value.missionCap).toBe(10);
    expect(result.value.creditedMissionDays).toBe(10);
  });

  it('reports headroom floored to the half-day', () => {
    const result = calculateTelework(VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.remainingToFiscal).toBe(2); // 96 - 94
    expect(result.value.remainingToSocial).toBe(25.5); // 119.76 - 94 -> 25.5
  });

  it('derives the regime from the canton without being asked', () => {
    expect(calculateTelework(VALID).ok).toBe(true);

    const geneva = calculateTelework(VALID);
    const vaud = calculateTelework(with_({ canton: 'VD' }));

    expect(geneva.ok && geneva.value.regime).toBe('source');
    expect(vaud.ok && vaud.value.regime).toBe('residence-1983');
  });
});

describe('calculateTelework - warnings reach the caller', () => {
  it('emits RULE_SET_FALLBACK for an unknown tax year (R11)', () => {
    const result = calculateTelework(with_({ taxYear: 2027 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const fallback = result.value.warnings.find(
      (warning) => warning.code === 'RULE_SET_FALLBACK',
    );

    expect(fallback).toBeDefined();
    expect(fallback && 'requestedYear' in fallback ? fallback.requestedYear : null).toBe(2027);
    expect(fallback && 'appliedYear' in fallback ? fallback.appliedYear : null).toBe(2026);
  });

  it('emits EXACT_METHOD_UNVERIFIED for a supplied denominator', () => {
    const result = calculateTelework(
      with_({ denominator: { kind: 'exact', totalWorkDays: 217 } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.warnings.map((warning) => warning.code)).toContain(
      'EXACT_METHOD_UNVERIFIED',
    );
    expect(result.value.totalWorkDays).toBe(217);
  });

  it('emits FRONTALIER_STATUS_AT_RISK only for a 1983 canton over the ceiling', () => {
    const overCeiling = { teleworkDays: 144, missionDaysFrance: 5, missionDaysThirdState: 0 };

    const vaud = calculateTelework(with_({ canton: 'VD', ...overCeiling }));
    const geneva = calculateTelework(with_({ canton: 'GE', ...overCeiling }));

    expect(vaud.ok && vaud.value.warnings.map((w) => w.code)).toContain(
      'FRONTALIER_STATUS_AT_RISK',
    );
    expect(geneva.ok && geneva.value.warnings.map((w) => w.code)).not.toContain(
      'FRONTALIER_STATUS_AT_RISK',
    );
  });
});
