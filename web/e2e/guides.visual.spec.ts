// web/e2e/guides.visual.spec.ts
//
// The guides surface, photographed. R37: in the container only.
//
// FOUR BASELINES, AND THE FOURTH IS THE ONE WORTH HAVING. The article closed
// and the hub are the states a reader arrives in; the article with every FAQ
// answer OPEN is the state nobody has ever looked at, and FW15 learned that
// lesson on the calculator's FAQ - the collapsed row appears in every
// baseline while the answer's colour, measure and spacing appear in none.
//
// R127's TWO VIEWPORTS: 1440 and 390. The article's layout changes shape
// between them - two columns to one, the outline moving above the prose - so
// a baseline at one width says nothing about the other.
//
// R128: the dimensions are asserted against the viewport by
// expectPageBaseline, because a fullPage capture WIDENS to include
// horizontal overflow rather than showing it. The 320 dp check lives in
// e2e/guides-narrow.spec.ts, where it is measured rather than photographed.

import { test } from '@playwright/test';
import { expectPageBaseline } from './baseline';

const FIXTURE = '/guides/fixture-modele-article';

interface VisualState {
  readonly id: string;
  readonly route: string;
  readonly reach?: (page: import('@playwright/test').Page) => Promise<void>;
}

const STATES: readonly VisualState[] = [
  { id: 'hub', route: '/guides' },
  { id: 'article', route: FIXTURE },
  {
    // THE STATE NOBODY HAS SEEN. Every other baseline carries the FAQ
    // closed; the answers' colour, measure and spacing have never been
    // photographed on this template.
    id: 'article-faq-ouverte',
    route: FIXTURE,
    reach: async (page) => {
      for (const details of await page.locator('[data-faq] details').all()) {
        await details.locator('summary').click();
      }
    },
  },
];

for (const { width, label } of [
  { width: 1440, label: 'desktop' },
  { width: 390, label: 'mobile' },
] as const) {
  test.describe(label, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const state of STATES) {
      test(state.id, async ({ page }) => {
        await page.goto(state.route);
        // Fonts before pixels: Inter arriving after the capture would
        // rebaseline the whole page against a fallback stack.
        await page.evaluate(() => document.fonts.ready);

        await state.reach?.(page);

        await expectPageBaseline(page, `guides-${state.id}-${label}.png`);
      });
    }
  });
}
