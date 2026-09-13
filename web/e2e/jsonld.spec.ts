// web/e2e/jsonld.spec.ts
//
// SPEC 14's structured data, as a crawler receives it.
//
// WHY THIS NEEDS A SERVER. The unit tests assert the builders and the
// rendered DOM under jsdom; neither can answer whether the JSON survived a
// production build and the real renderer. That question is not idle - the
// whole difficulty of putting JSON inside a script element is about escaping,
// and an escaping bug produces text that is still THERE and no longer parses.
// So this parses it, from the served bytes.
//
// AND IT COMPARES THE PUBLISHED ANSWERS AGAINST THE VISIBLE ONES, on the same
// page load. A FAQPage that agrees with the accordion in a unit test and
// disagrees in the shipped HTML would be cloaking that every other test calls
// correct.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';

interface Structured {
  readonly '@type': string;
  readonly url?: string;
  readonly mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
}

const structured = async (page: import('@playwright/test').Page): Promise<Structured[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map(
      (script) => JSON.parse(script.textContent ?? '') as unknown,
    ),
  ) as Promise<Structured[]>;

test.describe('the calculator publishes structured data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CALCULATOR_PATH);
  });

  test('emits a WebApplication and a FAQPage, both parseable', async ({ page }) => {
    const emitted = await structured(page);

    expect(emitted.map((object) => object['@type']).sort()).toEqual([
      'FAQPage',
      'WebApplication',
    ]);
  });

  test('publishes the questions and answers the page actually shows', async ({ page }) => {
    const emitted = await structured(page);
    const faq = emitted.find((object) => object['@type'] === 'FAQPage');

    const questions = await page.locator('[data-faq] summary').allTextContents();
    const answers = await page.locator('[data-faq] details > p').allTextContents();

    expect(questions.length).toBe(3);
    expect(faq?.mainEntity?.map((question) => question.name)).toEqual(questions);
    expect(faq?.mainEntity?.map((question) => question.acceptedAnswer.text)).toEqual(answers);
  });

  test('names itself at the same URL as its canonical', async ({ page }) => {
    // TWO TAGS THAT MUST AGREE, written by different code paths: the canonical
    // is Next resolving './' against metadataBase, the JSON-LD url is built
    // from siteOrigin() and the route constant. Nothing else compares them,
    // and a product that tells a crawler two different addresses for one page
    // is asking to have the wrong one indexed.
    const emitted = await structured(page);
    const app = emitted.find((object) => object['@type'] === 'WebApplication');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');

    expect(canonical, 'no canonical to compare against').not.toBeNull();
    expect(app?.url).toBe(canonical);
  });
});
