// web/tests/unit/calc-engine/rates.test.ts
//
// SPEC 7.3. Two rules that conflict by design, in two files, so they cannot
// be accidentally unified:
//
//   declarableRate  TRUNCATES to 2 dp   - must match the AFC filing
//   rawRate         rounds UP to 1 dp   - for display
//
// Geneva publishes 39.16 % for 94/240 (39.1666...) and 4.16 % for 10/240.
// Rounding would give 39.17 and 4.17. Matching the authority beats being
// conservative, because this number goes on a filing.

import { describe, expect, it } from 'vitest';
import { declarableRateFor } from '@/lib/calc-engine/declarable-rate';
import { rawRateFor } from '@/lib/calc-engine/raw-rate';

describe('declarableRateFor - truncates to 2 dp (SPEC 7.3)', () => {
  it('reproduces the two published truncations', () => {
    expect(declarableRateFor(94, 240)).toBe(39.16); // not 39.17
    expect(declarableRateFor(10, 240)).toBe(4.16); // not 4.17
  });

  it('truncates rather than rounding, even when rounding is nearer', () => {
    // 39.1666... rounds to 39.17 and truncates to 39.16. The AFC publishes
    // 39.16, so truncation is the rule.
    expect(declarableRateFor(94, 240)).not.toBe(39.17);
    expect(declarableRateFor(10, 240)).not.toBe(4.17);
  });

  it('leaves an exact value alone', () => {
    expect(declarableRateFor(72, 240)).toBe(30);
    expect(declarableRateFor(96, 240)).toBe(40);
    expect(declarableRateFor(144, 240)).toBe(60);
    expect(declarableRateFor(0, 240)).toBe(0);
  });

  it('does not understate an exact value through binary floating point', () => {
    // Regression, and the sharpest float trap in the engine. 23/125 is
    // exactly 18.4 %, but 18.4 is not representable in IEEE 754: computing
    // the percentage as a float and truncating gives 18.39. Truncation
    // always rounds toward zero, so the error never cancels - it silently
    // understates the rate filed with the AFC.
    //
    // A 125-day denominator is not exotic: it is employmentRate 52 on the
    // simplified basis, ceil(240 * 0.52) = 125.
    //
    // Normalising the float does NOT fix this. Only doing the arithmetic on
    // the numerator and denominator as integers does. Scanning every
    // numerator against every denominator up to 500 - 125 750 pairs - the
    // integer form is exact in all of them and the float form is wrong in 36.
    expect(declarableRateFor(23, 125)).toBe(18.4);
    expect(declarableRateFor(51, 125)).toBe(40.8);
    expect(declarableRateFor(97, 125)).toBe(77.6);
  });

  it('matters at the threshold: 51/125 is 40.8 and the regime is lost', () => {
    // Understating this to 40.79 would still be above 40, so it would not
    // flip the regime - but it would put a wrong number on a filing, and the
    // same class of error at 40.00 exactly would flip it.
    expect(declarableRateFor(51, 125)).toBeGreaterThan(40);
  });

  it('handles half-day granularity', () => {
    // 94.5/240 is 39.375 %, which truncates to 39.37.
    expect(declarableRateFor(94.5, 240)).toBe(39.37);
  });
});

describe('rawRateFor - rounds UP to 1 dp (SPEC 7.3)', () => {
  it('gives 45.0 for Geneva case c, against 39.16 declarable', () => {
    // The reason both rates are returned. 108 of 240 days were spent outside
    // Switzerland; only 94 of them are declarable. Showing one number would
    // mislead (SPEC 7.4).
    expect(rawRateFor(108, 240)).toBe(45);
    expect(declarableRateFor(94, 240)).toBe(39.16);
  });

  it('rounds up, never down', () => {
    expect(rawRateFor(99, 240)).toBe(41.3); // 41.25 -> 41.3
    expect(rawRateFor(106, 240)).toBe(44.2); // 44.1666... -> 44.2
    expect(rawRateFor(149, 240)).toBe(62.1); // 62.0833... -> 62.1
  });

  it('leaves an exact one-decimal value alone', () => {
    expect(rawRateFor(30, 240)).toBe(12.5);
    expect(rawRateFor(72, 240)).toBe(30);
    expect(rawRateFor(0, 240)).toBe(0);
  });

  it('does not overstate an exact value through binary floating point', () => {
    // The mirror of the truncation trap: ceiling on a float that landed a
    // hair above an exact tenth would add 0.1.
    expect(rawRateFor(108, 240)).toBe(45);
    expect(rawRateFor(23, 125)).toBe(18.4);
  });
});

describe('the two rules are independent', () => {
  it('declarableRate never exceeds rawRate on the published cases', () => {
    // Invariant 6 of SPEC 7.6. Truncating down and rounding up cannot cross.
    const cases: readonly (readonly [number, number, number])[] = [
      [72, 72, 240],
      [96, 99, 240],
      [94, 108, 240],
      [96, 106, 240],
      [144, 149, 240],
      [10, 30, 240],
    ];

    for (const [declarableDays, rawDays, total] of cases) {
      expect(declarableRateFor(declarableDays, total)).toBeLessThanOrEqual(
        rawRateFor(rawDays, total),
      );
    }
  });

  it('disagrees on the same input, which is why they are separate functions', () => {
    // 41.25: truncation gives 41.25 at 2 dp, ceiling gives 41.3 at 1 dp.
    expect(declarableRateFor(99, 240)).toBe(41.25);
    expect(rawRateFor(99, 240)).toBe(41.3);
  });
});
