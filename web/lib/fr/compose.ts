// web/lib/fr/compose.ts
//
// Shared French-composition helpers, one home each (R206). These three were
// each a private copy in one module and are now referenced by key rather than
// duplicated:
//   - n()         the no-break space French sets before : ; ? ! % (R91)
//   - cardinal()  a small count written out in words, taking the gender so it
//                 gives "Un" or "Une" (moved from releve-annuel.ts)
//   - frenchList() "A", "A et B", "A, B et C" (moved from tarifs.ts)
//
// WHY A SHARED HOME. FW34's home body needs all three, and R206 forbids a
// fourth copy: "where two places must say the same thing, one holds the text
// and the other holds a key." application.ts's and guides.ts's private n() stay
// as they are for now (§10) - this module claims only the duplication FW34
// would otherwise create.
//
// NO RAW U+00A0 IN THE SOURCE (R91/R66): the no-break space is built from a
// codepoint, never typed, so it is visible to a reader of this file and this
// file contributes zero literal U+00A0 to the copy-codepoints census.

const NB = String.fromCharCode(0x00a0);

/** A punctuation mark with the no-break space French sets before it (R91). */
export const n = (mark: string): string => `${NB}${mark}`;

/**
 * The gender of the counted noun, named by the word "one" takes: "un relevé",
 * "une partie". Only the value 1 differs between the two; 2 and up are
 * invariant, so the parameter is read only there.
 */
export type CardinalGender = 'un' | 'une';

/**
 * Capitalised, because every caller writes the count at the start of a clause
 * ("Six parties.", "Sept guides, dont ..."). 2 through 10 are gender-invariant.
 */
const WORDS: Readonly<Record<number, string>> = {
  2: 'Deux',
  3: 'Trois',
  4: 'Quatre',
  5: 'Cinq',
  6: 'Six',
  7: 'Sept',
  8: 'Huit',
  9: 'Neuf',
  10: 'Dix',
};

/**
 * A small count in words, because French prose writes one out. Above ten the
 * numeral is returned, so a range the caller did not expect reads oddly rather
 * than crashing and the reader of that sentence fixes it.
 */
export function cardinal(value: number, gender: CardinalGender): string {
  if (value === 1) return gender === 'une' ? 'Une' : 'Un';

  return WORDS[value] ?? String(value);
}

/**
 * "A", "A et B", "A, B et C" - the third case is the only one with a comma.
 *
 * CONCATENATION RATHER THAN A TEMPLATE LITERAL, and R91's source scan is the
 * reason tarifs.ts stated when this lived there: its second pass reads the
 * quoted spans of each line, and an operator inside a template literal lands
 * inside the quoted span and reads there as a French typography offence. Kept
 * on the move.
 */
export function frenchList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';

  const last = items[items.length - 1] ?? '';

  return items.slice(0, -1).join(', ') + ' et ' + last;
}
