// web/tests/unit/content/regulatory-gate.test.ts
//
// RULING R54, the mechanism half: "While it is null, the calculator page emits
// robots noindex, is excluded from sitemap.xml, and is absent from
// PublicShell's nav and footer links. When the operator sets the date, all
// three flip with no code change. A test asserts both states."
//
// THREE SURFACES, ONE CONDITION. The point of R54 is that a single constant
// drives all three, so they cannot disagree - a route that is noindex but
// still in the sitemap tells a crawler two different things.
//
// PARAMETERISED, NOT MOCKED, and this is a deliberate reading of the prompt's
// "tests for both states by mocking the constant". A vi.mock proves things
// about the mock; passing the review date in makes both branches ordinary
// function calls. The same choice as R51's reviewNotice, R84's entity prop and
// R85's ctaHrefIfLive - and it is why those three inverted cleanly when
// Checkpoint A landed rather than needing their mocks rewritten.
//
// THE GATE IS NOW OPEN (LAST_REGULATORY_REVIEW = '2026-09-09'), which makes
// the closed branch the one that would rot unnoticed. It is asserted first
// below for that reason.

import { describe, expect, it } from 'vitest';
import {
  CALCULATOR_PATH,
  PUBLIC_ROUTES,
  type PublicRoute,
  isGated,
  isHrefHidden,
  isVisible,
  visibleFooterColumns,
  visibleNav,
  sitemapPaths,
  visibleRoutes,
} from '@/lib/content/routes';
import { LAST_REGULATORY_REVIEW } from '@/lib/content/regulatory';
import { FOOTER_COLUMNS, SHELL_NAV } from '@/lib/fr/shell';

const GATED: PublicRoute = {
  path: '/gated-example',
  status: 'live',
  task: 'test',
  gate: 'regulatory-review',
  changeFrequency: 'monthly',
  priority: 0.9,
};

const UNGATED: PublicRoute = { ...GATED, path: '/ungated-example', gate: undefined };
const PLANNED: PublicRoute = { ...GATED, path: '/planned-example', status: 'planned' };

describe('a gated route while the review is UNRECORDED', () => {
  it('is not visible', () => {
    expect(isVisible(GATED, null)).toBe(false);
  });

  it('is absent from the visible set', () => {
    expect(visibleRoutes([GATED, UNGATED], null).map((r) => r.path)).toEqual(['/ungated-example']);
  });

  it('is absent from the sitemap', () => {
    expect(sitemapPaths([GATED, UNGATED], null)).toEqual(['/ungated-example']);
  });
});

describe('the same route once the review is RECORDED', () => {
  it('becomes visible with no code change - only the constant moved', () => {
    expect(isVisible(GATED, '2026-09-09')).toBe(true);
  });

  it('joins the visible set and the sitemap', () => {
    expect(visibleRoutes([GATED, UNGATED], '2026-09-09').map((r) => r.path)).toEqual([
      '/gated-example',
      '/ungated-example',
    ]);
    expect(sitemapPaths([GATED, UNGATED], '2026-09-09')).toEqual([
      '/gated-example',
      '/ungated-example',
    ]);
  });
});

describe('the gate is not the only condition', () => {
  it('a PLANNED route stays out even with the review recorded', () => {
    // Two independent reasons to hide a route, and conflating them would mean
    // recording the review published pages that do not exist. status says
    // whether the page EXISTS; gate says whether it may be SEEN.
    expect(isVisible(PLANNED, '2026-09-09')).toBe(false);
    expect(sitemapPaths([PLANNED], '2026-09-09')).toEqual([]);
  });

  it('an ungated live route is visible in both states', () => {
    expect(isVisible(UNGATED, null)).toBe(true);
    expect(isVisible(UNGATED, '2026-09-09')).toBe(true);
  });
});

describe('isGated', () => {
  it('is true only for a route carrying the regulatory gate', () => {
    expect(isGated(GATED)).toBe(true);
    expect(isGated(UNGATED)).toBe(false);
  });
});

describe('the real registry', () => {
  it('gates the calculator, and nothing else', () => {
    // R54 names one route. A second gated route would be a decision, not a
    // detail, so the count is pinned.
    const gated = PUBLIC_ROUTES.filter(isGated).map((route) => route.path);

    expect(gated).toEqual([CALCULATOR_PATH]);
  });

  it('exports the calculator path rather than repeating the slug', () => {
    // The slug is permanent (SPEC 14) and appears in the registry, the page
    // directory, the nav, the metadata and three test files. One export.
    expect(CALCULATOR_PATH).toBe('/calculateur-teletravail-frontalier');
  });

  it('has the calculator live, because the page now exists', () => {
    const calculator = PUBLIC_ROUTES.find((route) => route.path === CALCULATOR_PATH);

    expect(calculator?.status).toBe('live');
  });

  it('shows the calculator today, because the gate is open', () => {
    // The wiring, against reality rather than a fixture. If Checkpoint A were
    // ever un-recorded this flips, and that is the whole design.
    expect(LAST_REGULATORY_REVIEW).not.toBeNull();
    expect(sitemapPaths()).toContain(CALCULATOR_PATH);
  });

  it('would hide it again if the review were withdrawn', () => {
    // The branch that no longer occurs in production and therefore needs
    // asserting most: pass null explicitly and the calculator leaves the
    // sitemap while the legal pages stay.
    const paths = sitemapPaths(PUBLIC_ROUTES, null);

    expect(paths).not.toContain(CALCULATOR_PATH);
    expect(paths).toContain('/mentions-legales');
  });
});

describe('the third surface: the nav and the footer (R54)', () => {
  it('hides a gated href while the review is unrecorded', () => {
    expect(isHrefHidden(CALCULATOR_PATH, null)).toBe(true);
  });

  it('shows it once the review is recorded', () => {
    expect(isHrefHidden(CALCULATOR_PATH, '2026-09-09')).toBe(false);
  });

  it('never hides a route it does not know', () => {
    // The conservative direction for a NAV, and the opposite of
    // ctaHrefIfLive's. An unregistered href is a bug that
    // tests/unit/content/routes.test.ts already fails on; silently deleting
    // links because of it would hide the evidence and break navigation for a
    // typo. Hiding is reserved for a route that ASKED to be hidden.
    expect(isHrefHidden('/nowhere-at-all', null)).toBe(false);
  });

  it('drops the calculator from the nav while closed, and keeps it open', () => {
    const closed = visibleNav(SHELL_NAV, null);
    const open = visibleNav(SHELL_NAV, '2026-09-09');

    const hrefs = (entries: typeof SHELL_NAV): string[] =>
      entries.flatMap((entry) => [
        ...(entry.href === undefined ? [] : [entry.href]),
        ...(entry.children ?? []).map((child) => child.href),
      ]);

    expect(hrefs(closed)).not.toContain(CALCULATOR_PATH);
    expect(hrefs(open)).toContain(CALCULATOR_PATH);
  });

  it('drops the Calculateurs disclosure when the gate closes, since FW20', () => {
    // THIS TEST ASSERTED THE OPPOSITE UNTIL FW20, and its premise was
    // "the comparator is planned but NOT gated, so the menu still has a child
    // and must not vanish with the calculator."
    //
    // That premise depended on planned routes being LINKED. FW20 stopped it:
    // the shell had advertised /calculateur-lamal-cmu and /application from
    // the footer of every page since FW9, and both 404ed the whole time.
    // isHrefHidden now hides anything not live, which is R85's rule - a target
    // renders only when it is live - finally applied to the shell.
    //
    // So with the review closed, the disclosure's only two children are a
    // gated calculator and an unbuilt comparator, and it correctly vanishes -
    // which is exactly what the next test says must happen to a disclosure
    // that loses every child.
    const closed = visibleNav(SHELL_NAV, null);

    expect(closed.find((entry) => entry.children !== undefined)).toBeUndefined();
  });

  it('keeps it open today, because the calculator is live and the review is recorded', () => {
    // THE OTHER HALF, and the one that would catch an over-eager filter. A
    // predicate that hid too much would leave this disclosure empty too, and
    // the assertion above alone cannot tell "correctly dropped" from "drops
    // everything".
    const open = visibleNav(SHELL_NAV, '2026-09-09');
    const menu = open.find((entry) => entry.children !== undefined);

    expect(menu, 'the Calculateurs disclosure is gone even with the gate open').toBeDefined();
    expect(menu?.children?.map((child) => child.href)).toEqual([CALCULATOR_PATH]);
  });

  it('drops a disclosure that loses every child', () => {
    // A menu button that opens onto nothing is worse than an absent one.
    const onlyGated = [
      { label: 'Calculateurs', children: [{ label: 'Calc', href: CALCULATOR_PATH }] },
    ];

    expect(visibleNav(onlyGated, null)).toEqual([]);
    expect(visibleNav(onlyGated, '2026-09-09')).toHaveLength(1);
  });

  it('drops the calculator from the footer while closed', () => {
    const closed = visibleFooterColumns(FOOTER_COLUMNS, null);
    const open = visibleFooterColumns(FOOTER_COLUMNS, '2026-09-09');

    const hrefs = (columns: typeof FOOTER_COLUMNS): string[] =>
      columns.flatMap((column) => column.links.map((link) => link.href));

    expect(hrefs(closed)).not.toContain(CALCULATOR_PATH);
    expect(hrefs(open)).toContain(CALCULATOR_PATH);
  });

  it('keeps every column, because a column heading is not a link', () => {
    // The Outils column loses one of two links while closed. Dropping the
    // whole column would remove the comparator too.
    expect(visibleFooterColumns(FOOTER_COLUMNS, null)).toHaveLength(FOOTER_COLUMNS.length);
  });
});
