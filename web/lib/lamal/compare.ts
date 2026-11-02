// web/lib/lamal/compare.ts
//
// R657 (the FW-COMPARATEUR prompt's R641): THE CALCULATION IS PURE, AND ROUNDS
// AS THE TEXTS DO. No React, no I/O, no clock: the year is an input, the data
// is a static import, and the function never throws - a bad input is a
// Result, mapped to French copy by lib/fr/lamal.ts.
//
// THE FRENCH SIDE (rows L7-L11, rulings R669, R670):
//   contribution = 8 % x (A - 0,25 x PASS)              CSS art. D380-2 I
//   base and contribution rounded to the nearest euro   URSSAF 6a
//   negative -> 0, flagged, never presented as a rule   PARK-28
//   one contribution, whatever the household            URSSAF 6d
//   a whole year here; a start date is prorated by      D380-2 II, URSSAF 6a
//   days in lib/lamal/scenario.ts (FW-CALCS-A2, R744)
// With A in whole euros and the PASS a multiple of four the base is whole,
// and 8 % of a whole number of euros is never exactly half a euro, so the
// rounding never meets a tie.
//
// THE SWISS SIDE (rows L1-L6, rulings R665-R668): each insurer's monthly
// premium for each person - class from the year of birth, with or without
// accident cover - summed over the household, times 12. Then the LOWEST, the
// MEDIAN and the HIGHEST of those household totals across the insurers. One
// insurer for the whole household is how a total is formed; a household can
// in fact split across insurers, which the page says.
//
// WHICH IS CHEAPER is answered across the whole spread, in euros at the ECB
// rate: France only below the lowest, Switzerland only above the highest,
// otherwise `depends`. A tie is `depends`. The page words `france` and
// `switzerland` as "moins cher selon ces hypothèses" - never a verdict (R673).

import type {
  AgeClass,
  Cheaper,
  ComparatorInput,
  ComparatorResult,
  ComparatorYear,
  ExchangeRate,
  FrenchContribution,
  InsurerPremiums,
  PersonResult,
  SwissSpread,
} from './types';
import { convertAt } from './convert';
import { EXCHANGE_RATE, comparatorYear } from './years';

/** L3: the premium is monthly; a whole year is twelve of them. */
export const MONTHS_PER_YEAR = 12;

/** The oldest plausible year of birth relative to the premium year. */
const MAX_AGE = 130;

/**
 * The class for an age reached on 31 December (LAMal art. 16a al. 1 and 4;
 * OAMal art. 91 al. 3). The child bound - 18 and under - is DERIVED from the
 * young-adult range, not quoted (R666).
 */
export function ageClassFor(age: number): AgeClass {
  if (age <= 18) return 'child';
  if (age <= 25) return 'youngAdult';

  return 'adult';
}

/** The middle value; the mean of the two middle values for an even count. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle]!;

  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Exported for lib/lamal/scenario.ts (FW-CALCS-A2); unchanged. */
export function french(year: ComparatorYear, incomeEur: number): FrenchContribution {
  const allowanceEur = Math.round((year.passEur * year.allowancePercentOfPass) / 100);
  const formulaBase = Math.round(incomeEur - allowanceEur);
  const floored = formulaBase < 0;
  const baseEur = floored ? 0 : formulaBase;

  return {
    baseEur,
    contributionEur: Math.round((baseEur * year.ratePercent) / 100),
    floored,
    allowanceEur,
  };
}

function householdTotal(
  insurer: InsurerPremiums,
  persons: readonly PersonResult[],
  months: number = MONTHS_PER_YEAR,
): number {
  return persons.reduce((sum, person) => {
    const premiums = insurer[person.ageClass];

    return sum + months * (person.withAccident ? premiums.withAccident : premiums.withoutAccident);
  }, 0);
}

/**
 * FW-CALCS-A2, R745: every insurer's total for the household, ascending -
 * one figure per insurer in the dataset, never named. A whole year unless a
 * number of months is given (R744). swiss() below reads its spread from this
 * same list, so the chart's dots and the three figures cannot disagree.
 */
export function insurerTotalsCentimes(
  year: ComparatorYear,
  persons: readonly PersonResult[],
  months: number = MONTHS_PER_YEAR,
): number[] {
  return year.premiums.insurers.map((insurer) => householdTotal(insurer, persons, months)).sort((a, b) => a - b);
}

function swiss(year: ComparatorYear, persons: readonly PersonResult[]): SwissSpread {
  return spreadOf(insurerTotalsCentimes(year, persons), EXCHANGE_RATE);
}

/**
 * The lowest, median and highest of a sorted list of totals, converted at a
 * rate. Exported for lib/lamal/scenario.ts (FW-CALCS-A2): a partial year and
 * the franc slider build their spread with this same function.
 */
export function spreadOf(totals: readonly number[], rate: ExchangeRate): SwissSpread {
  // CHF centimes to whole euros. FW-CALCS-A2: the arithmetic is convertAt
  // (lib/lamal/convert.ts), the function compare() used inline before, so the
  // franc slider converts with the SAME function - identical at 0.
  const at = (centimes: number): number => convertAt(centimes, rate);
  const lowestCentimes = totals[0]!;
  const highestCentimes = totals[totals.length - 1]!;
  const medianCentimes = Math.round(median(totals));

  return {
    lowestCentimes,
    medianCentimes,
    highestCentimes,
    lowestEur: at(lowestCentimes),
    medianEur: at(medianCentimes),
    highestEur: at(highestCentimes),
    insurerCount: totals.length,
  };
}

/**
 * Which side is cheaper across the whole spread. Exported for
 * lib/lamal/scenario.ts (FW-CALCS-A2); the rule is unchanged.
 */
export function cheaperOf(contribution: number, swissSide: SwissSpread): Cheaper {
  return contribution < swissSide.lowestEur ? 'france'
    : contribution > swissSide.highestEur ? 'switzerland'
      : 'depends';
}

export function compare(input: ComparatorInput): ComparatorResult {
  const year = comparatorYear(input.year);

  if (year === undefined) return { ok: false, error: { code: 'YEAR_UNAVAILABLE', year: input.year } };

  if (!Number.isInteger(input.incomeEur) || input.incomeEur < 0) {
    return { ok: false, error: { code: 'INCOME_INVALID' } };
  }

  if (input.persons.length === 0) return { ok: false, error: { code: 'NO_PERSON' } };

  const persons: PersonResult[] = [];

  for (const [index, person] of input.persons.entries()) {
    const age = input.year - person.birthYear;

    if (!Number.isInteger(person.birthYear) || age < 0 || age > MAX_AGE) {
      return { ok: false, error: { code: 'BIRTH_YEAR_INVALID', index } };
    }

    persons.push({ ...person, age, ageClass: ageClassFor(age) });
  }

  const swissSide = swiss(year, persons);
  const frenchSide = french(year, input.incomeEur);
  const cheaper = cheaperOf(frenchSide.contributionEur, swissSide);

  return {
    ok: true,
    value: {
      year,
      rate: EXCHANGE_RATE,
      incomeEur: input.incomeEur,
      persons,
      swiss: swissSide,
      french: frenchSide,
      cheaper,
    },
  };
}

