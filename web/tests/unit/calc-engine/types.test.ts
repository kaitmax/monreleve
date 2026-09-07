// web/tests/unit/calc-engine/types.test.ts
//
// Type-level assertions on the engine's public surface. expectTypeOf is
// checked by tsc, so `pnpm typecheck` is what enforces these - a mismatch is
// a compile error, not a silent pass.
//
// Tests live outside lib/calc-engine on purpose: the engine fence forbids
// every non-relative import inside that directory, and a co-located test
// would have to import vitest. Keeping them here leaves the fence absolute.

import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  Canton,
  DenominatorMethod,
  Granularity,
  Regime,
  Result,
  TeleworkInput,
  TeleworkResult,
  ValidationError,
  Warning,
} from '@/lib/calc-engine';

describe('engine type surface (SPEC 7.4)', () => {
  it('TeleworkInput has exactly the spec fields, all readonly', () => {
    expectTypeOf<TeleworkInput>().toEqualTypeOf<{
      readonly taxYear: number;
      readonly canton: Canton;
      readonly employmentRate: number;
      readonly periodFraction: number;
      readonly denominator: DenominatorMethod;
      readonly granularity: Granularity;
      readonly teleworkDays: number;
      readonly missionDaysFrance: number;
      readonly missionDaysThirdState: number;
    }>();
  });

  it('TeleworkResult has exactly the spec fields, all readonly', () => {
    expectTypeOf<TeleworkResult>().toEqualTypeOf<{
      readonly regime: Regime;
      readonly regimeApplies: boolean;
      readonly totalWorkDays: number;
      readonly missionCap: number;
      readonly fiscalCeilingDays: number;
      readonly declarableRate: number;
      readonly rawRate: number;
      readonly swissTaxedDays: number;
      readonly frenchTaxedDays: number;
      readonly creditedMissionDays: number;
      readonly remainingToFiscal: number;
      readonly remainingToSocial: number;
      readonly warnings: readonly Warning[];
    }>();
  });

  it('Regime and Granularity are the spec unions', () => {
    expectTypeOf<Regime>().toEqualTypeOf<'source' | 'residence-1983'>();
    expectTypeOf<Granularity>().toEqualTypeOf<'day' | 'halfDay' | 'hours'>();
  });

  it('Canton is exactly these 26 codes', () => {
    const all = [
      'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR',
      'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG',
      'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
    ] as const;

    // Two-way: the literal list covers the union and the union covers the
    // list, so adding or dropping a canton in either place is a type error.
    expectTypeOf<(typeof all)[number]>().toEqualTypeOf<Canton>();
    expect(new Set(all).size).toBe(26);
  });

  it('Result is a discriminated union on ok', () => {
    expectTypeOf<Result<number, string>>().toEqualTypeOf<
      { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string }
    >();

    // Narrowing works at runtime, which is what consumers rely on.
    const ok: Result<number, readonly ValidationError[]> = { ok: true, value: 1 };
    const bad: Result<number, readonly ValidationError[]> = {
      ok: false,
      error: [{ code: 'RATE_OUT_OF_RANGE' }],
    };

    expect(ok.ok ? ok.value : null).toBe(1);
    expect(bad.ok ? null : bad.error[0]?.code).toBe('RATE_OUT_OF_RANGE');
  });

  it('DenominatorMethod is discriminated on kind, and exact carries the total', () => {
    const simplified: DenominatorMethod = { kind: 'simplified240' };
    const exact: DenominatorMethod = { kind: 'exact', totalWorkDays: 217 };

    expect(simplified.kind).toBe('simplified240');
    expect(exact.kind === 'exact' ? exact.totalWorkDays : null).toBe(217);
  });

  it('NEGATIVE_DAYS and GRANULARITY_MISMATCH name a field of TeleworkInput', () => {
    const negative: ValidationError = { code: 'NEGATIVE_DAYS', field: 'teleworkDays' };
    const mismatch: ValidationError = { code: 'GRANULARITY_MISMATCH', field: 'teleworkDays' };

    expect(negative.code === 'NEGATIVE_DAYS' ? negative.field : null).toBe('teleworkDays');
    expect(mismatch.code === 'GRANULARITY_MISMATCH' ? mismatch.field : null).toBe('teleworkDays');
  });
});
