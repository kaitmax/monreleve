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
    const edges = await page.evaluate(() => {
      const bar = document.querySelector('header > div');
      const list = document.querySelector('header nav ul');

      if (bar === null || list === null) return null;

      const box = bar.getBoundingClientRect();
      const padding = Number.parseFloat(getComputedStyle(bar).paddingRight);

      return { content: box.right - padding, nav: list.getBoundingClientRect().right };
    });

    expect(edges, 'no bar or no nav list was found').not.toBeNull();
    expect(Math.abs((edges?.content ?? 0) - (edges?.nav ?? 0))).toBeLessThanOrEqual(1);
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

  test('RED: the lone Calculateurs child is a link to the calculator, under its own label', async ({
    page,
  }) => {
    const only = SHELL_NAV[0]?.children?.[0];

    await expect(nav(page).getByRole('link', { name: only?.label ?? '', exact: true })).toHaveAttribute(
      'href',
      CALCULATOR_PATH,
    );
    await expect(nav(page).getByRole('button', { name: SHELL_NAV[0]?.label ?? '' })).toHaveCount(0);
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
