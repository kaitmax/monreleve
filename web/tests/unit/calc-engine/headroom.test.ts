// web/tests/unit/calc-engine/headroom.test.ts
//
// SPEC 7.2 step 6 and 7.3. Advisory headroom FLOORS to the half-day: a user
// must never be told they have more room than they do. Negative values are
// REPORTED, never clamped - "Vous etes 6 jours au-dessus" beats "0 jours
// restants".

import { describe, expect, it } from 'vitest';
import { floorToHalfDay, headroomFor } from '@/lib/calc-engine/headroom';
import { ruleSetFor } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);
const at = (daysCounted: number, totalWorkDays = 240) =>
  headroomFor(daysCounted, totalWorkDays, RULES);

describe('floorToHalfDay', () => {
  it.each([
    [0, 0],
    [0.4, 0],
    [0.5, 0.5],
    [0.9, 0.5],
    [1, 1],
    [1.4, 1],
    [1.5, 1.5],
    [23.9, 23.5],
    [47.76, 47.5],
  ])('floors %f to %f', (value, expected) => {
    expect(floorToHalfDay(value)).toBe(expected);
  });

  it('floors negatives away from zero, so it never overstates', () => {
    // -0.1 must not become 0: that would report room the user does not have.
    expect(floorToHalfDay(-0.1)).toBe(-0.5);
    expect(floorToHalfDay(-0.5)).toBe(-0.5);
    expect(floorToHalfDay(-0.6)).toBe(-1);
    expect(floorToHalfDay(-24.24)).toBe(-24.5);
  });
});

describe('headroomFor (SPEC 7.2 step 6)', () => {
  it('reports room to both ceilings at Geneva case a', () => {
    // 96 - 72 = 24 exactly. 119.76 - 72 = 47.76, floored to 47.5.
    const headroom = at(72);

    expect(headroom.remainingToFiscal).toBe(24);
    expect(headroom.remainingToSocial).toBe(47.5);
  });

  it('reports room at Geneva case c', () => {
    // 96 - 94 = 2. 119.76 - 94 = 25.76 -> 25.5.
    const headroom = at(94);

    expect(headroom.remainingToFiscal).toBe(2);
    expect(headroom.remainingToSocial).toBe(25.5);
  });

  it('reports zero fiscal room exactly at the ceiling', () => {
    expect(at(96).remainingToFiscal).toBe(0);
  });

  it('REPORTS negative values rather than clamping them', () => {
    // Geneva case e: 144 days counted against a 96-day ceiling.
    const headroom = at(144);

    expect(headroom.remainingToFiscal).toBe(-48);
    expect(headroom.remainingToSocial).toBe(-24.5); // 119.76 - 144 = -24.24
  });

  it('never reports more social room than the exact value', () => {
    // 119.76 - 94 = 25.76. Reporting 25.76 or 26 would overstate; 25.5 does
    // not. The floor is what makes the advice safe.
    expect(at(94).remainingToSocial).toBeLessThanOrEqual(25.76);
  });

  it('always leaves at least as much social room as fiscal room', () => {
    // Invariant 4 of SPEC 7.6, which must hold for negatives too.
    for (const days of [0, 50, 72, 94, 96, 100, 119, 120, 144, 240]) {
      const headroom = at(days);

      expect(headroom.remainingToSocial).toBeGreaterThanOrEqual(headroom.remainingToFiscal);
    }
  });

  it('scales with a part-time denominator', () => {
    // A 63-day denominator, which is employmentRate 45 over a 7/12 period.
    // Fiscal ceiling 63 * 0.40 = 25.2, social 63 * 0.499 = 31.437.
    const headroom = at(20, 63);

    expect(headroom.remainingToFiscal).toBe(5); // 25.2 - 20 = 5.2 -> 5
    expect(headroom.remainingToSocial).toBe(11); // 31.437 - 20 = 11.437 -> 11
  });
});
