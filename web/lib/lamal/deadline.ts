// web/lib/lamal/deadline.ts
//
// FW-CALCS-A2, R748: the end of the droit d'option's three-month period, for
// the page's "Votre délai" helper. Pure; the caller passes the event's day.
//
// THE THREE MONTHS ARE SOURCED (row D1, CLEISS; ameli, OFSP, URSSAF agree:
// docs/sources/primes-lamal/sources-2026-11.md S3.1-S3.5). HOW THEY ARE
// COUNTED IS NOT: S3 was not found (that report's NOT FOUND, item 1) - no
// text says whether the period runs from the event's day or the next, or
// ends on the same date or at a month's end. So the page shows the result
// below as INDICATIVE, with "environ" and the warning to confirm with the
// fund (row L17), and this is one stated way of counting, never a rule:
//
//   the event's date plus three calendar months, the day kept, clamped to
//   the last day of the target month - 30 November -> 28 or 29 February.
//
// Clamping DOWN is deliberate: a month end never rolls over into the next
// month, so the date shown is never later than the same date three months on.

/** Row D1: the option is exercised within three months. */
export const OPTION_PERIOD_MONTHS = 3;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in a month, month 1-12, from the calendar itself (leap years included). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The period's end as an ISO day, or undefined when the event is not a real ISO day. */
export function optionPeriodEnd(eventIso: string): string | undefined {
  const match = ISO_DAY.exec(eventIso);

  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;

  const index = month - 1 + OPTION_PERIOD_MONTHS;
  const endYear = year + Math.floor(index / 12);
  const endMonth = (index % 12) + 1;
  const endDay = Math.min(day, daysInMonth(endYear, endMonth));

  return `${String(endYear).padStart(4, '0')}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
}
