// web/e2e/rail.visual.spec.ts
//
// AC2: "Screenshot baselines for every variant x zone (3 x 3 = 9), plus a
// 200 px-wide render of the inline variant kept as the thumbnail-legibility
// artifact for human review at Checkpoint A."
//
// RUNS ONLY IN THE CONTAINER (ruling R37). playwright.config.ts puts these in
// their own `visual` project, which `pnpm test:e2e` excludes; `pnpm
// test:visual` runs them inside mcr.microsoft.com/playwright pinned to the
// installed version. Baselines made against one font stack and compared
// against another fail as a MISSING FILE rather than a diff, and then pass on
// the next run by comparing that file against itself - measured before this
// arrangement existed.
//
// The screenshots are taken IN A PAGE, through the real cascade, because the
// rail's colour and type are var() references. A rail rasterised without the
// token layer renders a black bar in 16 px Times - identically for all three
// zones - so nine baselines taken that way would all pass while proving
// nothing. app/layout.tsx loads global.scss, which loads the tokens.

import { expect, test } from '@playwright/test';
import { expectElementBaseline } from './baseline';

const VARIANTS = ['inline', 'compact', 'social'] as const;
const ZONES = ['compliant', 'fiscal-exposure', 'social-switch'] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/rail-gallery');
  // The fonts must be loaded before anything is captured, or the first
  // screenshot is taken mid-swap and the baseline bakes in a fallback face.
  await page.evaluate(() => document.fonts.ready);
});

for (const variant of VARIANTS) {
  for (const zone of ZONES) {
    test(`${variant} / ${zone}`, async ({ page }) => {
      await expectElementBaseline(
        page.getByTestId(`rail-${variant}-${zone}`),
        `rail-${variant}-${zone}.png`,
      );
    });
  }
}

test('inline at 200 px - the Checkpoint A thumbnail artifact', async ({ page }) => {
  await expectElementBaseline(
    page.getByTestId('rail-inline-200px'),
    'rail-inline-200px.png',
  );
});

test('the zones are visually distinct, not nine identical bars', async ({ page }) => {
  // The failure this catches is the one the baselines cannot: an undefined
  // custom property renders BLACK rather than as nothing, and identically for
  // every zone. Nine baselines of nine black bars would all pass and all be
  // wrong. So the fill colour is read from the live page and required to
  // differ across the three zones and to be a real colour rather than black.
  const fills = await page.evaluate(() => {
    const read = (zone: string): string => {
      const host = document.querySelector(`[data-testid="rail-inline-${zone}"]`);
      const rects = host?.querySelectorAll('rect') ?? [];
      // The fill is the second rect: track, then fill.
      const fill = rects[1];

      return fill ? getComputedStyle(fill).fill : '';
    };

    return {
      compliant: read('compliant'),
      fiscal: read('fiscal-exposure'),
      social: read('social-switch'),
    };
  });

  expect(new Set(Object.values(fills)).size).toBe(3);
  for (const colour of Object.values(fills)) {
    expect(colour).not.toBe('rgb(0, 0, 0)');
    expect(colour).toMatch(/^rgb\(/);
  }
});
