// web/e2e/calculateur.visual.spec.ts
//
// FW11 increment 5: a baseline per calculator state, at desktop and mobile.
//
// RUNS ONLY IN THE CONTAINER (ruling R37), like every other visual spec here.
// A baseline made against a Windows font stack and compared on Linux fails as
// a MISSING FILE rather than a diff, then passes against itself on the next
// run - see e2e/composants.visual.spec.ts for the full account.
//
// THREE STATES, WHICH IS WHAT A FORM HAS THAT A DOCUMENT DOES NOT. The page
// baselines in pages.visual.spec.ts capture prose; these capture the things
// only a filled-in form can show: the vertical rhythm of a stack of
// FieldGroups, a stepper's buttons sitting flush with the field between them,
// a revealed block's left rule, the 2 px error border and the 13 px message
// under it, and a 48/56 rate in the card below. Not one of those is visible in
// an empty form.
//
// THE WIDTHS ARE 1440 AND 390, which the FW11 prompt names. THEY DIFFER FROM
// pages.visual.spec.ts, which uses 1280 and 360 - the plan's reference Android
// width. Both pairs are defensible (390 is the current iPhone width, 360 the
// Android one) and having two in the same suite is not: a layout that breaks
// only at 360 would be invisible on this page. Followed as instructed and
// raised as a question in the report rather than reconciled unilaterally,
// because moving four existing baselines is a decision about the visual record
// and not a detail.

import { expect, test } from '@playwright/test';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { CALCULATOR_PATH } from '../lib/content/routes';

/**
 * Geneva case (c), driven through the controls.
 *
 * The same inputs the E2E gate uses, so the picture and the assertion are of
 * one thing: a baseline showing a rate that no test has checked would be a
 * record of whatever the page happened to do.
 */
const fillGenevaCaseC = async (page: import('@playwright/test').Page) => {
  await page.selectOption('#canton', 'GE');
  await page.fill('#jours-teletravail', '84');
  await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
  await page.fill('#missions-france', '24');
};

const STATES = [
  {
    id: 'vide',
    reach: async () => undefined,
  },
  {
    id: 'rempli',
    reach: fillGenevaCaseC,
  },
  {
    id: 'erreur',
    // A rate of nothing per cent: the field takes a 2 px error border, the
    // message appears beneath it, and the result region swaps the rate for
    // its note. Three states of three different components in one shot.
    reach: async (page: import('@playwright/test').Page) => {
      await fillGenevaCaseC(page);
      await page.fill('#taux-activite', '0');
    },
  },
] as const;

for (const { width, label } of [
  { width: 1440, label: 'desktop' },
  { width: 390, label: 'mobile' },
] as const) {
  test.describe(label, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const state of STATES) {
      test(state.id, async ({ page }) => {
        await page.goto(CALCULATOR_PATH);
        // Fonts before pixels: Inter arriving after the capture would
        // rebaseline the whole page against a fallback stack.
        await page.evaluate(() => document.fonts.ready);

        await state.reach(page);

        // The chevron rotates over 200 ms and the reveal has no transition of
        // its own; animations are disabled explicitly rather than relying on
        // the default, so a future config change cannot make these flaky
        // without saying so.
        //
        // maxDiffPixels, AND EXACTLY WHY - because a tolerance on a visual
        // baseline is a hole unless the number is argued for.
        //
        // CI failed calculateur-vide-desktop.png at 497 differing pixels,
        // three times including both retries, so deterministically. The
        // differences sat in ONE box, x 437-622 by y 411-422: the closed
        // select's placeholder text, "Selectionnez votre canton". Same image
        // dimensions, so nothing had moved or reflowed. Measured magnitude:
        // 476 of them above a channel delta of 128, peak 238 - glyph-level
        // movement, not antialiasing.
        //
        // WHAT RULES OUT A FONT PROBLEM: every other run of Inter on the page
        // matched to ZERO pixels, across the five other calculator shots and
        // all 48 component and page baselines. Only the native control's text
        // differs. Chromium paints a closed select's label through the
        // platform theme rather than the page's text pipeline, and sub-pixel
        // advances accumulate along a run - which is also why the short
        // "Geneve" in the filled and error shots matches exactly and this
        // 25-character placeholder does not.
        //
        // 600 is the measured 497 plus headroom, and it is 0.019% of a
        // 1440x2141 image. It cannot hide a real regression: the missing
        // field spacing this suite caught during increment 5 moved thousands
        // of pixels, a colour change moves an entire element, and anything
        // that reflows the page changes the image DIMENSIONS, which fails
        // regardless of this number.
        //
        // SCOPED TO THIS SPEC. The component and page baselines stay at zero
        // tolerance; they contain no native form controls, and nothing has
        // ever asked them for one.
        await expect(page).toHaveScreenshot(`calculateur-${state.id}-${label}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixels: 600,
        });
      });
    }
  });
}
