// web/e2e/shell-layout.spec.ts
//
// FW33: the shell's layout, MEASURED in a real browser rather than left to the
// baselines. A baseline certifies that nothing changed, never that what exists
// is right (R135) - FW13's 22 px copy button passed its baseline for exactly
// that reason. So the numbers FD11 section 1 and 7 give are asserted as numbers.
//
// AGAINST A SERVED PUBLIC PAGE, not the workbench: the claim is about the shell
// a reader meets. goToServedPage refuses to measure anything but a 200 (R169's
// corollary - an absence assertion on a 404 page proves nothing).
//
// Each test is labelled RED or PIN. A PIN is expected to pass on its first run
// and exists so a later change cannot move the value silently; the report
// lists it as such rather than as a guard that went red (R133).

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';
import { guideNavLinks } from '../lib/guides/registry';
import { FOOTER_COLUMNS, SHELL_COPY, SHELL_NAV } from '../lib/fr/shell';
import { goToServedPage } from './support/served';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 360, height: 800 };

/** #111827, --colour-text-primary, as Chromium serialises a computed colour. */
const TEXT_PRIMARY = 'rgb(17, 24, 39)';

const nav = (page: Page) => page.getByRole('navigation', { name: SHELL_COPY.navLabel });
const footerNav = (page: Page) => page.getByRole('navigation', { name: SHELL_COPY.footerNavLabel });

test.describe('the header, on desktop', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await goToServedPage(page, '/');
    await page.evaluate(() => document.fonts.ready);
  });

  test('RED: the nav sits centre-right, its right edge on the bar content edge', async ({
    page,
  }) => {
    // Before FW33 it sat 12 px after the wordmark, the bar's gap, with the
    // page's width empty to its right.
    //
    // THE DESKTOP NAV BY NAME, not `header nav ul` (R171: a test names the
    // thing it means). FW-SHELL-BURGER put a second nav in the header - the
    // phone menu's panel, which comes FIRST in the DOM because FD2 draws the
    // hamburger first - so the loose selector started measuring a list that
    // is display:none at this width, and reported a correct header as broken.
    //
    // FW-WEB-ACCOUNT: THE BAR MAY END WITH AN ACTION. The sign-in link (and the
    // CTA, the day it renders) follows the nav at the bar's gap, as the A2
    // header draws "Se connecter" after the last nav item. So the property is
    // stated for both shapes: the RIGHT-MOST visible thing in the bar sits on
    // the content edge, and when that is an action rather than the nav, the nav
    // ends exactly one bar gap before it - centre-right, never mid-bar.
    const edges = await page.evaluate((navLabel) => {
      const bar = document.querySelector('header > div');
      const navElement = document.querySelector(`header nav[aria-label="${navLabel}"]`);
      const list = navElement?.querySelector('ul') ?? null;

      if (bar === null || navElement === null || list === null) return null;

      const box = bar.getBoundingClientRect();
      const style = getComputedStyle(bar);
      const visible = [...bar.children].filter((child) => getComputedStyle(child).display !== 'none');
      const after = visible.slice(visible.indexOf(navElement) + 1)[0] ?? null;

      return {
        content: box.right - Number.parseFloat(style.paddingRight),
        rightmost: visible.at(-1)?.getBoundingClientRect().right ?? 0,
        nav: list.getBoundingClientRect().right,
        gap: Number.parseFloat(style.columnGap),
        nextLeft: after === null ? null : after.getBoundingClientRect().left,
      };
    }, SHELL_COPY.navLabel);

    expect(edges, 'no bar or no nav list was found').not.toBeNull();
    expect(Math.abs((edges?.content ?? 0) - (edges?.rightmost ?? 0))).toBeLessThanOrEqual(1);

    if (edges?.nextLeft === null || edges?.nextLeft === undefined) {
      expect(Math.abs((edges?.content ?? 0) - (edges?.nav ?? 0))).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(edges.nextLeft - edges.nav - edges.gap)).toBeLessThanOrEqual(1);
    }
  });

  test('RED: nav items are 32 px apart (FD11 section 1)', async ({ page }) => {
    const gaps = await nav(page)
      .locator(':scope > ul > li')
      .evaluateAll((items) =>
        items.slice(1).map((item, index) => {
          const previous = items[index]?.getBoundingClientRect();

          return Math.round(item.getBoundingClientRect().left - (previous?.right ?? 0));
        }),
      );

    expect(gaps.length, 'fewer than two nav items').toBeGreaterThan(0);
    expect(gaps.every((gap) => gap === 32), `gaps measured: ${gaps.join(', ')}`).toBe(true);
  });

  test('the Calculateurs menu is a disclosure again, opening onto both tools (FW-COMPARATEUR)', async ({
    page,
  }) => {
    // Until FW-COMPARATEUR this pinned H4's collapse: one live child, shown as
    // a link under its own label. The comparator is live, so the menu has two
    // children and the header renders the disclosure. H4 itself is still
    // proven on a synthetic menu (tests/unit/content/nav-collapse.test.ts).
    const button = nav(page).getByRole('button', { name: SHELL_NAV[0]?.label ?? '' });

    await expect(button).toHaveCount(1);
    await button.click();
    await expect(nav(page).getByRole('link', { name: SHELL_NAV[0]?.children?.[0]?.label ?? '', exact: true })).toHaveAttribute(
      'href',
      CALCULATOR_PATH,
    );
    await expect(nav(page).getByRole('link', { name: SHELL_NAV[0]?.children?.[1]?.label ?? '', exact: true })).toHaveAttribute(
      'href',
      '/calculateur-lamal-cmu',
    );
  });

  test('PIN: nav items stay text-primary (ruling H7: DESIGN-SYSTEM section 4 wins)', async ({
    page,
  }) => {
    const colour = await nav(page)
      .getByRole('link')
      .first()
      .evaluate((link) => getComputedStyle(link).color);

    expect(colour).toBe(TEXT_PRIMARY);
  });

  test('PIN: the bar is 64 px tall (the header box is 65 with its 1 px rule)', async ({
    page,
  }) => {
    const height = await page
      .locator('header > div')
      .first()
      .evaluate((bar) => bar.getBoundingClientRect().height);

    expect(Math.round(height)).toBe(64);
  });
});

/** The footer's column boxes, in document order. */
const columnBoxes = (page: Page) =>
  footerNav(page)
    .locator(':scope > div')
    .evaluateAll((columns) =>
      columns.map((column) => {
        const box = column.getBoundingClientRect();

        return { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width) };
      }),
    );

test.describe('the footer', () => {
  test('RED: four EQUAL columns on desktop, side by side', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await goToServedPage(page, '/');

    const boxes = await columnBoxes(page);

    expect(boxes).toHaveLength(FOOTER_COLUMNS.length);
    expect(new Set(boxes.map((box) => box.top)).size, 'the columns are not on one row').toBe(1);

    const widths = boxes.map((box) => box.width);

    expect(Math.max(...widths) - Math.min(...widths), `widths: ${widths.join(', ')}`).toBeLessThanOrEqual(1);
  });

  test('RED: two columns on a phone, so the 44 px rows do not run screens long', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await goToServedPage(page, '/');

    const boxes = await columnBoxes(page);

    expect(boxes).toHaveLength(FOOTER_COLUMNS.length);
    // Columns one and two share a row; three starts the next one.
    expect(boxes[1]?.top).toBe(boxes[0]?.top);
    expect(boxes[1]?.left ?? 0).toBeGreaterThan(boxes[0]?.left ?? 0);
    expect(boxes[2]?.top ?? 0).toBeGreaterThan(boxes[0]?.top ?? 0);
  });

  test('RED: it links every published guide, the alert list and the about page, and each answers 200', async ({
    page,
    request,
  }) => {
    await goToServedPage(page, '/');

    const hrefs = await footerNav(page)
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

    // PRESENCE FIRST, then reachability: a list that is merely absent would
    // make every "answers 200" check below vacuous.
    const wanted = [...guideNavLinks().map((link) => link.href), '/alertes', '/a-propos'];

    expect(guideNavLinks().length).toBeGreaterThan(0);

    for (const href of wanted) {
      expect(hrefs, href).toContain(href);
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });
});
