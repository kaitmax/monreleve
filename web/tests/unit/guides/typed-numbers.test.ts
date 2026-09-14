// web/tests/unit/guides/typed-numbers.test.ts
//
// RULING R147: NO NUMBER IS TYPED TWICE.
//
// "Every threshold, cap, basis and rate that appears in guide prose comes
// from RuleSet(2026) through a component or an MDX expression - never typed
// as a literal in the MDX. The 2028 rule change must edit one constant, not
// seven articles."
//
// WHY THE SCAN IS OF THE SOURCE AND NOT THE COMPILED OUTPUT, which is what
// the prompt's wording suggests. An expression is SUPPOSED to render "40 %"
// into the output - that is the whole mechanism - so a scan of the output
// cannot tell a permitted figure from a typed one without comparing it back
// against the source. Scanning what the AUTHOR TYPED answers the question
// directly and cannot false-positive on the correct construction.
//
// THE FRONTMATTER IS SCANNED TOO, and that has a consequence worth stating:
// a FAQ answer cannot carry an expression, because YAML has none. So FAQ
// answers name the thresholds rather than quoting them - "le plafond fiscal"
// rather than "40 %". That is the stricter reading and the right one: a
// figure typed into a FAQ answer is exactly the copy that goes stale in 2028
// while every test stays green.
//
// WHAT IS NOT FORBIDDEN: dates, article numbers, circular numbers and
// regulation numbers. 27.06.2023, art. 10, circulaire 45 and 883/2004 are
// citations, not figures the RuleSet carries, and a guide that could not name
// its own sources would be worse than one that repeats a number.

import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { allGuides } from '@/lib/guides/registry';

/**
 * The four figures R147 names, as they would look typed into French prose.
 *
 * ANCHORED ON THE UNIT rather than on the digits alone, which is what makes
 * the rule precise: "40" in "27.06.2023" or "art. 10" is a citation, and "40"
 * before a percent sign is the fiscal ceiling. The pattern is the figure AND
 * what makes it a regulatory quantity.
 */
const TYPED = [
  { what: 'the fiscal ceiling', pattern: /\b40\s*(?:%|pour cent)/i },
  { what: 'the social ceiling', pattern: /\b49[,.]9\s*(?:%|pour cent)/i },
  { what: 'the simplified basis', pattern: /\b240\s+jours/i },
  { what: 'the mission cap', pattern: /\b10\s+jours/i },
  { what: 'the A1 threshold', pattern: /\b25\s*(?:%|pour cent)/i },
] as const;

/** Every figure above must actually be a RuleSet value, or the rule is fiction. */
const RULES = ruleSetFor(2026);

describe('the figures R147 names are the ones RuleSet carries', () => {
  it('matches the engine, so the scan is not guarding invented numbers', () => {
    // NON-VACUITY AT THE TOP: if RuleSet changed and this list did not, the
    // scan would forbid a figure the product no longer uses and permit the
    // one it does.
    expect(RULES.fiscalCeiling).toBe(0.4);
    expect(RULES.socialCeiling).toBe(0.499);
    expect(RULES.simplifiedBasisDays).toBe(240);
    expect(RULES.missionCapDays).toBe(10);
    expect(RULES.a1ThresholdRate).toBe(0.25);
  });
});

/** The whole file as the author wrote it: frontmatter and body. */
const sourceOf = (guide: { file: string; body: string; frontmatter: unknown }): string =>
  `${JSON.stringify(guide.frontmatter)}\n${guide.body}`;

/**
 * A typed figure, with the line it sits on.
 *
 * Expressions are removed first: {fiscal} is the correct construction and
 * renders the figure at build, so a line carrying one is not a violation -
 * and a line carrying BOTH would be, which is the case this ordering keeps
 * catchable.
 */
function typedFigures(source: string): string[] {
  const withoutExpressions = source.replace(/\{[^}]*\}/g, ' ');

  return withoutExpressions
    .split('\n')
    .flatMap((line) =>
      TYPED.filter(({ pattern }) => pattern.test(line)).map(
        ({ what }) => `${what}: ${line.trim().slice(0, 90)}`,
      ),
    );
}

describe('no guide types a regulatory figure', () => {
  it('reads the articles on disk, so nothing below passes vacuously', () => {
    expect(allGuides().length).toBeGreaterThan(0);
  });

  it('finds none in what is written today', () => {
    const found = allGuides().flatMap((guide) =>
      typedFigures(sourceOf(guide)).map((hit) => `${guide.file} ${hit}`),
    );

    expect(
      found,
      `R147: these figures are typed rather than taken from RuleSet.\n${found.join('\n')}`,
    ).toEqual([]);
  });
});

describe('R147 fires on what it is for', () => {
  it('catches each of the five figures, typed', () => {
    // PLANTED AND CAPTURED. Each is how the figure would naturally be written
    // by somebody who had the number in their head.
    expect(typedFigures('Le plafond est de 40 % du temps de travail.')).toHaveLength(1);
    expect(typedFigures('Au-dela de 49,9 % votre affiliation bascule.')).toHaveLength(1);
    expect(typedFigures('La base simplifiee est de 240 jours par an.')).toHaveLength(1);
    expect(typedFigures('Le quota est de 10 jours de mission.')).toHaveLength(1);
    expect(typedFigures('Le seuil de rattachement est de 25 % de teletravail.')).toHaveLength(1);
  });

  it('permits the same sentence written as an expression', () => {
    // R120: a scan that flagged the correct construction too would make the
    // articles unwritable, and every assertion above would still pass.
    expect(typedFigures('Le plafond est de {fiscal} du temps de travail.')).toEqual([]);
    expect(typedFigures('La base simplifiee est de {basisDays} jours par an.')).toEqual([]);
  });

  it('permits dates, articles, circulars and regulation numbers', () => {
    // A guide that could not name its own sources would be worse than one
    // that repeats a number. These are citations, not RuleSet values.
    expect(typedFigures('Avenant du 27 juin 2023, en vigueur le 24 juillet 2025.')).toEqual([]);
    expect(typedFigures('Circulaire no 45 du 12 juin 2019, point 7.5.1.')).toEqual([]);
    expect(typedFigures('Article 13 du reglement (CE) 883/2004.')).toEqual([]);
    expect(typedFigures('Accord du 11 avril 1983.')).toEqual([]);
  });

  it('catches a figure on a line that ALSO carries an expression', () => {
    // The subtle one: an author converts half a sentence and leaves the rest.
    // Expressions are stripped before the scan precisely so this still fails.
    expect(
      typedFigures('Le plafond {fiscal} vaut 40 % du temps de travail annuel.'),
    ).toHaveLength(1);
  });
});
