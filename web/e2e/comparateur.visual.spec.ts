// web/e2e/comparateur.visual.spec.ts
//
// /calculateur-lamal-cmu, photographed. FW-COMPARATEUR, R661 (the prompt's
// R645): a baseline for the page in each state, each NAMED -
//
//   comparateur-vide-*        the empty page: lead, form, banner, limits
//   comparateur-rempli-*      a household compared: both sides, the spread
//   comparateur-erreur-*      a field error, no result
//   comparateur-inferieur-*   R674: the French contribution below the lowest
//                             Swiss total - its own sentence
//   comparateur-superieur-*   R674: above the highest - its own sentence
//                             (rempli is the third case, between the two)
//
// FW-CALCS-A2, ADDENDUM 2 (R751) - each new feature's state, NAMED:
//
//   comparateur-commune-*            R743: a joint return, the base shown
//                                    under the two fields
//   comparateur-annee-partielle-*    R744: an affiliation from 1 March - the
//                                    heading, the prorata line, the Swiss
//                                    start-month note (S2 not established)
//   comparateur-points-inferieur-*   R745: the dots with the French line below
//                                    every total
//   comparateur-points-entre-*       R745: the French line among the totals
//   comparateur-points-superieur-*   R745: the French line above every total
//   comparateur-soins-*              R746: the care card, for a household of
//                                    an adult and three children (the
//                                    children's joint cap shown)
//   comparateur-franc-deplace-*      R747: the slider moved to +5 %
//   comparateur-delai-sans-s3-*      R748: the deadline helper filled, with
//                                    « environ » and its warning - S3 was not
//                                    found, so there is no "with S3" state.
//                                    FW-DELAI-RAPPEL: it now shows the reminder
//                                    form (R918), on a PLACED clock - the form
//                                    is offered only while the due day has not
//                                    passed, so an unplaced clock would drop it
//                                    from this picture after 14 February 2027
//
// FW-DELAI-RAPPEL (R918), each NAMED:
//
//   comparateur-delai-rappel-envoye-*  the form answered "ok": the server's
//                                      sentence in its place (R225). The answer
//                                      is FULFILLED here, not asked of a server -
//                                      the picture is of the page, and the
//                                      round trip is tests/db's (R920)
//   comparateur-rappel-confirme-*      a confirmation link's landing: the
//                                      outcome revealed by its fragment
//
// Every mustShow below is DERIVED from lib/lamal and LAMAL_COPY (R171): the
// count sentence from the same countAgainst the panel uses, the dates from
// optionPeriodEnd, the base from jointIncomeEur.
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
import { RAPPEL_COPY } from '../lib/fr/rappel';
import { RAPPEL_FORM_COPY } from '../lib/fr/rappel-form';
import { LANDING_STATES, landingFragment } from '../lib/rappel/landing';
import { REMINDER_ENDPOINT, REMINDER_STATUS } from '../lib/rappel/status';
import { MONTHS_PER_YEAR } from '../lib/lamal/compare';
import { optionPeriodEnd } from '../lib/lamal/deadline';
import { formatEur } from '../lib/lamal/format';
import { countAgainst, householdTotals, jointIncomeEur, scenario } from '../lib/lamal/scenario';
import { DEFAULT_YEAR } from '../lib/lamal/years';

/** R745's counting sentence for one adult born 1985 at an income, as the panel words it. */
function countSentence(incomeEur: number): string {
  const result = scenario({ year: DEFAULT_YEAR, incomeEur, persons: [{ birthYear: 1985, withAccident: false }] });

  if (!result.ok) throw new Error(result.error.code);

  const value = result.value.comparison;
  const { above, below, count } = countAgainst(
    householdTotals(value, MONTHS_PER_YEAR).map((total) => total.eur),
    value.french.contributionEur,
  );

  return LAMAL_COPY.result.chart.sentence(above, below, count);
}

/** One adult born 1985 at an income, compared. */
async function compareAdult(page: import('@playwright/test').Page, income: string): Promise<void> {
  await page.locator('#revenu-fiscal').fill(income);
  await page.locator('#naissance-0').fill('1985');
  await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
}

/**
 * FW-CALC-REDESIGN (R1408, R1409): what a state photographs may now sit in a
 * closed accordion - the insurers' dots, the care card, the franc slider in
 * the rail; the three-month helper below. A reader opens it to see it, and so
 * does the state, before it is confirmed and photographed: a picture named
 * for the dots must show the dots.
 */
async function openFold(page: import('@playwright/test').Page, within: string): Promise<void> {
  const details = page.locator(`${within} details`).first();

  await details.locator(':scope > summary').click();
  await expect(details).toHaveJSProperty('open', true);
}

const START = `${DEFAULT_YEAR}-03-01`;
const EVENT = '2026-11-30';

interface VisualState {
  readonly id: string;
  readonly reach: (page: import('@playwright/test').Page) => Promise<void>;
  readonly mustShow?: string;
  /**
   * FW-DELAI-RAPPEL: the moment the page believes it is, placed before it
   * loads. The role (R171): a reader filling the helper ON THE DAY OF THE
   * EVENT - the reminder is offered then for any event, so the picture does
   * not depend on the day the suite runs.
   */
  readonly clock?: Date;
}

/** The reader fills the helper on the day of the event, at noon. */
const ON_THE_EVENT_DAY = new Date(`${EVENT}T12:00:00`);

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
    // R674. (12 225 - 12 225) x 8 % = 0 EUR: below the lowest Swiss total.
    id: 'inferieur',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('12225');
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
    },
    mustShow: LAMAL_COPY.result.below,
  },
  {
    // R674. (1 000 000 - 12 225) x 8 % = 79 022 EUR: above the highest.
    id: 'superieur',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('1000000');
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
    },
    mustShow: LAMAL_COPY.result.above,
  },
  {
    // FW-CALCS-A2 (R735): R737's sample household - one adult born 1985,
    // 42 000 EUR, the default year.
    id: 'adulte-seul',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('42000');
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
    },
    mustShow: LAMAL_COPY.result.below,
  },
  {
    // FW-CALCS-A2 (R735): the floored case - 12 000 EUR is under a quarter of
    // the PASS, the formula goes negative, the page shows 0 and says why.
    id: 'plancher',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('12000');
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
      await expect(page.locator('[data-floored]')).toHaveCount(1);
    },
    mustShow: LAMAL_COPY.result.below,
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
  {
    // R743: 38 000 personal + half of 8 000 in common = 42 000.
    id: 'commune',
    reach: async (page) => {
      await page.getByRole('button', { name: LAMAL_COPY.form.declaration.joint }).click();
      await page.locator('#revenus-personnels').fill('38000');
      await page.locator('#revenus-communs').fill('8000');
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
      await expect(page.locator('[data-panel="comparison"]')).toBeVisible();
    },
    mustShow: LAMAL_COPY.form.declaration.here(formatEur(jointIncomeEur(38000, 8000))),
  },
  {
    // R744: from 1 March of the default year - 306 days, 9 Swiss months.
    id: 'annee-partielle',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('42000');
      await page.getByRole('button', { name: LAMAL_COPY.form.affiliation.fromDate }).click();
      await page.locator('#debut-affiliation').fill(START);
      await page.locator('#naissance-0').fill('1985');
      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
      await expect(page.locator('[data-start-month]')).toHaveCount(1);
      await expect(page.locator('[data-prorata]')).toHaveCount(1);
    },
    mustShow: LAMAL_COPY.result.headingFrom(DEFAULT_YEAR, START),
  },
  {
    // R745: (12 225 - 12 225) x 8 % = 0 EUR - below all thirteen.
    id: 'points-inferieur',
    reach: async (page) => {
      await compareAdult(page, '12225');
      await openFold(page, '[data-chart]');
    },
    mustShow: countSentence(12225),
  },
  {
    // R745: (60 000 - 12 225) x 8 % = 3 822 EUR - among the totals.
    id: 'points-entre',
    reach: async (page) => {
      await compareAdult(page, '60000');
      await openFold(page, '[data-chart]');
    },
    mustShow: countSentence(60000),
  },
  {
    // R745: (1 000 000 - 12 225) x 8 % = 79 022 EUR - above all thirteen.
    id: 'points-superieur',
    reach: async (page) => {
      await compareAdult(page, '1000000');
      await openFold(page, '[data-chart]');
    },
    mustShow: countSentence(1000000),
  },
  {
    // R746: an adult and three children - the children's joint cap applies.
    id: 'soins',
    reach: async (page) => {
      await page.locator('#revenu-fiscal').fill('73519');
      await page.locator('#naissance-0').fill('1985');

      for (const [index, year] of ['2016', '2018', '2020'].entries()) {
        await page.getByRole('button', { name: LAMAL_COPY.form.persons.add }).click();
        await page.locator(`[data-person="${index + 2}"] input[inputmode="numeric"]`).fill(year);
      }

      await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
      await openFold(page, '[data-care]');
      await expect(page.locator('[data-children-cap]')).toBeVisible();
    },
    mustShow: LAMAL_COPY.result.care.apart,
  },
  {
    // R747: the slider five steps to the right - the franc 5 % stronger. A
    // range input cannot be filled, so it is moved as a reader moves it.
    id: 'franc-deplace',
    reach: async (page) => {
      await compareAdult(page, '42000');
      await openFold(page, '[data-franc]');

      const slider = page.locator('#cours-franc');

      await slider.focus();
      for (let step = 0; step < 5; step += 1) await slider.press('ArrowRight');
    },
    mustShow: LAMAL_COPY.result.franc.label(LAMAL_COPY.result.franc.stronger(5)),
  },
  {
    // R748, S3 NOT FOUND: 30 November -> the end of February, « environ ».
    id: 'delai-sans-s3',
    clock: ON_THE_EVENT_DAY,
    reach: async (page) => {
      await openFold(page, '[data-deadline]');
      await page.locator('#date-evenement').fill(EVENT);
      await expect(page.locator('[data-deadline-warning]')).toHaveText(LAMAL_COPY.deadline.warning);
      // R918: the reminder form under the helper, confirmed before photographed.
      await expect(page.locator('[data-reminder-form]')).toBeVisible();
    },
    mustShow: LAMAL_COPY.deadline.until(LAMAL_COPY.deadline.longDate(optionPeriodEnd(EVENT) ?? '')),
  },
  {
    // R918 / R225: the server answered "ok"; its sentence replaces the form.
    // Focus ends on no field: the button it was on is gone with the form.
    id: 'delai-rappel-envoye',
    clock: ON_THE_EVENT_DAY,
    reach: async (page) => {
      await page.route(`**${REMINDER_ENDPOINT}`, (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ status: REMINDER_STATUS.ok, message: RAPPEL_COPY.answers.ok }),
        }),
      );
      await openFold(page, '[data-deadline]');
      await page.locator('#date-evenement').fill(EVENT);
      await page.getByLabel(RAPPEL_FORM_COPY.label).fill('rappel@monreleve.test');
      await page.getByRole('button', { name: RAPPEL_FORM_COPY.submit }).click();
      await expect(page.locator('[data-reminder-sent]')).toBeVisible();
    },
    mustShow: RAPPEL_COPY.answers.ok,
  },
  {
    // A confirmation link's landing: the fragment reveals one outcome. The
    // page is scrolled back to the top so the capture does not depend on the
    // browser's jump to the target.
    id: 'rappel-confirme',
    reach: async (page) => {
      const target = landingFragment(LANDING_STATES.confirmed);

      await page.evaluate((hash) => {
        window.location.hash = hash;
      }, target);
      await expect(page.locator(`#${target}`)).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
    mustShow: RAPPEL_COPY.outcomes.confirmed.heading,
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
        if (state.clock !== undefined) await page.clock.setFixedTime(state.clock);

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
