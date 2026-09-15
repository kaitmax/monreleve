// web/lib/guides/scope.ts
//
// THE FIGURES AN ARTICLE IS ALLOWED TO WRITE, already formatted.
//
// RULING R147: "every threshold, cap, basis and rate that appears in guide
// prose comes from RuleSet(2026) through a component or an MDX expression -
// never typed as a literal in the MDX. The 2028 rule change must edit one
// constant, not seven articles." This is the other half of that rule: the
// test refuses a typed figure, and this is what an author writes instead.
//
// ALREADY FORMATTED, AND THAT IS THE DESIGN. Handing an article the raw
// RuleSet would mean every author deciding how many decimals a threshold
// takes and whether French puts a space before the percent sign - seven
// articles, seven answers. The product already has one answer to both
// (lib/ui/core/format), so the scope carries strings that have been through
// it and an article interpolates them whole.
//
// WHICH ALSO MAKES THE TYPOGRAPHY CORRECT BY CONSTRUCTION: formatPercent
// puts U+00A0 before the sign, so "40 %" can never break across a line and
// R91's guard has nothing to catch in the rendered figure.
//
// THE DECIMALS RULE IS /sources' RULE, not a new one - a whole percentage
// shows none and a fractional one shows one, which is what makes the pair
// read as "40 %" and "49,9 %" rather than "40,0 %" and "49,9 %".
//
// THE CANTON LIST IS HERE FOR THE SAME REASON AS THE NUMBERS, and it is the
// entry most likely to move: it is row 7 of docs/regulatory-sources.md, it is
// PENDING, and the reviewer is being asked precisely whether the membership
// is right. Typed into an article it would be a second copy of a RuleSet
// value that a review is expected to change.

import { ruleSetFor } from '@/lib/calc-engine';
import { CANTON_NAMES } from '@/lib/fr/cantons';
import { formatDays, formatPercent } from '@/lib/ui/core';

/** RuleSet holds fractions; a reader reads percentages (lib/ui/core/zones). */
const PERCENT = 100;

/** Whole percentages show no decimal, fractional ones show one. */
const percent = (fraction: number): string => {
  const value = fraction * PERCENT;

  return formatPercent(value, Number.isInteger(value) ? 0 : 1);
};

/**
 * What `{fiscal}` and its five siblings resolve to inside an article.
 *
 * NAMES A READER OF THE MDX WOULD GUESS, not the RuleSet field names: an
 * author writing prose types `{fiscal}` in the middle of a French sentence,
 * and `{fiscalCeiling}` reads like code in a paragraph.
 *
 * A TYPE ALIAS RATHER THAN AN INTERFACE, and that is not a style choice.
 * compileMDX takes `scope?: Record<string, unknown>`; TypeScript gives an
 * object-literal TYPE an implicit index signature and an INTERFACE none, so
 * the interface version failed to compile at all three call sites. Declared
 * this way the shape stays exact - every field is still named and checked -
 * and it is still assignable to what the compiler asks for.
 */
export type GuideScope = {
  /** The fiscal ceiling, as a percentage. */
  readonly fiscal: string;
  /** The social-security ceiling, as a percentage. */
  readonly social: string;
  /** The telework share from which the framework agreement applies. */
  readonly a1Threshold: string;
  /** The simplified denominator, in days. */
  readonly basisDays: string;
  /** The annual mission sub-cap, in days. */
  readonly missionCap: string;
  /** The eight 1983-accord cantons, in French, in RuleSet's order. */
  readonly cantons1983: string;
};

export function guideScope(taxYear: number): GuideScope {
  const rules = ruleSetFor(taxYear);

  return {
    fiscal: percent(rules.fiscalCeiling),
    social: percent(rules.socialCeiling),
    a1Threshold: percent(rules.a1ThresholdRate),
    basisDays: formatDays(rules.simplifiedBasisDays),
    missionCap: formatDays(rules.missionCapDays),
    cantons1983: rules.residence1983Cantons.map((canton) => CANTON_NAMES[canton]).join(', '),
  };
}
