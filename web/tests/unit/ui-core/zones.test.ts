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

  it('treats exactly 40.00 as fiscal-exposure, and 39.99 as compliant', () => {
    // The band is 0-40, so 40 is the start of the next one. Stated in the
    // FW6 prompt and asserted on both sides here.
    expect(zoneFor(39.99, RULES)).toBe('compliant');
    expect(zoneFor(40, RULES)).toBe('fiscal-exposure');
  });

  it('treats exactly 49.90 as social-switch, and 49.89 as fiscal-exposure', () => {
    expect(zoneFor(49.89, RULES)).toBe('fiscal-exposure');
    expect(zoneFor(49.9, RULES)).toBe('social-switch');
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

  it('mission-exposure can also sit on the fiscal-exposure band - Geneva case b', () => {
    // Exactly 40.00: the badge is still about the missions, the band has
    // moved. Recorded so nobody "fixes" the pairing above into a rule.
    const result = resultOf({ teleworkDays: 91, missionDaysFrance: 8 });

    expect(result.declarableRate).toBe(40);
    expect(statusFor(result)).toBe('mission-exposure');
    expect(zoneFor(result.declarableRate, RULES)).toBe('fiscal-exposure');
  });

  it('diverges at exactly 49.9: the band is social, the badge is not', () => {
    // The band is a POSITION and includes 49.9. The badge is a CONSEQUENCE
    // and the ceiling is only exceeded ABOVE 49.9 - which is also when the
    // engine's SOCIAL_CEILING_EXCEEDED warning fires. The badge agrees with
    // the warning; the rail shows where you stand. See the report.
    const result = resultOf({
      denominator: { kind: 'exact', totalWorkDays: 1000 },
      teleworkDays: 499,
    });

    expect(result.declarableRate).toBe(49.9);
    expect(result.remainingToSocial).toBe(0);
    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      'SOCIAL_CEILING_EXCEEDED',
    );

    expect(zoneFor(result.declarableRate, RULES)).toBe('social-switch');
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
