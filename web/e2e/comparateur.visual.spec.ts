// web/e2e/comparateur.visual.spec.ts
//
// /calculateur-lamal-cmu, photographed. FW-COMPARATEUR, R661 (the prompt's
// R645): a baseline for the page in each state, each NAMED -
//
//   comparateur-vide-*        the empty page: lead, form, banner, limits
//   comparateur-rempli-*      a household compared: both sides, the spread
//   comparateur-erreur-*      a field error, no result
//
// - at 1440 and 390, and the third state the prompt names, the refusal of a
// premium year the site does not hold, in composants.visual.spec.ts as
// `comparison-refusal`: no reader can reach it from the year selector, which
// offers only the years the data has, so the workbench is its only stage.
//
// THE STATE IS CONFIRMED BEFORE IT IS PHOTOGRAPHED (the calculator's
// MUST_SHOW rule): a baseline of a result nobody checked is a record of
// whatever the page happened to do.

import { expect, test } from '@playwright/test';
import { expectPageBaseline } from './baseline';
import { COMPARATOR_PATH } from '../lib/content/routes';
import { LAMAL_COPY } from '../lib/fr/lamal';
import { DEFAULT_YEAR } from '../lib/lamal/years';

interface VisualState {
  readonly id: string;
  readonly reach: (page: import('@playwright/test').Page) => Promise<void>;
  readonly mustShow?: string;
}

const STATES: readonly VisualState[] = [
  { id: 'vide', reach: async () => undefined, mustShow: LAMAL_COPY.banner.heading },
  {
    id: 'rempli',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('60000');
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.persons.add }).click();
      await page.locator('#naissance-1').fill('2016');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
    },
    mustShow: LAMAL_COPY.result.heading(DEFAULT_YEAR),
  },
  {
    id: 'erreur',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('abc');
      await page.locator('#naissance-0').fill('85');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
    },
    mustShow: LAMAL_COPY.errors.birthYear(DEFAULT_YEAR),
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
        await page.goto(COMPARATOR_PATH);
        await page.evaluate(() => document.fonts.ready);
        await state.reach(page);

        if (state.mustShow !== undefined) {
          await expect(page.locator('main')).toContainText(state.mustShow);
        }

        // The year select is painted without its label, for the reason the
        // calculator's spec records at length (e2e/visual-select.css).
        await expectPageBaseline(page, `comparateur-${state.id}-${label}.png`, {
          animations: 'disabled',
          stylePath: 'e2e/visual-select.css',
        });
      });
    }
  });
}
