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
// under it, and the rate in the card below. Not one of those is visible in an
// empty form.
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
import { expectPageBaseline } from './baseline';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { CALCULATOR_PATH } from '../lib/content/routes';
import { PROVISIONAL_COPY } from '../lib/fr/provisional';
import { RESULT_COPY } from '../lib/fr/result';

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

  // -------------------------------------------------------------------------
  // FW12 increment 6: THE PANEL, once per status, plus the notice.
  //
  // 'rempli' above is already mission-exposure - Geneva case (c) - so it is
  // not repeated here under a second name; the record would be two identical
  // pictures whose captions disagreed. What follows is the three statuses it
  // does not show and the one banner that is not a status at all.
  //
  // WHY THESE ARE PICTURES AND NOT MORE ASSERTIONS. Every string, order and
  // attribute in the panel is asserted in tests/unit/pages/result-panel-*;
  // what no assertion covers is whether seven stacked slots have room for
  // each other - a rail 376 px wide inside a 390 px viewport, four tiles that
  // must wrap rather than shrink, three banners with a heading each, and two
  // tiles whose figures turn red and whose labels get LONGER at exactly the
  // moment there is bad news to fit.
  // -------------------------------------------------------------------------
  {
    id: 'panneau-conforme',
    // 72 days of 240: 30 %, under both ceilings. One banner (A1), positive
    // headroom in both tiles, and the compliant badge.
    reach: async (page: import('@playwright/test').Page) => {
      await page.selectOption('#canton', 'GE');
      await page.fill('#jours-teletravail', '72');
    },
  },
  {
    id: 'panneau-regime-perdu',
    // 110 days: 45,83 %, past the fiscal ceiling and short of the social one.
    // THE MIXED CASE, and the one worth a picture: the first tile is red with
    // an "au-dessus" label while the second is black with a "restants" one,
    // side by side, and they must not read as a formatting inconsistency.
    reach: async (page: import('@playwright/test').Page) => {
      await page.selectOption('#canton', 'GE');
      await page.fill('#jours-teletravail', '110');
    },
  },
  {
    id: 'panneau-bascule-sociale',
    // 144 days plus 5 mission days: 60 %, past both. Two red tiles, three
    // banners, and the heaviest the panel ever gets.
    reach: async (page: import('@playwright/test').Page) => {
      await page.selectOption('#canton', 'GE');
      await page.fill('#jours-teletravail', '144');
      await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
      await page.fill('#missions-france', '5');
    },
  },
  {
    id: 'panneau-avis-provisoire',
    // R110's notice above a compliant panel: the info fill, the reading named
    // in bold inside the sentence, and the link to /sources. Both P1 and P3
    // at once, because two entries in that list is where the bullet spacing
    // and the link's line-wrapping are actually visible.
    reach: async (page: import('@playwright/test').Page) => {
      await page.selectOption('#canton', 'GE');
      await page.fill('#jours-teletravail', '40');
      await page.fill('#taux-activite', '80');
      await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
      await page.fill('#missions-france', '6');
      await page.fill('#missions-pays-tiers', '4');
      await page.getByRole('button', { name: CALCULATEUR_COPY.form.advanced.summary }).click();
      await page.getByRole('radio', { name: CALCULATEUR_COPY.form.method.exact }).check();
      await page.fill('#total-jours', '200');
    },
  },
] as const;

/**
 * What each panel state must actually be showing before it is photographed.
 *
 * THE HEADER OF THIS FILE STATES THE RULE AND THE FIRST DRAFT BROKE IT: "a
 * baseline showing a rate that no test has checked would be a record of
 * whatever the page happened to do." Four new states reached by filling
 * fields is four chances to photograph the wrong one - a mistyped id fills
 * nothing, and `page.fill` on a field that does not exist throws, but a field
 * that exists and does not change the STATUS fails silently and produces a
 * picture named for a status it does not show. `--update-snapshots` would
 * then accept it, and the record would be wrong in the one place nobody
 * re-reads.
 *
 * The contextual link is chosen by Status, so it identifies the state in one
 * string. Keyed by id, and every panel state must have an entry.
 */
const MUST_SHOW: Readonly<Record<string, string>> = {
  'panneau-conforme': RESULT_COPY.links.compliant.text,
  'panneau-regime-perdu': RESULT_COPY.links['regime-lost'].text,
  'panneau-bascule-sociale': RESULT_COPY.links['social-switch'].text,
  'panneau-avis-provisoire': PROVISIONAL_COPY.readMore,
  rempli: RESULT_COPY.links['mission-exposure'].text,
};

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

        // THE STATE IS CONFIRMED BEFORE IT IS PHOTOGRAPHED. See MUST_SHOW.
        const expected = MUST_SHOW[state.id];

        if (expected !== undefined) {
          await expect(page.locator('main')).toContainText(expected);
        }

        // animations disabled explicitly rather than by relying on the
        // default, so a future config change cannot make these flaky without
        // saying so. The chevron rotates over 200 ms.
        //
        // THE SELECT IS PAINTED WITHOUT ITS LABEL, and the alternative I
        // shipped first is recorded because withdrawing it is the lesson.
        //
        // CI rejected calculateur-vide-desktop.png at 497 differing pixels,
        // deterministically, every one of them inside the closed canton
        // select's label. Identical image dimensions; peak channel delta 238,
        // so glyph movement rather than antialiasing. Chromium paints a
        // closed select's label through the platform theme, and that path is
        // not reproducible between this machine's container and CI's.
        //
        // I FIRST ANSWERED WITH maxDiffPixels: 600 and wrote that it "cannot
        // hide a real regression". It hid one within the hour. Ruling R109
        // turned five number inputs into text inputs, removing their
        // spinners, and ALL SIX baselines silently declined to regenerate
        // because each change came in under the allowance - measured by
        // setting the tolerance to zero, at which point all six failed. A
        // tolerance on a whole image cannot tell the one unstable element
        // from everything else in the frame.
        //
        // So the CAUSE goes rather than the symptom being tolerated:
        // e2e/visual-select.css paints select text transparent for the
        // duration of the shot. Zero tolerance everywhere, the box still
        // compared - border, width, height, position - and the label's text
        // asserted where a
        // string belongs - all 26 options, their French names and their
        // collation order, in tests/unit/pages/calculateur-form.test.tsx.
        // R128: expectPageBaseline asserts the stored width against the
        // viewport. A fullPage capture widens to include horizontal
        // overflow, which is how this page shipped 31 px of it at 390.
        await expectPageBaseline(page, `calculateur-${state.id}-${label}.png`, {
          animations: 'disabled',
          stylePath: 'e2e/visual-select.css',
        });
      });
    }
  });
}
