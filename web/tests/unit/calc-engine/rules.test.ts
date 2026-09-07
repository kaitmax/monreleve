// web/tests/unit/calc-engine/rules.test.ts
//
// SPEC section 7.7. RuleSet is the only place a threshold may appear, and a
// dossier for year Y is always computed under ruleSetFor(Y) so that an old
// document stays reproducible after new rules ship.

import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';

/** SPEC section 7.2 step 1 and the 11 April 1983 accord. */
const RESIDENCE_1983 = ['BE', 'SO', 'BS', 'BL', 'VD', 'VS', 'NE', 'JU'] as const;

describe('ruleSetFor (SPEC 7.7)', () => {
  it('returns the 2026 constants for 2026', () => {
    const rules = ruleSetFor(2026);

    expect(rules.taxYear).toBe(2026);
    expect(rules.fiscalCeiling).toBe(0.4);
    expect(rules.socialCeiling).toBe(0.499);
    expect(rules.missionCapDays).toBe(10);
    expect(rules.simplifiedBasisDays).toBe(240);
  });

  it('lists exactly the eight residence-1983 cantons', () => {
    const rules = ruleSetFor(2026);

    expect([...rules.residence1983Cantons].sort()).toEqual([...RESIDENCE_1983].sort());
    expect(rules.residence1983Cantons).toHaveLength(8);
  });

  it('carries one citation per constant', () => {
    const rules = ruleSetFor(2026);

    // Five constants and the canton list: fiscal ceiling, mission sub-cap,
    // mission proration, social ceiling, simplified denominator, 1983 accord.
    expect(rules.sources.length).toBeGreaterThanOrEqual(6);
    for (const source of rules.sources) expect(source.trim()).not.toBe('');
  });

  it('falls back to the latest known set for an unknown year, and says so', () => {
    const requested = 2027;
    const rules = ruleSetFor(requested);

    // The returned set names its own year. A caller comparing the two sees
    // the fallback; nothing is silently relabelled as 2027.
    expect(rules.taxYear).toBe(2026);
    expect(rules.taxYear).not.toBe(requested);
    expect(rules).toEqual(ruleSetFor(2026));
  });

  it('falls back for a year before the first known set too', () => {
    expect(ruleSetFor(2019).taxYear).toBe(2026);
  });

  it('returns a frozen set, so a consumer cannot mutate the rules', () => {
    const rules = ruleSetFor(2026);

    expect(Object.isFrozen(rules)).toBe(true);
    expect(Object.isFrozen(rules.residence1983Cantons)).toBe(true);
  });
});
