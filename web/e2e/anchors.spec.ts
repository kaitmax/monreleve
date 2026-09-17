// web/e2e/anchors.spec.ts
//
// RULING R173: AN UNSTYLED ANCHOR IS IMPOSSIBLE, NOT MERELY DISCOURAGED.
//
// THE DEFECT SHIPPED THREE TIMES, in three different components, and every
// time the sequence was identical: an anchor placed in a new context took the
// user agent's default blue, no gate objected, a baseline photographed it, and
// a person cropping that baseline found it.
//
//   .breadcrumb                 FW17
//   the reviewer chip           FW18b, R160
//   the home page's two doors   FW20
//
// Each was fixed in its own component with the same one-line override. THIRD
// SHIPPING IS THE SIGNAL R149 DESCRIBES: the defect is in the guard, not the
// component. A fourth component would have produced a fourth instance.
//
// SO THE BASE LAYER STYLES `a`, and this asserts the consequence: no anchor
// the product renders resolves to the UA default. It is checked against the
// UA's OWN colours rather than against a list of permitted ones - a whitelist
// of design-system colours would need maintaining, and the thing being
// forbidden is precisely "nobody styled this", which has exactly two values.

import { expect, test } from '@playwright/test';
import { goToServedPage } from './support/served';
import { liveRoutes } from '../lib/content/routes';

/**
 * Chromium's unstyled anchor colours. These are what "nobody decided" looks
 * like, and they are stable across versions because they are in the HTML
 * rendering spec's suggested stylesheet.
 */
const UA_DEFAULTS = new Set(['rgb(0, 0, 238)', 'rgb(85, 26, 139)']);

/** Every live public route, so a new page cannot opt out by existing. */
const ROUTES = liveRoutes().map((route) => route.path);

test('the route list is the registry, so this is not a chosen few', () => {
  expect(ROUTES.length, 'liveRoutes() returned nothing').toBeGreaterThanOrEqual(10);
  expect(ROUTES).toContain('/');
});

for (const route of ROUTES) {
  test(`${route} renders no unstyled anchor (R173)`, async ({ page }) => {
    await goToServedPage(page, route);
    await page.evaluate(() => document.fonts.ready);

    const offenders = await page.evaluate(() => {
      const found: { text: string; colour: string; href: string }[] = [];

      for (const anchor of document.querySelectorAll('a')) {
        found.push({
          text: (anchor.textContent ?? '').trim().slice(0, 40),
          colour: getComputedStyle(anchor).color,
          href: anchor.getAttribute('href') ?? '',
        });
      }

      return found;
    });

    // NON-VACUOUS: every page in this product renders the shell, so a page
    // with no anchors at all means the selector broke, not that the page is
    // clean.
    expect(offenders.length, `${route} rendered no anchors at all`).toBeGreaterThan(5);

    const unstyled = offenders.filter((one) => UA_DEFAULTS.has(one.colour));

    expect(
      unstyled,
      `anchors nobody styled on ${route}:\n` +
        unstyled.map((o) => `  "${o.text}" -> ${o.href} (${o.colour})`).join('\n'),
    ).toEqual([]);
  });
}
