// @vitest-environment jsdom
//
// web/tests/unit/pages/accessibility.test.tsx
//
// FW10 increment 6: zero axe violations on every page this task built.
//
// A SECOND FILE, NOT AN ADDITION TO lib/ui/react/accessibility.test.tsx, and
// the reason is the fence. That file lives inside lib/ui/react, where the
// nested tsconfig supplies the JSX transform and where every import is a
// sibling component; importing page components from app/ into it would point
// the component suite at the application. The property being asserted is also
// different: that one says "every STATE of every component", this one says
// "every PAGE, as composed".
//
// WHAT COMPOSITION ADDS THAT COMPONENTS CANNOT. Nine components can each be
// clean and the page still wrong - two h1s because the shell emitted one and
// the page emitted another, a heading level skipped between sections, a
// duplicate id where two definition lists meet, a landmark nested inside
// another landmark. Every one of those is a property of the assembly, and axe
// only sees it once the page is assembled.
//
// SO THE PAGES ARE RENDERED INSIDE THE SHELL, which is what a reader gets.
// Rendering the content alone would miss precisely the class of defect this
// file exists for.
//
// WHAT AXE CANNOT SEE HERE, so the green is not read as more than it is: jsdom
// has no layout, so colour-contrast rules come back INCOMPLETE. Contrast is
// answered by tests/unit/tokens/contrast.test.ts, which as of this task audits
// the page stylesheets too - the 404's brand-coloured links are measured
// there at 11,40:1.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { CguContent } from '@/app/(public)/cgu/CguContent';
import AProposPage from '@/app/(public)/a-propos/page';
import ApplicationPage from '@/app/(public)/application/page';
import HomePage from '@/app/(public)/page';
import ReleveAnnuelPage from '@/app/(public)/releve-annuel/page';
import TarifsPage from '@/app/(public)/tarifs/page';
import { ConfidentialiteContent } from '@/app/(public)/confidentialite/ConfidentialiteContent';
import { MentionsLegalesContent } from '@/app/(public)/mentions-legales/MentionsLegalesContent';
import { LEGAL_ENTITY, LEGAL_ENTITY_FIELDS, type LegalEntity } from '@/lib/content/legal-entity';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

expect.extend(matchers);

afterEach(cleanup);

/** Filled, so the placeholder-shaped strings are not what axe is judging. */
const FILLED: LegalEntity = Object.fromEntries(
  LEGAL_ENTITY_FIELDS.map((field) => [field, `Valeur ${field}`]),
) as unknown as LegalEntity;

const PAGES = [
  { name: 'mentions-legales, empty', node: <MentionsLegalesContent entity={LEGAL_ENTITY} /> },
  { name: 'mentions-legales, filled', node: <MentionsLegalesContent entity={FILLED} /> },
  { name: 'confidentialite, empty', node: <ConfidentialiteContent entity={LEGAL_ENTITY} /> },
  { name: 'confidentialite, filled', node: <ConfidentialiteContent entity={FILLED} /> },
  { name: 'cgu, empty', node: <CguContent entity={LEGAL_ENTITY} /> },
  { name: 'cgu, filled', node: <CguContent entity={FILLED} /> },

  // FW20's four public pages. Each is prose in the shell, which is the shape
  // this file already covers - but "the same shape" is a description, not a
  // measurement, and the heading-order assertion below is the one that would
  // catch a page opening at h2 or skipping a level.
  //
  // The home page is here too although it is not new: it stopped being a
  // placeholder in FW20 and grew its first interactive elements, so the
  // version this file last saw is not the version that ships.
  { name: 'accueil', node: <HomePage /> },
  { name: 'a-propos', node: <AProposPage /> },
  { name: 'tarifs', node: <TarifsPage /> },
  { name: 'application', node: <ApplicationPage /> },
  { name: 'releve-annuel', node: <ReleveAnnuelPage /> },
];

describe('every page composed in the shell is free of axe violations', () => {
  it('covers all three legal pages in both states, FW20s four and FW20bs one', () => {
    // Without this the loop could pass by shrinking to nothing.
    expect(PAGES).toHaveLength(11);
    for (const page of ['mentions-legales', 'confidentialite', 'cgu']) {
      expect(PAGES.filter((entry) => entry.name.startsWith(page))).toHaveLength(2);
    }

    // FW20's four plus FW20b's one, NAMED rather than counted, for the reason
    // the legal pages are: a count of ten is satisfied by any ten, and the page
    // that would quietly fall out of this list is the one somebody rewrote.
    //
    // /application EARNS ITS PLACE HERE more than most. Its two mode cards are
    // the only place on the site where a glyph repeats six times, and the
    // decision to make it decorative - aria-hidden, meaning carried by the
    // sentence beside it - is exactly the kind that axe checks and a human
    // reviewer takes on trust.
    for (const page of ['accueil', 'a-propos', 'tarifs', 'releve-annuel', 'application']) {
      expect(PAGES.filter((entry) => entry.name === page), page).toHaveLength(1);
    }
  });

  for (const page of PAGES) {
    it(page.name, async () => {
      const { container } = render(<PublicShell>{page.node}</PublicShell>);

      expect(await axe(container)).toHaveNoViolations();
    });
  }
});

describe('the heading structure of the assembled page', () => {
  it.each(PAGES.map((page) => [page.name, page.node] as const))(
    '%s has exactly one h1 and skips no level',
    async (_name, node) => {
      // Asserted separately from axe because axe's heading-order rule is not
      // in its default rule set, and because the failure mode is specific: the
      // shell deliberately emits no h1 so that the page can, and a page that
      // forgot would leave the document with none at all.
      const { container } = render(<PublicShell>{node}</PublicShell>);

      const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((element) =>
        Number.parseInt(element.tagName.slice(1), 10),
      );

      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);

      // No jump of more than one level on the way down. The footer's column
      // headings are h2s, so the sequence continues past the page's own.
      for (let index = 1; index < levels.length; index += 1) {
        const previous = levels[index - 1] ?? 1;
        const current = levels[index] ?? 1;

        expect(current - previous, `h${previous} followed by h${current}`).toBeLessThanOrEqual(1);
      }
    },
  );
});
