// web/e2e/application.spec.ts
//
// /application, and the two assertions this page exists to survive.
//
// ---------------------------------------------------------------------------
// ONE. THE TWO MODE CARDS TAKE NO SIDE.
//
// FD12's rule is that manual and automatic are MECHANICALLY IDENTICAL, and
// its warning is precise: the moment the line about background location
// renders as a caveat, manual becomes the safe choice and automatic the risky
// one, and the page has chosen for a reader whose choice it is. That is the
// highlighted middle column of a pricing table, dressed as candour.
//
// A COMMENT SAYING "KEEP THESE THE SAME" IS NOT A GUARD - R173's lesson, one
// component over. So the equality is measured in the browser: same rendered
// width and height, same number of lines, the same glyph on every one of
// them, and no warning token anywhere in either card.
//
// WHY GEOMETRY AND NOT JUST MARKUP. R148 exists because the article head sat
// 100 px left of its prose while every element was present and individually
// correct. Two cards from one class can still render unequal - a longer body,
// a wrapped line, a grid that sizes rows to content - and "looks balanced" is
// a judgement somebody makes once. The numbers are the assertion.
//
// ---------------------------------------------------------------------------
// TWO. EVERY SENTENCE ABOUT THE APP IS IN THE FUTURE.
//
// PRODUCT_STATE.appExists is false: there is no android/ directory in this
// repository. A present-tense sentence here is the defect R172 was issued
// about, on the page where it would be most persuasive and least checkable.
//
// THE SCAN IS OVER THE SERVED PROSE, not over the copy module, because the
// copy module is where somebody would fix it and the page is where a reader
// meets it - and because R154's whole subject is a mechanism that produced
// nothing while every guard passed.

import { expect, test } from '@playwright/test';
import { APPLICATION_COPY } from '@/lib/fr/application';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import {
  FUTURE_FORMS_THAT_MUST_PASS,
  PRESENT_FORMS_THAT_MUST_FIRE,
  PRESENT_TENSE_CLAIMS,
  presentTenseClaimsIn,
} from '@/tests/support/present-tense';

const APPLICATION = '/application';

interface Box {
  readonly width: number;
  readonly height: number;
  readonly left: number;
}

test.describe('the two mode cards take no side (FD12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(APPLICATION);
    await page.evaluate(() => document.fonts.ready);
  });

  test('renders exactly the two modes the copy declares', async ({ page }) => {
    // R119's census shape: the count comes from the source of truth, so a
    // third mode added to the copy fails here rather than appearing silently.
    const cards = page.locator('[data-mode]');

    await expect(cards).toHaveCount(APPLICATION_COPY.modes.length);
    await expect(cards).toHaveCount(2);
  });

  test('gives both cards the same geometry (R148)', async ({ page }) => {
    const boxes = await page.locator('[data-mode]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();

        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
        };
      }),
    );

    expect(boxes, 'two cards').toHaveLength(2);

    const [manual, automatic] = boxes as [Box, Box];

    expect(automatic.width, 'the cards must be the same width').toBe(manual.width);
    expect(automatic.height, 'the cards must be the same height').toBe(manual.height);
    // AND NEITHER IS INDENTED OR INSET relative to the other, which is the
    // cheapest way a "featured" card gets made.
    expect(manual.left, 'the manual card sits at the left of the pair').toBeLessThan(
      automatic.left,
    );
  });

  test('gives every line of both cards the same glyph', async ({ page }) => {
    const perCard = await page.locator('[data-mode]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const lines = [...node.querySelectorAll('li')];
        const glyphs = [...node.querySelectorAll('li svg')];

        return {
          lines: lines.length,
          glyphs: glyphs.length,
          paths: glyphs.map((svg) => svg.querySelector('path')?.getAttribute('d') ?? ''),
          colours: glyphs.map((svg) => getComputedStyle(svg).color),
        };
      }),
    );

    const [manual, automatic] = perCard;

    expect(manual?.lines, 'the manual card lists three facts').toBe(3);
    expect(automatic?.lines, 'the automatic card lists three facts').toBe(3);

    // A GLYPH ON EVERY LINE, both cards. The failure this catches is not a
    // missing icon - it is an icon that was swapped for a different one on
    // the line somebody felt uneasy about.
    expect(manual?.glyphs).toBe(manual?.lines);
    expect(automatic?.glyphs).toBe(automatic?.lines);

    const paths = [...(manual?.paths ?? []), ...(automatic?.paths ?? [])];
    const colours = [...(manual?.colours ?? []), ...(automatic?.colours ?? [])];

    expect(new Set(paths).size, `six lines, one glyph - found ${String(new Set(paths).size)}`).toBe(
      1,
    );
    expect(
      new Set(colours).size,
      `six lines, one colour - found ${[...new Set(colours)].join(', ')}`,
    ).toBe(1);
  });

  test('renders no warning treatment inside either card', async ({ page }) => {
    // THE LINE THIS IS ABOUT is the automatic card's third: it names the
    // background-location requirement. A requirement is not a drawback, and
    // the page must not say otherwise in any of the ways a page can.
    const suspicious = await page.locator('[data-mode]').evaluateAll((nodes) =>
      nodes.flatMap((node) =>
        [...node.querySelectorAll('*')]
          .filter((element) => {
            const className = element.getAttribute('class') ?? '';
            const attributes = element.getAttributeNames().join(' ');

            return /warn|caution|danger|alert|risk|recommend/i.test(`${className} ${attributes}`);
          })
          .map((element) => element.tagName + ':' + (element.getAttribute('class') ?? '')),
      ),
    );

    expect(suspicious, 'a warning or recommendation treatment inside a mode card').toEqual([]);

    // AND NO COPY THAT RANKS THEM. "recommande" is the word FD12 names.
    const text = await page.locator('[data-modes]').innerText();

    expect(text.toLowerCase(), 'the page must not recommend a mode').not.toContain('recommand');
    expect(text.toLowerCase(), 'the page must not rank the modes').not.toContain('conseill');
  });
});

test.describe('the app does not exist, and the page says so throughout', () => {
  test('makes no present-tense claim about the application', async ({ page }) => {
    // THE PRECONDITION, stated rather than assumed: this whole assertion is
    // about the state the product is actually in. If the app ships and the
    // flag flips, this test is wrong to keep running, so it says so.
    expect(
      PRODUCT_STATE.appExists,
      'the app now exists - this assertion describes the other state',
    ).toBe(false);

    await page.goto(APPLICATION);

    const body = await page.locator('main').innerText();

    // R169's presence corollary: establish the page is real BEFORE asserting
    // an absence in it. An absence assertion is satisfied by a 404.
    expect(body.length, 'the page served no prose at all').toBeGreaterThan(600);
    expect(body, 'the page must open by saying the app is not built').toContain(
      APPLICATION_COPY.lead(PRODUCT_STATE),
    );

    // THE VOCABULARY LIVES IN tests/support/present-tense.ts, not here.
    // R126 flagged it when it was a literal in this file and was right to:
    // a list of French sentences in a spec is indistinguishable from
    // duplicated page copy. It is the same case tests/support/vocabulary.ts
    // already holds - synthetic input for a guard, allowlisted with that
    // reason - and the alternative of escaping the apostrophes would have
    // hidden the duplication rather than removed it.
    const found = presentTenseClaimsIn(body);

    expect(found, 'present-tense claims about an application that does not exist').toEqual([]);
  });

  test('and the detector fires, and does not over-fire', async () => {
    // NON-VACUITY, BOTH DIRECTIONS, and the first version of this spec had
    // neither - which is how the two mode cards shipped in the present tense
    // with the scan green. The vocabulary had been written from what I
    // imagined a shipped-app page saying rather than from what this page
    // said, so it matched nothing on the copy it was guarding.
    //
    // A detector proved only against sentences nobody wrote is a detector
    // proved against nothing.
    for (const sentence of PRESENT_TENSE_CLAIMS.map((claim) => claim.what)) {
      expect(sentence.length, 'every pattern is named for its failure message').toBeGreaterThan(5);
    }

    // IT FIRES on the exact forms this page carried before the read-through.
    // The sentences live in the support module beside the patterns they
    // exercise, not here: R126 caught them in this file on the final gate,
    // and it was right - a list of French sentences in a spec is
    // indistinguishable from duplicated page copy.
    for (const sentence of PRESENT_FORMS_THAT_MUST_FIRE) {
      expect(
        presentTenseClaimsIn(sentence).length,
        `not caught, and it was on the page: ${sentence}`,
      ).toBeGreaterThan(0);
    }

    // AND IT DOES NOT FIRE on the future forms the page uses now. A detector
    // that flagged the refusals band would be switched off within a task.
    for (const sentence of FUTURE_FORMS_THAT_MUST_PASS) {
      expect(
        presentTenseClaimsIn(sentence),
        `false positive on correct future-tense copy: ${sentence}`,
      ).toEqual([]);
    }
  });

  test('links no store and ships no screenshot', async ({ page }) => {
    await page.goto(APPLICATION);

    const links = await page.locator('main a').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    );

    const stores = links.filter((href) =>
      /play\.google|apps\.apple|itunes\.apple|appstore/i.test(href),
    );

    expect(stores, 'a download link for an application that does not exist').toEqual([]);

    // NO SCREENSHOT EITHER. FD12 specifies two, and neither can be a
    // photograph of something unbuilt - it would be an illustration of a
    // product presented as a picture of one.
    const images = await page.locator('main img').count();

    expect(images, 'a screenshot of an application that does not exist').toBe(0);
  });
});
