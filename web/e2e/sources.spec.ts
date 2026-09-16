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
