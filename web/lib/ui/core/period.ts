// web/lib/ui/core/period.ts
//
// A start-of-activity date becomes TeleworkInput's periodFraction.
//
// WHY IT LIVES HERE rather than in the engine. The engine takes periodFraction
// as a number and says nothing about where it came from (SPEC 7.4); turning a
// calendar day into that number is a presentation concern, and putting it in
// lib/calc-engine would add a second way to express the same input. The FW11
// prompt places it here for that reason.
//
// PURE, AND NO CLOCK. R28: a calendar day is an ISO string, never a Date, and
// nothing here reads the host date or a timezone. FW6 measured what happens
// otherwise - an unpinned formatter that was right in the dev checkout AND
// right in CI, both non-western, and a day wrong for every user west of
// Greenwich. The Date objects below exist only to do arithmetic on a UTC
// instant built from the string; no calendar field is ever read from "now".
//
// THE ROUND-TRIP CHECK IS NOT OPTIONAL, and formatDate found out first: new
// Date does not reject an impossible day, it ROLLS IT OVER. '2026-02-29'
// parses to 1 March 2026. A NaN check alone would accept it and shift the
// fraction by a day with nothing to show for it, so the canonical ISO day is
// rebuilt from the parsed fields and required to equal the input.

/** 24 hours. Written from its factors so no bare millisecond count appears. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const JANUARY = 1;
const DECEMBER = 12;
const FIRST_DAY = 1;
const LAST_DAY_OF_DECEMBER = 31;

/** The UTC midnight of an ISO YYYY-MM-DD day, or a RangeError. */
function utcMidnight(isoDay: string): Date {
  const parsed = new Date(`${isoDay}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(
      `remainingYearFraction needs an ISO YYYY-MM-DD day, received ${JSON.stringify(isoDay)}`,
    );
  }

  const year = String(parsed.getUTCFullYear()).padStart(4, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');

  if (`${year}-${month}-${day}` !== isoDay) {
    throw new RangeError(
      `${JSON.stringify(isoDay)} is not a real calendar day in ISO YYYY-MM-DD form`,
    );
  }

  return parsed;
}

/** Whole days between two UTC midnights. Both are exact multiples of a day. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * The fraction of `taxYear` still to be worked from `isoDay`, counted
 * inclusively.
 *
 * INCLUSIVE, because somebody who starts on 31 December works that day. An
 * exclusive count would return 0 for a real working day, and 0 is the one
 * value SPEC 7.4 forbids - so the mistake would surface as a validation error
 * on a date the user entered correctly.
 *
 * OUTSIDE THE YEAR, two answers and neither is an exception:
 *
 *   before  1. The contract predates the year, so the whole year is worked.
 *              This is the common case of a date field left filled in from a
 *              previous year rather than an error.
 *   after   0. Nonsense, and returned as a number the ENGINE rejects with
 *              PERIOD_OUT_OF_RANGE. The alternative - throwing, or clamping
 *              to something plausible - would put a second opinion about what
 *              a valid period is inside the form, where SPEC 7.4 already
 *              says.
 *
 * @param isoDay  the first day worked, ISO YYYY-MM-DD (R28)
 * @param taxYear the calendar year being calculated
 */
export function remainingYearFraction(isoDay: string, taxYear: number): number {
  const start = utcMidnight(isoDay);
  const startYear = start.getUTCFullYear();

  if (startYear < taxYear) return 1;
  if (startYear > taxYear) return 0;

  const firstOfYear = new Date(Date.UTC(taxYear, JANUARY - 1, FIRST_DAY));
  const lastOfYear = new Date(Date.UTC(taxYear, DECEMBER - 1, LAST_DAY_OF_DECEMBER));

  const daysInYear = daysBetween(firstOfYear, lastOfYear) + 1;
  const remaining = daysBetween(start, lastOfYear) + 1;

  return remaining / daysInYear;
}
