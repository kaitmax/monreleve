// web/tests/unit/calc-engine/properties-1-4.test.ts
//
// SPEC 7.6 invariants 1 to 4, over 10 000 generated cases each.
//
// Every invariant is paired with a DELIBERATELY BROKEN variant that fast-check
// must FALSIFY. A property that has never failed has not been tested: it might
// be asserting something vacuous, or the generator might never reach the
// region where it could break. Those pairings are permanent, so that stays
// true - and each one is written as "expect this to be falsified", so the
// suite is green when the engine is right AND the property has teeth.
//
// No snapshots anywhere in this module (SPEC 7.6).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import { declarableRateFor } from '@/lib/calc-engine/declarable-rate';
import { floorToHalfDay } from '@/lib/calc-engine/headroom';
import { FALSIFY_CONFIG, RUN_CONFIG, RULES, validInputArb } from './arbitraries';
import type { TeleworkInput, TeleworkResult } from '@/lib/calc-engine';

/** Only valid inputs carry a result; the generator produces those by design. */
function resultOf(input: TeleworkInput): TeleworkResult {
  const result = calculateTelework(input);
  if (!result.ok) {
    throw new Error(`generator produced invalid input: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** The declarable numerator, which TeleworkResult does not expose directly. */
const countedDays = (input: TeleworkInput, result: TeleworkResult): number =>
  result.regimeApplies ? input.teleworkDays + result.creditedMissionDays : input.teleworkDays;

const missionTotal = (input: TeleworkInput): number =>
  input.missionDaysFrance + input.missionDaysThirdState;

const CEILING_PERCENT = RULES.fiscalCeiling * 1e2;

/** Asserts that fast-check finds a counterexample - i.e. the break is real. */
function expectFalsified(property: fc.IProperty<unknown[]>): void {
  expect(() => fc.assert(property, { ...FALSIFY_CONFIG, endOnFailure: true })).toThrow(
    /Property failed/,
  );
}

describe('invariant 1 - the day partition is exact', () => {
  it('swissTaxedDays + frenchTaxedDays === totalWorkDays, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        expect(result.swissTaxedDays + result.frenchTaxedDays).toBe(result.totalWorkDays);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by a waterfall that forgets to return credited missions to Switzerland', () => {
    // The likeliest real mistake in the regime-applies branch: writing
    // swissTaxedDays = total - missionDaysTotal and omitting + credited.
    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        const brokenSwiss = result.totalWorkDays - missionTotal(input);

        expect(brokenSwiss + result.frenchTaxedDays).toBe(result.totalWorkDays);
      }),
    );
  });
});

describe('invariant 2 - the declarable rate cannot exceed the ceiling', () => {
  it('declarableRate <= 40 whenever regimeApplies, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        if (!result.regimeApplies) return;
        expect(result.declarableRate).toBeLessThanOrEqual(CEILING_PERCENT);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by a budget that ignores the headroom', () => {
    // Note what does NOT break this invariant, because it is worth recording:
    // rounding the rate up instead of truncating cannot push it past 40, since
    // the numerator is already capped at the ceiling and ceil(4000)/100 is 40.
    // The only way to exceed the ceiling is to credit more mission days than
    // the headroom allows, which is why this break is the same one invariant 3
    // catches - the two invariants guard one mistake from opposite ends.
    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        if (!result.regimeApplies) return;

        const brokenCredited = Math.min(missionTotal(input), result.missionCap);
        const brokenRate = declarableRateFor(
          input.teleworkDays + brokenCredited,
          result.totalWorkDays,
        );

        expect(brokenRate).toBeLessThanOrEqual(CEILING_PERCENT);
      }),
    );
  });
});

describe('invariant 3 - credited missions respect both limits', () => {
  it('creditedMissionDays <= missionCap AND <= fiscalCeilingDays - teleworkDays, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        expect(result.creditedMissionDays).toBeLessThanOrEqual(result.missionCap);

        if (result.regimeApplies) {
          expect(result.creditedMissionDays).toBeLessThanOrEqual(
            result.fiscalCeilingDays - input.teleworkDays,
          );
        }
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by a budget that ignores the headroom', () => {
    // budget = missionCap, dropping the min() with headroom. This is the
    // mistake that would make Geneva case d credit 10 days instead of 2.
    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        if (!result.regimeApplies) return;

        const brokenCredited = Math.min(missionTotal(input), result.missionCap);

        expect(brokenCredited).toBeLessThanOrEqual(
          result.fiscalCeilingDays - input.teleworkDays,
        );
      }),
    );
  });
});

describe('invariant 4 - there is always at least as much social room as fiscal', () => {
  it('remainingToSocial >= remainingToFiscal, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        expect(result.remainingToSocial).toBeGreaterThanOrEqual(result.remainingToFiscal);
      }),
      RUN_CONFIG,
    );
  });

  it('holds for negative headroom too, which is where clamping would break it', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        if (result.remainingToFiscal >= 0) return;
        expect(result.remainingToSocial).toBeGreaterThanOrEqual(result.remainingToFiscal);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by swapping the two ceilings', () => {
    // The copy-paste mistake: measuring social room against the fiscal
    // ceiling and vice versa.
    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        const counted = countedDays(input, result);

        const brokenSocial = floorToHalfDay(
          result.totalWorkDays * RULES.fiscalCeiling - counted,
        );
        const brokenFiscal = floorToHalfDay(
          result.totalWorkDays * RULES.socialCeiling - counted,
        );

        expect(brokenSocial).toBeGreaterThanOrEqual(brokenFiscal);
      }),
    );
  });
});

describe('the generator itself', () => {
  it('produces only inputs the engine accepts', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        expect(calculateTelework(input).ok).toBe(true);
      }),
      RUN_CONFIG,
    );
  });

  it('reaches every granularity, both denominator methods and both regimes', () => {
    const seen = {
      granularity: new Set<string>(),
      denominator: new Set<string>(),
      regimeApplies: new Set<boolean>(),
      partTime: false,
      midYear: false,
      fallbackYear: false,
    };

    fc.assert(
      fc.property(validInputArb, (input) => {
        seen.granularity.add(input.granularity);
        seen.denominator.add(input.denominator.kind);
        seen.regimeApplies.add(resultOf(input).regimeApplies);
        if (input.employmentRate < 100) seen.partTime = true;
        if (input.periodFraction < 1) seen.midYear = true;
        if (input.taxYear !== 2026) seen.fallbackYear = true;
      }),
      { numRuns: 2_000, seed: RUN_CONFIG.seed },
    );

    // A property suite that never reaches the interesting region proves
    // nothing, so the reach of the generator is itself asserted. AC1 names
    // part-time, mid-year, the exact method and all three granularities.
    expect([...seen.granularity].sort()).toEqual(['day', 'halfDay', 'hours']);
    expect([...seen.denominator].sort()).toEqual(['exact', 'simplified240']);
    expect([...seen.regimeApplies].sort()).toEqual([false, true]);
    expect(seen.partTime).toBe(true);
    expect(seen.midYear).toBe(true);
    expect(seen.fallbackYear).toBe(true);
  });
});
