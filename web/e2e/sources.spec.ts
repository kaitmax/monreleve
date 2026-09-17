// web/e2e/sources.spec.ts
//
// RULING R164: THE REGULATORY TABLE TAKES THE WIDE CONTAINER.
//
// WHY THIS FILE EXISTS. FW18b measured the page and found 49 px of the LAST
// column - the status - outside its scroll container at 1440 and 1280, and
// 315 px at 390, with 0 px of page overflow at every width. The page never
// scrolled sideways, which is R159 working exactly as specified; the cost was
// paid entirely by the column a reader most needs, on a screen with 824 px of
// unused viewport. Recorded as PARK-11.
//
// It is a defect of the WRONG CONTAINER, not of the scroll rule. The 680 px
// article measure exists for reading paragraphs, and this is a reference
// table. R164 gives the table section Container 'public' at 1200.
//
// BOTH HALVES ARE ASSERTED, because fixing either one alone is easy and
// wrong: widening the container until nothing scrolls would reintroduce the
// page overflow R127 forbids, and keeping the page from scrolling is what the
// old layout already did while hiding the column.

import { expect, test } from '@playwright/test';
import { goToServedPage } from './support/served';
import { SOURCES_COPY, UNKNOWN_IDS } from '../lib/fr/sources';
import { A_PROPOS_COPY } from '../lib/fr/a-propos';
import { TARIFS_COPY } from '../lib/fr/tarifs';
import { RELEVE_COPY } from '../lib/fr/releve-annuel';
import { PRODUCT_STATE } from '../lib/content/product-state';
import { complianceClaims } from '../tests/support/vocabulary';

/** 390 is a phone; 1280 and 1440 are the desktop widths the baselines use. */
const WIDTHS = [1440, 1280, 390] as const;

interface Measured {
  readonly containerWidth: number;
  readonly tableWidth: number;
  readonly lastCellRight: number;
  readonly containerRight: number;
  readonly pageOverflow: number;
}

async function measure(page: import('@playwright/test').Page): Promise<Measured | null> {
  return page.evaluate(() => {
    const table = document.querySelector('main table');
    const container = table?.parentElement;
    const lastCell = table?.querySelector('tbody tr td:last-child');

    if (!table || !container || !lastCell) return null;

    return {
      containerWidth: Math.round(container.clientWidth),
      tableWidth: Math.round(table.getBoundingClientRect().width),
      lastCellRight: Math.round(lastCell.getBoundingClientRect().right),
      containerRight: Math.round(container.getBoundingClientRect().right),
      pageOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const width of WIDTHS) {
  test(`/sources never scrolls the page sideways at ${width} (R127)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sources');
    await page.evaluate(() => document.fonts.ready);

    const m = await measure(page);

    expect(m, '/sources has no table to measure').not.toBeNull();
    expect(
      m?.pageOverflow,
      `the page scrolled sideways by ${String(m?.pageOverflow)} px`,
    ).toBe(0);
  });
}

for (const width of [1440, 1280] as const) {
  test(`/sources shows the whole status column at ${width} (R164)`, async ({ page }) => {
    // THE HALF PARK-11 WAS ABOUT. A reader on a desktop must not have to
    // scroll a container to learn whether a rule is verified - that column is
    // the page's answer to the question every guide's chip sends them here to
    // ask.
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sources');
    await page.evaluate(() => document.fonts.ready);

    const m = await measure(page);

    expect(m, '/sources has no table to measure').not.toBeNull();
    expect(
      m?.lastCellRight ?? 0,
      `the status column ends ${String((m?.lastCellRight ?? 0) - (m?.containerRight ?? 0))} px ` +
        'outside its container, so a reader must scroll the table to read it',
    ).toBeLessThanOrEqual(m?.containerRight ?? 0);

    // AND THE TABLE FITS, which is the same fact from the other side and
    // fails differently: a container wide enough but a table wider still.
    expect(m?.tableWidth ?? 0).toBeLessThanOrEqual(m?.containerWidth ?? 0);
  });
}

test('the prose keeps the reading measure, which is the point of moving only the table', async ({
  page,
}) => {
  // R164 WIDENS THE TABLE, NOT THE PAGE. If the whole page had been moved to
  // 1200 the status column would also be visible - and every paragraph on the
  // page would be 1200 px wide, which is the measure FD13's 680 exists to
  // prevent. This assertion is what stops the cheap version of the fix.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sources');
  await page.evaluate(() => document.fonts.ready);

  const prose = await page
    .locator('main p')
    .first()
    .evaluate((node) => Math.round(node.getBoundingClientRect().width));

  expect(prose, 'the prose is no longer at the article measure').toBeLessThanOrEqual(680);
});

test('the page has ONE left edge, head and table alike (R148)', async ({ page }) => {
  // THE DEFECT THIS WAS WRITTEN FOR IS MINE, and it arrived with R164. The
  // first version of that change put the page head in Container 'article' and
  // the table section in Container 'public'. Both centre their own max-width,
  // so they produce DIFFERENT LEFT EDGES: the h1 began 260 px to the right of
  // the section heading beneath it.
  //
  // Every other assertion passed. The status column was visible, the page did
  // not scroll, the prose kept its measure - and the page had two margins.
  // R135's crop found it, which is how FW17 found the article head sitting
  // 100 px right of its own prose, and it is the reason R148 asserts geometry
  // rather than trusting that correct parts compose into a correct page.
  await page.setViewportSize({ width: 1440, height: 900 });
  await goToServedPage(page, '/sources');
  await page.evaluate(() => document.fonts.ready);

  const left = async (selector: string): Promise<number> =>
    page.locator(selector).first().evaluate((node) => Math.round(node.getBoundingClientRect().left));

  const title = await left('main h1');
  const heading = await left('main h2');
  const table = await left('main table');

  expect(heading, 'the section heading does not start where the title does').toBe(title);
  expect(table, 'the table does not start where the prose does').toBe(title);
});

test('the page discloses what this site does not know (R154)', async ({ page }) => {
  // THE SECTION EXISTS BECAUSE THREE REFUSALS WERE INVISIBLE. PARK-1, PARK-3
  // and PARK-4 each recorded a decision not to publish something for want of
  // a source, and each lived only in the repository - so a reader looking for
  // one of those figures met an absence, with no way to tell a deliberate
  // refusal from an oversight.
  //
  // ASSERTED BY VALUE, from the copy module, because the failure this guards
  // is a section that renders its container and none of its entries. A count
  // alone would pass on three empty rows.
  await goToServedPage(page, '/sources');

  const text = await page.locator('main').evaluate((node) => node.textContent ?? '');

  expect(text, 'the section heading').toContain(SOURCES_COPY.unknownsHeading);
  expect(text, 'the section intro').toContain(SOURCES_COPY.unknownsIntro);

  for (const id of UNKNOWN_IDS) {
    expect(text, `${id}: the heading`).toContain(SOURCES_COPY.unknowns[id].heading);
    expect(text, `${id}: the body`).toContain(SOURCES_COPY.unknowns[id].body);
  }

  // NON-VACUOUS, AND THE FIRST VERSION WAS NOT. It checked the BODY lengths
  // and not the headings, so toContain(SOURCES_COPY.unknowns[id].heading)
  // degenerated to toContain('') the moment a heading emptied - which is
  // what planting an emptied heading proved: the test passed. R154 again,
  // inside the test written to satisfy R154. Both fields are checked now.
  expect(UNKNOWN_IDS.length).toBe(3);
  for (const id of UNKNOWN_IDS) {
    expect(SOURCES_COPY.unknowns[id].heading.length, `${id}: heading`).toBeGreaterThan(20);
    expect(SOURCES_COPY.unknowns[id].body.length, `${id}: body`).toBeGreaterThan(80);
  }

  // AND IT PROMISES NOTHING. SPEC 20's vocabulary rule is strictest on the
  // page whose subject is what the product does not know: an entry saying
  // when a figure will arrive would be the one claim this section cannot
  // make.
  for (const id of UNKNOWN_IDS) {
    const body = SOURCES_COPY.unknowns[id].body.toLowerCase();

    // NO ELISION FORMS IN THIS LIST. R126 refuses a French elision apostrophe
    // outside lib/fr, and it caught the first version of this line, which
    // carried "en cours d'ajout". A guard's vocabulary is not product copy and
    // does not belong in the copy module either - so the list uses forms that
    // say the same thing without an apostrophe.
    for (const promise of ['bientôt', 'prochainement', 'à venir', 'sous peu']) {
      expect(body, `${id} promises "${promise}"`).not.toContain(promise);
    }
  }
});

test('/a-propos says nobody has validated the rules (R160 at page length)', async ({ page }) => {
  // THE PAGE'S ONE JOB, and todo.md's TODO-REVIEWER placeholder is what it
  // replaces. A placeholder is not a sentence a reader can read.
  //
  // ASSERTED BY VALUE from the copy module, because the failure that matters
  // is a page that renders its headings and drops the paragraph carrying the
  // admission - which would leave a section titled "Personne n'a valide ces
  // regles" above nothing, reading as an oversight rather than a statement.
  await goToServedPage(page, '/a-propos');

  const text = await page.locator('main').evaluate((node) => node.textContent ?? '');

  expect(text, 'the admission heading').toContain(A_PROPOS_COPY.reviewHeading);
  expect(text, 'the admission itself').toContain(A_PROPOS_COPY.reviewBody);
  expect(text, 'what it means in practice').toContain(A_PROPOS_COPY.reviewConsequence);

  // THE METHOD, all three steps and the refusal that is their point.
  expect(text, 'the method intro').toContain(A_PROPOS_COPY.methodIntro);
  for (const step of A_PROPOS_COPY.method) {
    expect(text, `step: ${step.heading}`).toContain(step.heading);
    expect(text, `step body: ${step.heading}`).toContain(step.body);
  }
  expect(text, 'the refusal').toContain(A_PROPOS_COPY.methodRefusal);

  // NON-VACUOUS: real copy behind every assertion above, so none of them is
  // toContain('') - the hole this task already fell into once.
  expect(A_PROPOS_COPY.method.length).toBe(3);
  expect(A_PROPOS_COPY.reviewHeading.length).toBeGreaterThan(20);
  expect(A_PROPOS_COPY.reviewBody.length).toBeGreaterThan(120);
  for (const step of A_PROPOS_COPY.method) {
    expect(step.heading.length, step.heading).toBeGreaterThan(10);
    expect(step.body.length, step.heading).toBeGreaterThan(80);
  }

  // AND IT IS NOT A STORY. SPEC 9.1 gives this page one subject; a founder
  // narrative is the thing a page like this grows into if nobody says not to.
  const forbidden = ['fondateur', 'notre mission', 'notre histoire', 'passionn'];

  for (const word of forbidden) {
    expect(text.toLowerCase(), `the page reads like a story: "${word}"`).not.toContain(word);
  }
});

test('/tarifs states SPEC D3 and sells nothing (R154)', async ({ page }) => {
  // BOTH HALVES, because D3's acceptance criterion is an ABSENCE - "no tier
  // grid, no checkout" - and an absence assertion is satisfied by a page that
  // renders nothing at all. So the sentence is asserted present first, and
  // only then is the grid asserted absent.
  await goToServedPage(page, '/tarifs');

  const text = await page.locator('main').evaluate((node) => node.textContent ?? '');

  expect(text, "SPEC D3's position sentence").toContain(TARIFS_COPY.position);
  expect(text, 'what free actually means this year').toContain(TARIFS_COPY.positionDetail(PRODUCT_STATE));
  expect(text, 'why it is free').toContain(TARIFS_COPY.whyBody);
  expect(text, 'what happens in 2028').toContain(TARIFS_COPY.laterBody);
  expect(TARIFS_COPY.position.length, 'the position sentence is empty').toBeGreaterThan(40);

  // NO TIER GRID. D3 named the A/B price experiment it replaced and said it
  // "does not belong in the build"; a two-column table with a highlighted
  // middle is that experiment arriving through the back door.
  await expect(page.locator('main table'), 'a pricing table').toHaveCount(0);

  // NO CHECKOUT. No form, no button that takes money, no third party.
  await expect(page.locator('main form'), 'a payment form').toHaveCount(0);
  await expect(page.locator('main button'), 'a purchase control').toHaveCount(0);

  const hrefs = await page
    .locator('main a')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));

  for (const href of hrefs) {
    expect(href.startsWith('/'), `/tarifs links offsite: ${href}`).toBe(true);
  }
});

test('/releve-annuel is written in the tense the code is in (R166, R138)', async ({ page }) => {
  // THE CONSTRAINT R166 PUT ON THIS PAGE. The dossier does not exist, so
  // every sentence about it is future or conditional and none is present.
  // "Le releve contient" would be the clearest possible violation of the rule
  // this product is built on, on the page describing the artifact that rule
  // exists to protect.
  await goToServedPage(page, '/releve-annuel');

  const text = await page.locator('main').evaluate((node) => node.textContent ?? '');

  // PRESENCE FIRST, so the absences below are not satisfied by an empty page.
  expect(text, 'the page says it does not exist yet').toContain(RELEVE_COPY.lead(PRODUCT_STATE));
  expect(text, 'what it will be for').toContain(RELEVE_COPY.purposeBody);
  expect(text, 'where the document stands').toContain(RELEVE_COPY.stateBody(PRODUCT_STATE));
  expect(RELEVE_COPY.contents.length, 'SPEC 12 has six sections').toBe(6);
  for (const item of RELEVE_COPY.contents) {
    expect(text, `a section of the document: ${item.slice(0, 30)}`).toContain(item);
  }

  // NO PRESENT-TENSE ASSERTION ABOUT THE DOCUMENT. These are the forms that
  // would claim it exists; the page uses "contiendra", "servira", "dira".
  for (const claim of [
    'le relevé contient',
    'le relevé comprend',
    'le document contient',
    'vous obtenez',
    'téléchargez',
  ]) {
    expect(text.toLowerCase(), `present-tense claim: "${claim}"`).not.toContain(claim);
  }

  // SPEC 12's OWN VOCABULARY RULE, THROUGH THE PRODUCT'S OWN GUARD.
  //
  // The first version of this check hand-rolled a list - 'sont certifiées',
  // 'sont attestées' - and failed on this page's own sentence saying it will
  // NEVER claim those things. A substring cannot tell a disclaimer from an
  // assertion, which is precisely the mistake tests/support/vocabulary.ts
  // records having made once already: banning 'certifi' outright forbade the
  // calculator from naming the A1 CERTIFICATE that SPEC 7.1 requires it to
  // explain.
  //
  // So the check is the shared guard, which matches claim FORMS. R171: a test
  // names a role - the vocabulary rule - never a word list that happens to
  // approximate it today.
  expect(
    complianceClaims(text),
    'the page makes a compliance claim SPEC 20 forbids',
  ).toEqual([]);

  // NON-VACUOUS: the guard catches something, so an empty result above means
  // the page is clean rather than the guard being broken.
  expect(complianceClaims('Vos journées sont certifiées conformes.').length).toBeGreaterThan(0);

  // NO WAITING LIST, NO PRICE. A form collecting addresses against a promise
  // is a promise; the price is /tarifs' subject and belongs to one page.
  await expect(page.locator('main form'), 'a waiting list').toHaveCount(0);
  expect(text, 'a price on the wrong page').not.toContain('CHF');
});

test('/sources counts itself correctly (R171)', async ({ page }) => {
  // FOUND BY RUNNING THE APP, not by any suite. The lead read "huit
  // constantes et trois lectures" as a constant. FW18b took SOURCE_IDS from
  // eight to fourteen and nobody changed the sentence, so the page whose
  // entire subject is accuracy opened by miscounting itself by six. The table
  // beneath it was right the whole time.
  //
  // THE SENTENCE IS DERIVED NOW, so this asserts the two agree rather than
  // asserting a number - a test naming a literal here would be the same
  // defect one layer up (R171).
  await goToServedPage(page, '/sources');

  const lead = await page.locator('main p').first().evaluate((n) => n.textContent ?? '');
  const rows = await page.locator('main table tbody tr').count();

  expect(lead, 'the lead does not state the row count').toContain(String(rows));
  expect(rows, 'the table rendered no rows').toBeGreaterThanOrEqual(14);

  // AND THE READINGS, the other half of the same sentence.
  const readings = await page.locator('main dl div[id^="lecture-"]').count();

  expect(lead, 'the lead does not state the reading count').toContain(String(readings));
  expect(readings).toBe(3);
});
