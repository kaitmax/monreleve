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
import { TYPED_FIGURES } from '../../support/typed-figures';

/**
 * The four figures R147 names, as they would look typed into French prose.
 *
 * ANCHORED ON THE UNIT rather than on the digits alone, which is what makes
 * the rule precise: "40" in "27.06.2023" or "art. 10" is a citation, and "40"
 * before a percent sign is the fiscal ceiling. The pattern is the figure AND
 * what makes it a regulatory quantity.
 */
/**
 * The figures R147 names now live in tests/support/typed-figures.ts.
 *
 * MOVED IN FW18b, when the operator's Q52 answer extended R147 to lib/fr and
 * tests/unit/fr/typed-numbers.test.ts needed the same list. Two hand-kept
 * copies of a forbidden-figure list disagree the day either is edited, and
 * the disagreement is silent in the direction that matters: the copy nobody
 * updated permits the figure the other forbids.
 */
const TYPED = TYPED_FIGURES;

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

/**
 * The file as the author wrote it - minus the two IDENTITY fields.
 *
 * R147 SAYS "guide PROSE", AND THE TITLE AND SLUG ARE NOT PROSE. They are
 * the article's name, and the number in them is not a statement of the rule
 * but the rule's name in public usage: people search for "la regle des 40 %"
 * the way they say "the 35-hour week". SPEC 9.5 fixes the slug
 * (teletravail-frontalier-40-pourcent) and SPEC 14 makes slugs PERMANENT, so
 * the figure is already frozen there by a stronger rule than this one.
 *
 * EVERYTHING ELSE IS COVERED, including the description and the FAQ, because
 * those render as reader-facing prose: a description carrying "40 %" is the
 * hub entry that goes stale in 2028 with every test green, which is exactly
 * what R147 exists to prevent.
 *
 * THE LINE IS NARROW AND NAMED rather than a list that grows. If a third
 * field ever wants an exemption, that is a ruling, not an edit here.
 */
const IDENTITY_FIELDS = new Set(['title', 'slug']);

const sourceOf = (guide: { file: string; body: string; frontmatter: unknown }): string => {
  const prose = Object.fromEntries(
    Object.entries(guide.frontmatter as Record<string, unknown>).filter(
      ([field]) => !IDENTITY_FIELDS.has(field),
    ),
  );

  return `${JSON.stringify(prose)}\n${guide.body}`;
};

/**
 * THE EXEMPTED CONSTRUCTION, AND IT IS NARROW ON PURPOSE.
 *
 * Only a bare name is removed before the scan: {fiscal}, {rules.missionCap}.
 * The first version of this exempted ANY brace pair, `/\{[^}]*\}/g`, which is
 * every JSX attribute expression in the article as well - and the component
 * kit is driven entirely by those:
 *
 *   <DataGrid rows={[{ key: 'seuil', cells: { source: '40 %' } }]} />
 *
 * Under the wide rule that cell is invisible to R147 and the comparison table
 * - the article's densest concentration of figures - could be typed by hand
 * with every suite green. The wide rule exempted the place the rule is most
 * needed.
 *
 * A NAME CANNOT CARRY A DIGIT SEQUENCE THAT MEANS ANYTHING, which is what
 * makes the narrow form safe to remove: `{fiscal}` renders the figure at
 * build and contains none. Everything else stays in the text and is scanned,
 * including the inside of every prop.
 */
const BARE_NAME = /\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\}/g;

/**
 * An MDX comment, which the compiler deletes and no reader ever meets.
 *
 * STRIPPED, AND THE WIDE RULE WAS HIDING THAT IT HAD TO BE. `{/* ... *\/}` is
 * itself a brace pair, so the old exemption swallowed every comment block as
 * a side effect; narrowing it surfaced the fixture's own English note about
 * "the 40 % rule" as a violation. That note is maintainer commentary in a
 * file that exists to exercise the template - the figure is not a claim, is
 * not rendered, and cannot go stale on a reader.
 *
 * SAME TREATMENT AS THE TYPOGRAPHY GUARD, which strips them for the same
 * reason and says so: a comment is not prose. Applied FIRST, so that a
 * figure inside one cannot be resurrected by the name pass.
 */
const MDX_COMMENT = /\{\/\*[\s\S]*?\*\/\}/g;

/**
 * A typed figure, with the line it sits on.
 *
 * Expressions are removed first: {fiscal} is the correct construction and
 * renders the figure at build, so a line carrying one is not a violation -
 * and a line carrying BOTH would be, which is the case this ordering keeps
 * catchable.
 */
function typedFigures(source: string): string[] {
  const withoutExpressions = source.replace(MDX_COMMENT, ' ').replace(BARE_NAME, ' ');

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

  it('catches a figure typed inside a JSX attribute expression', () => {
    // WHERE THE COMPARISON TABLE LIVES. The kit takes its data as props, so
    // if props were exempt the densest concentration of figures in the
    // article would be the one place R147 could not see.
    expect(
      typedFigures(`  rows={[{ key: 'seuil', cells: { source: '40 %' } }]}`),
    ).toHaveLength(1);
  });

  it('still permits a name inside one', () => {
    // The correct construction, in the place the table actually uses it.
    expect(typedFigures(`  rows={[{ key: 'seuil', cells: { source: fiscal } }]}`)).toEqual([]);
  });

  it('ignores an MDX comment, which no reader meets', () => {
    expect(typedFigures('{/* This note is about the 40 % rule. */}')).toEqual([]);
  });

  it('still catches prose that FOLLOWS a comment', () => {
    // The stripper must not swallow the rest of the file: `*\/}` ends it.
    expect(
      typedFigures('{/* a note */}\nLe plafond est de 40 % du temps de travail.'),
    ).toHaveLength(1);
  });
});
