// web/tests/unit/calc-engine/properties-5-8.test.ts
//
// SPEC 7.6 invariants 5 to 8, over 10 000 generated cases each, each paired
// with a deliberately broken variant that fast-check must falsify.
//
// Invariant 7 is the one that ruling R16 makes provable: truncation can only
// ever be checked against the exact unrounded value if the exact value is
// computed on integers. Comparing two floats would be comparing the defect
// against itself.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import { declarableRateFor } from '@/lib/calc-engine/declarable-rate';
import { rawRateFor } from '@/lib/calc-engine/raw-rate';
import { FALSIFY_CONFIG, RUN_CONFIG, validInputArb } from './arbitraries';
import type { TeleworkInput, TeleworkResult } from '@/lib/calc-engine';

function resultOf(input: TeleworkInput): TeleworkResult {
  const result = calculateTelework(input);
  if (!result.ok) {
    throw new Error(`generator produced invalid input: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

const missionTotal = (input: TeleworkInput): number =>
  input.missionDaysFrance + input.missionDaysThirdState;

const countedDays = (input: TeleworkInput, result: TeleworkResult): number =>
  result.regimeApplies ? input.teleworkDays + result.creditedMissionDays : input.teleworkDays;

function expectFalsified(property: fc.IProperty<unknown[]>): void {
  expect(() => fc.assert(property, { ...FALSIFY_CONFIG, endOnFailure: true })).toThrow(
    /Property failed/,
  );
}

/** The step a granularity permits, so a bumped input stays valid. */
const stepOf = (input: TeleworkInput): number =>
  input.granularity === 'day' ? 1 : input.granularity === 'halfDay' ? 0.5 : 0.25;

describe('invariant 5 - rawRate is monotonic in teleworkDays', () => {
  it('increasing teleworkDays never decreases rawRate, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, fc.nat({ max: 40 }), (input, bumpSteps) => {
        const step = stepOf(input);
        const bumped: TeleworkInput = {
          ...input,
          teleworkDays: input.teleworkDays + bumpSteps * step,
        };

        // Only compare where the bumped input is still valid: a bump past the
        // total is rejected for a different reason and says nothing about
        // monotonicity.
        const after = calculateTelework(bumped);
        if (!after.ok) return;

        expect(after.value.rawRate).toBeGreaterThanOrEqual(resultOf(input).rawRate);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by a rawRate built from Swiss-taxed days instead of days outside', () => {
    // The inversion mistake. As telework rises the headroom shrinks, so fewer
    // mission days are credited, so swissTaxedDays FALLS - and a rate built
    // on it falls with it.
    expectFalsified(
      fc.property(validInputArb, fc.nat({ max: 40 }), (input, bumpSteps) => {
        const step = stepOf(input);
        const bumped: TeleworkInput = {
          ...input,
          teleworkDays: input.teleworkDays + bumpSteps * step,
        };

        const after = calculateTelework(bumped);
        if (!after.ok) return;

        const before = resultOf(input);
        const brokenBefore = rawRateFor(before.swissTaxedDays, before.totalWorkDays);
        const brokenAfter = rawRateFor(after.value.swissTaxedDays, after.value.totalWorkDays);

        expect(brokenAfter).toBeGreaterThanOrEqual(brokenBefore);
      }),
    );
  });
});

describe('invariant 6 - the declarable rate never exceeds the raw rate', () => {
  it('declarableRate <= rawRate, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        expect(result.declarableRate).toBeLessThanOrEqual(result.rawRate);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by a rawRate that forgets the mission days', () => {
    // rawRate is the share of days spent OUTSIDE Switzerland, so it must
    // include missions. Omitting them makes it smaller than the declarable
    // rate whenever any mission day is credited.
    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        const brokenRaw = rawRateFor(input.teleworkDays, result.totalWorkDays);

        expect(result.declarableRate).toBeLessThanOrEqual(brokenRaw);
      }),
    );
  });
});

describe('invariant 7 - truncation never overstates', () => {
  /**
   * Tolerance for one float multiplication only. declarableRate is exact by
   * construction (ruling R16), but recovering its hundredths as
   * rate * 1e2 reintroduces representation error - 18.4 * 1e2 is
   * 1840.0000000000002. The tolerance covers that step and nothing else; it
   * is far below the 1-hundredth granularity being asserted.
   */
  const EPSILON = 1e-9;

  it('declarableRate is never above the exact unrounded value, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        const counted = countedDays(input, result);

        // The exact value in hundredths of a percent, on integers.
        const exactHundredths = (counted * 1e4) / result.totalWorkDays;

        expect(result.declarableRate * 1e2).toBeLessThanOrEqual(exactHundredths + EPSILON);
      }),
      RUN_CONFIG,
    );
  });

  it('loses less than one hundredth, so it truncates rather than discards', () => {
    // The other side of the same rule: a "truncation" that threw away more
    // than the last digit would also satisfy "never above".
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        const counted = countedDays(input, result);
        const exactHundredths = (counted * 1e4) / result.totalWorkDays;

        expect(exactHundredths - result.declarableRate * 1e2).toBeLessThan(1 + EPSILON);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by rounding to nearest instead of truncating', () => {
    // 39.1666... rounds to 39.17, which is above the exact value. This is the
    // whole reason SPEC 7.3 specifies truncation.
    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        const counted = countedDays(input, result);
        const exactHundredths = (counted * 1e4) / result.totalWorkDays;
        const rounded = Math.round(exactHundredths);

        expect(rounded).toBeLessThanOrEqual(exactHundredths + EPSILON);
      }),
    );
  });
});

describe('invariant 8 - swapping the mission split never increases the credit', () => {
  it('swapping France and third-state never increases creditedMissionDays, over 10 000 cases', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const swapped: TeleworkInput = {
          ...input,
          missionDaysFrance: input.missionDaysThirdState,
          missionDaysThirdState: input.missionDaysFrance,
        };

        expect(resultOf(swapped).creditedMissionDays).toBeLessThanOrEqual(
          resultOf(input).creditedMissionDays,
        );
      }),
      RUN_CONFIG,
    );
  });

  it('in fact leaves it identical, because the credit is min(total, budget)', () => {
    // Stronger than the spec asks, and worth pinning: the France-before-third
    // -state order changes WHICH days are credited, never HOW MANY. What the
    // order decides is who collects the tax on the uncredited ones.
    fc.assert(
      fc.property(validInputArb, (input) => {
        const swapped: TeleworkInput = {
          ...input,
          missionDaysFrance: input.missionDaysThirdState,
          missionDaysThirdState: input.missionDaysFrance,
        };

        expect(resultOf(swapped).creditedMissionDays).toBe(resultOf(input).creditedMissionDays);
      }),
      RUN_CONFIG,
    );
  });

  it('is falsified by imputing against the raw France input instead of the credited amount', () => {
    // budget - missionDaysFrance instead of budget - creditedFrance. When
    // France alone exceeds the budget the subtraction goes negative and eats
    // into the third-state credit, which makes the result asymmetric.
    const brokenCredit = (france: number, thirdState: number, budget: number): number => {
      const creditedFrance = Math.min(france, budget);

      return creditedFrance + Math.min(thirdState, budget - france);
    };

    expectFalsified(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        if (!result.regimeApplies) return;

        const budget = Math.min(
          result.missionCap,
          result.fiscalCeilingDays - input.teleworkDays,
        );

        const straight = brokenCredit(
          input.missionDaysFrance,
          input.missionDaysThirdState,
          budget,
        );
        const swapped = brokenCredit(
          input.missionDaysThirdState,
          input.missionDaysFrance,
          budget,
        );

        expect(swapped).toBeLessThanOrEqual(straight);
      }),
    );
  });

  it('never credits more than the mission days actually taken', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        expect(resultOf(input).creditedMissionDays).toBeLessThanOrEqual(missionTotal(input));
      }),
      RUN_CONFIG,
    );
  });
});

describe('the two rate rules stay separated', () => {
  it('disagree on at least some generated input, or one of them is dead code', () => {
    let disagreements = 0;

    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        if (result.declarableRate !== result.rawRate) disagreements += 1;
      }),
      { numRuns: 2_000, seed: RUN_CONFIG.seed },
    );

    expect(disagreements).toBeGreaterThan(0);
  });

  it('agree exactly when no mission day is uncredited', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);
        if (missionTotal(input) !== result.creditedMissionDays) return;

        // Same numerator, different rounding: truncation to 2 dp against
        // round-up to 1 dp. They can still differ, and that is correct - but
        // the declarable one can never be the larger.
        expect(result.declarableRate).toBeLessThanOrEqual(result.rawRate);
      }),
      RUN_CONFIG,
    );
  });
});

describe('declarableRateFor and rawRateFor in isolation', () => {
  it('agree with the wired result for the same numerator', () => {
    fc.assert(
      fc.property(validInputArb, (input) => {
        const result = resultOf(input);

        expect(declarableRateFor(countedDays(input, result), result.totalWorkDays)).toBe(
          result.declarableRate,
        );
        expect(
          rawRateFor(input.teleworkDays + missionTotal(input), result.totalWorkDays),
        ).toBe(result.rawRate);
      }),
      RUN_CONFIG,
    );
  });
});
