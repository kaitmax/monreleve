// web/tests/unit/calc-engine/regime.test.ts
//
// SPEC section 7.2 step 1. The regime is derived from the canton and never
// asked. The 40 % ceiling is the same either way; the consequence of
// breaching it is not.
//
// Every canton is written out with its expected regime, deliberately. Looping
// over the implementation's own list would assert only that the list equals
// itself, and the eight-canton list is a regulatory fact worth spelling out
// where a reviewer can read it against the 1983 accord.

import { describe, expect, it } from 'vitest';
import { regimeFor } from '@/lib/calc-engine';
import type { Canton, Regime } from '@/lib/calc-engine';

const CASES: readonly (readonly [Canton, Regime])[] = [
  ['AG', 'source'],
  ['AI', 'source'],
  ['AR', 'source'],
  ['BE', 'residence-1983'],
  ['BL', 'residence-1983'],
  ['BS', 'residence-1983'],
  ['FR', 'source'],
  ['GE', 'source'],
  ['GL', 'source'],
  ['GR', 'source'],
  ['JU', 'residence-1983'],
  ['LU', 'source'],
  ['NE', 'residence-1983'],
  ['NW', 'source'],
  ['OW', 'source'],
  ['SG', 'source'],
  ['SH', 'source'],
  ['SO', 'residence-1983'],
  ['SZ', 'source'],
  ['TG', 'source'],
  ['TI', 'source'],
  ['UR', 'source'],
  ['VD', 'residence-1983'],
  ['VS', 'residence-1983'],
  ['ZG', 'source'],
  ['ZH', 'source'],
];

describe('regimeFor (SPEC 7.2 step 1)', () => {
  for (const [canton, expected] of CASES) {
    it(`${canton} is ${expected}`, () => {
      expect(regimeFor(canton)).toBe(expected);
    });
  }

  it('covers all 26 cantons, so no canton is silently untested', () => {
    expect(CASES).toHaveLength(26);
    expect(new Set(CASES.map(([canton]) => canton)).size).toBe(26);
  });

  it('classifies exactly eight cantons as residence-1983', () => {
    const residence = CASES.filter(([, regime]) => regime === 'residence-1983');

    expect(residence).toHaveLength(8);
    expect(residence.map(([canton]) => canton).sort()).toEqual([
      'BE',
      'BL',
      'BS',
      'JU',
      'NE',
      'SO',
      'VD',
      'VS',
    ]);
  });

  it('GE is source - Geneva is where the worked examples come from', () => {
    // Worth its own case: the canton every fixture uses is NOT a 1983 canton,
    // so a bug that inverted the test would still pass the Geneva fixtures.
    expect(regimeFor('GE')).toBe('source');
  });
});
