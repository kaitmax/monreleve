// web/tests/unit/lamal/compare.test.ts
//
// R657 (the FW-COMPARATEUR prompt's R641): THE CALCULATION IS PURE, TESTED,
// AND ROUNDS AS THE TEXTS DO.
//
// Every regulatory parameter at its boundary - the allowance (25 % of the
// PASS), the floor the texts do not write (PARK-28), the absence of a ceiling,
// the rounding to the nearest euro - for both years; a household of one and of
// several; the age classes at their bounds; and a missing premium year refused
// rather than answered with another year's figures.
//
// LITERALS ARE THE ASSERTION HERE (R171). 48 060 and 48 900 are the published
// PASS; 209,30 CHF is a published premium (2027_Praemien_EU.csv, insurer 1562,
// adult, without accident). Where an expectation is a combination of the
// thirteen insurers, it is recomputed by a deliberately naive loop below
// rather than typed, and one combination is pinned literally as well.

import { describe, expect, it } from 'vitest';
import { compare, median } from '@/lib/lamal/compare';
import { PREMIUMS_2027 } from '@/lib/lamal/premiums-2027.generated';
import { AVAILABLE_YEARS, DEFAULT_YEAR } from '@/lib/lamal/years';
import type { ComparatorInput, Comparison } from '@/lib/lamal/types';

const ADULT_FRONTALIER = { birthYear: 1985, withAccident: false };

function ok(input: ComparatorInput): Comparison {
  const result = compare(input);

  if (!result.ok) throw new Error(`expected a comparison, got ${result.error.code}`);

  return result.value;
}

describe('the years', () => {
  it('offers 2026 and 2027, newest first, and defaults to the newest', () => {
    expect(AVAILABLE_YEARS).toEqual([2027, 2026]);
    expect(DEFAULT_YEAR).toBe(2027);
  });

  it('REFUSES a premium year it does not hold, rather than answering with another', () => {
    for (const year of [2025, 2028]) {
      const result = compare({ year, incomeEur: 40000, persons: [ADULT_FRONTALIER] });

      expect(result).toEqual({ ok: false, error: { code: 'YEAR_UNAVAILABLE', year } });
    }
  });

  it('never mixes years: 2026 takes the 2026 premiums AND the 2026 PASS', () => {
    const y2026 = ok({ year: 2026, incomeEur: 40000, persons: [ADULT_FRONTALIER] });
    const y2027 = ok({ year: 2027, incomeEur: 40000, persons: [ADULT_FRONTALIER] });

    expect(y2026.year.passEur).toBe(48060);
    expect(y2026.year.passStatus).toBe('final');
    expect(y2026.french.allowanceEur).toBe(12015);
    // 2026, insurer 1562, adult without accident: 200,00 CHF a month.
    expect(y2026.swiss.lowestCentimes).toBe(12 * 20000);

    expect(y2027.year.passEur).toBe(48900);
    expect(y2027.year.passStatus).toBe('announced');
    expect(y2027.french.allowanceEur).toBe(12225);
    // 2027, insurer 1562, adult without accident: 209,30 CHF a month.
    expect(y2027.swiss.lowestCentimes).toBe(12 * 20930);
  });
});

describe('the input', () => {
  it('refuses an income that is not a whole, non-negative number of euros', () => {
    for (const incomeEur of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(compare({ year: 2027, incomeEur, persons: [ADULT_FRONTALIER] })).toEqual({
        ok: false,
        error: { code: 'INCOME_INVALID' },
      });
    }
  });

  it('refuses an empty household - the frontalier is always the first person', () => {
    expect(compare({ year: 2027, incomeEur: 40000, persons: [] })).toEqual({
      ok: false,
      error: { code: 'NO_PERSON' },
    });
  });

  it('refuses a year of birth after the premium year, or implausibly early, naming the person', () => {
    const cases: [number, number][] = [
      [2028, 1],
      [1896, 1],
      [1990.5, 1],
    ];

    for (const [birthYear, index] of cases) {
      expect(
        compare({ year: 2027, incomeEur: 0, persons: [ADULT_FRONTALIER, { birthYear, withAccident: true }] }),
      ).toEqual({ ok: false, error: { code: 'BIRTH_YEAR_INVALID', index } });
    }
  });

  it('accepts a child born in the premium year itself (age 0)', () => {
    const result = ok({ year: 2027, incomeEur: 0, persons: [ADULT_FRONTALIER, { birthYear: 2027, withAccident: true }] });

    expect(result.persons[1]).toMatchObject({ age: 0, ageClass: 'child' });
  });
});

describe('the age classes, from the year of birth (LAMal art. 16a, OAMal art. 91 al. 3)', () => {
  const classOf = (birthYear: number): string =>
    ok({ year: 2027, incomeEur: 0, persons: [{ birthYear, withAccident: true }] }).persons[0]!.ageClass;

  it('is a child at 18 on 31 December - the bound DERIVED from 19 (al. 1)', () => {
    expect(classOf(2009)).toBe('child');
  });

  it('is a young adult from 19 to 25 on 31 December (al. 1)', () => {
    expect(classOf(2008)).toBe('youngAdult');
    expect(classOf(2002)).toBe('youngAdult');
  });

  it('is an adult from 26 (al. 4, read with al. 1)', () => {
    expect(classOf(2001)).toBe('adult');
    expect(classOf(1940)).toBe('adult');
  });

  it('follows the premium year chosen: born 2008 is 18 in 2026 and 19 in 2027', () => {
    const in2026 = ok({ year: 2026, incomeEur: 0, persons: [{ birthYear: 2008, withAccident: true }] });

    expect(in2026.persons[0]).toMatchObject({ age: 18, ageClass: 'child' });
    expect(classOf(2008)).toBe('youngAdult');
  });
});

describe('the French contribution: 8 % x (A - 0,25 x PASS), rounded to the euro (D380-2 I, URSSAF)', () => {
  const french = (year: number, incomeEur: number) =>
    ok({ year, incomeEur, persons: [ADULT_FRONTALIER] }).french;

  it('is exactly zero at the allowance, and NOT floored there - the formula gives 0 itself', () => {
    expect(french(2027, 12225)).toEqual({ baseEur: 0, contributionEur: 0, floored: false, allowanceEur: 12225 });
    expect(french(2026, 12015)).toEqual({ baseEur: 0, contributionEur: 0, floored: false, allowanceEur: 12015 });
  });

  it('is shown as 0 one euro below the allowance, and says it was floored (PARK-28)', () => {
    expect(french(2027, 12224)).toEqual({ baseEur: 0, contributionEur: 0, floored: true, allowanceEur: 12225 });
    expect(french(2027, 0)).toMatchObject({ contributionEur: 0, floored: true });
  });

  it('rounds to the NEAREST euro: 0,48 -> 0 and 0,56 -> 1', () => {
    expect(french(2027, 12225 + 6)).toMatchObject({ baseEur: 6, contributionEur: 0 });
    expect(french(2027, 12225 + 7)).toMatchObject({ baseEur: 7, contributionEur: 1 });
  });

  it('computes a worked case in each year', () => {
    // 2027: (40 000 - 12 225) x 8 % = 2 222,00
    expect(french(2027, 40000)).toEqual({ baseEur: 27775, contributionEur: 2222, floored: false, allowanceEur: 12225 });
    // 2026: (40 000 - 12 015) x 8 % = 2 238,80 -> 2 239
    expect(french(2026, 40000)).toEqual({ baseEur: 27985, contributionEur: 2239, floored: false, allowanceEur: 12015 });
  });

  it('has no ceiling - none is written - so a large income is computed in full', () => {
    // (1 000 000 - 12 225) x 8 % = 79 022
    expect(french(2027, 1_000_000)).toMatchObject({ baseEur: 987775, contributionEur: 79022 });
  });

  it('is ONE contribution whatever the household: dependants add nothing (URSSAF 6d)', () => {
    const one = ok({ year: 2027, incomeEur: 60000, persons: [ADULT_FRONTALIER] });
    const four = ok({
      year: 2027,
      incomeEur: 60000,
      persons: [
        ADULT_FRONTALIER,
        { birthYear: 1987, withAccident: true },
        { birthYear: 2015, withAccident: true },
        { birthYear: 2019, withAccident: true },
      ],
    });

    expect(four.french).toEqual(one.french);
    expect(four.swiss.lowestCentimes).toBeGreaterThan(one.swiss.lowestCentimes);
  });
});

describe('the Swiss side: each insurer prices the household, then the lowest, median and highest', () => {
  /** The naive re-statement: one insurer, every person, 12 months. */
  function totals(persons: ComparatorInput['persons'], year = 2027): number[] {
    return PREMIUMS_2027.insurers
      .map((insurer) =>
        persons.reduce((sum, person) => {
          const age = year - person.birthYear;
          const premiums = age <= 18 ? insurer.child : age <= 25 ? insurer.youngAdult : insurer.adult;

          return sum + 12 * (person.withAccident ? premiums.withAccident : premiums.withoutAccident);
        }, 0),
      )
      .sort((a, b) => a - b);
  }

  it('a household of one: 12 x the monthly premium, across the 13 insurers', () => {
    const result = ok({ year: 2027, incomeEur: 40000, persons: [ADULT_FRONTALIER] });
    const expected = totals([ADULT_FRONTALIER]);

    expect(result.swiss.insurerCount).toBe(13);
    expect(result.swiss.lowestCentimes).toBe(expected[0]);
    expect(result.swiss.medianCentimes).toBe(expected[6]);
    expect(result.swiss.highestCentimes).toBe(expected[12]);
    // Pinned as published: 209,30 / 489,30 / 823,10 CHF a month.
    expect([result.swiss.lowestCentimes, result.swiss.medianCentimes, result.swiss.highestCentimes]).toEqual([
      12 * 20930,
      12 * 48930,
      12 * 82310,
    ]);
  });

  it('a household of several: the frontalier, a partner and two children, accident cover per person', () => {
    const persons = [
      ADULT_FRONTALIER,
      { birthYear: 1988, withAccident: true },
      { birthYear: 2016, withAccident: true },
      { birthYear: 2006, withAccident: false },
    ];
    const result = ok({ year: 2027, incomeEur: 40000, persons });
    const expected = totals(persons);

    expect(result.persons.map((person) => person.ageClass)).toEqual(['adult', 'adult', 'child', 'youngAdult']);
    expect(result.swiss.lowestCentimes).toBe(expected[0]);
    expect(result.swiss.medianCentimes).toBe(expected[6]);
    expect(result.swiss.highestCentimes).toBe(expected[12]);
  });

  it('switching accident cover changes the premium - and only for that person', () => {
    const without = ok({ year: 2027, incomeEur: 0, persons: [ADULT_FRONTALIER] });
    const withCover = ok({ year: 2027, incomeEur: 0, persons: [{ ...ADULT_FRONTALIER, withAccident: true }] });

    // 2027, insurer 1562, adult with accident: 225,00 CHF.
    expect(withCover.swiss.lowestCentimes).toBe(12 * 22500);
    expect(without.swiss.lowestCentimes).toBe(12 * 20930);
  });

  it('converts at the ECB rate, to the euro, keeping the CHF figure', () => {
    const result = ok({ year: 2027, incomeEur: 0, persons: [ADULT_FRONTALIER] });

    // 2 511,60 CHF / 0,9239 = 2 718,47 EUR -> 2 718
    expect(result.rate).toEqual({ chfPerEurTenThousandths: 9239, date: '2026-10-27' });
    expect(result.swiss.lowestEur).toBe(2718);
  });
});

describe('which is cheaper, across the whole spread - never a verdict on a single figure', () => {
  const cheaper = (incomeEur: number) => ok({ year: 2027, incomeEur, persons: [ADULT_FRONTALIER] }).cheaper;

  it('France, when its contribution is below the LOWEST Swiss premium', () => {
    expect(cheaper(12225)).toBe('france');
  });

  it('Switzerland, when the French contribution is above the HIGHEST Swiss premium', () => {
    expect(cheaper(1_000_000)).toBe('switzerland');
  });

  it('depends - on the insurer - when the contribution falls inside the spread', () => {
    // (60 000 - 12 225) x 8 % = 3 822 EUR, between 2 718 and 10 691.
    expect(cheaper(60000)).toBe('depends');
  });

  it('depends on a tie with either bound: equal is not cheaper', () => {
    const lowestEur = ok({ year: 2027, incomeEur: 0, persons: [ADULT_FRONTALIER] }).swiss.lowestEur;
    // contribution = 8 % x base; find an income whose contribution equals lowestEur exactly.
    const base = Math.round((lowestEur * 100) / 8);
    const income = 12225 + base;
    const result = ok({ year: 2027, incomeEur: income, persons: [ADULT_FRONTALIER] });

    expect(result.french.contributionEur).toBe(lowestEur);
    expect(result.cheaper).toBe('depends');
  });
});

describe('median', () => {
  it('is the middle element of an odd count and the mean of the two middle of an even one', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
