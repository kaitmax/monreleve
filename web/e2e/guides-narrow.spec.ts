// web/e2e/guides-narrow.spec.ts
//
// RULING R127: THE 320 dp CHECK, on both guides routes.
//
// WHY 320 AND NOT 390. FW12 shipped a calculator that scrolled sideways at
// every phone width - 101 px of overflow at 320, 61 at 360, 31 at 390 - and
// eight baselines taken at 390 did not show it, because a fullPage capture
// WIDENS to include the overflow rather than revealing it. 320 is the
// narrowest width the product supports and the first place a fixed dimension
// shows.
//
// THE GUIDES ARE WHERE THIS IS MOST LIKELY TO RECUR. The article layout has a
// 280 px table-of-contents column, a 680 px prose cap and a grid that switches
// at 64rem - three fixed numbers, any of which could reach a phone if a media
// query were written the wrong way round. The outline card and the closing
// card are the elements that would push it.
//
// ASSERTED AS A PROPERTY OF THE DOCUMENT, not of a screenshot: scrollWidth
// against clientWidth is what "scrolls sideways" actually means, and it
// cannot be hidden by a capture that widens.

import { expect, test } from '@playwright/test';
import { goToServedPage } from './support/served';
import { GUIDES_PATH, publishedGuides } from '../lib/guides/registry';

const NARROW = { width: 320, height: 720 };

const FIXED = [
  ['the hub', '/guides'],
  ['the article', '/guides/fixture-modele-article'],
] as const;

/**
 * EVERY PUBLISHED ARTICLE, DERIVED, and FW18b derived it after finding the
 * hole a hand-kept list had already grown.
 *
 * THE REAL ARTICLES ARE WHY THIS CHECK EXISTS AT ALL. Both of FW17's
 * comparison tables failed here the first time they were written: FD13 draws
 * the pillar's as three columns of French sentences, which comes to 334 px
 * inside a 320 dp viewport, and the social cluster's missed by two pixels -
 * the same defect and easier to wave away. The fixture could never have
 * caught either; it has no table, no summary block and no banner. That is the
 * R140 shape - the guard was on the template, and the CONTENT is what carries
 * the fixed widths.
 *
 * FW17 listed its three articles here by hand and the list was right. FW18
 * then added four more and put none of them in it - so at FW18b the census
 * covered three of seven, and the two it missed included GENEVE, which
 * carries the product's only six-row DataGrid and is therefore the article
 * most likely to overflow. The article most likely to fail this check was
 * one of the articles not running it.
 *
 * DERIVING IS THE RIGHT CHOICE HERE AND THE WRONG ONE IN
 * tests/unit/content/routes.test.ts, which hardcodes its list on purpose and
 * says so. The difference is what each is asserting. That test asks "is the
 * registry's content what we intend", and deriving would make it agree with
 * whatever the registry says. This one asks "does every article survive 320
 * dp", and the set of articles is not the claim - it is the input. A list
 * that can fall behind the content directory is a check that silently stops
 * covering what it is for.
 */
const ARTICLES = publishedGuides().map(
  (guide) => [guide.frontmatter.slug, `${GUIDES_PATH}/${guide.frontmatter.slug}`] as const,
);

const ROUTES = [...FIXED, ...ARTICLES] as const;

test.use({ viewport: NARROW });

test('the derived list found the articles, so the loop below is not empty', () => {
  // THE COST OF DERIVING, PAID HERE. A hand-kept list goes stale loudly - the
  // entries are visible and wrong. A derived one goes stale SILENTLY: if
  // publishedGuides() returned nothing, the loop would generate zero tests
  // and this file would pass in a fraction of a second having checked
  // nothing. That is the failure mode R154 names, arriving through the fix
  // for a different one.
  expect(ARTICLES.length, 'publishedGuides() returned nothing').toBeGreaterThanOrEqual(7);
  expect(ARTICLES.map(([, route]) => route)).toContain('/guides/geneve');
});

for (const [what, route] of ROUTES) {
  test(`${what} does not scroll sideways at 320 dp (R127)`, async ({ page }) => {
    await goToServedPage(page, route);
    await page.evaluate(() => document.fonts.ready);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      overflow.scrollWidth,
      `${route} is ${String(overflow.scrollWidth - overflow.clientWidth)} px wider than the ` +
        'viewport at 320 dp. Something carries a fixed width that does not ' +
        'collapse - the outline column and the closing card are the candidates.',
    ).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test(`${what} keeps every element inside the viewport at 320 dp`, async ({ page }) => {
    // The document can fit while a single element pokes out - an image, a
    // long unbroken URL, a card with a min-width. scrollWidth would not
    // always show it; measuring the widest element does.
    await goToServedPage(page, route);
    await page.evaluate(() => document.fonts.ready);

    const widest = await page.evaluate(() => {
      let worst = { tag: '', width: 0 };

      for (const element of document.querySelectorAll('main *')) {
        const width = element.getBoundingClientRect().width;

        if (width > worst.width) worst = { tag: element.tagName.toLowerCase(), width };
      }

      return worst;
    });

    expect(widest.width, `the widest element is a <${widest.tag}>`).toBeLessThanOrEqual(320);
  });
}

test('the outline comes before the prose on a phone', async ({ page }) => {
  // FD13 puts the outline in a left column on desktop. On one column the
  // question is which comes FIRST, and the answer is the outline: a reader
  // on a phone meets a long reference document and needs to know what is in
  // it before deciding to scroll. It is also the document order, so this is
  // asserting that no CSS reordering has been introduced.
  await goToServedPage(page, '/guides/fixture-modele-article');

  const order = await page.evaluate(() => {
    const toc = document.querySelector('[data-toc]');
    const prose = document.querySelector('[data-article-body]');

    if (toc === null || prose === null) return 'missing';

    return toc.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING
      ? 'outline first'
      : 'prose first';
  });

  expect(order).toBe('outline first');
});

test('a table too wide for the phone scrolls itself, not the page (R159)', async ({ page }) => {
  // THE POSITIVE HALF, and R154 is why it exists. Every assertion above is
  // "the document does not scroll sideways", which a page with no table
  // satisfies perfectly - and would go on satisfying if the scroll container
  // were deleted tomorrow, right up until an article grew a wide table.
  //
  // So this drives a KNOWN input through the mechanism: a cell is made wider
  // than the viewport, and the two things R159 decides are then measured
  // separately. The table scrolls. The page does not.
  await goToServedPage(page, '/guides/geneve');
  await page.evaluate(() => document.fonts.ready);

  const measured = await page.evaluate(() => {
    const table = document.querySelector('main table');
    const container = table?.parentElement;

    if (table === null || container === undefined || container === null) return null;

    // An unbreakable string, so the table's min-content width cannot shrink
    // to fit - which is exactly what a long word in a real cell does.
    const cell = table.querySelector('tbody td');

    if (cell === null) return null;
    cell.textContent = 'X'.repeat(200);

    return {
      containerScrolls: container.scrollWidth > container.clientWidth,
      containerWidth: container.clientWidth,
      documentScroll: document.documentElement.scrollWidth,
      documentClient: document.documentElement.clientWidth,
      focusable: container.getAttribute('tabindex'),
    };
  });

  expect(measured, '/guides/geneve has no table to widen').not.toBeNull();

  // THE TABLE SCROLLS - the container has more content than it can show, and
  // it can be reached by keyboard to scroll it.
  expect(measured?.containerScrolls, 'the container does not scroll').toBe(true);
  expect(measured?.focusable, 'a scrollable region that cannot take focus').toBe('0');

  // NEVER THE PAGE - and this is the assertion that would fail without the
  // container, because the 200-character cell would push the document.
  expect(
    measured?.documentScroll,
    `the page scrolled sideways instead: ${String((measured?.documentScroll ?? 0) - (measured?.documentClient ?? 0))} px`,
  ).toBeLessThanOrEqual(measured?.documentClient ?? 0);

  // And the container did not silently grow to fit it either.
  expect(measured?.containerWidth).toBeLessThanOrEqual(320);
});
