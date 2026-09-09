// web/tests/unit/ui-core/period.test.ts
//
// FW11 increment 3: the start-of-activity date becomes TeleworkInput's
// periodFraction.
//
// WHAT THE NUMBER MEANS. SPEC 7.4 constrains periodFraction to 0 < f <= 1 and
// SPEC 9.3 says the start date "sets periodFraction, prorates the mission
// cap". So the fraction is the part of the CALENDAR YEAR still to come on the
// day the contract starts, counted INCLUSIVELY - somebody starting on
// 31 December works that day, so their fraction is one day's worth and not
// zero. Counting exclusively would hand the engine a 0 for a real working
// day, and 0 is precisely the value the engine rejects.
//
// THE FOUR CASES THE PROMPT NAMES are 1 January, 1 July, 31 December and a
// leap year, and each is here for a different reason:
//
//   1 January    the identity. A full year must come back as exactly 1, not
//                0.9999..., or every full-year calculation inherits a
//                rounding error from a field nobody filled in.
//   1 July       the case a naive "half the year" would get right by accident
//                and this gets right on purpose: the second half of a
//                365-day year is 184 days, not 182.5.
//   31 December  the boundary, and the one an exclusive count breaks.
//   a leap year  the denominator changes, and 29 February exists at all.
//
// TWO CASES THE PROMPT DOES NOT NAME, both reachable from the form and both
// decided here rather than left to produce a NaN downstream: a date BEFORE
// the tax year (the contract predates it, so the whole year is worked) and a
// date AFTER it (nonsense, and returned as 0 so the ENGINE reports it with
// PERIOD_OUT_OF_RANGE rather than the UI inventing a message of its own).

import { describe, expect, it } from 'vitest';
import { remainingYearFraction } from '@/lib/ui/core';

/** Days in a non-leap and a leap year, written once. */
const COMMON_YEAR = 365;
const LEAP_YEAR = 366;

describe('the whole year', () => {
  it('is exactly 1 from 1 January, with no floating-point residue', () => {
    expect(remainingYearFraction('2026-01-01', 2026)).toBe(1);
  });

  it('is exactly 1 in a leap year too', () => {
    expect(remainingYearFraction('2024-01-01', 2024)).toBe(1);
  });
});

describe('mid-year starts', () => {
  it('counts 184 days from 1 July in a common year, not half of it', () => {
    // July 31 + August 31 + September 30 + October 31 + November 30 +
    // December 31. A "half the year" shortcut would give 182.5/365.
    expect(remainingYearFraction('2026-07-01', 2026)).toBe(184 / COMMON_YEAR);
  });

  it('counts the same 184 days from 1 July in a leap year, over 366', () => {
    // The leap day is in February, so it changes the DENOMINATOR and not the
    // remaining count - which is the whole reason both are asserted.
    expect(remainingYearFraction('2024-07-01', 2024)).toBe(184 / LEAP_YEAR);
  });
});

describe('the last day', () => {
  it('is one day of the year, not zero', () => {
    expect(remainingYearFraction('2026-12-31', 2026)).toBe(1 / COMMON_YEAR);
  });

  it('stays inside the range the engine accepts', () => {
    const fraction = remainingYearFraction('2026-12-31', 2026);

    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThanOrEqual(1);
  });
});

describe('the leap day itself', () => {
  it('exists, and leaves 307 of 366 days', () => {
    // Day 60 of 2024 (31 in January + 29 in February), so 366 - 60 + 1.
    expect(remainingYearFraction('2024-02-29', 2024)).toBe(307 / LEAP_YEAR);
  });

  it('is not a real day in a common year, and is refused (R28)', () => {
    // new Date does not reject an impossible day, it ROLLS IT OVER -
    // '2026-02-29' parses to 1 March. formatDate found this first; the same
    // round-trip check applies here, because a silently shifted start date
    // would move the fraction by a day and nothing would say so.
    expect(() => remainingYearFraction('2026-02-29', 2026)).toThrow(RangeError);
  });
});

describe('a date outside the tax year', () => {
  it('gives the whole year when the contract started before it', () => {
    expect(remainingYearFraction('2025-06-01', 2026)).toBe(1);
  });

  it('gives 0 for a year not yet begun, so the ENGINE reports it', () => {
    // Deliberately not an exception and deliberately not clamped to
    // something plausible. 0 is outside SPEC 7.4's 0 < f <= 1, so
    // validateInput returns PERIOD_OUT_OF_RANGE and the user sees the
    // engine's own French message - one source of truth for what is a valid
    // period, rather than a second opinion living in the form.
    expect(remainingYearFraction('2027-03-01', 2026)).toBe(0);
  });
});

describe('the input contract (R28)', () => {
  it.each([
    ['an empty string', ''],
    ['a timestamp', '2026-07-01T00:00:00.000Z'],
    ['a Swiss-formatted day', '01.07.2026'],
    ['a one-digit day', '2026-7-1'],
    ['a two-digit year', '26-07-01'],
    ['not a date at all', 'demain'],
  ])('refuses %s', (_label, value) => {
    expect(() => remainingYearFraction(value, 2026)).toThrow(RangeError);
  });

  it('is pure: the same arguments give the same answer', () => {
    // No clock, no zone. A conversion that read the host date would be right
    // in a dev checkout and wrong in a container, which is the defect R28
    // exists to have deleted.
    const once = remainingYearFraction('2026-07-01', 2026);
    const twice = remainingYearFraction('2026-07-01', 2026);

    expect(once).toBe(twice);
  });
});
