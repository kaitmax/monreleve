// web/lib/params/rhythm.ts
//
// R343: the weekly rhythm as a URL parameter, in both directions.
//
// ============================================================================
// WHY IT IS A REPEATED PARAMETER AND NOT ONE POSITIONAL STRING
// ============================================================================
//
// THE FIRST VERSION OF THIS FILE WAS `rythme=sdsds` - five characters, one per
// weekday, three symbols so a day could be teleworked, worked in Switzerland,
// or not worked at all. It was shorter, it was more expressive, it matched the
// Android rhythm model exactly, and IT CANNOT BE PRODUCED BY THE FORM.
//
// A checkbox submits its own name and value or nothing at all. Five of them
// cannot agree on one five-character string without JavaScript to assemble it,
// and the whole requirement is that the rhythm works with JavaScript OFF -
// R346's project asserts a real projected figure on a page reached with
// scripting disabled. A format the form can only produce when hydrated is a
// format that fails the one test that matters.
//
// So the parameter REPEATS: `?rythme=ma&rythme=je`. Five checkboxes, one name,
// and the browser builds the query itself.
//
// ============================================================================
// WHAT THAT COSTS, STATED RATHER THAN GLOSSED
// ============================================================================
//
// THE URL CARRIES TELEWORK DAYS ONLY. The web question is "quels jours
// teletravaillez-vous d'habitude", which is binary per day, so a day the
// reader does not check is simply not a telework day - the URL cannot say
// whether they worked it in Switzerland or did not work it at all.
//
// THAT IS LOSSLESS FOR THE RATE, AND THE SHARED FIXTURE IS WHAT ESTABLISHES
// IT RATHER THAN REASONING: `les-jours-suisses-ne-bougent-pas-le-taux`
// imagines five Swiss days and expects the rate NOT to move. Under the
// 240-day basis the denominator is the rule set's; under the exact basis the
// reader supplies it. Neither is counted from imagined days, so the only
// imagined day that can move a rate is one spent at home.
//
// The Rhythm TYPE still carries both kinds, because the fixture does and the
// date function must reproduce it exactly. It is the URL that is narrower
// than the type, which is the right way round: a format that could express
// something the form cannot ask would be a format with untested values in it.
//
// ============================================================================
// WHAT A PARAMETER OF THIS SHAPE CANNOT DO
// ============================================================================
//
// schema.ts argues that no personal data is representable because every
// parameter maps to a field of TeleworkInput. This one does not - the rhythm
// feeds the FORECAST, not the engine - so that sentence no longer covers the
// whole set on its own, and the argument is extended there rather than
// quietly dropped. The value space here is five legal strings of two letters,
// and a format with five legal values cannot carry an identity whatever
// anybody types into it.

import type { Rhythm, RhythmKind, Weekday } from '@/lib/forecast/imagined';

/**
 * The code each weekday carries in the URL.
 *
 * TWO LETTERS, FRENCH, IN THE STYLE OF THE CODES AROUND THEM - `decompte`
 * already uses `j`, `dj` and `h` for jour, demi-journee and heures. Two rather
 * than one because `m` would have to mean both mardi and mercredi, and a
 * format whose first collision is in its own alphabet is a format that will
 * acquire a third letter later and break the links that used the second.
 *
 * THE ORDER IS MONDAY FIRST, and it is part of the contract: encode walks this
 * map, so two links to the same rhythm are the same string.
 */
export const RHYTHM_DAY_CODES = {
  MONDAY: 'lu',
  TUESDAY: 'ma',
  WEDNESDAY: 'me',
  THURSDAY: 'je',
  FRIDAY: 've',
} as const satisfies Readonly<Record<Weekday, string>>;

export type RhythmDayCode = (typeof RHYTHM_DAY_CODES)[Weekday];

/** The kind a checked day means. The web question asks about one kind only. */
const CHECKED: RhythmKind = 'HOME';

/** The parse direction, derived so the two cannot disagree (R181). */
const WEEKDAY_OF: Readonly<Record<string, Weekday>> = Object.fromEntries(
  (Object.entries(RHYTHM_DAY_CODES) as ReadonlyArray<[Weekday, string]>).map(([day, code]) => [
    code,
    day,
  ]),
);

/** Every code a value may be. Exported so the test enumerates the real set. */
export const RHYTHM_CODES: readonly string[] = Object.values(RHYTHM_DAY_CODES);

/**
 * The telework days of a rhythm, as their codes, in weekday order.
 *
 * SWISS DAYS ARE NOT WRITTEN, by the argument in this file's header: they
 * cannot move a rate, the web form cannot ask about them, and writing them
 * would put values in shared links that no form can produce and no test
 * covers.
 */
export function renderRhythmDays(rhythm: Rhythm): readonly string[] {
  return (Object.keys(RHYTHM_DAY_CODES) as readonly Weekday[])
    .filter((day) => rhythm[day] === CHECKED)
    .map((day) => RHYTHM_DAY_CODES[day]);
}

/**
 * The codes a URL carried, as a rhythm, or null where any of them is not a
 * code.
 *
 * NULL RATHER THAN SKIPPING THE BAD ONE. SPEC 9.4 requires a value that could
 * not be read to fall back AND to surface the notice; silently dropping
 * `rythme=lundi` would give the reader a projection missing a day they
 * checked, with nothing on the page to say so.
 *
 * AN EMPTY LIST IS AN EMPTY RHYTHM, not a refusal: it is what a form submits
 * when nobody checked anything, and the prompt is explicit that this shows
 * today's position only.
 *
 * DUPLICATES ARE TOLERATED. `?rythme=ma&rythme=ma` is a URL somebody edited by
 * hand or a platform rewrote; it names a legal rhythm unambiguously, and
 * refusing it would turn a harmless oddity into a notice about a dropped
 * value.
 */
export function parseRhythmDays(raw: readonly string[]): Rhythm | null {
  const rhythm: { -readonly [K in Weekday]?: RhythmKind } = {};

  for (const code of raw) {
    const weekday = WEEKDAY_OF[code];

    if (weekday === undefined) return null;

    rhythm[weekday] = CHECKED;
  }

  return rhythm;
}
