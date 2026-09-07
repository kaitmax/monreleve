// web/tests/unit/ui-core/format-exhaustive.test.ts
//
// RULING R26: "The engine returns declarableRate as a number; FW6's
// formatPercent must prove by exhaustive test that for every integer n in
// 0...10 000, formatPercent(n / 100) renders exactly the digits of n. That is
// the only way R16's 'integers until the final formatted output' holds end to
// end without changing the public API." Plus the same for rawRate's one
// decimal over n in 0...1 000.
//
// Every expectation below is built by INTEGER ARITHMETIC - Math.floor,
// remainder, padStart - and never by toFixed, Intl or string arithmetic on a
// float. An expectation computed the same way as the thing it checks proves
// only that the code agrees with itself.
//
// WHAT R26 DOES AND DOES NOT PIN. Measured across its own two domains, with
// the expectations below: roundingMode 'trunc', 'halfExpand' and 'halfEven'
// all produce ZERO failures. So R26 is satisfied by any of the three and does
// not, on its own, pin the rounding policy - which matters, because outside
// its domains they disagree loudly. Rendering a two-decimal value at ONE
// decimal, trunc and halfExpand differ in 5 000 of 10 001 cases, including
// 39.95 -> "39,9" against "40,0" - one side of the fiscal ceiling against the
// other. The last block here pins trunc for that reason, so the choice is
// asserted rather than incidental.
//
// A second measured surprise, in the direction opposite to the FW4 defect:
// 1839/100 is 18.390000000000000568, ABOVE the decimal, not below it. So
// truncation at two decimals recovers 18,39 rather than the 18,38 that the
// FW4 rate defect would suggest. The exhaustive loop is what establishes that
// for all 10 001 values rather than for the one that came to mind.

import { describe, expect, it } from 'vitest';
import { formatDays, formatPercent, formatSignedDays } from '@/lib/ui/core/format/number';

/** U+00A0 NO-BREAK SPACE. */
const NBSP = '\u00A0';
/** U+202F NARROW NO-BREAK SPACE. */
const NNBSP = '\u202F';

const HUNDREDTHS = 100;
const TENTHS = 10;
const THOUSAND = 1000;

/** Group an integer's digits in threes with U+202F, by integer arithmetic. */
function groupInteger(whole: number): string {
  let rest = whole;
  const groups: string[] = [];

  while (rest >= THOUSAND) {
    groups.unshift(String(rest % THOUSAND).padStart(3, '0'));
    rest = Math.floor(rest / THOUSAND);
  }
  groups.unshift(String(rest));

  return groups.join(NNBSP);
}

describe('R26: formatPercent renders exactly the digits of n, two decimals', () => {
  it('holds for every integer n in 0..10000', () => {
    const failures: string[] = [];

    for (let n = 0; n <= 10_000; n++) {
      const whole = Math.floor(n / HUNDREDTHS);
      const hundredths = n % HUNDREDTHS;
      const wanted = `${groupInteger(whole)},${String(hundredths).padStart(2, '0')}${NBSP}%`;
      const got = formatPercent(n / HUNDREDTHS, 2);

      if (got !== wanted) failures.push(`n=${n} wanted ${wanted} got ${got}`);
    }

    expect(failures).toEqual([]);
  });

  it('really did test 10001 values, and the expectation is not the code', () => {
    // Guarding the guard, both ways. If groupInteger or the padding were
    // wrong, the loop above would agree with a wrong formatter.
    expect(groupInteger(0)).toBe('0');
    expect(groupInteger(34)).toBe('34');
    expect(groupInteger(1234)).toBe(`1${NNBSP}234`);
    expect(groupInteger(1_000_000)).toBe(`1${NNBSP}000${NNBSP}000`);
    expect(formatPercent(3460 / HUNDREDTHS, 2)).toBe(`34,60${NBSP}%`);
    expect(formatPercent(1839 / HUNDREDTHS, 2)).toBe(`18,39${NBSP}%`);
  });

  it('recovers the AFC hundredth that the FW4 rate defect loses', () => {
    // 23/125 is exactly 18.4 %. FW4 recorded that computing the rate by
    // dividing first truncates it to 18.39 on the filing. This is the other
    // end of the same pipeline: given a correctly computed 18.39 or 18.40,
    // the FORMATTER does not lose a further hundredth.
    expect(formatPercent(1840 / HUNDREDTHS, 2)).toBe(`18,40${NBSP}%`);
    expect(formatPercent(1839 / HUNDREDTHS, 2)).toBe(`18,39${NBSP}%`);
  });
});

describe('R26 second clause: one decimal over n in 0..1000', () => {
  it('holds for every integer n in 0..1000', () => {
    const failures: string[] = [];

    for (let n = 0; n <= 1_000; n++) {
      const wanted = `${groupInteger(Math.floor(n / TENTHS))},${String(n % TENTHS)}${NBSP}%`;
      const got = formatPercent(n / TENTHS, 1);

      if (got !== wanted) failures.push(`n=${n} wanted ${wanted} got ${got}`);
    }

    expect(failures).toEqual([]);
  });
});

describe('formatDays over every half day, exhaustively', () => {
  it('renders and groups every half day from 0 to 5000', () => {
    // Grouping is the part that can fail at a boundary rather than in
    // general, so every thousand boundary is crossed here rather than
    // sampled: 999.5, 1000, 1000.5 and so on.
    const failures: string[] = [];

    for (let half = 0; half <= 10_000; half++) {
      const whole = Math.floor(half / 2);
      const isHalf = half % 2 === 1;
      const wanted = isHalf ? `${groupInteger(whole)},5` : groupInteger(whole);
      const got = formatDays(half / 2);

      if (got !== wanted) failures.push(`half=${half} wanted ${wanted} got ${got}`);
    }

    expect(failures).toEqual([]);
  });

  it('crosses the thousand boundary without losing the separator', () => {
    expect(formatDays(999.5)).toBe(`999,5`);
    expect(formatDays(1000)).toBe(`1${NNBSP}000`);
    expect(formatDays(1000.5)).toBe(`1${NNBSP}000,5`);
  });
});

describe('the negative half of the domain, which R26 does not reach', () => {
  it('reports sign and magnitude for every signed half day to 2000', () => {
    const failures: string[] = [];

    for (let half = -4_000; half <= 4_000; half++) {
      const value = half / 2;
      const magnitude = Math.abs(half);
      const whole = Math.floor(magnitude / 2);
      const wanted = magnitude % 2 === 1 ? `${groupInteger(whole)},5` : groupInteger(whole);
      const got = formatSignedDays(value);

      if (got.text !== wanted) failures.push(`half=${half} wanted ${wanted} got ${got.text}`);
      if (got.negative !== half < 0) failures.push(`half=${half} sign flag ${got.negative}`);
      // The magnitude must never carry a sign, in either encoding.
      if (got.text.includes('-') || got.text.includes('\u2212')) {
        failures.push(`half=${half} text carries a sign: ${got.text}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('does not report negative zero as negative', () => {
    expect(formatSignedDays(-0).negative).toBe(false);
    expect(formatSignedDays(0).negative).toBe(false);
  });
});

describe('the rounding policy is asserted, not incidental', () => {
  // R26's own domains pass under trunc, halfExpand and halfEven alike -
  // measured, zero failures for each - so without this block the rounding
  // mode could be changed with the whole exhaustive suite still green. These
  // are the cases where the modes part company.

  it('truncates a two-decimal value asked for at one decimal', () => {
    expect(formatPercent(0.05, 1)).toBe(`0,0${NBSP}%`);
    expect(formatPercent(0.09, 1)).toBe(`0,0${NBSP}%`);
    expect(formatPercent(12.35, 1)).toBe(`12,3${NBSP}%`);
  });

  it('never rounds a rate up onto or across the fiscal ceiling', () => {
    // The pair that matters. halfExpand renders 39.95 as "40,0" - a rate
    // BELOW the ceiling displayed as one that reaches it - and 39.99 as
    // "40,0" likewise. A displayed breach that did not happen is the worst
    // available error in this product, so the formatter truncates.
    expect(formatPercent(39.95, 1)).toBe(`39,9${NBSP}%`);
    expect(formatPercent(39.99, 1)).toBe(`39,9${NBSP}%`);
    expect(formatPercent(39.999, 1)).toBe(`39,9${NBSP}%`);
  });

  it('never rounds a rate up onto or across the social ceiling', () => {
    expect(formatPercent(49.89, 1)).toBe(`49,8${NBSP}%`);
    expect(formatPercent(49.8999, 2)).toBe(`49,89${NBSP}%`);
  });

  it('leaves a value already at the requested precision alone', () => {
    // The case that makes truncation harmless in practice: the engine fixes
    // precision before the formatter sees the number (SPEC 7.4 -
    // declarableRate truncated to 2 dp, rawRate rounded up to 1 dp), so the
    // formatter is never asked to reduce precision on a real result.
    expect(formatPercent(39.16, 2)).toBe(`39,16${NBSP}%`);
    expect(formatPercent(45, 1)).toBe(`45,0${NBSP}%`);
    expect(formatPercent(40, 1)).toBe(`40,0${NBSP}%`);
  });
});
