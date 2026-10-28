// web/lib/lamal/input.ts
//
// The comparator's two text fields, parsed. R109's shape - type="text" with
// an inputMode - so the parsing is ours, total and tested
// (tests/unit/lamal/input.test.ts). Pure.

/** Spaces of every kind a reader or a paste may put in "42 000". */
const SPACES = /[\s\u00A0\u202F]/g;

/** "42 000" -> 42000. Anything but whole euros (up to nine digits) -> undefined. */
export function parseIncome(text: string): number | undefined {
  const compact = text.replace(SPACES, '');

  return /^\d{1,9}$/.test(compact) ? Number(compact) : undefined;
}

/** "1985" -> 1985. Anything but four digits -> undefined. */
export function parseBirthYear(text: string): number | undefined {
  const compact = text.replace(SPACES, '');

  return /^\d{4}$/.test(compact) ? Number(compact) : undefined;
}
