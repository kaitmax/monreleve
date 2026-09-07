// web/tests/unit/ui-core/zones.test.ts
//
// SPEC 6.2. "Zones and statuses are different things."
//
//   Zone   - the RAIL. Position. Three regulatory bands, 0-40 / 40-49.9 /
//            >= 49.9, coloured success / warning / error.
//   Status - the BADGE. Consequence. Four states, one of which
//            (mission-exposure) sits on the GREEN band with a warning badge.
//
// Colouring the rail by Status is a review rejection (SPEC 6.2), so the two
// are computed by separate functions from separate inputs and this suite
// tests them separately - including the cases where they deliberately
// disagree, which is the whole reason there are two.

import { describe, expect, it } from 'vitest';
import { calculateTelework, ruleSetFor } from '@/lib/calc-engine';
import { statusFor, zoneFor } from '@/lib/ui/core/zones';
import type { TeleworkInput, TeleworkResult } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);

/** Geneva, full time, full year: 240 days, a 96-day ceiling, a 10-day cap. */
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

function resultOf(patch: Partial<TeleworkInput>): TeleworkResult {
  const outcome = calculateTelework({ ...BASE, ...patch });
  if (!outcome.ok) throw new Error(`invalid fixture input: ${JSON.stringify(outcome.error)}`);
  return outcome.value;
}

describe('zoneFor - the rail bands (SPEC 6.2)', () => {
  it('places a rate below the fiscal ceiling on the compliant band', () => {
    expect(zoneFor(0, RULES)).toBe('compliant');
    expect(zoneFor(30, RULES)).toBe('compliant');
    expect(zoneFor(39.16, RULES)).toBe('compliant');
  });

  it('treats exactly 40.00 as COMPLIANT, and 40.01 as fiscal-exposure (R32)', () => {
    // RULING R32: the ceilings are inclusive on the COMPLIANT side. A rate of
    // exactly 40.00 is compliant with zero headroom, not exposed.
    //
    // The fixtures are why. Geneva case b is teleworkDays 91 with 8 mission
    // days: declarableRate exactly 40, regimeApplies TRUE, 237 of 240 days
    // taxed in Switzerland. The old boundary painted that rail AMBER while
    // the fixture said the regime applies - the rail contradicting the
    // ship-blocking fixture. Case d is the same at 94/12.
    expect(zoneFor(40, RULES)).toBe('compliant');
    expect(zoneFor(40.01, RULES)).toBe('fiscal-exposure');
  });

  it('treats exactly 49.90 as fiscal-exposure, and 49.91 as social-switch (R32)', () => {
    // The same rule at the social ceiling, and here it removes a
    // disagreement rather than a contradiction: the engine's
    // SOCIAL_CEILING_EXCEEDED fires only when remainingToSocial goes
    // NEGATIVE, so at exactly 49.9 the engine says the ceiling is not
    // exceeded. The old band said social-switch anyway.
    expect(zoneFor(49.89, RULES)).toBe('fiscal-exposure');
    expect(zoneFor(49.9, RULES)).toBe('fiscal-exposure');
    expect(zoneFor(49.91, RULES)).toBe('social-switch');
  });

  it('places anything above on the social band', () => {
    expect(zoneFor(60, RULES)).toBe('social-switch');
    expect(zoneFor(100, RULES)).toBe('social-switch');
  });

  it('reads the thresholds from the RuleSet, not from constants of its own', () => {
    // SPEC 7.7: RuleSet is the only place a threshold may appear. A rule set
    // with different ceilings must move the bands - if it does not, zoneFor
    // is carrying its own copy of 40 and 49.9.
    const shifted = { fiscalCeiling: 0.5, socialCeiling: 0.6 };

    expect(zoneFor(45, shifted)).toBe('compliant');
    expect(zoneFor(55, shifted)).toBe('fiscal-exposure');
    expect(zoneFor(65, shifted)).toBe('social-switch');
  });

  it('does not confuse the fraction in the RuleSet with the percentage it is given', () => {
    // THE UNIT TRAP. RuleSet.fiscalCeiling is 0.4, a fraction; declarableRate
    // is 39.16, a percentage. Comparing them directly makes every rate look
    // like an exceedance, so 30 would come back 'social-switch'.
    expect(RULES.fiscalCeiling).toBe(0.4);
    expect(RULES.socialCeiling).toBe(0.499);
    expect(zoneFor(30, RULES)).toBe('compliant');
  });
});

describe('statusFor - the badge (SPEC 6.2)', () => {
  it('is compliant when the regime holds and no mission day is taxed in France', () => {
    // Geneva case a: 72 telework days, no missions.
    const result = resultOf({ teleworkDays: 72 });

    expect(result.regimeApplies).toBe(true);
    expect(result.frenchTaxedDays).toBe(0);
    expect(statusFor(result)).toBe('compliant');
  });

  it('is mission-exposure when the regime holds but mission days spill into France', () => {
    // Geneva case c: 84 telework, 24 missions, only 10 creditable.
    const result = resultOf({ teleworkDays: 84, missionDaysFrance: 24 });

    expect(result.regimeApplies).toBe(true);
    expect(result.frenchTaxedDays).toBe(14);
    expect(statusFor(result)).toBe('mission-exposure');
  });

  it('is regime-lost above the fiscal ceiling but inside the social one', () => {
    // 100 of 240 is 41.66 %: past 40, nowhere near 49.9.
    const result = resultOf({ teleworkDays: 100 });

    expect(result.regimeApplies).toBe(false);
    expect(result.remainingToSocial).toBeGreaterThanOrEqual(0);
    expect(statusFor(result)).toBe('regime-lost');
  });

  it('is social-switch once the social ceiling is exceeded', () => {
    // Geneva case e: 144 of 240 is 60 %.
    const result = resultOf({ teleworkDays: 144, missionDaysFrance: 5 });

    expect(result.remainingToSocial).toBeLessThan(0);
    expect(statusFor(result)).toBe('social-switch');
  });

  it('prefers social-switch over regime-lost, because the first implies the second', () => {
    // Under the regime declarableRate can never exceed the fiscal ceiling, so
    // exceeding the SOCIAL ceiling always means the regime is already lost.
    // Testing regime-lost first would label every social case regime-lost.
    const result = resultOf({ teleworkDays: 144, missionDaysFrance: 5 });

    expect(result.regimeApplies).toBe(false);
    expect(statusFor(result)).toBe('social-switch');
  });

  it('does not read mission exposure from the regime-lost branch', () => {
    // In that branch frenchTaxedDays = teleworkDays + missions, so it is
    // positive for a reason that has nothing to do with mission exposure.
    // Without the regimeApplies guard this would come back mission-exposure.
    const result = resultOf({ teleworkDays: 100, missionDaysFrance: 4 });

    expect(result.frenchTaxedDays).toBeGreaterThan(0);
    expect(statusFor(result)).toBe('regime-lost');
  });

  it('reaches all four states across the four cases above', () => {
    const states = new Set([
      statusFor(resultOf({ teleworkDays: 72 })),
      statusFor(resultOf({ teleworkDays: 84, missionDaysFrance: 24 })),
      statusFor(resultOf({ teleworkDays: 100 })),
      statusFor(resultOf({ teleworkDays: 144, missionDaysFrance: 5 })),
    ]);

    expect([...states].sort()).toEqual([
      'compliant',
      'mission-exposure',
      'regime-lost',
      'social-switch',
    ]);
  });
});

describe('the Zone and Status of one result are independent (SPEC 6.2)', () => {
  it('mission-exposure sits on the COMPLIANT band - Geneva case c', () => {
    // The pairing SPEC 6.2 calls out: "one of which (mission-exposure) sits
    // on the green band with a warning badge". A green rail and an amber
    // badge on the same result is correct, not a bug.
    const result = resultOf({ teleworkDays: 84, missionDaysFrance: 24 });

    expect(statusFor(result)).toBe('mission-exposure');
    expect(zoneFor(result.declarableRate, RULES)).toBe('compliant');
  });

  it('mission-exposure sits on the COMPLIANT band at exactly 40.00 too - Geneva case b (R32)', () => {
    // Exactly 40.00 with the regime applying. Under R32 the band is green and
    // the badge is amber, which is the SAME pairing SPEC 6.2 calls out - so
    // the spec's own named oddity is now true of the fixture as well as of
    // case c, where before the rail contradicted it.
    const result = resultOf({ teleworkDays: 91, missionDaysFrance: 8 });

    expect(result.declarableRate).toBe(40);
    expect(result.regimeApplies).toBe(true);
    expect(statusFor(result)).toBe('mission-exposure');
    expect(zoneFor(result.declarableRate, RULES)).toBe('compliant');
  });

  it('agrees at exactly 49.9: neither the band nor the badge claims a breach (R32)', () => {
    // This used to be the one deliberate DISAGREEMENT, and R32 removed it.
    // The engine is the arbiter: SOCIAL_CEILING_EXCEEDED fires only when
    // remainingToSocial goes negative, and at exactly 49.9 it is zero, so the
    // engine says the ceiling is not exceeded. The rail now says the same.
    //
    // The badge reads regime-lost rather than compliant because the regime
    // really has gone - 49.9 % of telework is far past the fiscal ceiling -
    // and that is not a disagreement: Zone is POSITION and Status is
    // CONSEQUENCE. What matters is that neither of them now claims a SOCIAL
    // breach that has not happened.
    const result = resultOf({
      denominator: { kind: 'exact', totalWorkDays: 1000 },
      teleworkDays: 499,
    });

    expect(result.declarableRate).toBe(49.9);
    expect(result.remainingToSocial).toBe(0);
    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      'SOCIAL_CEILING_EXCEEDED',
    );

    expect(zoneFor(result.declarableRate, RULES)).toBe('fiscal-exposure');
    expect(statusFor(result)).toBe('regime-lost');
  });

  it('agrees one day later, when the ceiling is actually crossed', () => {
    const result = resultOf({
      denominator: { kind: 'exact', totalWorkDays: 1000 },
      teleworkDays: 500,
    });

    expect(result.warnings.map((warning) => warning.code)).toContain('SOCIAL_CEILING_EXCEEDED');
    expect(zoneFor(result.declarableRate, RULES)).toBe('social-switch');
    expect(statusFor(result)).toBe('social-switch');
  });
});

// ---------------------------------------------------------------------------
// Added after an adversarial review of increments 1-2. Each block below exists
// because a wrong implementation passed everything above it.
// ---------------------------------------------------------------------------

describe('zoneFor compares exactly, and must not be "hardened" into rounding', () => {
  it('scales both ceilings without float error', () => {
    // The premise of the exact comparison. If either of these were inexact,
    // rounding would be the right fix; they are not, so it is not.
    expect(RULES.fiscalCeiling * 100).toBe(40);
    expect(RULES.socialCeiling * 100).toBe(49.9);
  });

  it('keeps a rate finer than a hundredth on the right side of the line', () => {
    // The rows that separate the exact comparison from an integer-hundredths
    // one. Under R32's strict > the discriminating cases MOVED, and moved to
    // the more dangerous side: with Math.round(rate * 1e2) > Math.round(
    // ceiling * 1e4), round(4000.1) is 4000, which is not > 4000, so 40.001 -
    // a rate genuinely PAST the fiscal ceiling - would be reported compliant.
    // The rounded form now understates a breach instead of inventing one,
    // which is worse, so these rows matter more than they did in FW6.
    expect(zoneFor(40.001, RULES)).toBe('fiscal-exposure');
    expect(zoneFor(49.901, RULES)).toBe('social-switch');

    // ...and the other side still holds.
    expect(zoneFor(39.999, RULES)).toBe('compliant');
    expect(zoneFor(49.8999, RULES)).toBe('fiscal-exposure');
  });
});

describe('zoneFor refuses a rate that is not a number', () => {
  // Unguarded, every >= against NaN is false and the function returns
  // 'compliant' - the success band, for a rate that was never computed.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    it(`throws on ${String(bad)} rather than painting the success band`, () => {
      expect(() => zoneFor(bad, RULES)).toThrow(RangeError);
    });
  }

  it('still accepts the ordinary range', () => {
    expect(() => zoneFor(0, RULES)).not.toThrow();
    expect(() => zoneFor(100, RULES)).not.toThrow();
  });
});

describe('the badge agrees with the engine own warnings, across a sweep', () => {
  // statusFor reads two DERIVED numbers - remainingToSocial (floored) and
  // frenchTaxedDays - while the banners rendered beside the badge come from
  // result.warnings. Nothing tied the two together, so a change to
  // headroom.ts's flooring or to the waterfall's budget line could drift the
  // badge away from the banner list with no test going red. This is that tie.

  /** The same four states, decided only by the engine's warning codes. */
  function statusFromWarnings(result: TeleworkResult): string {
    const codes = new Set(result.warnings.map((warning) => warning.code));

    if (codes.has('SOCIAL_CEILING_EXCEEDED')) return 'social-switch';
    if (!result.regimeApplies) return 'regime-lost';
    if (codes.has('MISSION_CAP_EXCEEDED') || codes.has('MISSIONS_EXCEED_HEADROOM')) {
      return 'mission-exposure';
    }

    return 'compliant';
  }

  const sweep: TeleworkResult[] = [];
  for (let telework = 0; telework <= 240; telework += 0.5) {
    for (let missions = 0; missions <= 20; missions += 0.5) {
      const outcome = calculateTelework({
        ...BASE,
        granularity: 'halfDay',
        teleworkDays: telework,
        missionDaysFrance: missions,
      });
      if (outcome.ok) sweep.push(outcome.value);
    }
  }

  it('sweeps a meaningful number of results', () => {
    expect(sweep.length).toBeGreaterThan(10_000);
  });

  it('reaches all four states, so the agreement below is not vacuous', () => {
    expect(new Set(sweep.map(statusFor)).size).toBe(4);
  });

  it('agrees with the warning codes on every swept result', () => {
    const disagreements = sweep
      .filter((result) => statusFor(result) !== statusFromWarnings(result))
      .map((result) => ({
        declarableRate: result.declarableRate,
        frenchTaxedDays: result.frenchTaxedDays,
        badge: statusFor(result),
        fromWarnings: statusFromWarnings(result),
      }));

    expect(disagreements).toEqual([]);
  });
});

describe('regime lost AND missions over the cap - the precedence the fixtures cannot reach', () => {
  // Every regime-lost fixture keeps missions at or under the 10-day cap, so
  // MISSION_CAP_EXCEEDED never co-occurs with regimeApplies false in the
  // fixture file. warnings.ts emits MISSION_CAP_EXCEEDED unconditionally and
  // suppresses only MISSIONS_EXCEED_HEADROOM once the regime is lost, so the
  // pair is reachable - and an implementation that read mission exposure
  // straight from the codes, without statusFor's !regimeApplies guard, would
  // label this mission-exposure and still pass all six fixtures.
  const result = resultOf({ teleworkDays: 100, missionDaysFrance: 12 });

  it('really does breach the cap with the regime already gone', () => {
    expect(result.regimeApplies).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('MISSION_CAP_EXCEEDED');
    // ...and NOT past the social ceiling, or the case would test precedence
    // over social-switch instead, which is a different test.
    expect(result.remainingToSocial).toBeGreaterThanOrEqual(0);
  });

  it('is regime-lost, not mission-exposure', () => {
    expect(statusFor(result)).toBe('regime-lost');
  });
});
