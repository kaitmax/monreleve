// web/e2e/calculateur.spec.ts
//
// FW11 AC3 and ruling R54, proved where they can only be proved.
//
// WHY THE NO-JAVASCRIPT ASSERTION CANNOT BE A UNIT TEST. A jsdom render of the
// page component proves the server component RETURNS the copy. It cannot prove
// that what a browser with scripting disabled RECEIVES contains it - that
// depends on Next actually server-rendering this route rather than shipping a
// shell that fills itself in on hydration, which is a build-and-serve fact.
// `javaScriptEnabled: false` is the only place the distinction is real.
//
// SPEC 9.3: "Static HTML renders the full explanatory content server-side: the
// CALCULATION needs JavaScript; the PAGE must be meaningful without it."
//
// The form island arrives in increment 2. What increment 1 owes is the copy
// and no result region, which is what this asserts.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH, gateRobotsDirective, sitemapPaths } from '../lib/content/routes';
import { LAST_REGULATORY_REVIEW } from '../lib/content/regulatory';
import { currentTaxYear } from '../lib/content/tax-year';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { ruleSetFor } from '../lib/calc-engine';
import { formatPercent } from '../lib/ui/core';

const YEAR = currentTaxYear();
const RULES = ruleSetFor(YEAR);

const ceiling = (rate: number): string => {
  const percent = rate * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
};

const FISCAL = ceiling(RULES.fiscalCeiling);
const SOCIAL = ceiling(RULES.socialCeiling);

test.describe('with JavaScript disabled (AC3)', () => {
  test.use({ javaScriptEnabled: false });

  test('the page is meaningful: heading, intro, all three paragraphs', async ({ page }) => {
    const response = await page.goto(CALCULATOR_PATH);

    expect(response?.status()).toBe(200);

    // BY textContent, not toContainText: the copy carries U+00A0 before its
    // punctuation (R91) and Playwright's text matchers normalise both sides,
    // so they could not tell a no-break space from a plain one. R71.
    const body = (await page.locator('main').textContent()) ?? '';

    expect(body).toContain(CALCULATEUR_COPY.title);
    expect(body).toContain(CALCULATEUR_COPY.intro(FISCAL, SOCIAL));
    expect(body).toContain(CALCULATEUR_COPY.fiscal(FISCAL));
    expect(body).toContain(CALCULATEUR_COPY.social(SOCIAL));
    expect(body).toContain(CALCULATEUR_COPY.missions(FISCAL));
  });

  test('never a blank shell - the copy is in the SERVED html', async ({ page }) => {
    // The distinction that matters. Without scripting there is no hydration,
    // so anything present here was rendered on the server. A page that
    // rendered its copy on the client would pass every jsdom test and fail
    // this one.
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main.length).toBeGreaterThan(400);
    expect(await page.locator('h1').count()).toBe(1);
  });

  test('shows the tax year (R55), resolved on the server', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main).toContain(CALCULATEUR_COPY.yearCaption(YEAR));
  });

  test('renders the form, so the page is not a wall of prose', async ({ page }) => {
    // AC3's second clause: "the page shows the full explanatory copy, THE
    // FORM, and no result". With scripting off the island never hydrates, but
    // it is a Server Component render first - so the controls are in the
    // served HTML and a user can at least see what the tool asks for.
    await page.goto(CALCULATOR_PATH);

    for (const label of [
      CALCULATEUR_COPY.form.canton.label,
      CALCULATEUR_COPY.form.rate.label,
      CALCULATEUR_COPY.form.days.label,
    ]) {
      await expect(page.getByText(label, { exact: true }), label).toBeVisible();
    }
  });

  test('renders NO result, only the invitation to start one', async ({ page }) => {
    // AC3's third clause, and it CHANGED SHAPE at increment 4. This asserted
    // that no aria-live region existed at all, which was right when there was
    // no form: an empty live region announces nothing on every navigation.
    //
    // Now the region has a job, so the requirement is the one AC3 actually
    // states - no RESULT - and the region says why rather than sitting empty.
    // Scoped to the region because the explanatory copy below it legitimately
    // contains the ceiling as a percentage.
    await page.goto(CALCULATOR_PATH);

    const region = page.locator('[aria-live]');

    await expect(region).toHaveCount(1);

    // textContent, not toHaveText: the note is compared by codepoint and
    // Playwright's text matchers normalise both sides (R66/R71).
    const text = (await region.textContent()) ?? '';

    expect(text).toBe(CALCULATEUR_COPY.result.empty);
    expect(text).not.toContain('%');
  });

  test('the shell is still there, so the page is navigable', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});

test.describe('ruling R54: the gate, in the state it is actually in', () => {
  test('is indexable, because the review is recorded', async ({ page }) => {
    // The three surfaces have to AGREE. A page that were noindex while listed
    // in the sitemap would tell a crawler two different things, which is the
    // failure R54's single condition exists to make impossible.
    await page.goto(CALCULATOR_PATH);

    expect(LAST_REGULATORY_REVIEW).not.toBeNull();
    expect(gateRobotsDirective()).toBeNull();

    const robots = page.locator('meta[name="robots"]');

    // Next emits no robots meta when the field is absent. If one appears it
    // must not say noindex.
    if ((await robots.count()) > 0) {
      expect((await robots.getAttribute('content')) ?? '').not.toContain('noindex');
    }
  });

  test('is listed in the sitemap, and the sitemap agrees with the page', async ({ request }) => {
    const body = await request.get('/sitemap.xml').then((r) => r.text());

    expect(sitemapPaths()).toContain(CALCULATOR_PATH);
    expect(body).toContain(`${CALCULATOR_PATH}</loc>`);
  });

  test('is linked from the nav and the footer', async ({ page }) => {
    // The third surface. Absence here while the review was null was the point
    // of R54: a page linked from every other page, asking not to be indexed,
    // gets indexed anyway.
    await page.goto('/');

    const links = page.locator(`a[href="${CALCULATOR_PATH}"]`);

    expect(await links.count()).toBeGreaterThan(0);
  });

  test('carries a self-referencing canonical like every other public page', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    // head-scoped: see the long note in e2e/routing.spec.ts. THIS is the page
    // whose canonical was emitted into the body, so of the two files this is
    // the one where the scoping earns its keep.
    const canonical = page.locator('head > link[rel="canonical"]');

    await expect(canonical).toHaveCount(1);
    expect(await canonical.getAttribute('href')).toBe(
      `https://frontalier.example${CALCULATOR_PATH}`,
    );
  });
});
