// web/lib/content/tax-year.ts
//
// RULING R55: the calculator computes for the current calendar year in
// Europe/Paris.
//
// WHY NOT new Date().getFullYear(). That reads the HOST's zone. A server in
// UTC on 31 December at 23:30 is already 1 January in Paris, so the calculator
// would compute against the wrong RuleSet for half an hour every year - and
// that half hour is exactly when a frontalier is closing out their year. SPEC
// 8 states the rule for the same reason: "Day boundaries and reminder times
// are computed in Europe/Paris - the frontalier lives in France. A UTC
// day-boundary bug here is a wrong record."
//
// WHY NOT AN OFFSET. Paris is UTC+1 in winter and UTC+2 in summer. Adding an
// hour would be right on 31 December and wrong in July, which is the kind of
// bug that passes every test written in the month it was made. Intl resolves
// the offset for the instant.
//
// WHY IT LIVES HERE AND NOT IN THE ENGINE. SPEC 20: the engine reads no clock.
// It takes taxYear as an input and resolves its RuleSet from that, so the
// clock is the caller's problem - which means the page's, resolved on the
// server and passed down.

import { DATE_TIME_ZONE } from '@/lib/ui/core';

/**
 * Formats the year alone, in the pinned zone.
 *
 * Constructed once at module load rather than per call: DateTimeFormat is
 * expensive to build and this is called on every render of the calculator.
 */
const YEAR_IN_PARIS = new Intl.DateTimeFormat('fr-FR', {
  timeZone: DATE_TIME_ZONE,
  year: 'numeric',
});

/**
 * The calendar year in Europe/Paris at `now`.
 *
 * `now` is an argument so both sides of the new-year boundary are testable -
 * a function that read the clock could not be asked about 31 December at all,
 * and would assert something different every day it ran. The default is the
 * real clock, for the page.
 */
export function currentTaxYear(now: Date = new Date()): number {
  // formatToParts rather than format(), because format() on some locales
  // decorates the year - fr-FR does not today, but "2026" is a contract this
  // function should not inherit from CLDR.
  const year = YEAR_IN_PARIS.formatToParts(now).find((part) => part.type === 'year')?.value ?? '';

  return Number.parseInt(year, 10);
}

/**
 * Formats the whole day, in the pinned zone. Same construction, same reason.
 */
const DAY_IN_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: DATE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The calendar DAY in Europe/Paris at `now`, as that day's UTC midnight.
 *
 * WHY THE PROJECTION NEEDS IT (FW-FORECAST). The imagined year starts the
 * day after today, so "today" decides how many working days are left - and a
 * host in UTC at 23:30 on a Sunday is already Monday in Paris. Getting it
 * wrong by one costs the reader a whole working day of projection, every
 * evening, for the two hours a day the two zones disagree.
 *
 * UTC MIDNIGHT OF THE PARIS DAY, deliberately. The value is a calendar day
 * rather than an instant: everything downstream - the imagined-days walk, the
 * fixture, the codec - does its arithmetic in UTC so no zone can shift a
 * boundary, and handing back a Paris-local instant would reintroduce exactly
 * the boundary this function exists to remove.
 *
 * en-CA, BECAUSE ITS SHORT DATE IS ISO. fr-FR formats 09/10/2026, which needs
 * reordering before it can be parsed, and reordering is where a day and a
 * month change places. formatToParts for the same reason currentTaxYear uses
 * it: the parts are named, so nothing depends on CLDR ordering at all.
 */
export function currentDayInParis(now: Date = new Date()): Date {
  const parts = DAY_IN_PARIS.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number.parseInt(parts.find((candidate) => candidate.type === type)?.value ?? '', 10);

  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}
