// web/e2e/calcs-figures.spec.ts
//
// FW-CALCS-A2, R737: PROOF THAT THE REDESIGN CHANGED NO FIGURE.
//
// Both calculators were restyled to the A2 artboards with their logic
// untouched. This spec states, for a fixed set of inputs, every figure each
// page SHOWS - the telework rate, the four day tiles, the status, the warning
// codes, the engine's refusals; the comparator's three Swiss totals in francs
// and euros, the French contribution, the case sentence and its flags - and
// it was committed and run against main (33abf79) BEFORE any page changed,
// then run again on the branch. Same file, same literals, both green.
//
// THE LITERALS ARE THE ASSERTION (R171). They are the engine's and lib/lamal's
// outputs for these inputs, produced once by calling calculateTelework and
// compare() directly and written here; a figure that moves on either page
// fails this file, whichever layer moved it.
//
// READ THROUGH HOOKS THE REDESIGN KEEPS: data-panel, data-negative,
// data-warning, data-side, data-case-sentence, data-floored, data-pass. The
// comparator's amounts are read as a sorted list per row, because the A2 card
// sets the euros above the francs where main set them below - an order of
// presentation, not a figure.

import { expect, type Locator, type Page, test } from '@playwright/test';
import { CALCULATOR_PATH, COMPARATOR_PATH, RESULT_PATH } from '../lib/content/routes';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { LAMAL_COPY } from '../lib/fr/lamal';
import { RATE_COPY } from '../lib/fr/rates';
import { STATUS_COPY } from '../lib/fr/statuses';

/** Whitespace as a reader sees it: every run of spaces, NBSP or NNBSP is one. */
const squash = (text: string | null): string => (text ?? '').replace(/[\s\u00a0\u202f]+/g, ' ').trim();

interface TeleworkFigures {
  readonly status: string;
  readonly badge: string;
  readonly rate: readonly string[];
  readonly tiles: readonly string[];
  readonly warnings: readonly string[];
}

async function teleworkFigures(page: Page): Promise<TeleworkFigures> {
  const panel = page.locator('#resultat');
  const chip = panel.locator('[data-panel="badge"] [data-status]');

  await expect(page.locator('[data-panel="rate"]')).toBeVisible();

  return {
    status: (await chip.getAttribute('data-status')) ?? '',
    badge: squash(await chip.textContent()),
    rate: (await panel.locator('[data-panel="rate"] p').allTextContents()).map(squash),
    tiles: (await panel.locator('[data-panel="tiles"] [data-negative]').allTextContents()).map(squash),
    warnings: await panel
      .locator('[data-warning]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-warning') ?? '')),
  };
}

/**
 * The rate slot as RateDisplay words it: the declarable figure and its
 * caption, then - the two rates diverge in every case here - the raw figure,
 * its caption and the reason. The figures are literals; the words are
 * RATE_COPY's, so this asserts numbers rather than re-typing copy (R181).
 */
const rates = (declarable: string, raw: string): readonly string[] => [
  declarable,
  RATE_COPY.declarableCaption,
  raw,
  RATE_COPY.rawCaption,
  squash(RATE_COPY.divergence),
];

/**
 * The cases. `query` is SPEC 9.4's vocabulary; the island decodes it on mount
 * and /resultat on the server, so one query exercises both renderings.
 */
const TELEWORK = [
  {
    name: 'Geneva case (c): 84 days, 24 mission days in France, half-days',
    query: 'canton=GE&tt=84&mfr=24&decompte=dj',
    figures: {
      status: 'mission-exposure',
      badge: STATUS_COPY['mission-exposure'].label,
      rate: rates('39,16 %', '45,0 %'),
      tiles: ['2', '25,5', '226', '14'],
      warnings: ['MISSION_CAP_EXCEEDED', 'MISSIONS_EXCEED_HEADROOM', 'A1_REQUIRED'],
    },
  },
  {
    name: 'Vaud, 80 %, 40 days',
    query: 'canton=VD&taux=80&tt=40',
    figures: {
      status: 'compliant',
      badge: STATUS_COPY['compliant'].label,
      rate: rates('20,83 %', '20,9 %'),
      tiles: ['36,5', '55,5', '192', '0'],
      warnings: [],
    },
  },
  {
    name: 'Geneva, the exact method over 220 days, 62 days',
    query: 'canton=GE&tt=62&methode=exact&total=220',
    figures: {
      status: 'compliant',
      badge: STATUS_COPY['compliant'].label,
      rate: rates('28,18 %', '28,2 %'),
      tiles: ['26', '47,5', '220', '0'],
      // The panel's order (ResultPanel's WARNING_ORDER), not the engine's.
      warnings: ['A1_REQUIRED', 'EXACT_METHOD_UNVERIFIED'],
    },
  },
  {
    name: 'Geneva, 130 days: both ceilings passed',
    query: 'canton=GE&tt=130',
    figures: {
      status: 'social-switch',
      badge: STATUS_COPY['social-switch'].label,
      rate: rates('54,16 %', '54,2 %'),
      tiles: ['34', '10,5', '110', '130'],
      warnings: ['FISCAL_CEILING_EXCEEDED', 'SOCIAL_CEILING_EXCEEDED', 'A1_REQUIRED'],
    },
  },
] as const;

test.describe('R737: the telework calculator shows the same figures', () => {
  test('94 / 240 typed into the form reads 39,16 %, never 39,17', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);
    await page.getByLabel(CALCULATEUR_COPY.form.canton.label).selectOption('GE');
    await page.getByLabel(CALCULATEUR_COPY.form.days.label).fill('94');

    expect(await teleworkFigures(page)).toEqual({
      status: 'compliant',
      badge: STATUS_COPY['compliant'].label,
      rate: rates('39,16 %', '39,2 %'),
      tiles: ['2', '25,5', '240', '0'],
      warnings: ['A1_REQUIRED'],
    });
  });

  for (const { name, query, figures } of TELEWORK) {
    test(`the island, from a link: ${name}`, async ({ page }) => {
      await page.goto(`${CALCULATOR_PATH}?${query}`);

      expect(await teleworkFigures(page)).toEqual(figures);
    });

    test(`/resultat, without the island: ${name}`, async ({ page }) => {
      await page.goto(`${RESULT_PATH}?${query}`);

      expect(await teleworkFigures(page)).toEqual(figures);
    });
  }

  test('/resultat refuses half a day under whole days with the engine’s words', async ({ page }) => {
    await page.goto(`${RESULT_PATH}?canton=TI&tt=50.5&mtiers=3&decompte=j`);

    await expect(page.locator('[data-panel]')).toHaveCount(0);
    expect(squash(await page.locator('main li').first().textContent())).toContain('demi-journée');
  });
});

/** The amounts in one element, as a sorted list: "2 511,60 CHF", "2 718 €". */
async function amounts(element: Locator): Promise<string[]> {
  const text = squash(await element.textContent());

  return [...text.matchAll(/\d[\d ]*(?:,\d+)? (?:CHF|€)/g)].map((match) => match[0]).sort();
}

interface ComparatorFigures {
  readonly heading: string;
  readonly swiss: Readonly<Record<string, readonly string[]>>;
  readonly french: readonly string[];
  readonly caseSentence: string;
  readonly floored: boolean;
  readonly announced: boolean;
}

async function comparatorFigures(page: Page): Promise<ComparatorFigures> {
  const panel = page.locator('[data-panel="comparison"]');

  await expect(panel).toBeVisible();

  const swiss: Record<string, string[]> = {};
  const labels = panel.locator('[data-side="switzerland"] dt');

  for (let index = 0; index < (await labels.count()); index += 1) {
    const label = labels.nth(index);

    swiss[squash(await label.textContent())] = await amounts(label.locator('xpath=following-sibling::dd[1]'));
  }

  return {
    heading: squash(await panel.locator('h2').textContent()),
    swiss,
    french: await amounts(panel.locator('[data-side="france"] dd')),
    caseSentence: squash(await panel.locator('[data-case-sentence]').textContent()),
    floored: (await panel.locator('[data-floored]').count()) === 1,
    announced: (await panel.locator('[data-pass="announced"]').count()) === 1,
  };
}

async function compareHousehold(
  page: Page,
  household: { readonly year?: string; readonly income: string; readonly births: readonly string[] },
): Promise<ComparatorFigures> {
  await page.goto(COMPARATOR_PATH);

  if (household.year !== undefined) {
    await page.getByLabel(LAMAL_COPY.form.year.label).selectOption(household.year);
  }

  await page.locator('#revenu-fiscal').fill(household.income);

  for (const [index, birth] of household.births.entries()) {
    if (index > 0) await page.getByRole('button', { name: LAMAL_COPY.form.persons.add }).click();

    await page.locator(`[data-person="${index + 1}"] input[inputmode="numeric"]`).fill(birth);
  }

  await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();

  return comparatorFigures(page);
}

const SINGLE_ADULT_2027 = {
  'Total le plus bas': ['2 511,60 CHF', '2 718 €'],
  'Total médian': ['5 871,60 CHF', '6 355 €'],
  'Total le plus haut': ['10 691 €', '9 877,20 CHF'],
} as const;

test.describe('R737: the LAMal / CMU comparator shows the same figures', () => {
  test('the sample household: one adult born 1985, 42 000 EUR, 2027', async ({ page }) => {
    expect(await compareHousehold(page, { income: '42000', births: ['1985'] })).toEqual({
      heading: LAMAL_COPY.result.heading(2027),
      swiss: SINGLE_ADULT_2027,
      french: ['2 382 €'],
      caseSentence: squash(LAMAL_COPY.result.below),
      floored: false,
      announced: true,
    });
  });

  test('a household with a child: 1985 and 2016, 73 519 EUR, 2027', async ({ page }) => {
    expect(await compareHousehold(page, { income: '73519', births: ['1985', '2016'] })).toEqual({
      heading: LAMAL_COPY.result.heading(2027),
      swiss: {
        'Total le plus bas': ['3 132,00 CHF', '3 390 €'],
        'Total médian': ['8 511,60 CHF', '9 213 €'],
        'Total le plus haut': ['13 057,20 CHF', '14 133 €'],
      },
      french: ['4 904 €'],
      caseSentence: squash(LAMAL_COPY.result.depends),
      floored: false,
      announced: true,
    });
  });

  test('the floored case: 12 000 EUR reads 0 € and says why', async ({ page }) => {
    expect(await compareHousehold(page, { income: '12000', births: ['1985'] })).toEqual({
      heading: LAMAL_COPY.result.heading(2027),
      swiss: SINGLE_ADULT_2027,
      french: ['0 €'],
      caseSentence: squash(LAMAL_COPY.result.below),
      floored: true,
      announced: true,
    });
  });

  test('the other year: the same adult for 2026, with its final PASS', async ({ page }) => {
    expect(await compareHousehold(page, { year: '2026', income: '42000', births: ['1985'] })).toEqual({
      heading: LAMAL_COPY.result.heading(2026),
      swiss: {
        'Total le plus bas': ['2 400,00 CHF', '2 598 €'],
        'Total médian': ['5 871,60 CHF', '6 355 €'],
        'Total le plus haut': ['10 691 €', '9 877,20 CHF'],
      },
      french: ['2 399 €'],
      caseSentence: squash(LAMAL_COPY.result.below),
      floored: false,
      announced: false,
    });
  });
});
