// web/tests/unit/web-account/year.test.ts
//
// THE ACCOUNT AREA'S YEARS (Web Ruling 32, W12 R1067): the current tax year and
// the one before, and a download may name only those two.
//
// Every year here is derived - from the clock through currentTaxYear (R55) and
// from accountYears itself - never typed as a calendar fact (R171). The one
// typed instant is a clock built on either side of a new year in Paris.

import { describe, expect, it } from 'vitest';
import { currentTaxYear } from '@/lib/content/tax-year';
import { accountYearFrom, accountYears, yearFrom } from '@/lib/web-account/year';

const NOW = currentTaxYear();

describe('accountYears: the current tax year and the one before', () => {
  it('names exactly two years, newest first, one apart', () => {
    const [current, previous] = accountYears(NOW);

    expect(accountYears(NOW)).toHaveLength(2);
    expect(current).toBe(NOW);
    expect(previous).toBe(NOW - 1);
  });

  it('turns with the year in Europe/Paris, not in UTC (R55)', () => {
    // 31 December 23:30 UTC is already 1 January in Paris.
    const lateUtc = new Date(`${String(NOW)}-12-31T23:30:00.000Z`);

    expect(accountYears(currentTaxYear(lateUtc))).toEqual([NOW + 1, NOW]);
  });
});

describe('accountYearFrom: a download names one of the two, or nothing', () => {
  it('accepts both years the page offers', () => {
    for (const year of accountYears(NOW)) expect(accountYearFrom(String(year), NOW)).toBe(year);
  });

  it('refuses the year after and the year before the window', () => {
    const [current, previous] = accountYears(NOW);

    expect(accountYearFrom(String(current + 1), NOW)).toBeNull();
    expect(accountYearFrom(String(previous - 1), NOW)).toBeNull();
  });

  it('refuses what is not a year at all, by the API read rule (R206)', () => {
    for (const raw of ['', 'abcd', ` ${String(NOW)}`, `${String(NOW)}.0`, undefined, null, NOW]) {
      expect(accountYearFrom(raw, NOW)).toBeNull();
    }

    expect(yearFrom(String(NOW))).toBe(NOW);
  });
});
