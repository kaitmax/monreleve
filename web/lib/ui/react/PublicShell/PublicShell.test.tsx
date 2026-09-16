// @vitest-environment jsdom
//
// web/lib/ui/react/PublicShell/PublicShell.test.tsx
//
// FW9 increment 4. The header is 64 px, white, 1 px bottom border; wordmark
// and four nav items on the left, one brand CTA on the right; below 768 the
// nav collapses into a disclosure and the CTA STAYS OUTSIDE it.
//
// THE ASSERTIONS THAT MATTER ARE THE KEYBOARD ONES, and they are the reason
// this component is worth a test at all. A nav that looks right and traps a
// keyboard user is the defect a visual review cannot see:
//
//   Escape closes the panel               a panel with no Escape is a trap
//   focus returns to the trigger          losing focus to <body> puts the
//                                         user at the top of the document
//   aria-expanded tracks the state        a disclosure that never updates it
//                                         announces "collapsed" while open
//
// Tab TRAVERSAL is NOT tested here. fireEvent cannot simulate it -
// @testing-library/user-event is not a dependency and adding one is
// ask-first - and jsdom has no layout, so it cannot answer what is reachable
// anyway. That claim belongs to the 360 px Playwright test in increment 6,
// which is where the prompt puts AC2's proof. What IS testable here is every
// item's PRESENCE in the panel, which is the half a Tab test would rely on.
//
// IT MUST NOT EMIT AN h1. The page owns that (FW9 protocol item 8), and a
// shell that emitted one would give every page two.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_NAME } from '@/lib/fr';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '@/lib/content/regulatory';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { ctaHrefIfLive, visibleFooterColumns, visibleNav } from '@/lib/content/routes';
import { formatDate } from '@/lib/ui/core';
import { FOOTER_COLUMNS, SHELL_COPY, SHELL_NAV } from '@/lib/fr/shell';
import type { NavLink } from '@/lib/fr/shell';
import { text } from '@/tests/support/markup';
import { PublicShell } from './PublicShell';

// Testing Library registers cleanup only under vitest globals, which this repo
// does not set. See FieldGroup.test.tsx.
afterEach(cleanup);

const DIR = join(process.cwd(), 'lib', 'ui', 'react', 'PublicShell');
const CHILD = 'Contenu de la page';

const renderShell = () => render(<PublicShell>{CHILD}</PublicShell>);

/**
 * Every leaf destination the nav offers, disclosure children included.
 *
 * A NavEntry is NOT a NavLink - its href is optional, because a disclosure
 * has none - so the entries that do have one are rebuilt as links rather than
 * passed through. Spreading them straight in typechecks as
 * `NavLink[] | NavEntry[]` and fails, which is the type doing its job: a
 * disclosure has no destination and must not be treated as if it had.
 */
/**
 * WHAT THE SHELL RENDERS, not what lib/fr declares - and FW20 is why.
 *
 * These derived from SHELL_NAV, the raw copy list, which includes routes that
 * are not built. The shell filters those out through visibleNav, so the test
 * was asserting the presence of links the component is right not to render.
 *
 * R171: a test names a role. The role here is "every destination the shell
 * actually offers", and visibleNav is the only thing that knows it.
 */
const LEAVES: readonly NavLink[] = visibleNav(SHELL_NAV).flatMap((entry) => {
  if (entry.children !== undefined) return [...entry.children];

  return entry.href === undefined ? [] : [{ label: entry.label, href: entry.href }];
});

describe('the landmarks', () => {
  it('emits a header and a named nav', () => {
    renderShell();

    expect(screen.getByRole('banner')).toBeDefined();
    expect(screen.getByRole('navigation', { name: SHELL_COPY.navLabel })).toBeDefined();
  });

  it('emits NO h1, because the page owns it', () => {
    // A shell that emitted one would give every page two, and the second h1
    // is the one nobody notices.
    const { container } = renderShell();

    expect(container.querySelector('h1')).toBeNull();
  });

  it('renders its children', () => {
    renderShell();

    expect(screen.getByText(CHILD)).toBeDefined();
  });
});

describe('the wordmark', () => {
  it('links home under an accessible name that says where it goes', () => {
    renderShell();

    const home = screen.getByRole('link', { name: SHELL_COPY.homeLabel });

    expect(home.getAttribute('href')).toBe('/');
  });

  it('shows the product name as text, not only as a picture', () => {
    const { container } = renderShell();

    expect(container.textContent).toContain(APP_NAME);
  });

  it('hides the mark itself from assistive technology', () => {
    // It is a placeholder geometric shape; APP_NAME beside it carries the
    // name, so announcing the glyph would say it twice.
    const { container } = renderShell();
    const mark = container.querySelector('a svg');

    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the mark in currentColor, with no gradient and no flag', () => {
    // frontier-logo-symbol.svg at the repository root is a full-colour
    // gradient mark whose red/blue pair reads as a French flag - every one of
    // those is on the briefs' "never draw" list, and its hexes are outside
    // the token set. The prompt asks for a placeholder geometric mark, so
    // this asserts the file was NOT reached for.
    // Comments stripped, for the reason MetricTile's equivalent test records:
    // the module comment EXPLAINS the trap by naming it, and a test that
    // fails on the explanation invites deleting the explanation.
    const source = readFileSync(join(DIR, 'Wordmark.tsx'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/linearGradient|gradient/i);
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).toContain('currentColor');
    expect(code).toContain('export function Wordmark');
  });
});

describe('the nav', () => {
  it('offers every entry from lib/fr', () => {
    renderShell();

    for (const entry of SHELL_NAV) {
      // A disclosure is a button, a leaf is a link - so this asserts the
      // label is present either way rather than guessing the role.
      expect(screen.getAllByText(entry.label).length).toBeGreaterThan(0);
    }
  });

  it('links every leaf to its href', () => {
    renderShell();

    // Every disclosure is opened first. Its children are deliberately NOT in
    // the tree while collapsed - a hidden-but-present panel is reachable by
    // Tab, which is the keyboard trap this component is mostly about - so
    // without this the test would be asserting the collapsed state and
    // failing against a correct component. The first version did exactly that.
    for (const entry of SHELL_NAV) {
      if (entry.children === undefined) continue;
      fireEvent.click(screen.getByRole('button', { name: entry.label }));
    }

    for (const leaf of LEAVES) {
      const links = screen.getAllByRole('link', { name: leaf.label });

      expect(links.length, `${leaf.label} is not a link`).toBeGreaterThan(0);
      expect(links[0]?.getAttribute('href')).toBe(leaf.href);
    }
  });

  it('offers no signup and no Connexion, whatever else it renders', () => {
    // D14: there is no signup and no signed-in web area, so "Connexion" would
    // be an entry point to nothing. SPEC 9.2's diagram still shows one.
    renderShell();

    expect(screen.queryByText(/connexion/i)).toBeNull();
    expect(screen.queryByText(/inscription/i)).toBeNull();
  });

  it('renders the primary CTA if and only if its target is live (R85)', () => {
    // THE ASSERTION IS CONDITIONAL ON PURPOSE, and it is the wiring test
    // rather than the decision test. ctaHrefIfLive is proved in BOTH
    // directions against synthetic route lists in
    // tests/unit/content/cta-gate.test.ts; what cannot be proved there is that
    // this component actually consults it. What cannot be proved HERE is both
    // branches, because the registry is a module constant and jsdom cannot
    // change it without mocking - which would prove things about the mock.
    //
    // Written this way it is correct in either state and needs no edit the day
    // /application ships: it fails if the shell renders a button to a planned
    // route, and it fails if the shell hides a button whose target is live.
    renderShell();

    const expected = ctaHrefIfLive(SHELL_COPY.ctaHref);
    const cta = screen.queryAllByRole('link', { name: SHELL_COPY.cta });

    if (expected === null) {
      expect(cta, 'a CTA is rendered although its target is not live').toHaveLength(0);
    } else {
      expect(cta.length).toBeGreaterThan(0);
      expect(cta[0]?.getAttribute('href')).toBe(expected);
    }
  });

  it('is hidden TODAY, and for the stated reason', () => {
    // The state above, pinned, so "no CTA" cannot quietly become "the CTA
    // broke". If this fails because /application went live, delete it and the
    // conditional above starts exercising the other branch.
    renderShell();

    expect(ctaHrefIfLive(SHELL_COPY.ctaHref)).toBeNull();
    expect(screen.queryAllByRole('link', { name: SHELL_COPY.cta })).toHaveLength(0);
  });
});

describe('the Calculateurs disclosure', () => {
  const disclosure = () => screen.getByRole('button', { name: 'Calculateurs' });

  it('starts collapsed, and says so', () => {
    renderShell();

    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
  });

  it('expands on click and updates aria-expanded', () => {
    // A disclosure that opens without updating the attribute announces
    // "collapsed" while showing its contents.
    renderShell();
    fireEvent.click(disclosure());

    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
  });

  it('reveals its children only when expanded', () => {
    // SCOPED TO THE HEADER NAV, and it has to be: the footer links to the same
    // destinations by design - a test asserts that overlap below - so a
    // document-wide query finds the footer's copy of this label while the
    // disclosure is still collapsed. The first version of this test did
    // exactly that and failed the moment the footer landed, against a
    // correct component.
    renderShell();

    const child = SHELL_NAV[0]?.children?.[0]?.label ?? '';
    const nav = () => screen.getByRole('navigation', { name: SHELL_COPY.navLabel });

    expect(within(nav()).queryByRole('link', { name: child })).toBeNull();

    fireEvent.click(disclosure());

    expect(within(nav()).getByRole('link', { name: child })).toBeDefined();
  });

  it('closes on Escape and RETURNS FOCUS to the trigger', () => {
    // The half that gets forgotten. Closing a panel and dropping focus to
    // <body> puts a keyboard user back at the top of the document with no
    // indication anything happened.
    renderShell();
    fireEvent.click(disclosure());
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(disclosure(), { key: 'Escape' });

    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(disclosure());
  });
});

describe('the mobile menu', () => {
  const trigger = () => screen.getByRole('button', { name: SHELL_COPY.menuOpen });

  it('has a 44 px tap target named in words', () => {
    // SPEC 16 and FD2: every tappable target >= 44 px. The size is a token
    // assertion (jsdom computes no layout); what is checked here is that the
    // icon button is not an unnamed glyph.
    renderShell();

    expect(trigger()).toBeDefined();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens, renames itself, and closes on Escape with focus returned', () => {
    renderShell();
    fireEvent.click(trigger());

    const open = screen.getByRole('button', { name: SHELL_COPY.menuClose });

    expect(open.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(open, { key: 'Escape' });

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('keeps the CTA OUTSIDE the panel', () => {
    // The requirement most easily lost in a mobile layout: the one action the
    // header exists to offer must not be hidden behind a hamburger. Asserted
    // structurally - the CTA must not be a descendant of the panel - because
    // asserting it is "visible" would pass in jsdom either way.
    const { container } = renderShell();

    fireEvent.click(trigger());

    const panel = container.querySelector('[data-mobile-panel]');
    const cta = screen.queryAllByRole('link', { name: SHELL_COPY.cta })[0];

    expect(panel).not.toBeNull();

    // UNEXERCISED WHILE R85 HIDES THE CTA, and this asserts WHY rather than
    // passing quietly. A test that simply found no CTA and moved on would look
    // identical to one where the CTA had been moved inside the panel - the
    // exact regression this test exists to catch. So: either there is a CTA
    // and it is outside the panel, or there is none AND the reason is that its
    // target is not live.
    if (cta === undefined) {
      expect(ctaHrefIfLive(SHELL_COPY.ctaHref), 'no CTA, and not because of R85').toBeNull();
    } else {
      expect(panel?.contains(cta)).toBe(false);
    }
  });

  it('carries every nav destination inside the panel', () => {
    // What a Tab-traversal test would lean on, asserted where it can be:
    // every leaf is reachable from the panel once it is open.
    const { container } = renderShell();

    fireEvent.click(trigger());

    const panel = container.querySelector('[data-mobile-panel]');

    for (const leaf of LEAVES) {
      const links = [...(panel?.querySelectorAll('a') ?? [])];

      expect(
        links.some((link) => link.textContent === leaf.label),
        `${leaf.label} is missing from the mobile panel`,
      ).toBe(true);
    }
  });
});

describe('the stylesheet carries what jsdom cannot (R61)', () => {
  const scss = readFileSync(join(DIR, 'PublicShell.module.scss'), 'utf8');

  it('sets both header heights from their R68 tokens', () => {
    expect(scss).toContain('var(--size-header-height)');
    expect(scss).toContain('var(--size-header-height-mobile)');
  });

  it('uses the hairline token for the bottom border, not the card border', () => {
    // R69. The header's rule is a rule, not the edge of a card.
    expect(scss).toContain('var(--size-rule)');
    expect(scss).not.toContain('var(--size-card-border)');
  });

  it('sets the wordmark from its own R70 pair, composing nothing', () => {
    expect(scss).toContain('var(--type-wordmark-size)');
    expect(scss).toContain('var(--type-wordmark-weight)');
  });

  it('switches at the one breakpoint, via the Sass variable', () => {
    // Not a raw 768: R68 put it in _breakpoints.scss precisely so there is
    // one switch point rather than one per stylesheet.
    expect(scss).toContain('bp.$breakpoint-md');
    expect(scss).not.toMatch(/@media[^{]*768px/);
  });

  it('gives the CTA the brand fill and a white label', () => {
    // DESIGN-SYSTEM.md section 1. This is the rule that made the contrast
    // audit resolve effective backgrounds (R76) - measured white-on-white at
    // 1,00:1 before the fix.
    expect(scss).toContain('var(--colour-brand)');
    expect(scss).toContain('var(--colour-surface)');
  });
});

describe('the footer', () => {
  it('is a landmark with its own named nav', () => {
    // Two navs on one page need two names, or a screen reader's landmark list
    // offers "navigation" twice with no way to tell them apart.
    renderShell();

    expect(screen.getByRole('contentinfo')).toBeDefined();
    expect(screen.getByRole('navigation', { name: SHELL_COPY.footerNavLabel })).toBeDefined();
  });

  it('renders the four columns from lib/fr', () => {
    renderShell();

    const footer = screen.getByRole('contentinfo');

    expect(FOOTER_COLUMNS).toHaveLength(4);
    for (const column of FOOTER_COLUMNS) {
      expect(within(footer).getByText(column.heading)).toBeDefined();
    }
  });

  it('links every destination it declares', () => {
    renderShell();

    const footer = screen.getByRole('contentinfo');

    // visibleFooterColumns, for LEAVES' reason: FOOTER_COLUMNS declares
    // destinations that are not built, and the footer is right not to link
    // them.
    for (const column of visibleFooterColumns(FOOTER_COLUMNS)) {
      for (const link of column.links) {
        const found = within(footer).getAllByRole('link', { name: link.label });

        expect(found[0]?.getAttribute('href'), link.label).toBe(link.href);
      }
    }
  });

  it('agrees with the header on where a shared label goes', () => {
    // The footer and the nav both link to the calculator and the guides. Two
    // hand-maintained lists WILL drift, and the drift is silent - a footer
    // pointing at a moved route looks fine and 404s. FW10 increment 5 makes
    // lib/content/routes.ts the one source for every public URL; until then
    // this is what holds the two together.
    const navHrefs = new Map<string, string>();

    for (const entry of SHELL_NAV) {
      for (const leaf of entry.children ?? (entry.href !== undefined ? [entry] : [])) {
        if (leaf.href !== undefined) navHrefs.set(leaf.label, leaf.href);
      }
    }

    const shared: string[] = [];

    for (const column of FOOTER_COLUMNS) {
      for (const link of column.links) {
        const inNav = navHrefs.get(link.label);

        if (inNav !== undefined) {
          shared.push(link.label);
          expect(link.href, `${link.label} differs between the nav and the footer`).toBe(inNav);
        }
      }
    }

    // Without this the loop above passes by finding no shared labels at all,
    // which is the vacuous-green shape ruling R63 exists to catch.
    expect(shared.length, 'the nav and the footer share no label').toBeGreaterThan(0);
  });

  it('carries the SAME disclaimer LegalNote renders, not a second wording', () => {
    // SPEC 9.1:650 puts $legal-01 in the footer; FD11:93 prints a shorter
    // sentence. The prompt's rule is that the spec wins on conflict, and one
    // wording means one promise - a second, softer disclaimer in the footer
    // would be the one a reader quotes back.
    renderShell();

    expect(text(screen.getByRole('contentinfo').textContent ?? '')).toContain(
      LEGAL_COPY.standing,
    );
  });
});

describe('the review date never lies (R51)', () => {
  // CHECKPOINT A RAN ON 09.09.2026, so the next two assertions inverted.
  // They are not deleted, because the property R51 protects is not "the
  // footer says pending" - it is that the footer says whatever is TRUE.
  // Before the gate that meant no date; after it, the date. Both are
  // asserted against the constant rather than a literal, so neither can
  // drift from it.
  //
  // The null branch is still covered where it belongs: reviewNotice is a
  // pure function and tests/unit/content/regulatory.test.ts exercises both
  // of its branches directly. That is why R51 built it that way, and it is
  // why this inversion costs no coverage.

  it('renders the recorded date, now that the gate has been recorded', () => {
    // BY textContent, NOT getByText - and this test went red the first time
    // for exactly the reason R66 exists. reviewNotice's sentence now carries a
    // U+00A0 before its colon (the FW11 typography pass), getByText normalises
    // the DOM side and not the matcher, so the two never met. The failure
    // printed two strings that were identical on screen:
    //
    //   Unable to find an element with the text: Derniere verification
    //   reglementaire : 09.09.2026 (normalized from 'Derniere verification
    //   reglementaire : 09.09.2026')
    //
    // Measured behaviour, written down an hour before this test was written,
    // and still walked into. textContent preserves the codepoint.
    renderShell();

    const footer = screen.getByRole('contentinfo').textContent ?? '';

    expect(LAST_REGULATORY_REVIEW).not.toBeNull();
    expect(footer).toContain(reviewNotice(LAST_REGULATORY_REVIEW));
  });

  it('no longer shows the in-progress sentence', () => {
    // Safe as a text query: reviewPending carries no punctuation the
    // typography pass touches, so there is no codepoint to disagree about.
    renderShell();

    expect(screen.queryByText(SHELL_COPY.reviewPending)).toBeNull();
  });

  it('shows a date, and it is the constant formatted rather than a literal', () => {
    // The reader-facing half, inverted. Before the gate a dd.mm.yyyy here
    // would have been the most damaging string on the site - the claim most
    // reasonably relied on, and false. Now its ABSENCE would be the wrong
    // answer, and a hand-typed date would be a second source of truth.
    renderShell();

    const footer = screen.getByRole('contentinfo').textContent ?? '';

    expect(footer).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(footer).toContain(formatDate(LAST_REGULATORY_REVIEW ?? ''));
  });

  it('reads THE CONSTANT, with no prop to override it', () => {
    // Structural, and it is the guarantee rather than a detail: a `review`
    // prop would be exactly the channel through which a date that has not
    // happened could reach the page. Comments stripped, for the reason
    // MetricTile's equivalent records.
    const source = readFileSync(join(DIR, 'PublicShell.tsx'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).toContain('reviewNotice(LAST_REGULATORY_REVIEW)');
    expect(code).not.toMatch(/readonly review/);

    // And the rendered output must equal what the pure function returns for
    // the real constant - so the two cannot diverge.
    renderShell();
    expect(screen.getByRole('contentinfo').textContent ?? '').toContain(
      reviewNotice(LAST_REGULATORY_REVIEW),
    );
  });
});
