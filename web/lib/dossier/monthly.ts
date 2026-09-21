// web/lib/dossier/monthly.ts
//
// The monthly breakdown, and its cumulative column. FW24 increment 3.
//
// ============================================================================
// THE CUMULATIVE COLUMN IS COMPUTED, NOT ACCUMULATED
// ============================================================================
//
// SPEC 12 item 4: a monthly table ending in "cumul % declarable". The obvious
// implementation adds each month's percentage to a running total, or averages
// them. Both are wrong, and wrong in the way that is hardest to see:
//
//   `declarableRate` is TRUNCATED to two decimals for the AFC. Accumulating
//   percentages truncates twelve times and the error compounds in one
//   direction - every row looks plausible, the arithmetic looks consistent,
//   and only the December figure disagrees with the annual one.
//
//   A weighted average over months would be arithmetically closer and still
//   wrong, because the denominator is not a sum of monthly denominators: it is
//   prorated once over the year (SPEC 7.4), and twelve prorations do not add
//   up to one.
//
// So each month's cumulative figure is the ENGINE's answer for January through
// that month. Twelve engine calls, no arithmetic here. That is the same rule as
// everywhere else in this service - every figure comes from the engine - and it
// is stated here because this is the one place where an alternative is
// tempting and looks correct.
//
// A test asserts December's cumulative EQUALS the annual result, which is the
// assertion that fails under accumulation and passes under computation.

import {
  calculateTelework,
  type TeleworkInput,
  type TeleworkResult,
  type ValidationError,
} from '@/lib/calc-engine';
import {
  type AggregatableEntry,
  type AggregatableUser,
  countDays,
  toTeleworkInput,
} from '@/lib/dossier/aggregate';

/** Twelve, named, so no bare month count appears below. */
const MONTHS_IN_YEAR = 12;

export interface MonthRow {
  /** 1-12. The dossier renders the name; this is the number it renders from. */
  readonly month: number;
  readonly swissDays: number;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
  readonly absenceDays: number;
  /**
   * The declarable rate for JANUARY THROUGH THIS MONTH, from the engine.
   *
   * Not this month's rate, and not a running sum. The dossier's column is
   * "cumul", and a reader comparing December's figure with the annual one must
   * find them equal.
   */
  readonly cumulativeDeclarableRate: number;
}

/**
 * The engine's answer, or a throw naming why it refused.
 *
 * ============================================================================
 * THE ENGINE RETURNS A Result, AND IGNORING THAT COST THREE GREEN TESTS
 * ============================================================================
 *
 * `calculateTelework` returns `Result<TeleworkResult, ValidationError[]>` - a
 * discriminated union, not a bare result. The first version of this module read
 * `result.declarableRate` straight off the wrapper, which is `undefined`.
 *
 * THREE TESTS PASSED ON THAT. "December equals the annual figure" compared
 * `undefined` with `undefined`; "the column rises through the year" compared
 * `undefined` with itself twelve times; "every month has a row" never looked at
 * a rate. The one that caught it asserted the December figure was GREATER THAN
 * ZERO - a non-vacuity guard, doing exactly what R133 says it is for.
 *
 * IT THROWS RATHER THAN RETURNING A ZERO. A dossier is a legal document; a rate
 * of 0 because validation failed is indistinguishable, on the page, from a rate
 * of 0 because the person never left Switzerland. The errors name which rule
 * refused, and the caller decides what to show - this module will not invent a
 * figure to keep a table full.
 */
function unwrap(result: ReturnType<typeof calculateTelework>): TeleworkResult {
  if (result.ok) return result.value;

  const reasons = (result.error as readonly ValidationError[])
    .map((error) => JSON.stringify(error))
    .join('; ');

  throw new Error(`the engine refused this input: ${reasons}`);
}

/** One engine call, from a built input. */
function run(input: TeleworkInput): TeleworkResult {
  return unwrap(calculateTelework(input));
}

/** The month a stored day belongs to, 1-12. */
function monthOf(dayDate: Date): number {
  // getUTCMonth, because dayDate is a @db.Date holding UTC midnight (R28). A
  // local getter would put 1 January into December for anyone west of
  // Greenwich - the FW6 defect, in a different function.
  return dayDate.getUTCMonth() + 1;
}

/**
 * The twelve rows.
 *
 * EVERY MONTH IS PRESENT, including months with no entries at all. SPEC 12's
 * annex prints unlogged days as *Non renseigne* rather than skipping them, and
 * a table that omits an empty month makes the same claim by omission: that
 * nothing needed reporting. A month with no rows has zero days and carries the
 * cumulative rate it inherited, which is the true statement about it.
 */
export function monthlyBreakdown(
  user: AggregatableUser,
  entries: readonly AggregatableEntry[],
  taxYear: number,
): MonthRow[] {
  const rows: MonthRow[] = [];

  for (let month = 1; month <= MONTHS_IN_YEAR; month += 1) {
    const inMonth = entries.filter((entry) => monthOf(entry.dayDate) === month);
    const counts = countDays(inMonth);

    // THE CUMULATIVE SLICE: everything up to and including this month, handed
    // to the engine as one year-to-date. Not this month's rows, and not a
    // number carried forward.
    const toDate = entries.filter((entry) => monthOf(entry.dayDate) <= month);
    const result = run(toTeleworkInput(user, toDate, taxYear));

    rows.push({
      month,
      swissDays: counts.swissDays,
      teleworkDays: counts.teleworkDays,
      missionDaysFrance: counts.missionDaysFrance,
      missionDaysThirdState: counts.missionDaysThirdState,
      absenceDays: counts.absenceDays,
      cumulativeDeclarableRate: result.declarableRate,
    });
  }

  return rows;
}

/** The whole year, from the engine, in one call. */
export function annualResult(
  user: AggregatableUser,
  entries: readonly AggregatableEntry[],
  taxYear: number,
): TeleworkResult {
  return run(toTeleworkInput(user, entries, taxYear));
}
