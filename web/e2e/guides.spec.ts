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
import { GUIDES_COPY } from '@/lib/fr/guides';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { GUIDES_PATH, allGuides } from '@/lib/guides/registry';
import { readingMinutes } from '@/lib/guides/reading-time';
import { formatDate } from '@/lib/ui/core';

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
    await expect(headings).toContainText('Article de démonstration');
  });

  test('carries exactly one standing disclaimer, in the footer (R119, R124)', async ({
    page,
  }) => {
    // THE CENSUS CANNOT REACH THIS ROUTE, so it is counted here. The article
    // page is an async server component that compiles MDX and jsdom runs
    // neither, so tests/unit/pages/singletons.test.tsx exempts the three
    // article routes by name and points at this file. An exemption whose
    // replacement does not exist is a hole, so the replacement exists.
    //
    // R124: counted PER REGION. One in the footer, none in main - the
    // calculator's second copy is in its result panel and a guide has none.
    // TWO <footer> ELEMENTS ON THIS PAGE, and finding that out is half the
    // value of running the assertion here rather than in jsdom: the article
    // template has its own footer - FD13's sources line and related list -
    // INSIDE <main>, and the shell's is the page footer outside it. A bare
    // locator('footer') matched both and Playwright refused it. So the shell's
    // is addressed as the one outside main, which is what "in the footer"
    // has always meant.
    //
    // FROM THE COPY CONSTANT, NOT A LITERAL (R126), and split rather than a
    // regexp because the sentence carries U+00A0 that would need escaping -
    // an escaping mistake in a counter reads as a clean bill of health.
    const counts = await page.evaluate((sentence) => {
      const occurrences = (haystack: string): number => haystack.split(sentence).length - 1;
      const main = document.querySelector('main');
      const pageFooter = [...document.querySelectorAll('footer')].find(
        (node) => main === null || !main.contains(node),
      );

      return {
        footers: document.querySelectorAll('footer').length,
        inPageFooter: occurrences(pageFooter?.textContent ?? ''),
        inMain: occurrences(main?.textContent ?? ''),
      };
    }, LEGAL_COPY.standing);

    expect(counts.footers, 'the article footer and the page footer').toBe(2);
    expect(counts.inPageFooter).toBe(1);
    expect(counts.inMain).toBe(0);
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

  test('the outline and the FAQ are both operable by keyboard alone', async ({ page }) => {
    // ON A REAL ARTICLE, not the fixture: this is about the two controls a
    // reader without a mouse actually uses, and the pillar is the longest
    // document the product has.
    //
    // R136 MAKES THIS INTERESTING RATHER THAN ROUTINE. The guides ship zero
    // client JavaScript, so the outline is anchors and the accordion is native
    // <details>. Both are keyboard-operable BY DEFAULT - which is the whole
    // argument for using them - and this is what proves the default has not
    // been overridden by a tabindex, a role, or a click handler that only
    // answers to a pointer.
    await page.goto('/guides/teletravail-frontalier-40-pourcent');

    // THE OUTLINE. Focus the first entry directly rather than tabbing from the
    // top - the number of tab stops before it is the shell's business and
    // would make this a test of the header.
    const firstEntry = page.locator('[data-toc] a').first();

    await firstEntry.focus();
    await expect(firstEntry).toBeFocused();

    const target = (await firstEntry.getAttribute('href')) ?? '';

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${target}$`));

    // The heading it names is real and on screen, which is the difference
    // between an outline that works and one that merely has links.
    await expect(page.locator(`[data-article-body] ${target}`)).toBeInViewport();

    // THE ACCORDION. Space is the key a <summary> answers to, and a closed
    // answer must open without a pointer.
    const firstQuestion = page.locator('[data-faq] summary').first();

    await firstQuestion.focus();
    await expect(firstQuestion).toBeFocused();

    const details = page.locator('[data-faq] details').first();

    expect(await details.evaluate((node: HTMLDetailsElement) => node.open)).toBe(false);

    await page.keyboard.press('Space');

    expect(await details.evaluate((node: HTMLDetailsElement) => node.open)).toBe(true);
    await expect(details.locator('p').first()).toBeVisible();
  });

  test('is noindex, because the fixture is not content', async ({ page }) => {
    // It is a real route so that tests and baselines can render it, and it
    // must never be indexed. Excluded from the sitemap by publishedGuides();
    // told directly here.
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');

    expect(robots).toContain('noindex');
  });
});

// ---------------------------------------------------------------------------
// RULING R154: A MECHANISM IS PROVEN TO DELIVER, NOT PROVEN NOT TO FAIL.
//
// THE GAP THIS CLOSES, found by auditing the five mechanisms R154 names and
// then noticing a sixth that was not on the list. The chips are a chain:
//
//   frontmatter.lastReviewed -> formatDate -> GUIDES_COPY.reviewedOn -> chip
//
// and NOTHING asserted the rendered chip carried the article's date.
// tests/unit/pages/guide-section-order.test.tsx passes the literal
// '09.09.2026' into a COPY of the head markup, and the e2e order assertion
// above checks only that [data-chips] EXISTS and sits in the right position.
//
// If the middle link emptied, the chip would read "Derniere verification : "
// - grammatical, plausible, and every suite green. SPEC 9.5 REQUIRES it:
// "every guide carries a derniere verification date". That is the blockJS
// shape exactly, on the chip the spec names.
//
// EVERY VALUE COMES FROM THE REGISTRY, never written as a literal, so the
// test cannot agree with a renderer that has stopped interpolating.
//
// AND THE FIXTURE'S DATE WAS CHANGED TO MAKE THIS DISCRIMINATE. All four
// articles carried 2026-09-09, so "the chip contains the date" would have
// passed against a template with the date hardcoded - the same vacuity R154
// is about, in the test written to enforce R154. The fixture now reads
// 2026-01-15, so one hardcoded date cannot satisfy both.

test.describe('the metadata chips deliver their values (R154)', () => {
  const articles = allGuides();

  test('the set carries more than one date, or nothing below discriminates', () => {
    const dates = new Set(articles.map((guide) => guide.frontmatter.lastReviewed));

    expect(dates.size, 'every article shares a date; a hardcoded one would pass').toBeGreaterThan(
      1,
    );
  });

  for (const guide of articles) {
    const { slug, lastReviewed, reviewer } = guide.frontmatter;

    test(`${slug} renders its own date, reviewer and reading time`, async ({ page }) => {
      await page.goto(`${GUIDES_PATH}/${slug}`);

      // textContent rather than innerText, and includes() rather than a
      // matcher: R66/R71 - the normaliser collapses the U+00A0 these
      // sentences carry, and a matcher written with an ordinary space would
      // match either character.
      const chips = await page
        .locator('[data-chips]')
        .evaluate((node) => node.textContent ?? '');

      // THE EXPECTATION MUST NOT COME FROM THE FUNCTION UNDER TEST, and the
      // first version of this block did exactly that - it compared the chip
      // against GUIDES_COPY.reviewedOn(formatDate(...)). Planting the defect
      // proved it worthless: with reviewedOn returning its sentence WITHOUT
      // the date, both sides lost the date and the comparison still matched.
      // All four articles passed against an emptied interpolation.
      //
      // That is the tautological comparison tasks/plan.md records under R71 -
      // "a comparison whose two sides both come from the formatter proves
      // pass-through, not the value" - occurring inside the test written to
      // enforce R154. The same shape, one level up, again.
      //
      // So each assertion is against the VALUE, taken from the frontmatter:
      // the formatted date, the reviewer as written, the computed count. An
      // emptied interpolation drops all three out of the chip and all three
      // fail.
      expect(chips, `${slug}: the verification date`).toContain(formatDate(lastReviewed));
      expect(chips, `${slug}: the reviewer`).toContain(reviewer);
      expect(chips, `${slug}: the reading time`).toContain(
        String(readingMinutes(guide.body)),
      );

      // AND THE FORMATTER ITSELF, which formatDate cannot launder either:
      // the year and the day come from the raw ISO string in the file, so a
      // formatter returning something unrelated fails here even though it
      // would agree with itself above.
      const [year, , day] = lastReviewed.split('-');

      expect(chips, `${slug}: the year`).toContain(year ?? '');
      expect(chips, `${slug}: the day`).toContain(day ?? '');

      // The sentence around the value is still the copy module's, and that
      // it is PRESENT is worth one assertion - it is what makes the date a
      // verification date rather than a loose number.
      expect(chips, `${slug}: the chip's sentence`).toContain(
        GUIDES_COPY.reviewedOn('').trim().split(String.fromCharCode(0x00a0))[0] ?? '',
      );

      // A reading time of zero renders "0 min de lecture", which is
      // grammatical and wrong. The count is computed from the body, so it
      // must be positive for a real article.
      expect(readingMinutes(guide.body), `${slug}: reading time`).toBeGreaterThan(0);
    });
  }
});

test.describe('the hub delivers each entry its own date (R154)', () => {
  test('every listed guide shows the date its frontmatter carries', async ({ page }) => {
    await page.goto(GUIDES_PATH);

    const text = await page.locator('main').evaluate((node) => node.textContent ?? '');
    const published = allGuides().filter((guide) => !guide.file.startsWith('_'));

    expect(published.length).toBeGreaterThan(0);

    for (const guide of published) {
      expect(text, guide.frontmatter.slug).toContain(
        GUIDES_COPY.reviewedOn(formatDate(guide.frontmatter.lastReviewed)),
      );
      expect(text, guide.frontmatter.slug).toContain(guide.frontmatter.title);
    }

    // The fixture's date must NOT be here - it is excluded from the hub, and
    // this is what makes the assertion above about THESE guides rather than
    // about any date at all.
    const fixture = allGuides().find((guide) => guide.file.startsWith('_'));

    expect(text).not.toContain(
      GUIDES_COPY.reviewedOn(formatDate(fixture?.frontmatter.lastReviewed ?? '')),
    );
  });
});
