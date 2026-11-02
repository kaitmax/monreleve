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
import { expectElementBaseline, expectPageBaseline } from './baseline';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { CALCULATOR_PATH, RESULT_PATH } from '../lib/content/routes';
import { ALERTES_COPY } from '../lib/fr/alertes';
import { PARAM_NOTICE } from '../lib/fr/params';
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

/**
 * A state worth a picture.
 *
 * `search` is FW13: two of these states are not reached by using the form
 * at all but by ARRIVING at a URL somebody else wrote, which is the whole
 * point of the share mechanic. A state reached by filling fields and a state
 * reached by opening a link produce different first renders, and only the
 * second one can show a notice.
 */
interface VisualState {
  readonly id: string;
  readonly search?: string;
  readonly reach: (page: import('@playwright/test').Page) => Promise<void>;
}

const STATES: readonly VisualState[] = [
  {
    id: 'vide',
    reach: async () => undefined,
  },
  {
    // THE FAQ OPEN, and it is the only state in this file that exists
    // because nobody had ever looked at it. FW15 added three collapsed
    // answers; the closed row appears in every baseline here, and the
    // ANSWER - its colour, its measure, its spacing under a question that
    // wraps to two lines at 390 - had never been photographed. R135:
    // a baseline certifies that nothing changed, and only a person
    // cropping the image catches something that was wrong from the start.
    id: 'faq-ouverte',
    reach: async (page: import('@playwright/test').Page) => {
      for (const details of await page.locator('[data-faq] details').all()) {
        await details.locator('summary').click();
      }
    },
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

  // -------------------------------------------------------------------------
  // FW13 increment 6: THE TWO STATES A LINK PRODUCES.
  //
  // Every state above is reached by filling fields, which is the reader who
  // typed their way here. The share mechanic makes a second kind of reader -
  // one who opened a link from a Facebook thread - and their FIRST RENDER is
  // different from anything above: a form that is already full before they
  // touched it, or a notice explaining what the platform did to the link on
  // the way.
  //
  // WHAT ONLY A PICTURE ANSWERS. The notice sits above the form and pushes
  // everything down; it is the only element on this page that renders text
  // somebody else wrote, and it carries a dismiss control on the same line as
  // a sentence that wraps differently at 390 than at 1440.
  // -------------------------------------------------------------------------
  {
    id: 'lien-partage',
    // Geneva case (c) as a LINK. The same scenario as "rempli" above, reached
    // the other way - so the two baselines are a visual round-trip test: if
    // decoding a link produced a different form from filling it in, these two
    // pictures would differ and nothing else in the suite would say so.
    search: '?canton=GE&tt=84&mfr=24&decompte=dj',
    reach: async () => undefined,
  },
  {
    // FW14: the capture card's status, revealed by the FRAGMENT the
    // subscribe handler redirects with. These two are the only baselines in
    // the product whose appearance depends on a URL fragment, and they are
    // the only place the :target mechanism can be seen working against real
    // CSS - jsdom identity-maps CSS modules, so axe sees all six messages
    // and the hiding is invisible to it.
    id: 'capture-succes',
    search: '#alerte-ok',
    reach: async () => undefined,
  },
  {
    id: 'capture-erreur',
    search: '#alerte-adresse-invalide',
    reach: async () => undefined,
  },
  {
    id: 'lien-invalide',
    // What Facebook does to an ampersand, plus a value that cannot be read
    // and a tracking parameter nobody here recognises: all three notice lines
    // at once - invalid, ignored, and the advice under them.
    search: '?canton=GE&tt=84&taux=abc&amp;mfr=24&utm_source=facebook',
    reach: async () => undefined,
  },
  // FW-CALCS-A2 (R735): the A2 states the page did not have a picture of.
  {
    // The missions question answered "Oui": the two fields revealed.
    id: 'missions-ouvertes',
    reach: async (page) => {
      await page.selectOption('#canton', 'GE');
      await page.fill('#jours-teletravail', '40');
      await page.getByRole('radio', { name: CALCULATEUR_COPY.form.missions.yes }).check();
    },
  },
  {
    // A rhythm chosen: two chips checked, and the line that says where the
    // projection is drawn (R343 - on /resultat, by the server).
    id: 'projection',
    search: '?canton=GE&tt=40&rythme=ma&rythme=je',
    reach: async () => undefined,
  },
];

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

  // FW13. The shared link must show the SAME contextual link as the state it
  // reproduces, which is what makes the two pictures comparable; the mangled
  // one must show the notice, without which it is a photograph of an
  // ordinary page under a name that claims otherwise.
  'lien-partage': RESULT_COPY.links['mission-exposure'].text,
  'lien-invalide': PARAM_NOTICE.lead,

  // FW14. Without these, a fragment that stopped matching would photograph
  // an ordinary calculator under a name claiming a status.
  'capture-succes': ALERTES_COPY.submitted,
  'capture-erreur': ALERTES_COPY.errors.emailInvalid,

  // FW-CALCS-A2 (R735).
  'missions-ouvertes': CALCULATEUR_COPY.form.missions.france.label,
  projection: CALCULATEUR_COPY.projection.onTheResult,
};

/**
 * FW-CALCS-A2 (R727, R735): /resultat, the answer without JavaScript, in its
 * two main states. NO RHYTHM in the result state: the projection counts the
 * working days left from today, so a baseline carrying one would change every
 * day without anything having changed (the projection is pictured on the
 * calculator side by the 'projection' state, and its card by the workbench's
 * ResultCard specimen).
 */
const RESULTAT_STATES = [
  {
    id: 'resultat',
    search: '?canton=GE&tt=84&mfr=24&decompte=dj',
    mustShow: RESULT_COPY.links['mission-exposure'].text,
  },
  {
    id: 'invalide',
    search: '?canton=TI&tt=50.5&decompte=j',
    mustShow: CALCULATEUR_COPY.resultat.invalid,
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
        // A state with a `search` is ENTERED at that URL rather than
        // navigated to and then filled: the notice and the prefill are
        // properties of the first render.
        await page.goto(`${CALCULATOR_PATH}${state.search ?? ''}`);
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

    for (const state of RESULTAT_STATES) {
      test(`resultat-${state.id}`, async ({ page }) => {
        await page.goto(`${RESULT_PATH}${state.search}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('main')).toContainText(state.mustShow);
        await expectPageBaseline(page, `resultat-${state.id}-${label}.png`, {
          animations: 'disabled',
        });
      });
    }
  });
}

// ---------------------------------------------------------------------------
// RULING R130's VISUAL PROOF, at 320 px - SPEC section 16's stated floor.
//
// THE ONE WIDTH WHERE THE SCALING IS LARGEST, and therefore the one where a
// scaling tick is worst. R127 gave the rail max-width: 100%, so at a 320 px
// viewport the panel column is 230 px against the SVG's natural 376 - a
// factor of 0,61, which turns a 2 px tick into 1,22 px of drawn width before
// R130 and leaves it at 2 px after.
//
// AN ELEMENT CAPTURE, NOT THE PAGE. The subject is two marks a few pixels
// wide; a full-page shot at 320 would be four thousand pixels tall and the
// thing under test would be forty of them. The rail slot is the smallest
// frame that contains the claim.
//
// THIS IS THE THIRD WIDTH IN A SUITE R127 RECONCILED ONTO TWO, and that is
// deliberate rather than a lapse: 1440 and 390 are the LAYOUT baselines, and
// at neither of them is the rail scaled at all - 390 gives the slot 300 px,
// and the difference between a scaled and an unscaled tick there is a tenth
// of a pixel. A proof of a scaling rule has to be taken where the scaling
// happens.
// ---------------------------------------------------------------------------
test.describe('R130: the rail at 320', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test('ticks stay 2 px where the rail is scaled to 0,61', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);
    await page.evaluate(() => document.fonts.ready);

    await page.selectOption('#canton', 'GE');
    await page.fill('#jours-teletravail', '110');

    // The state is confirmed before it is photographed, like every other
    // baseline in this file.
    await expect(page.locator('main')).toContainText(RESULT_COPY.links['regime-lost'].text);

    const rail = page.locator('[data-panel="rail"]');

    await expect(rail).toBeVisible();
    await expectElementBaseline(rail, 'rail-scaled-320.png');
  });
});
