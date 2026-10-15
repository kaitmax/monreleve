// web/e2e/home.spec.ts
// Smoke coverage for the e2e harness, and the half of FW1 AC1 that only a real
// browser can prove: that Inter is reaching the page with tabular numerals on.

import { expect, test } from '@playwright/test';
import { BASE_URL } from './support/base-url';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '../lib/content/regulatory';
import { HOME_COPY } from '../lib/fr/home';
import { SHELL_COPY } from '../lib/fr/shell';
import { formatDate } from '../lib/ui/core';
import { currentTaxYear } from '../lib/content/tax-year';
import { guideScope } from '../lib/guides/scope';

/**
 * The server these tests actually hit, which is NOT the origin the build is
 * configured with. The build sets NEXT_PUBLIC_SITE_URL to monreleve.example
 * so the canonicals have something real to assert, so a trace filtered by the
 * METADATA origin calls every request foreign.
 *
 * FROM THE SHARED CONSTANT SINCE R170, not the literal localhost:3000. The
 * port moves, and a hardcoded one here does not fail loudly - it reclassifies
 * our own chunks as third-party requests, which is this file asserting the
 * opposite of what it means. Found on the first run at FRONTALIER_PORT=3100.
 */
const ORIGIN = BASE_URL;

test('/ responds 200 and renders its heading from lib/fr', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);

  // The heading is the PAGE's, not the product name: PublicShell emits no
  // h1 on purpose, so there is exactly one and the page owns it. This
  // assertion used to expect APP_NAME, which was true only while the home
  // page was a placeholder with the product name as its heading.
  // BY textContent, NOT toHaveText - ruling R71, and the heading is now a
  // reason rather than a precaution. FW11's typography pass (R91) put a U+00A0
  // before its question mark, and toHaveText cannot see the difference:
  // MEASURED in a real browser, it matches a matcher containing U+00A0 AND one
  // containing an ordinary space against the same DOM, because it normalises
  // both sides. So it would keep passing on the day the no-break space
  // silently became a space again, which is the only failure worth catching
  // here.
  //
  // textContent keeps the codepoint - also measured - so this compares the
  // exact string, and the constant on the other side carries it too.
  expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(
    HOME_COPY.hero.heading,
  );

  // And the codepoint itself, named, so a reader of a failure knows what to
  // look for. U+00A0 is indistinguishable from a space on screen and in a diff.
  // The hero headline carries it before its question mark (R91).
  expect(HOME_COPY.hero.heading).toContain(String.fromCharCode(0x00a0));
});

test('/ is wrapped in the public shell, header and footer both', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: SHELL_COPY.navLabel })).toBeAttached();
});

test('the footer carries the recorded review date (R51)', async ({ page }) => {
  // INVERTED AT CHECKPOINT A, 09.09.2026, and deliberately not deleted. R51
  // does not say "the footer says pending" - it says the footer must never
  // claim a verification that has not happened. Before the gate that meant the
  // in-progress sentence and no date; after it, the date and no sentence. The
  // assertion reads the constant, so it cannot drift from it.
  //
  // BY textContent, NOT toContainText. reviewNotice now carries a U+00A0
  // before its colon (the FW11 typography pass), and Playwright normalises
  // whitespace on BOTH sides of its text matchers - measured in a real
  // browser - so toContainText would pass whether the codepoint were there or
  // not. Ruling R71: assert on textContent by codepoint.
  await page.goto('/');

  const footer = (await page.getByRole('contentinfo').textContent()) ?? '';

  expect(LAST_REGULATORY_REVIEW).not.toBeNull();
  expect(footer).toContain(reviewNotice(LAST_REGULATORY_REVIEW));
  expect(footer).toContain(formatDate(LAST_REGULATORY_REVIEW ?? ''));

  // And the sentence it replaced is gone, so the page cannot say both.
  expect(footer).not.toContain(SHELL_COPY.reviewPending);
});

test('exactly one h1 on the page', async ({ page }) => {
  // PublicShell must not add one. Two h1s is the kind of thing that looks
  // fine and quietly breaks a document outline.
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('the Inter subset is actually served and loaded, not just declared', async ({
  page,
}) => {
  // getComputedStyle returns the declared stack whether or not the woff2 ever
  // arrived, so the assertions above pass even if /fonts/ 404s. public/fonts
  // is generated output rebuilt by a script on every clone, so this is the
  // check that would catch it disappearing.
  const responses: { url: string; status: number }[] = [];
  page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const loaded = await page.evaluate(() => document.fonts.check('1em "Inter Variable"'));
  expect(loaded).toBe(true);

  const font = responses.find((r) => r.url.endsWith('/fonts/inter-latin-wght-normal.woff2'));
  expect(font?.status).toBe(200);
});

test('a public route makes no third-party request and sets no cookie', async ({
  page,
  context,
}) => {
  // SPEC section 17: zero third-party network requests on any web page.
  // SPEC D12: no cookies on public routes. A hostname grep cannot see either,
  // so both are asserted from a real network trace.
  const foreignRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(ORIGIN)) foreignRequests.push(request.url());
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  expect(foreignRequests).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

// ---------------------------------------------------------------------------
// The OTHER direction of ruling R81, and it is not optional: a guard that
// always refused would pass every assertion in guard.runtime.spec.ts. This
// suite runs WITHOUT FRONTALIER_RUNTIME, which is the ordinary case, so it is
// where "the guard stays quiet" can be proved for free.
// ---------------------------------------------------------------------------

test('/sitemap.xml is served normally when the process is not marked as serving', async ({
  request,
}) => {
  const response = await request.get('/sitemap.xml');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');

  const body = await response.text();

  expect(body).toContain('<urlset');
  expect(body).toContain('<loc>');
});

test('/api/health reports ok when the process is not marked as serving', async ({ request }) => {
  const response = await request.get('/api/health');
  const body = (await response.json()) as { status: string; reasons: string[]; runtime: boolean };

  expect(response.status()).toBe(200);
  expect(body.status).toBe('ok');
  expect(body.reasons).toEqual([]);
  expect(body.runtime).toBe(false);
});

test('/api/ready is 200 and ready when the process is not marked as serving', async ({
  request,
}) => {
  // The counter-direction for ruling R83. Readiness must NOT fail in a local
  // build or in CI - that is the same mistake the NODE_ENV guard made, one
  // endpoint over, and it would block the pipeline for a condition that
  // publishes nothing.
  const response = await request.get('/api/ready');
  const body = (await response.json()) as {
    ready: boolean;
    checks: { name: string; ok: boolean | null }[];
  };

  expect(response.status()).toBe(200);
  expect(body.ready).toBe(true);

  // NOTHING FAILED - but a plain truthiness check over every ok is no
  // longer the way to say so.
  // R353 added the database check and R355 gives it a third state: this
  // server is NOT marked as serving, so the check is NOT EVALUATED and
  // reports ok: null. Null must not block (a build needs no database) and
  // must not read as a pass (a check that stopped running would hide).
  expect(body.checks.every((check) => check.ok !== false)).toBe(true);

  // And that is asserted directly, because it is the property R355 exists
  // for: present in the list, explicitly not evaluated.
  const database = body.checks.find((check) => check.name === 'database');

  expect(database, 'the check stays listed so its absence is visible').toBeDefined();
  expect(database?.ok).toBeNull();
});

test('the meta description delivers both thresholds, formatted (R147, R154)', async ({ page }) => {
  // FW18b MADE THE DESCRIPTION A FUNCTION, because R147 now reaches lib/fr
  // and it used to type "40 %" and "49,9 %". A function that returned its
  // sentence with the interpolations empty would still be a valid meta tag,
  // still parse, still pass every other assertion on this page, and the
  // snippet in every search result would read "avant les seuils de  et ".
  //
  // That is exactly the shape R154 exists for, so the assertion is against
  // the VALUES - taken from the engine, not from the copy module - rather
  // than against the sentence the copy module would produce.
  await page.goto('/');

  const description = await page
    .locator('meta[name="description"]')
    .getAttribute('content');

  const { fiscal, social } = guideScope(currentTaxYear());

  expect(description, 'the fiscal ceiling').toContain(fiscal);
  expect(description, 'the social ceiling').toContain(social);

  // AND THE FIGURES ARE REAL ONES, so a scope returning two empty strings
  // cannot satisfy the two assertions above by making them vacuous.
  expect(fiscal).toMatch(/\d/u);
  expect(social).toMatch(/\d/u);

  // The sentence around them is still the copy module's, and that it survived
  // is worth one assertion.
  expect(description).toContain('Calculez votre part de télétravail annuelle');
});
