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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_NAME } from '@/lib/fr';
import { SHELL_COPY, SHELL_NAV } from '@/lib/fr/shell';
import { PublicShell } from './PublicShell';

// Testing Library registers cleanup only under vitest globals, which this repo
// does not set. See FieldGroup.test.tsx.
afterEach(cleanup);

const DIR = join(process.cwd(), 'lib', 'ui', 'react', 'PublicShell');
const CHILD = 'Contenu de la page';

const renderShell = () => render(<PublicShell>{CHILD}</PublicShell>);

/** Every leaf destination the nav offers, disclosure children included. */
const LEAVES = SHELL_NAV.flatMap((entry) =>
  entry.children !== undefined ? [...entry.children] : entry.href !== undefined ? [entry] : [],
);

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

  it('has exactly ONE primary action, and it is not a signup', () => {
    // D14: there is no signup and no signed-in web area, so "Connexion" would
    // be an entry point to nothing. SPEC 9.2's diagram still shows one.
    renderShell();

    const cta = screen.getAllByRole('link', { name: SHELL_COPY.cta });

    expect(cta[0]?.getAttribute('href')).toBe(SHELL_COPY.ctaHref);
    expect(screen.queryByText(/connexion/i)).toBeNull();
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
    renderShell();

    const child = SHELL_NAV[0]?.children?.[0]?.label ?? '';

    expect(screen.queryByRole('link', { name: child })).toBeNull();

    fireEvent.click(disclosure());

    expect(screen.getByRole('link', { name: child })).toBeDefined();
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
    const cta = screen.getAllByRole('link', { name: SHELL_COPY.cta })[0];

    expect(panel).not.toBeNull();
    expect(cta).toBeDefined();
    expect(panel?.contains(cta ?? null)).toBe(false);
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
