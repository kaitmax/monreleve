// web/e2e/guides.spec.ts
//
// The article template, as it is served.
//
// WHY THIS EXISTS BESIDE THE UNIT TEST. tests/unit/pages/guide-section-order
// .test.tsx renders a COPY of the head markup, because the route is an async
// server component that compiles MDX and jsdom cannot run it. A copy can
// drift from the route it copies. This reads the real HTML, so the two
// together assert the order AND that the order asserted is the one shipped.
//
// AND IT IS WHERE THE MDX MAP IS PROVEN AT ALL. Nothing in a unit test shows
// that a heading in an article became an <h2> with the product's type, that a
// markdown link became a validated <a>, or that the prose is capped at the
// 680 px measure. Those are properties of compiled output.

import { expect, test } from '@playwright/test';

/** The fixture article: the one guide that exists in FW16. */
const FIXTURE = '/guides/fixture-modele-article';

test.describe('the article template', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
  });

  test('renders the head in FD13s order, from the served HTML', async ({ page }) => {
    // THE SAME SEQUENCE THE UNIT TEST ASSERTS, read from the real document -
    // which is what makes the copy in that test safe to keep.
    const order = await page.evaluate(() => {
      const selectors = ['[data-breadcrumb]', 'h1', '[data-chips]', 'hr', '[data-prose]'];

      return [...document.querySelectorAll(selectors.join(', '))].map((element) => {
        const match = selectors.find((selector) => element.matches(selector));

        return match ?? 'unknown';
      });
    });

    expect(order).toEqual([
      '[data-breadcrumb]',
      'h1',
      '[data-chips]',
      'hr',
      '[data-prose]',
    ]);
  });

  test('carries exactly one h1, and it is the article title', async ({ page }) => {
    const headings = page.locator('h1');

    await expect(headings).toHaveCount(1);
    await expect(headings).toContainText('Article de demonstration');
  });

  test('compiles MDX headings into the product type scale', async ({ page }) => {
    // The map is what stops seven articles looking like seven sites. If it
    // were not applied, these would be browser-default headings.
    const h2 = page.locator('[data-prose] h2').first();

    await expect(h2).toBeVisible();

    const size = await h2.evaluate((node) => getComputedStyle(node).fontSize);

    expect(size).toBe('24px');
  });

  test('caps the prose at the 680 px measure (FD13, R64)', async ({ page }) => {
    // ~70 characters per line. The column is wider; the PROSE is not, and the
    // cap comes from Container 'article' rather than from a width invented
    // in the guide stylesheet.
    const width = await page
      .locator('[data-prose] p')
      .first()
      .evaluate((node) => node.getBoundingClientRect().width);

    expect(width).toBeLessThanOrEqual(680);
  });

  test('serves the whole article with JavaScript disabled', async ({ browser }) => {
    // R136: content ships zero client JavaScript, so content must not NEED
    // any. A crawler that runs no script and a reader on a bad connection see
    // the same article.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(FIXTURE);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-prose] h2').first()).toBeVisible();
    await expect(page.locator('[data-prose] a').first()).toBeVisible();

    await context.close();
  });

  test('is noindex, because the fixture is not content', async ({ page }) => {
    // It is a real route so that tests and baselines can render it, and it
    // must never be indexed. Excluded from the sitemap by publishedGuides();
    // told directly here.
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');

    expect(robots).toContain('noindex');
  });
});
