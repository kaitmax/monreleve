// web/tests/unit/calc-engine/granularity.test.ts
//
// SPEC section 7.2 step 3, sourced to circular no. 45 point 7.5.1:
//
//   day      1 day if over 4 h, else 0
//   halfDay  1 if over 4 h; half if 2-4 h; 0 if under 2 h
//   hours    every hour counted
//
// The boundaries are the point of this test. SPEC 7.6 names 1.9 h, 2 h, 4 h
// and 4.1 h specifically, because "2-4h" has to be read as inclusive at both
// ends and "over 4h" as strictly greater.

import { describe, expect, it } from 'vitest';
import { classifyTeleworkHours } from '@/lib/calc-engine';
import type { Granularity } from '@/lib/calc-engine';

/** hours -> expected value, per granularity. */
const TABLE: readonly (readonly [number, number, number, number])[] = [
  // hours   day  halfDay  hours
  [0, 0, 0, 0],
  [1.9, 0, 0, 1.9],
  [2, 0, 0.5, 2],
  [2.5, 0, 0.5, 2.5],
  [4, 0, 0.5, 4],
  [4.1, 1, 1, 4.1],
  [8, 1, 1, 8],
];

const COLUMN: Record<Granularity, 1 | 2 | 3> = { day: 1, halfDay: 2, hours: 3 };

describe('classifyTeleworkHours (SPEC 7.2 step 3)', () => {
  for (const row of TABLE) {
    const [hours] = row;

    for (const granularity of ['day', 'halfDay', 'hours'] as const) {
      const expected = row[COLUMN[granularity]];

      it(`${hours} h under '${granularity}' counts ${expected}`, () => {
        expect(classifyTeleworkHours(hours, granularity)).toBe(expected);
      });
    }
  }

  it("treats 4 h as a half day, not a full one, under 'halfDay'", () => {
    // "over 4h" is strictly greater. Exactly 4 h is the top of the 2-4 band.
    expect(classifyTeleworkHours(4, 'halfDay')).toBe(0.5);
    expect(classifyTeleworkHours(4.0001, 'halfDay')).toBe(1);
  });

  it("treats exactly 2 h as a half day, not zero, under 'halfDay'", () => {
    // "2-4h" is inclusive at the bottom too.
    expect(classifyTeleworkHours(2, 'halfDay')).toBe(0.5);
    expect(classifyTeleworkHours(1.9999, 'halfDay')).toBe(0);
  });

  it("counts nothing below 4 h under 'day', however close", () => {
    expect(classifyTeleworkHours(3.9999, 'day')).toBe(0);
    expect(classifyTeleworkHours(4, 'day')).toBe(0);
  });

  it('is total for negative input and returns 0 rather than throwing', () => {
    // SPEC 7.4 types this function as returning number, so it has no channel
    // for a ValidationError. Negative day counts are rejected upstream by
    // validate.ts with NEGATIVE_DAYS; this stays total because the engine
    // never throws.
    for (const granularity of ['day', 'halfDay', 'hours'] as const) {
      expect(classifyTeleworkHours(-1, granularity)).toBe(0);
    }
  });
});
