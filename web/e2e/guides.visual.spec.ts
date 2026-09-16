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

  // THE REAL ARTICLES, FW17. The fixture exercises the TEMPLATE - headings,
  // paragraphs, links, the outline, the FAQ - and nothing else, because that
  // is all it contains. It cannot photograph the half of the kit SPEC 9.5
  // names: the bordered summary block, the warning banner, the comparison
  // table. Until now no baseline held a picture of any of them.
  //
  // TWO ARTICLES RATHER THAN THREE, and the choice is not arbitrary. The
  // pillar is the longest and carries every element once; the mission cluster
  // is the only one with a three-row table and two banners in the same
  // column, which is where spacing between stacked kit blocks shows. The
  // social cluster is structurally a subset of the two and would be a third
  // picture of the same decisions.
  { id: 'pilier', route: '/guides/teletravail-frontalier-40-pourcent' },
  { id: 'cluster-missions', route: '/guides/jours-de-mission-hors-suisse' },

  // FW18's two, chosen for what they contain rather than to be complete.
  // The attestation guide is the one written ENTIRELY in the conditional
  // (R146 case (c) applied to a premise, parked as P1) and carries two
  // stacked Avertissements; the Geneve page is the only one with a six-row
  // DataGrid, and the only canton page. The declaration guide is
  // structurally a subset of the attestation guide's shape.
  { id: 'attestation', route: '/guides/attestation-employeur-teletravail' },
  { id: 'geneve', route: '/guides/geneve' },

  // FW18b's droit d'option guide gets NO STATE, and that is a decision rather
  // than an oversight. The selection rule this list has followed since FW17 is
  // "photograph what no existing baseline contains": the pillar for every kit
  // element once, the mission cluster for a table beside two banners, the
  // attestation guide for stacked Avertissements, Geneve for a six-row
  // DataGrid. The droit d'option article is an Encadre, one Avertissement and
  // bullet lists - each already photographed, in the same column, at the same
  // widths. A seventh picture of the same decisions costs two baselines to
  // review on every regeneration and catches nothing the six do not.
  //
  // IT IS NOT UNPHOTOGRAPHED. The hub baseline carries its card, and its
  // prose is asserted in e2e/guides.spec.ts and the mesh. If the article ever
  // grows a table or a second banner, it earns a state here.
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
