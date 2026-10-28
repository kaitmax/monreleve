// web/tests/unit/lamal/format.test.ts
//
// The comparator's amounts are formatted from INTEGERS - centimes, euros,
// ten-thousandths - so no float reaches a formatter. The case that makes it
// matter: 2511.6 is 2511.5999... in binary, and a truncating formatter prints
// "2 511,59" for a premium the file states as 2 511,60.

import { describe, expect, it } from 'vitest';
import { formatChf, formatEur, formatRate, formatWholePercent, groupDigits } from '@/lib/lamal/format';

const NNBSP = ' ';
const NBSP = ' ';

describe('the comparator formats', () => {
  it('groups thousands with U+202F', () => {
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(999)).toBe('999');
    expect(groupDigits(1000)).toBe(`1${NNBSP}000`);
    expect(groupDigits(1234567)).toBe(`1${NNBSP}234${NNBSP}567`);
  });

  it('refuses what it cannot format honestly', () => {
    expect(() => groupDigits(-1)).toThrow(RangeError);
    expect(() => groupDigits(1.5)).toThrow(RangeError);
  });

  it('prints CHF centimes exactly - 251160 is 2 511,60, never 2 511,59', () => {
    expect(formatChf(251160)).toBe(`2${NNBSP}511,60${NBSP}CHF`);
    expect(formatChf(30000)).toBe(`300,00${NBSP}CHF`);
    expect(formatChf(0)).toBe(`0,00${NBSP}CHF`);
    expect(formatChf(5)).toBe(`0,05${NBSP}CHF`);
  });

  it('prints whole euros, percentages and the ECB rate', () => {
    expect(formatEur(2718)).toBe(`2${NNBSP}718${NBSP}€`);
    expect(formatWholePercent(8)).toBe(`8${NBSP}%`);
    expect(formatRate(9239)).toBe(`0,9239${NBSP}CHF`);
  });
});
