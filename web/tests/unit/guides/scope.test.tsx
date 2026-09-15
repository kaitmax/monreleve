// web/tests/unit/guides/scope.test.tsx
//
// R147's OTHER HALF, AND THE HALF THAT WAS SILENTLY MISSING.
//
// The ruling has two directions. "Never typed as a literal in the MDX" is
// refused by tests/unit/guides/typed-numbers.test.ts, which scans what the
// author wrote. "Comes from RuleSet through a component or an MDX EXPRESSION"
// is this file, and nothing asserted it - so the rule was enforceable in the
// direction that FORBIDS and unenforceable in the direction that DELIVERS.
//
// WHICH MATTERED, BECAUSE THE EXPRESSION DID NOT WORK. next-mdx-remote@6
// defaults `blockJS` to TRUE, and its own documentation says what that does:
// "patterns like {variable} or {func()} will be removed while preserving JSX
// components and standard Markdown" - plus, in the plugin itself, "Remove
// JavaScript expressions from JSX attribute values". The article template
// passed `{ parseFrontmatter: false }` and nothing else, so every expression
// an author wrote would have been DELETED at compile: not thrown, not logged,
// deleted. The pillar would have shipped reading "jusqu'a de son temps de
// travail annuel".
//
// EVERY OTHER LAYER STAYS GREEN THROUGH THAT. The frontmatter parses, the
// claims resolve, the typed-number scan finds nothing because there IS no
// typed number, the mesh links resolve, the baselines record whatever the page
// renders and certify it forever. The only detector is a person who knows what
// the figure should be.
//
// SO THE TEST COMPILES MDX AND READS THE OUTPUT, and it plants the failure:
// the same source under the library's defaults must NOT contain the figure.
// The comparison is the evidence - an assertion that the value appears would
// also pass if something else had put it there.

import { compileMDX } from 'next-mdx-remote/rsc';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { CANTON_NAMES } from '@/lib/fr/cantons';
import { formatDays, formatPercent } from '@/lib/ui/core';
import { MDX_OPTIONS } from '@/lib/guides/mdx-options';
import { guideScope } from '@/lib/guides/scope';

const YEAR = 2026;
const RULES = ruleSetFor(YEAR);
const SCOPE = guideScope(YEAR);

/** The codepoint French puts between a figure and its percent sign. */
const NBSP = 0x00a0;

describe('the scope is RuleSet, formatted - not a second copy of it', () => {
  it('formats each figure the way the rest of the product formats it', () => {
    // NON-VACUITY, AND THE POINT OF R147: if RuleSet moved and this did not,
    // every article would render the old figure with every suite green.
    expect(SCOPE.fiscal).toBe(formatPercent(RULES.fiscalCeiling * 100, 0));
    expect(SCOPE.social).toBe(formatPercent(RULES.socialCeiling * 100, 1));
    expect(SCOPE.a1Threshold).toBe(formatPercent(RULES.a1ThresholdRate * 100, 0));
    expect(SCOPE.basisDays).toBe(formatDays(RULES.simplifiedBasisDays));
    expect(SCOPE.missionCap).toBe(formatDays(RULES.missionCapDays));
  });

  it('shows a whole percentage with no decimal and a fractional one with one', () => {
    // The pair a reader meets on the pillar. "40,0 %" beside "49,9 %" would
    // read as a precision the fiscal ceiling does not have.
    expect(SCOPE.fiscal).toMatch(/^40/);
    expect(SCOPE.fiscal).not.toContain(',');
    expect(SCOPE.social).toContain(',');
  });

  it('carries the no-break space by codepoint, not by looking right (R66)', () => {
    // An assertion written with an ordinary space would match either
    // character, because the DOM side is what gets normalised.
    expect(SCOPE.fiscal.charCodeAt(SCOPE.fiscal.length - 2)).toBe(NBSP);
    expect(SCOPE.social.charCodeAt(SCOPE.social.length - 2)).toBe(NBSP);
  });

  it('names the cantons from RuleSet, in RuleSet order', () => {
    // The entry most likely to MOVE: row 7 of docs/regulatory-sources.md is
    // pending and the reviewer is being asked about this exact list.
    expect(SCOPE.cantons1983).toBe(
      RULES.residence1983Cantons.map((canton) => CANTON_NAMES[canton]).join(', '),
    );
    expect(SCOPE.cantons1983).toContain('Jura');
    expect(SCOPE.cantons1983).not.toContain('Genève');
  });
});

/** An article in miniature: one prose expression and one inside a JSX prop. */
const SOURCE = [
  'Le plafond est de {fiscal} du temps de travail annuel.',
  '',
  '<Encadre titre={basisDays}>',
  '',
  'Un contenu.',
  '',
  '</Encadre>',
].join('\n');

interface EncadreProps {
  readonly titre: string;
  readonly children?: ReactNode;
}

/** The kit, reduced to what SOURCE uses. */
const components = {
  Encadre: ({ titre, children }: EncadreProps) => <aside data-titre={titre}>{children}</aside>,
};

type Options = Parameters<typeof compileMDX>[0]['options'];

async function render(options: Options): Promise<string> {
  const { content } = await compileMDX({ source: SOURCE, components, options });

  return renderToStaticMarkup(content);
}

describe('an MDX expression actually reaches the page', () => {
  it('renders the figure the scope carries, in prose and in a prop', async () => {
    const html = await render({ ...MDX_OPTIONS, scope: SCOPE });

    expect(html).toContain(SCOPE.fiscal);
    expect(html).toContain(`data-titre="${SCOPE.basisDays}"`);
  });

  it('DELETES both under the library defaults, which is what was configured', async () => {
    // THE PLANTED FAILURE, AND IT IS NOT HYPOTHETICAL: this is the exact
    // options object app/(public)/guides/[slug]/page.tsx passed until FW17.
    const html = await render({ parseFrontmatter: false, scope: SCOPE });

    expect(html).not.toContain(SCOPE.fiscal);
    expect(html).not.toContain(SCOPE.basisDays);

    // And the prose closes over the hole, which is why nothing else would
    // have caught it: the sentence still renders, missing its figure.
    expect(html).toContain('du temps de travail annuel');
  });

  it('still refuses the dangerous globals, which blockJS is not the guard for', async () => {
    // blockDangerousJS stays at its default, and it REFUSES rather than
    // quietly emptying: the compile throws with the global named, which -
    // because articles compile during static generation - stops the build.
    // That is the better failure of the two, and it is asserted rather than
    // assumed: turning off the expression blocker must not read as turning
    // off both.
    await expect(
      compileMDX({
        source: 'Valeur {process.env.HOME} ici.',
        components: {},
        options: { ...MDX_OPTIONS, scope: {} },
      }),
    ).rejects.toThrow(/process/);
  });
});
