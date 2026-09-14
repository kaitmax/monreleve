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

  test('caps the prose at the 680 px measure and aligns the head to it', async ({
    page,
  }) => {
    // FD13: ~70 characters per line, and "the article head aligned with the
    // prose column".
    //
    // BOTH HALVES ARE ASSERTED BECAUSE A BASELINE CAUGHT THE SECOND ONE
    // FAILING. The head sat at the column's left edge and the prose 100 px
    // to its right, because Container centres its measure and pads it -
    // correct for a page-level column, wrong inside a grid track, where it
    // also cut the measure to 616 px. Nothing in the suite noticed: every
    // element was present, styled and individually correct. A person cropped
    // the picture and read it (R135).
    //
    // The grid track is now the measure, so one number decides both.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.fonts.ready);

    const box = async (selector: string): Promise<{ left: number; width: number }> =>
      page.locator(selector).first().evaluate((node) => {
        const rect = node.getBoundingClientRect();

        return { left: Math.round(rect.left), width: Math.round(rect.width) };
      });

    const head = await box('h1');
    const prose = await box('[data-article-body] p');
    const toc = await box('[data-toc]');

    expect(prose.width).toBe(680);
    expect(head.width).toBe(680);
    expect(head.left, 'the head must start where the prose starts').toBe(prose.left);

    // And the outline column is FD13's 280, from --size-toc-column.
    expect(toc.width).toBe(280);
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

  test('lists every section, and every anchor lands on a heading', async ({ page }) => {
    // THE FAILURE THIS CATCHES is a table of contents that looks complete
    // and whose links do nothing - six entries pointing at ids the document
    // does not carry. It cannot happen while both come from one read, and
    // this is what proves they still do.
    const hrefs = await page.locator('[data-toc] a').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    );

    expect(hrefs.length).toBeGreaterThanOrEqual(4);

    for (const href of hrefs) {
      expect(href.startsWith('#'), href).toBe(true);

      const target = page.locator(`[data-article-body] ${href}`);

      await expect(target, `${href} lands on nothing`).toHaveCount(1);
    }
  });

  test('the outline is in the same order as the document', async ({ page }) => {
    // An outline listing the right sections in the wrong order is worse
    // than none: it tells a reader the article is structured differently
    // from the way it reads.
    const outline = await page.locator('[data-toc] a').evaluateAll((nodes) =>
      nodes.map((node) => (node.getAttribute('href') ?? '').slice(1)),
    );
    const document_ = await page
      .locator('[data-article-body] h2, [data-article-body] h3')
      .evaluateAll((nodes) => nodes.map((node) => node.id));

    expect(outline).toEqual(document_);
  });

  test('the outline needs no JavaScript either', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(FIXTURE);

    // R136: the outline is links and CSS. No active-item highlight ships -
    // see TableOfContents.module.scss for why - so there is nothing here
    // that a script would have had to turn on.
    await expect(page.locator('[data-toc] a').first()).toBeVisible();

    await context.close();
  });

  test('links the calculator twice, inline THEN the end card (SPEC 9.5)', async ({
    page,
  }) => {
    // R119: COUNTED BY POSITION, NOT JUST PRESENCE. Two links to the
    // calculator somewhere on the page is not the rule - SPEC 9.5 says
    // "inline at the moment the reader realises they cannot do the math,
    // and the end Tile". A page with both links inside the closing card
    // would satisfy a count and fail the reader who needed the tool eight
    // paragraphs earlier.
    const positions = await page.evaluate(() => {
      const links = [...document.querySelectorAll('[data-prose] a')];
      const cta = document.querySelector('[data-guide-cta]');

      return links
        .filter((link) => link.getAttribute('href') === '/calculateur-teletravail-frontalier')
        .map((link) => (cta?.contains(link) === true ? 'end card' : 'inline'));
    });

    expect(positions).toEqual(['inline', 'end card']);
  });

  test('ends with the one CTA card every guide ends with', async ({ page }) => {
    // FD13: "this exact card ends every guide on the site - one CTA, no
    // variants". One on the page, and the component takes no props that
    // could make a second one different.
    await expect(page.locator('[data-guide-cta]')).toHaveCount(1);
  });

  test('carries the /sources link in its footer (SPEC 9.5)', async ({ page }) => {
    // Every rule cited in a guide has to reach its source. The link is the
    // TEMPLATE's rather than each author's, so no guide can ship without
    // it - which is also why the mesh checker can treat it as a property
    // of the body and still be honest: an author who omits it is caught,
    // and the template guarantees the rendered page has one.
    const footer = page.locator('[data-guide-footer]');

    await expect(footer).toHaveCount(1);
    await expect(footer.locator('a[href="/sources"]')).toHaveCount(1);
  });

  test('publishes exactly the FAQ the accordion renders (SPEC 14)', async ({ page }) => {
    // FW15 established the rule and this applies it to content: a claim in
    // structured data that a reader cannot see is cloaking. Both come from
    // the frontmatter, and this reads them back from the SERVED page - the
    // only place a disagreement could actually appear.
    const published = await page.evaluate(() => {
      interface Question {
        readonly name: string;
        readonly acceptedAnswer: { readonly text: string };
      }

      const script = document.querySelector('script[type="application/ld+json"]');
      const parsed = JSON.parse(script?.textContent ?? '{}') as {
        readonly mainEntity?: readonly Question[];
      };

      return (parsed.mainEntity ?? []).map((question) => ({
        name: question.name,
        text: question.acceptedAnswer.text,
      }));
    });

    const questions = await page.locator('[data-faq] summary').allTextContents();
    const answers = await page.locator('[data-faq] details > p').allTextContents();

    expect(questions.length).toBeGreaterThan(0);
    expect(published.map((entry) => entry.name)).toEqual(questions);
    expect(published.map((entry) => entry.text)).toEqual(answers);
  });

  test('keeps every FAQ answer in the DOM while closed', async ({ page }) => {
    // The property the structured data rests on. A collapsed accordion
    // that did not render its answers would publish claims nobody can see.
    await expect(page.locator('[data-faq] details[open]')).toHaveCount(0);

    const answers = await page.locator('[data-faq] details > p').allTextContents();

    expect(answers.length).toBeGreaterThan(0);
    for (const answer of answers) expect(answer.length).toBeGreaterThan(40);
  });

  test('is noindex, because the fixture is not content', async ({ page }) => {
    // It is a real route so that tests and baselines can render it, and it
    // must never be indexed. Excluded from the sitemap by publishedGuides();
    // told directly here.
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');

    expect(robots).toContain('noindex');
  });
});
