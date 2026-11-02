// web/lib/lamal/scenario.ts
//
// FW-CALCS-A2, ADDENDUM 2: the comparator's new inputs, on top of compare().
// Pure, like compare(): no React, no I/O, no clock (R657).
//
// R751 - THE DEFAULT IS compare() ITSELF. With no start date and the slider
// at 0 this returns compare()'s own result object, untouched: the figures
// e2e/calcs-figures.spec.ts pins cannot move, because nothing recomputes
// them. Only a start date or a moved slider builds a different Comparison,
// and it builds it from compare()'s own pieces (french, insurerTotalsCentimes,
// spreadOf, cheaperOf, convertAt).
//
// R743 - THE JOINT RETURN (URSSAF 6b, row L8): personal income + half of the
// income received in common. Both fields are whole euros (parseIncome), so
// the half can end in ,50 - a tie L10's "à l'euro le plus proche" does not
// settle. It is rounded DOWN, the reader's side (row L10's note).
//
// R744 - A START DATE:
//   FRENCH  round(base x 8 % x days / 365), the base already rounded - URSSAF
//           6a's formula and order (rows L9, L10); days from the start to
//           31 December, BOTH counted (1 March 2027 = 306).
//   SWISS   S2 IS NOT ESTABLISHED for a frontalier (sources-2026-11.md S2.1-
//           S2.3 name birth, a move and death only; row L16). R744's fallback,
//           literally: whole months FROM THE MONTH AFTER the start - the start
//           month is never counted, even when the start is the 1st - and the
//           page says so ("mois de début non compté : règle non vérifiée").
//
// R747 - THE FRANC SLIDER: whole percent, -10 to +10; the Swiss euro figures
// are converted at francRate(reference, shift) (convert.ts). The French side
// is in euros and does not move.

import { MONTHS_PER_YEAR, cheaperOf, compare, french, insurerTotalsCentimes, spreadOf } from './compare';
import { FRANC_SHIFT_LIMIT_PERCENT, convertAt, francRate } from './convert';
import type { ComparatorError, Comparison, CoveragePeriod, PersonInput } from './types';
import { EXCHANGE_RATE } from './years';

/** URSSAF 6a: "× nombre de jours ÷ 365" (row L9). */
export const PRORATA_YEAR_DAYS = 365;

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ScenarioInput {
  readonly year: number;
  /** A, in whole euros - for a joint return, jointIncomeEur's result. */
  readonly incomeEur: number;
  readonly persons: readonly PersonInput[];
  /** R744: the ISO day the affiliation starts; absent for the whole year. */
  readonly startIso?: string;
  /** R747: the slider, whole percent from -10 to +10; absent or 0 is the ECB reference. */
  readonly francShiftPercent?: number;
}

export interface Scenario {
  /** The panel's Comparison - compare()'s own object for the default inputs. */
  readonly comparison: Comparison;
  readonly period: CoveragePeriod | null;
  readonly francShiftPercent: number;
}

export type ScenarioError = ComparatorError | { readonly code: 'START_INVALID' } | { readonly code: 'SHIFT_INVALID' };

export type ScenarioResult =
  | { readonly ok: true; readonly value: Scenario }
  | { readonly ok: false; readonly error: ScenarioError };

/** R743: personal + half of the common income, the half rounded down. */
export function jointIncomeEur(personalEur: number, commonEur: number): number {
  return personalEur + Math.floor(commonEur / 2);
}

/** [year, month 1-12, day] of a real ISO day, or undefined. */
function isoParts(iso: string): readonly [number, number, number] | undefined {
  const match = ISO_DAY.exec(iso);

  if (match === null) return undefined;

  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  const back = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

  return back.getUTCFullYear() === parts[0] && back.getUTCMonth() === parts[1] - 1 && back.getUTCDate() === parts[2]
    ? parts
    : undefined;
}

/** R744: days from the start to 31 December of its year, both counted. */
export function coverageDays(startIso: string): number {
  const parts = isoParts(startIso);

  if (parts === undefined) throw new RangeError(`not an ISO day: ${JSON.stringify(startIso)}`);

  const [year, month, day] = parts;

  return Math.round((Date.UTC(year, 11, 31) - Date.UTC(year, month - 1, day)) / DAY_MS) + 1;
}

/** R744's fallback: whole months from the month AFTER the start's, to December. */
export function swissMonthsFrom(startIso: string): number {
  const parts = isoParts(startIso);

  if (parts === undefined) throw new RangeError(`not an ISO day: ${JSON.stringify(startIso)}`);

  return MONTHS_PER_YEAR - parts[1];
}

/** URSSAF 6a: round(base x rate x days / 365), one rounding, at the end. */
export function proratedContributionEur(baseEur: number, ratePercent: number, days: number): number {
  return Math.round((baseEur * ratePercent * days) / (100 * PRORATA_YEAR_DAYS));
}

export interface HouseholdTotal {
  readonly centimes: number;
  readonly eur: number;
}

/**
 * R745: one total per insurer for the comparison's household, over `months`,
 * in CHF centimes and in euros at the comparison's own rate - the dots.
 */
export function householdTotals(comparison: Comparison, months: number): readonly HouseholdTotal[] {
  return insurerTotalsCentimes(comparison.year, comparison.persons, months).map((centimes) => ({
    centimes,
    eur: convertAt(centimes, comparison.rate),
  }));
}

export interface Count {
  /** Totals strictly above the French contribution. */
  readonly above: number;
  /** Totals strictly below it. */
  readonly below: number;
  /** Every total: the number of insurers in the dataset. */
  readonly count: number;
}

/** R745's counting sentence, as numbers. A tie is neither above nor below. */
export function countAgainst(totalsEur: readonly number[], contributionEur: number): Count {
  return {
    above: totalsEur.filter((eur) => eur > contributionEur).length,
    below: totalsEur.filter((eur) => eur < contributionEur).length,
    count: totalsEur.length,
  };
}

export function scenario(input: ScenarioInput): ScenarioResult {
  const shift = input.francShiftPercent ?? 0;

  if (!Number.isInteger(shift) || Math.abs(shift) > FRANC_SHIFT_LIMIT_PERCENT) {
    return { ok: false, error: { code: 'SHIFT_INVALID' } };
  }

  const base = compare({ year: input.year, incomeEur: input.incomeEur, persons: input.persons });

  if (!base.ok) return base;

  let period: CoveragePeriod | null = null;

  if (input.startIso !== undefined) {
    const parts = isoParts(input.startIso);

    if (parts === undefined || parts[0] !== input.year) return { ok: false, error: { code: 'START_INVALID' } };

    period = { startIso: input.startIso, days: coverageDays(input.startIso), months: swissMonthsFrom(input.startIso) };
  }

  // R751: nothing to change - compare()'s own object.
  if (period === null && shift === 0) return { ok: true, value: { comparison: base.value, period, francShiftPercent: 0 } };

  const { year, persons } = base.value;
  const rate = francRate(EXCHANGE_RATE, shift);
  const fullYear = french(year, input.incomeEur);
  const frenchSide =
    period === null
      ? fullYear
      : { ...fullYear, contributionEur: proratedContributionEur(fullYear.baseEur, year.ratePercent, period.days) };
  const swissSide = spreadOf(insurerTotalsCentimes(year, persons, period?.months ?? MONTHS_PER_YEAR), rate);

  return {
    ok: true,
    value: {
      comparison: {
        ...base.value,
        rate,
        swiss: swissSide,
        french: frenchSide,
        cheaper: cheaperOf(frenchSide.contributionEur, swissSide),
      },
      period,
      francShiftPercent: shift,
    },
  };
}
