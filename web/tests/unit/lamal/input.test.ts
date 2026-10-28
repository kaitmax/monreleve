// web/tests/unit/lamal/input.test.ts
//
// What the comparator's two text fields accept. R109's shape: type="text"
// with an inputMode, so the parsing is ours and is tested here rather than
// left to a browser's number input.

import { describe, expect, it } from 'vitest';
import { parseBirthYear, parseIncome } from '@/lib/lamal/input';

describe('the income field: whole euros, spaces of any kind allowed', () => {
  it.each([
    ['42000', 42000],
    ['42 000', 42000],
    ['42\u00A0000', 42000],
    ['42\u202F000', 42000],
    [' 0 ', 0],
    ['123456789', 123456789],
  ])('%j -> %d', (text, expected) => {
    expect(parseIncome(text)).toBe(expected);
  });

  it.each(['', '   ', '42000,50', '42.000', '-1', '1e5', 'abc', '1234567890'])('%j -> refused', (text) => {
    expect(parseIncome(text)).toBeUndefined();
  });
});

describe('the year-of-birth field: four digits', () => {
  it.each([
    ['1985', 1985],
    [' 2027 ', 2027],
  ])('%j -> %d', (text, expected) => {
    expect(parseBirthYear(text)).toBe(expected);
  });

  it.each(['', '85', '19850', 'abcd', '19 85x'])('%j -> refused', (text) => {
    expect(parseBirthYear(text)).toBeUndefined();
  });
});
