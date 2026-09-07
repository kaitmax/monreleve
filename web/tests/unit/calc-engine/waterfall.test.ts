// web/tests/unit/calc-engine/waterfall.test.ts
//
// SPEC 7.2 step 5. "The core; not a threshold test."
//
// The spec calls out two details as easy to get wrong and both matter, so
// each gets its own named test below: missions are EXCLUDED from the declared
// numerator when telework alone exceeds the ceiling, and France missions are
// imputed BEFORE third-state ones.

import { describe, expect, it } from 'vitest';
import { runWaterfall } from '@/lib/calc-engine/waterfall';
import { ruleSetFor } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);

/** Full time, full year: 240 days, a 96-day ceiling, a 10-day mission cap. */
const run = (
  teleworkDays: number,
  missionDaysFrance: number,
  missionDaysThirdState: number,
  totalWorkDays = 240,
  missionCap = 10,
) =>
  runWaterfall(
    { totalWorkDays, missionCap, teleworkDays, missionDaysFrance, missionDaysThirdState },
    RULES,
  );

describe('runWaterfall - the ceiling', () => {
  it('computes the fiscal ceiling in days from the rule set', () => {
    expect(run(0, 0, 0).fiscalCeilingDays).toBe(96); // 240 * 0.40
  });

  it('applies the regime at exactly the ceiling', () => {
    // "if teleworkDays > fiscalCeiling" is strictly greater, so landing
    // exactly on 96 keeps the regime.
    expect(run(96, 0, 0).regimeApplies).toBe(true);
  });

  it('loses the regime one day above the ceiling', () => {
    expect(run(97, 0, 0).regimeApplies).toBe(false);
  });
});

describe('runWaterfall - the regime-lost branch', () => {
  it('EXCLUDES mission days from the declared numerator', () => {
    // The detail SPEC 7.2 step 5 warns about. Geneva is explicit: the regime
    // does not apply, so missions must not be folded into the rate filed
    // with the AFC, even though they are taxed in France. Case e's shape.
    const outcome = run(144, 5, 0);

    expect(outcome.regimeApplies).toBe(false);
    expect(outcome.daysCountedAgainstCeiling).toBe(144); // not 149
    expect(outcome.creditedMissionDays).toBe(0);
  });

  it('still taxes the mission days in France', () => {
    const outcome = run(144, 5, 0);

    expect(outcome.frenchTaxedDays).toBe(149); // 144 + 5
    expect(outcome.swissTaxedDays).toBe(91); // 240 - 144 - 5
  });

  it('accounts for every day', () => {
    const outcome = run(144, 3, 2);

    expect(outcome.swissTaxedDays + outcome.frenchTaxedDays).toBe(240);
  });
});

describe('runWaterfall - the budget', () => {
  it('is limited by the cap when headroom is wider', () => {
    // 96 - 84 = 12 days of room, but the cap is 10. Case c's shape.
    const outcome = run(84, 24, 0);

    expect(outcome.headroomDays).toBe(12);
    expect(outcome.creditedMissionDays).toBe(10);
  });

  it('is limited by headroom when the cap is wider', () => {
    // 96 - 91 = 5 days of room against a 10-day cap. Case b's shape.
    const outcome = run(91, 8, 0);

    expect(outcome.headroomDays).toBe(5);
    expect(outcome.creditedMissionDays).toBe(5);
  });

  it('credits nothing when there is no headroom at all', () => {
    const outcome = run(96, 8, 0);

    expect(outcome.headroomDays).toBe(0);
    expect(outcome.creditedMissionDays).toBe(0);
    expect(outcome.frenchTaxedDays).toBe(8);
  });

  it('credits every mission day when both cap and headroom are wider', () => {
    const outcome = run(10, 3, 0);

    expect(outcome.creditedMissionDays).toBe(3);
    expect(outcome.frenchTaxedDays).toBe(0);
  });
});

describe('runWaterfall - France missions are imputed BEFORE third-state', () => {
  // The second detail SPEC 7.2 step 5 warns about. The order changes who
  // pays how: excess France missions are collected by French withholding via
  // the Swiss employer, excess third-state missions are declared and paid by
  // the employee directly. So the split of what remains uncredited matters
  // even when the credited total is identical.

  it('fills the budget from France first', () => {
    // telework 90 -> headroom 6, cap 10, budget 6.
    const outcome = run(90, 4, 8);

    expect(outcome.creditedFranceDays).toBe(4); // all of France fits
    expect(outcome.creditedThirdStateDays).toBe(2); // then 2 of the 8
    expect(outcome.creditedMissionDays).toBe(6);
  });

  it('leaves third-state missions uncredited before France ones', () => {
    // Same 12 mission days, same budget of 6, split the other way.
    const outcome = run(90, 8, 4);

    expect(outcome.creditedFranceDays).toBe(6); // France exhausts the budget
    expect(outcome.creditedThirdStateDays).toBe(0); // nothing left
    expect(outcome.creditedMissionDays).toBe(6);
  });

  it('gives the same credited total either way, but a different composition', () => {
    const franceLight = run(90, 4, 8);
    const franceHeavy = run(90, 8, 4);

    // Invariant 8 of SPEC 7.6: swapping never increases the credited total.
    expect(franceHeavy.creditedMissionDays).toBe(franceLight.creditedMissionDays);
    expect(franceHeavy.frenchTaxedDays).toBe(franceLight.frenchTaxedDays);

    // But the composition differs, which is the whole point of two fields.
    expect(franceLight.creditedFranceDays).not.toBe(franceHeavy.creditedFranceDays);
  });

  it('never credits more third-state days than the remaining budget', () => {
    const outcome = run(91, 5, 5); // budget 5, France takes all of it

    expect(outcome.creditedFranceDays).toBe(5);
    expect(outcome.creditedThirdStateDays).toBe(0);
  });
});

describe('runWaterfall - the day split when the regime applies', () => {
  it('returns missions to Switzerland as they are credited', () => {
    // swissTaxedDays = totalWorkDays - missionDaysTotal + creditedMissions
    const outcome = run(84, 24, 0);

    expect(outcome.swissTaxedDays).toBe(226); // 240 - 24 + 10
    expect(outcome.frenchTaxedDays).toBe(14); // 24 - 10
  });

  it('accounts for every day', () => {
    const outcome = run(84, 12, 12);

    expect(outcome.swissTaxedDays + outcome.frenchTaxedDays).toBe(240);
  });

  it('counts telework plus credited missions against the ceiling', () => {
    const outcome = run(84, 24, 0);

    expect(outcome.daysCountedAgainstCeiling).toBe(94); // 84 + 10
  });
});

describe('runWaterfall - part-time proration', () => {
  it('scales the ceiling with the denominator', () => {
    // A 63-day denominator: ceiling 25.2, cap prorated to 5 by the caller.
    const outcome = run(20, 8, 0, 63, 5);

    expect(outcome.fiscalCeilingDays).toBeCloseTo(25.2, 10);
    expect(outcome.headroomDays).toBeCloseTo(5.2, 10);
    expect(outcome.creditedMissionDays).toBe(5); // cap binds
    expect(outcome.swissTaxedDays).toBe(60); // 63 - 8 + 5
  });
});
