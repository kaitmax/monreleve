// web/e2e/narrow.spec.ts
//
// RULING R127: a 360 dp overflow check on every public route.
//
// WHY IT EXISTS. R127 reconciled the two baseline width pairs onto 1440 and
// 390 - 390 being the current iPhone width, and one pair being better than two
// defensible ones. That gave up the 360 captures, which were plan.md's
// reference Android width, and giving up coverage without replacing it is what
// R112 forbids. So the narrow case is covered by a MEASUREMENT instead of a
// picture: cheap, one assertion per route, and it catches the thing a
// 360-wide screenshot was actually there to catch.
//
// WHAT A 360 SCREENSHOT WAS FOR, and it is worth being honest that this is not
// a like-for-like swap. A picture shows how prose wraps, whether a placeholder
// name breaks badly, whether a heading collides with a rule. This check does
// not see any of that. What it sees is the failure that MATTERS at 360 and is
// invisible in a passing 390 baseline: a page that scrolls sideways, which
// makes a phone reader drag the layout back and forth to read a sentence.
// SPEC 16 states 320 as the floor; FD2 states 360 as the width the layout must
// hold at.
//
// REGISTRY-DRIVEN, AND THAT IS THE OPPOSITE OF WHAT pages.visual.spec.ts DOES.
// That file lists its pages by hand and says why: "a registry-driven loop
// would silently add a baseline the day a route goes live, and a NEW baseline
// always passes - it is written, then compared against itself." Exactly right
// for a picture, and exactly wrong here. A new route added to this loop gets a
// real check on its first run, because an overflow measurement has no
// self-comparing first state - it either overflows or it does not. So the
// registry drives it, and a route that goes live is covered without anybody
// remembering to add it.

import { expect, test } from '@playwright/test';
import { PUBLIC_ROUTES } from '../lib/content/routes';

/** Every live route, plus a URL that produces the 404. */
const ROUTES: ReadonlyArray<{ readonly id: string; readonly path: string }> = [
  ...PUBLIC_ROUTES.filter((route) => route.status === 'live').map((route) => ({
    id: route.path === '/' ? 'accueil' : route.path.slice(1),
    path: route.path,
  })),
  { id: '404', path: '/cette-page-nexiste-pas' },
];

/** FD2's reference width. plan.md's Android device. */
const NARROW = 360;

test.describe(`${NARROW} dp`, () => {
  test.use({ viewport: { width: NARROW, height: 800 } });

  test('the route list came from the registry and is not empty', () => {
    // The loop below is generated, so an empty or broken list would report
    // zero failures as success - the vacuous-pass shape R63 exists to catch.
    expect(ROUTES.length).toBeGreaterThanOrEqual(6);
    expect(ROUTES.map((route) => route.path)).toContain('/sources');
    expect(ROUTES.map((route) => route.path)).toContain(
      '/calculateur-teletravail-frontalier',
    );
  });

  for (const { id, path } of ROUTES) {
    test(`${id} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;

        return root.scrollWidth - root.clientWidth;
      });

      expect(
        overflow,
        `${path} scrolls horizontally by ${overflow} px at ${NARROW} dp`,
      ).toBeLessThanOrEqual(0);
    });
  }

  test('the calculator holds at 360 with a result on screen too', async ({ page }) => {
    // THE STATE THE OTHER LOOP CANNOT REACH. Every route above is measured in
    // its initial state, and the calculator's initial state has no panel:
    // no rail, no four tiles, no banners. The rail is 376 px wide by FD1,
    // which is WIDER THAN THIS VIEWPORT, so it is the single most likely
    // source of horizontal overflow in the product and the empty page cannot
    // show it.
    await page.goto('/calculateur-teletravail-frontalier');
    await page.evaluate(() => document.fonts.ready);

    await page.selectOption('#canton', 'GE');
    await page.fill('#jours-teletravail', '144');

    // The heaviest panel: two negative tiles, three banners, the rail full.
    await expect(page.locator('[data-panel="tiles"]')).toBeVisible();

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;

      return root.scrollWidth - root.clientWidth;
    });

    expect(
      overflow,
      `the calculator with a result scrolls horizontally by ${overflow} px at ${NARROW} dp`,
    ).toBeLessThanOrEqual(0);
  });

  test('and the measurement would catch a real overflow', async ({ page }) => {
    // An absence assertion needs its detector tested, and this one is two
    // properties of documentElement that could both be zero for uninteresting
    // reasons. A deliberately over-wide element must be seen.
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    await page.evaluate(() => {
      const wide = document.createElement('div');

      wide.style.width = '900px';
      wide.style.height = '10px';
      document.body.append(wide);
    });

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;

      return root.scrollWidth - root.clientWidth;
    });

    expect(overflow).toBeGreaterThan(0);
  });
});
