// web/tests/unit/lamal/scenario.test.ts
//
// FW-CALCS-A2, ADDENDUM 2 (R743-R747, R751): the comparator's four new inputs
// - a joint tax return, a start date, the franc slider - and the per-insurer
// totals the chart draws, as PURE arithmetic on lib/lamal.
//
// R751 FIRST: with the default inputs (no start date, slider at 0) the
// scenario IS compare()'s result, figure for figure - that is what keeps
// e2e/calcs-figures.spec.ts green unchanged. Then each new rule at its edges.
//
// LITERALS ARE THE ASSERTION (R171) where the value is a published one or a
// pinned case: 306 days from 1 March 2027 (the addendum's own example),
// 8399 = 9239 / 1,1 (R747's own test), 209,30 CHF (insurer 1562's adult
// premium, 2027, as compare.test.ts pins it).

import { describe, expect, it } from 'vitest';
import { compare, insurerTotalsCentimes } from '@/lib/lamal/compare';
import { convertAt, francRate } from '@/lib/lamal/convert';
import { careCapCentimes } from '@/lib/lamal/cost-sharing';
import {
  countAgainst,
  coverageDays,
  householdTotals,
  jointIncomeEur,
  proratedContributionEur,
  scenario,
  swissMonthsFrom,
  type Scenario,
  type ScenarioInput,
} from '@/lib/lamal/scenario';
import { EXCHANGE_RATE } from '@/lib/lamal/years';
import type { Comparison } from '@/lib/lamal/types';

const ADULT = { birthYear: 1985, withAccident: false };

function ok(input: ScenarioInput): Scenario {
  const result = scenario(input);

  if (!result.ok) throw new Error(`expected a scenario, got ${result.error.code}`);

  return result.value;
}

function compared(incomeEur: number, persons = [ADULT], year = 2027): Comparison {
  const result = compare({ year, incomeEur, persons });

  if (!result.ok) throw new Error(result.error.code);

  return result.value;
}

describe('R751: the default inputs are compare() exactly', () => {
  it.each([
    [42000, [ADULT]],
    [73519, [ADULT, { birthYear: 2016, withAccident: true }]],
    [12000, [ADULT]],
    [1_000_000, [ADULT]],
  ])('income %i: no start date and the slider at 0 give compare()’s result', (incomeEur, persons) => {
    const expected = compared(incomeEur, persons);

    expect(ok({ year: 2027, incomeEur, persons }).comparison).toEqual(expected);
    expect(ok({ year: 2027, incomeEur, persons, francShiftPercent: 0 }).comparison).toEqual(expected);
    expect(ok({ year: 2027, incomeEur, persons }).period).toBeNull();
  });

  it('passes compare()’s refusals through unchanged', () => {
    expect(scenario({ year: 2025, incomeEur: 1, persons: [ADULT] })).toEqual(
      compare({ year: 2025, incomeEur: 1, persons: [ADULT] }),
    );
  });
});

describe('R743: the joint tax return - personal + half of what is received in common', () => {
  it('adds half of the common income to the personal income', () => {
    expect(jointIncomeEur(38000, 8000)).toBe(42000);
  });

  it('counts an empty common field as 0', () => {
    expect(jointIncomeEur(38000, 0)).toBe(38000);
  });

  it('rounds an odd half DOWN, never in the reader’s disfavour (L10 needs a tie rule here)', () => {
    expect(jointIncomeEur(38000, 8001)).toBe(42000);
    expect(jointIncomeEur(0, 1)).toBe(0);
  });
});

describe('R744: the French prorata - days from the start to 31 December, both counted', () => {
  it('pins 1 March 2027 at 306 days (the addendum’s own case)', () => {
    expect(coverageDays('2027-03-01')).toBe(306);
  });

  it('counts a whole non-leap year as 365, and 31 December as 1', () => {
    expect(coverageDays('2027-01-01')).toBe(365);
    expect(coverageDays('2027-12-31')).toBe(1);
  });

  it('counts 29 February in a leap year', () => {
    expect(coverageDays('2028-02-29')).toBe(307);
    expect(coverageDays('2028-03-01')).toBe(306);
  });

  it('rounds once, at the end: round(base x 8 % x days / 365) (URSSAF 6a, L9, L10)', () => {
    // (42 000 - 12 225) x 8 % x 306 / 365 = 1 996,96 -> 1 997
    expect(proratedContributionEur(29775, 8, 306)).toBe(1997);
    // A whole year is the unprorated figure: 2 382 (calcs-figures.spec.ts).
    expect(proratedContributionEur(29775, 8, 365)).toBe(2382);
  });
});

describe('R744, S2 NOT ESTABLISHED: the Swiss side counts whole months from the month AFTER the start', () => {
  it('does not count the start month, whatever the day', () => {
    expect(swissMonthsFrom('2027-03-01')).toBe(9);
    expect(swissMonthsFrom('2027-03-15')).toBe(9);
    expect(swissMonthsFrom('2027-03-31')).toBe(9);
  });

  it('counts 11 months from 1 January and none from December (the edges the report names)', () => {
    expect(swissMonthsFrom('2027-01-01')).toBe(11);
    expect(swissMonthsFrom('2027-12-01')).toBe(0);
  });
});

describe('R745: one household total per insurer', () => {
  it('lists one total per insurer in the dataset, sorted, bounded by compare()’s spread', () => {
    const comparison = compared(42000);
    const totals = insurerTotalsCentimes(comparison.year, comparison.persons);

    expect(totals).toHaveLength(comparison.year.premiums.insurers.length);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
    expect(totals[0]).toBe(comparison.swiss.lowestCentimes);
    expect(totals[totals.length - 1]).toBe(comparison.swiss.highestCentimes);
    // 2027, insurer 1562, adult without accident: 209,30 CHF a month.
    expect(totals[0]).toBe(12 * 20930);
  });

  it('counts the months it is given', () => {
    const comparison = compared(42000);

    expect(insurerTotalsCentimes(comparison.year, comparison.persons, 9)[0]).toBe(9 * 20930);
  });

  it('converts each total at the comparison’s rate, as compare() converts its three', () => {
    const comparison = compared(73519, [ADULT, { birthYear: 2016, withAccident: true }]);
    const totals = householdTotals(comparison, 12);

    expect(totals[0]?.eur).toBe(comparison.swiss.lowestEur);
    expect(totals[totals.length - 1]?.eur).toBe(comparison.swiss.highestEur);
  });

  it('counts the totals above and below the French contribution, agreeing with the case sentence', () => {
    for (const income of [12225, 60000, 1_000_000]) {
      const comparison = compared(income);
      const count = countAgainst(
        householdTotals(comparison, 12).map((total) => total.eur),
        comparison.french.contributionEur,
      );

      expect(count.count).toBe(comparison.year.premiums.insurers.length);

      if (comparison.cheaper === 'france') expect(count.above).toBe(count.count);
      if (comparison.cheaper === 'switzerland') expect(count.below).toBe(count.count);
      if (comparison.cheaper === 'depends') {
        expect(count.above).toBeLessThan(count.count);
        expect(count.below).toBeLessThan(count.count);
      }
    }
  });

  it('counts a tie as neither above nor below', () => {
    expect(countAgainst([1, 2, 3], 2)).toEqual({ above: 1, below: 1, count: 3 });
  });
});

describe('R747: the franc slider, -10 % to +10 % around the ECB reference', () => {
  it('is the reference itself at 0', () => {
    expect(francRate(EXCHANGE_RATE, 0)).toEqual(EXCHANGE_RATE);
  });

  it('is the reference / 1,1 at +10 % (a stronger franc), rounded to the ten-thousandth', () => {
    expect(francRate(EXCHANGE_RATE, 10)).toEqual({ chfPerEurTenThousandths: 8399, date: EXCHANGE_RATE.date });
  });

  it('is the reference / 0,9 at -10 %', () => {
    expect(francRate(EXCHANGE_RATE, -10).chfPerEurTenThousandths).toBe(10266);
  });

  it('converts as compare() does: 2 511,60 CHF at 0,9239 is 2 718 EUR', () => {
    expect(convertAt(251160, EXCHANGE_RATE)).toBe(2718);
  });

  it('moves every Swiss euro figure and no French one; at 0 the result is the reference', () => {
    const reference = ok({ year: 2027, incomeEur: 42000, persons: [ADULT] }).comparison;
    const stronger = ok({ year: 2027, incomeEur: 42000, persons: [ADULT], francShiftPercent: 10 }).comparison;

    expect(stronger.rate.chfPerEurTenThousandths).toBe(8399);
    // 2 511,60 CHF / 0,8399 = 2 990,36 -> 2 990
    expect(stronger.swiss.lowestEur).toBe(2990);
    expect(stronger.swiss.lowestCentimes).toBe(reference.swiss.lowestCentimes);
    expect(stronger.french).toEqual(reference.french);
  });

  it('refuses a shift outside the slider or not whole', () => {
    for (const francShiftPercent of [11, -11, 2.5]) {
      expect(scenario({ year: 2027, incomeEur: 42000, persons: [ADULT], francShiftPercent })).toEqual({
        ok: false,
        error: { code: 'SHIFT_INVALID' },
      });
    }
  });
});

describe('R744: a scenario that starts on a date', () => {
  it('prorates the French side by days and counts the Swiss months from the next month', () => {
    const result = ok({ year: 2027, incomeEur: 42000, persons: [ADULT], startIso: '2027-03-01' });

    expect(result.period).toEqual({ startIso: '2027-03-01', days: 306, months: 9 });
    expect(result.comparison.french.contributionEur).toBe(1997);
    expect(result.comparison.french.baseEur).toBe(29775);
    expect(result.comparison.swiss.lowestCentimes).toBe(9 * 20930);
    expect(result.comparison.swiss.lowestEur).toBe(convertAt(9 * 20930, EXCHANGE_RATE));
  });

  it('refuses a start date outside the compared year, or not a real day', () => {
    for (const startIso of ['2026-12-31', '2028-01-01', '2027-02-30', '01.03.2027', '']) {
      expect(scenario({ year: 2027, incomeEur: 42000, persons: [ADULT], startIso })).toEqual({
        ok: false,
        error: { code: 'START_INVALID' },
      });
    }
  });
});

describe('R746 (S1): the most the household pays on top of the premiums in a year', () => {
  const persons = (...births: number[]) => compared(42000, births.map((birthYear) => ({ birthYear, withAccident: true })));

  it('is franchise + the capped share for an adult and a young adult: 300 + 700 CHF (OAMal art. 103 al. 1-2)', () => {
    const adult = persons(1985);
    const young = persons(2005);

    expect(careCapCentimes(adult.year, adult.persons)).toBe(100000);
    expect(careCapCentimes(young.year, young.persons)).toBe(100000);
  });

  it('is the halved share alone for a child: 350 CHF (LAMal art. 64 al. 4)', () => {
    const household = persons(1985, 2016);

    expect(careCapCentimes(household.year, household.persons)).toBe(135000);
  });

  it('caps several children together at what one adult pays (LAMal art. 64 al. 4, second sentence)', () => {
    const two = persons(1985, 2016, 2018);
    const three = persons(1985, 2016, 2018, 2020);

    expect(careCapCentimes(two.year, two.persons)).toBe(170000);
    expect(careCapCentimes(three.year, three.persons)).toBe(200000);
  });
});
