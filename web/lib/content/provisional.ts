// web/lib/content/provisional.ts
//
// RULING R110: which pending regulatory reading a given input depends on.
//
// THE NOTICE IS INPUT-SPECIFIC, NEVER GLOBAL, and that is the whole ruling.
// docs/regulatory-sources.md carries three readings still awaiting expert
// review, and the calculator is indexed. A banner on every calculation would
// be true and useless: most users never touch any of the three, and a caveat
// permanently on screen is read as boilerplate within a week. One that appears
// exactly when the user's own numbers depend on a pending reading is
// information.
//
// WHY IT LIVES IN lib/content RATHER THAN IN THE ENGINE. The engine computes;
// it does not have opinions about which of its rules are settled. Verification
// STATUS is editorial state - it sits beside LAST_REGULATORY_REVIEW in
// regulatory.ts, changes when a lawyer answers rather than when code changes,
// and is exactly what lib/content is for. Putting it in the engine would also
// mean the engine importing its own provenance, which SPEC 7 keeps out.
//
// P2 HAS NO TRIGGER, deliberately. The 49,9 versus under-50 edge under
// two-decimal truncation is a property of the threshold band rather than of any
// input combination - every calculation near the social ceiling touches it and
// none touches it more than another.
//
// WHICH IS WHY THE TWO SETS BELOW ARE RELATED BY A TYPE (ruling R113). P2 was
// designed with no input trigger and its only disclosure pointed at a route
// that did not exist, while the calculator went live - so for a while the
// product depended on a reading a user had no way to read about. The subset
// direction makes that unrepresentable rather than merely unlikely: a reading
// that can fire a notice MUST be published, and tsc says so.

import type { TeleworkInput } from '@/lib/calc-engine';

/**
 * The pending readings that a specific input can depend on.
 *
 * Ordered, and asserted to be exactly this, so that a fourth pending reading
 * is a deliberate edit here rather than something that quietly starts or stops
 * appearing.
 */
export const PROVISIONAL_IDS = ['P1', 'P3'] as const;

export type ProvisionalId = (typeof PROVISIONAL_IDS)[number];

/**
 * Every pending reading /sources publishes, trigger or no trigger.
 *
 * A SUPERSET OF THE ABOVE, and the satisfies clause is the enforcement: a
 * reading that can fire a notice but is not published fails to compile. That
 * is ruling R113 expressed as a type rather than as a habit - the alternative
 * is remembering, and the last time that was the mechanism P2 went undisclosed
 * on an indexed page.
 */
export const PUBLISHED_PROVISIONAL_IDS = ['P1', 'P2', 'P3'] as const;

export type PublishedProvisionalId = (typeof PUBLISHED_PROVISIONAL_IDS)[number];

/**
 * The subset check, at compile time.
 *
 * If PROVISIONAL_IDS ever gains an id that PUBLISHED_PROVISIONAL_IDS lacks,
 * this assignment is the error. It costs one unused type and buys the one
 * property R113 is about.
 */
type EveryTriggerIsPublished = ProvisionalId extends PublishedProvisionalId ? true : never;

export const TRIGGERS_ARE_ALL_PUBLISHED: EveryTriggerIsPublished = true;

/**
 * Where /sources renders one reading, so a notice can link to THAT reading.
 *
 * THE FRAGMENT IS THE WHOLE POINT OF THE LINK. R110's notice already knows
 * which of the three readings the user's own input depends on; sending them to
 * a page with three and letting them find it discards the one piece of
 * information the notice has. So the anchor is derived from the id here, in
 * lib/content, and both the page that renders it and the notice that links to
 * it call this - a fragment agreed by two string literals in two files is a
 * broken link the day one of them is edited.
 *
 * PREFIXED, because a bare "P1" is a plausible id for something else on a
 * page that also lists eight constants, and an id collision resolves to
 * whichever element comes first.
 */
export function readingAnchor(id: PublishedProvisionalId): string {
  return `lecture-${id}`;
}

/** A full-time contract, in the units employmentRate uses. */
const FULL_TIME = 100;

/** A whole year, in the units periodFraction uses. */
const WHOLE_YEAR = 1;

/**
 * Which pending readings this input depends on. Empty is the common path.
 *
 * PURE, AND TAKES THE WHOLE INPUT rather than the individual fields, so that
 * the conditions read the way docs/regulatory-sources.md states them and a
 * reader can check one against the other without translating.
 */
export function provisionalFor(input: TeleworkInput): readonly ProvisionalId[] {
  const touched: ProvisionalId[] = [];

  // P1 - THE IMPUTATION ORDER. France is imputed before a third state, and
  // how much of the annual cap each consumes depends on that order. With days
  // in only ONE place the order cannot matter, which is why both counts must
  // be positive rather than either. Geneva case (c) - the fixture the engine
  // is verified against - has 24 days in France and none elsewhere, so the
  // product's own reference calculation carries no caveat.
  if (input.missionDaysFrance > 0 && input.missionDaysThirdState > 0) {
    touched.push('P1');
  }

  // P3 - THE EXACT METHOD'S CAP PRORATION, ruling R19's open question:
  // whether the cap is prorated under the exact method and by which factors.
  // With a full-time contract over a whole year there is nothing to prorate,
  // so the reading cannot change the answer and the notice would be noise.
  if (
    input.denominator.kind === 'exact' &&
    (input.employmentRate < FULL_TIME || input.periodFraction < WHOLE_YEAR)
  ) {
    touched.push('P3');
  }

  return touched;
}
