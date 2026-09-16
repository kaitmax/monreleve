// web/tests/support/typed-figures.ts
//
// The figures RULING R147 forbids typing, in one place.
//
// EXTRACTED BECAUSE IT WAS ABOUT TO HAVE A SECOND COPY. The guide scan
// (tests/unit/guides/typed-numbers.test.ts) has held this list since FW17;
// FW18b extends R147 to lib/fr under the operator's Q52 ruling, and a second
// hand-maintained copy of a forbidden-figure list is a list that disagrees
// with the first one the day either is edited. Same reasoning as
// tests/support/quoted-spans.ts, one rule over.
//
// ANCHORED ON THE UNIT rather than on the digits alone, which is what makes
// the rule precise: "40" in "27.06.2023" or "art. 10" is a citation, and "40"
// before a percent sign is the fiscal ceiling. The pattern is the figure AND
// what makes it a regulatory quantity.
//
// WHAT IS NOT FORBIDDEN: dates, article numbers, circular numbers and
// regulation numbers. 27.06.2023, art. 10, circulaire 45 and 883/2004 are
// citations, not figures the RuleSet carries, and copy that could not name
// its own sources would be worse than copy that repeats a number.

export interface TypedFigure {
  /** Named in the failure message, because a regexp is not a diagnosis. */
  readonly what: string;
  readonly pattern: RegExp;
}

export const TYPED_FIGURES: readonly TypedFigure[] = [
  { what: 'the fiscal ceiling', pattern: /\b40\s*(?:%|pour cent)/i },
  { what: 'the social ceiling', pattern: /\b49[,.]9\s*(?:%|pour cent)/i },
  { what: 'the simplified basis', pattern: /\b240\s+jours/i },
  { what: 'the mission cap', pattern: /\b10\s+jours/i },
  { what: 'the A1 threshold', pattern: /\b25\s*(?:%|pour cent)/i },
];

/** Every figure the given text types, named. Empty is the passing case. */
export function typedFiguresIn(text: string): readonly string[] {
  return TYPED_FIGURES.filter(({ pattern }) => pattern.test(text)).map(({ what }) => what);
}
