// web/lib/forecast/imagined.ts
//
// FW-FORECAST: THE IMAGINED YEAR, as one plain function.
//
// A weekly rhythm plus the day the projection is requested go in; the working
// days from tomorrow to 31 December come out, as entry rows the existing
// aggregation already understands. Nothing else happens here: no rate, no
// percentage, no threshold. The caller hands these rows to toTeleworkInput and
// calculateTelework exactly as it would hand over recorded ones.
//
// ============================================================================
// WHY THIS RETURNS ROWS RATHER THAN A COUNT
// ============================================================================
//
// A count would be smaller and would be a second engine. The denominator, the
// proration, the half-day arithmetic and the mission cap all live in
// toTeleworkInput and calc-engine, and a function that returned "24 telework
// days" would be inviting its caller to divide by 240 - which is FW12's defect
// and what R340 forbids: a figure a component computed is a second engine
// nobody tested. Rows go in the same door the recorded ones do.
//
// It is also what makes the shared fixture checkable. The Kotlin side's
// imaginedEntriesToYearEnd returns rows, concatenates them with the recorded
// ones and runs the shared aggregation; this returns rows so the two sides can
// be compared step for step rather than at the final percentage.
//
// ============================================================================
// WHAT IT DELIBERATELY DOES NOT KNOW
// ============================================================================
//
// PUBLIC HOLIDAYS AND LEAVE ARE NOT DEDUCTED, and that is the contract rather
// than an omission. On the 240-day basis leaving them in OVERSTATES telework,
// so the projection warns early and never late. The page says so in words -
// a projection that quietly flattered the reader would be the one kind of
// error this product cannot make.
//
// "TODAY" IS NOT RESOLVED HERE. This function takes the day it is given and
// has no clock of its own, because a clock inside it would read the machine's
// zone - and R28 fixes the product's day to Europe/Paris. The caller resolves
// the day and passes it, which is also what lets a test drive it with a fixed
// one.
//
// UTC THROUGHOUT, for the calendar walk. The codec's own date arithmetic made
// the same choice for the same reason ("UTC throughout, so no zone shifts a
// boundary"): a Date advanced by local days crosses a DST boundary twice a
// year and silently gains or loses one.

import type { AggregatableEntry } from '@/lib/dossier/aggregate';

/**
 * The two kinds a rhythm can assign to a weekday.
 *
 * NARROWED FROM THE ENTRY KINDS ON PURPOSE. AggregatableEntry['kind'] also has
 * MISSION_FR, MISSION_THIRD and ABSENT, and none of them is a thing a person
 * can say about "the days I usually telework": a mission is an event, not a
 * rhythm, and an absence is the absence of one. Typing it as a subset means a
 * sixth entry kind cannot silently become a rhythm option.
 */
export type RhythmKind = Extract<AggregatableEntry['kind'], 'CH' | 'HOME'>;

/**
 * The five weekdays, in the order JavaScript numbers them.
 *
 * INDEXED BY Date#getUTCDay, which is why Sunday leads and why the array is
 * seven long: `WEEKDAYS[date.getUTCDay()]` is then the whole lookup, with the
 * two nulls doing the weekend check. A five-element array would need an offset
 * calculation, and an offset calculation is where an off-by-one lives.
 *
 * The names are the fixture's keys, so the file both engines read is the thing
 * that decides them (R181).
 */
const WEEKDAYS = [
  null,
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  null,
] as const;

export type Weekday = Exclude<(typeof WEEKDAYS)[number], null>;

/**
 * Which kind the person works on each weekday they work at all.
 *
 * PARTIAL, AND THE ABSENCE IS MEANINGFUL. A weekday with no entry is not a
 * working day - it is not "worked in Switzerland by default". The fixture
 * pins this directly: `rythme-partiel-mardi-jeudi` lists only Tuesday and
 * Thursday and expects 2 imagined working days, not 5.
 */
export type Rhythm = Partial<Readonly<Record<Weekday, RhythmKind>>>;

/** One day, in milliseconds. UTC throughout, so no zone shifts a boundary. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The working days from the day after `today` to 31 December, as entry rows.
 *
 * STRICTLY AFTER TODAY. The contract's own words: "today itself is never
 * imagined (it is recorded or it is not)." A projection that imagined today
 * would double-count it for anybody who had already recorded it, which is the
 * one day of the year most likely to be recorded.
 *
 * FULL DAYS ONLY. A rhythm says which days you telework, not which halves; a
 * reader who works half days says so through the granularity field, and the
 * aggregation already handles it. Imagining AM/PM pairs here would be
 * inventing detail the question never asked for.
 */
export function imaginedEntriesToYearEnd(
  rhythm: Rhythm,
  today: Date,
  taxYear: number,
): readonly AggregatableEntry[] {
  const entries: AggregatableEntry[] = [];

  // CLAMPED TO THE TAX YEAR AT BOTH ENDS. A shared link opened in a later
  // year, or a fixed clock set before the year begins, must not imagine days
  // outside the year the rate is about: the denominator is that year's.
  const firstOfYear = Date.UTC(taxYear, 0, 1);
  const dayAfterToday =
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + MS_PER_DAY;
  const lastOfYear = Date.UTC(taxYear, 11, 31);

  for (
    let day = Math.max(firstOfYear, dayAfterToday);
    day <= lastOfYear;
    day += MS_PER_DAY
  ) {
    const date = new Date(day);
    const weekday = WEEKDAYS[date.getUTCDay()];

    // Saturday and Sunday are null above, so the weekend needs no test of
    // its own; a weekday the rhythm leaves out is not a working day either.
    //
    // `== null` CATCHES undefined TOO, and that is not defensive noise:
    // TypeScript types an index read as possibly undefined because it cannot
    // know getUTCDay returns 0..6, and narrowing only `null` left the next
    // line indexing by `string | undefined`. The compiler said so.
    if (weekday == null) continue;

    const kind = rhythm[weekday];

    if (kind === undefined) continue;

    entries.push({ dayDate: date, portion: 'FULL', kind });
  }

  return entries;
}
