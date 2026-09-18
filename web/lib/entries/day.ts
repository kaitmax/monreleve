// web/lib/entries/day.ts
//
// A day, and the two instants that bound it in the reader's zone.
//
// SPEC 8: "Day boundaries and reminder times are computed in Europe/Paris -
// the frontalier lives in France. A UTC day-boundary bug here is a wrong
// record."
//
// THE DAY IS A STRING AND STAYS A STRING. It arrives as "2026-04-07", it is
// stored in a `@db.Date` column, and it comes back as "2026-04-07". The only
// conversion is at the database boundary, and it goes through UTC midnight -
// the one instant that reads back as the same calendar day everywhere.
//
// THE BUG THIS PREVENTS, concretely:
//
//   new Date('2026-04-07')   -> 2026-04-07T00:00:00Z   correct
//   new Date(2026, 3, 7)     -> 2026-04-06T22:00:00Z   in Paris summer
//
// The second, read back as a UTC date, is THE SIXTH. A person's day in
// Switzerland becomes the day before, one row at a time, and nothing looks
// wrong until a dossier is short a day or the ratio moves.

/**
 * The zone every boundary is computed in.
 *
 * PARIS AND NOT ZURICH, although the work is in Switzerland: SPEC 8 gives the
 * reason - "the frontalier lives in France". The reader's day is the one their
 * calendar shows them, and a reminder at 17:30 means half past five where they
 * are. The asymmetry is deliberate and is exactly the kind of thing a later
 * reader would "correct".
 */
export const PARIS = 'Europe/Paris';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function assertDay(day: string): void {
  if (!DAY_PATTERN.test(day)) {
    throw new Error(`Not a calendar day: ${JSON.stringify(day)}. Expected YYYY-MM-DD.`);
  }
}

/**
 * The value that goes into a `@db.Date` column.
 *
 * UTC MIDNIGHT, ALWAYS. A `Date` is an instant, and a date column stores the
 * calendar day of that instant - so the only safe instant is the one whose UTC
 * calendar day is the day we mean. Any local-midnight construction encodes the
 * server's timezone into the record.
 */
export function toStoredDay(day: string): Date {
  assertDay(day);

  return new Date(`${day}T00:00:00.000Z`);
}

/** The day a stored value represents, back as the string it arrived as. */
export function fromStoredDay(stored: Date): string {
  return stored.toISOString().slice(0, 10);
}

/**
 * Paris's UTC offset, in minutes, at a given instant.
 *
 * ASKED OF THE PLATFORM RATHER THAN CALCULATED. The transition rules are
 * political: the EU has voted to abolish the change more than once and has not
 * done it, and the dates have moved before. A hand-written "last Sunday in
 * March" is a rule that is correct until a parliament says otherwise, and it
 * would fail silently - every day still 24 hours long, just the wrong ones.
 * Intl carries the tz database, which is what gets updated when the rule
 * changes.
 */
function parisOffsetMinutes(instant: Date): number {
  // The same instant formatted in both zones; the difference is the offset.
  const asUtc = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(instant),
  );

  const asParis = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PARIS,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(instant),
  );

  return (asParis.getTime() - asUtc.getTime()) / 60_000;
}

/**
 * When a Paris day begins, as a UTC instant.
 *
 * ONE PASS, AND THE SECOND ONE WAS REMOVED RATHER THAN KEPT "JUST IN CASE".
 *
 * The first draft did two: guess using the offset at UTC midnight, then
 * correct using the offset at that guess - on the reasoning that the offset is
 * a function of the instant we are solving for. The ablation refused it: with
 * the correction removed, all eighteen tests still passed.
 *
 * THEY PASSED BECAUSE THE CORRECTION CANNOT FIRE IN THIS ZONE. Europe's
 * transitions happen at 02:00 and 03:00 local, never at midnight, so the
 * offset an hour either side of midnight is always the same one and both
 * passes return the same instant. The second pass was untested defensive code
 * that no input could reach - which is the shape R133 refuses: a guard that
 * cannot fire proves nothing, and carrying it would have implied a hazard this
 * zone does not have.
 *
 * IT WOULD MATTER in a zone that transitions AT midnight - parts of South
 * America have - and if this product ever computes days in one, the correction
 * comes back WITH A TEST THAT FAILS WITHOUT IT. Writing it now, untestable,
 * only makes the next reader believe it was needed here.
 *
 * What IS load-bearing is asking the platform for the offset at all: ablating
 * that to a fixed +60 fails the 23-hour day, the 25-hour day, and the
 * summer/winter boundary instants.
 */
export function startOfParisDay(day: string): Date {
  assertDay(day);

  const utcMidnight = new Date(`${day}T00:00:00.000Z`);

  return new Date(utcMidnight.getTime() - parisOffsetMinutes(utcMidnight) * 60_000);
}

/**
 * When a Paris day ends - which is when the next one begins.
 *
 * DEFINED AS THE NEXT DAY'S START rather than computed independently. A
 * boundary calculated twice is a boundary that can disagree with itself, and
 * the disagreement would be an hour wide on exactly the two days a year when
 * anybody would notice.
 */
export function endOfParisDay(day: string): Date {
  assertDay(day);

  const next = new Date(`${day}T00:00:00.000Z`);

  next.setUTCDate(next.getUTCDate() + 1);

  return startOfParisDay(next.toISOString().slice(0, 10));
}
