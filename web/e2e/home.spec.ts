// web/e2e/home.spec.ts
// Smoke coverage for the e2e harness, and the half of FW1 AC1 that only a real
// browser can prove: that Inter is reaching the page with tabular numerals on.

import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { BASE_URL } from './support/base-url';
import { LAST_REGULATORY_REVIEW, reviewNotice } from '../lib/content/regulatory';
import { HOME_COPY } from '../lib/fr/home';
import { SHELL_COPY } from '../lib/fr/shell';
import { formatDate } from '../lib/ui/core';
import { currentTaxYear } from '../lib/content/tax-year';
import { guideScope } from '../lib/guides/scope';
import { guideNavLinks } from '../lib/guides/registry';

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
    HOME_COPY.opening.heading,
  );

  // And the codepoint that matters, named. FW-HOME-A2's heading has no French
  // mark before which R91 sets a no-break space, so the character a
  // normalising matcher would erase is its typographic apostrophe, U+2019
  // (R126) - textContent keeps it, and this says what to look for.
  expect(HOME_COPY.opening.heading).toContain(String.fromCharCode(0x2019));
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

// ---------------------------------------------------------------------------
// R931: WHETHER THE SERVER UNDER TEST IS SERVING IS A ROLE, NOT A PREMISE.
//
// The two tests below used to ASSUME the server was not marked as serving.
// That is true of the host run - playwright.config.ts starts `next start`
// without FRONTALIER_RUNTIME - and false of the image, which sets
// FRONTALIER_RUNTIME=1 by design (R81, web/Dockerfile). The container harness
// excluded the /api/health test by title (FW28); the /api/ready test gained
// its `ok: null` assertion later (R355) and was never excluded, so
// test:container:e2e stopped there on every commit and never reached its PDF
// step (FW-HEALTH-IMAGE, R930).
//
// THE LAUNCHER DECLARES, THE SERVER CONFIRMS. scripts/container-e2e.mjs, the
// one launcher that starts a SERVING server for this suite, says so in
// SERVING_DECLARATION; every other launcher leaves it unset, which declares
// the ordinary case. /api/health's `runtime` must agree with the declaration,
// and /api/ready is then asserted for the state the server reports.
//
// BRANCHING ON `runtime` ALONE WOULD HAVE LOOSENED THE HOST RUN: a host
// server that became marked would pass as quietly as the image does, and the
// not-serving direction would stop being exercised with nothing red. With the
// declaration, the host run proves one direction and the container run the
// other, and each fails if its server is in the other state (R196's shape).
//
// THE NAME IS WRITTEN TWICE, here and in the harness, and the run enforces
// it rather than a comparison: if the two drift, the container run declares
// nothing, its server answers runtime: true, and the /api/health test fails
// with both values in its message.
// ---------------------------------------------------------------------------

/** '1' when the process that started the server under test marked it as serving. */
const SERVING_DECLARATION = 'FRONTALIER_SERVER_IS_SERVING';

function declaredServing(): boolean {
  return process.env[SERVING_DECLARATION] === '1';
}

test('/api/health reports ok, and its runtime marker is the one its launcher declared', async ({
  request,
}) => {
  const response = await request.get('/api/health');
  const body = (await response.json()) as { status: string; reasons: string[]; runtime: boolean };

  expect(response.status()).toBe(200);
  expect(body.status).toBe('ok');
  expect(body.reasons).toEqual([]);
  expect(
    body.runtime,
    `${SERVING_DECLARATION} is ${process.env[SERVING_DECLARATION] ?? '(unset)'}, so the ` +
      `launcher declared this server ${declaredServing() ? 'serving' : 'not serving'}`,
  ).toBe(declaredServing());
});

test('/api/ready is 200 and ready, and evaluates the database exactly when serving', async ({
  request,
}) => {
  // The counter-direction for ruling R83. Readiness must NOT fail in a local
  // build or in CI - that is the same mistake the NODE_ENV guard made, one
  // endpoint over, and it would block the pipeline for a condition that
  // publishes nothing. Nor may it fail in a correctly configured image.

  // THE ROLE, READ FROM THE SERVER ITSELF (R171) - never from a literal that
  // happens to match one of the two runs. The test above pins it to the
  // launcher's declaration.
  const health = (await (await request.get('/api/health')).json()) as { runtime: boolean };
  const serving = health.runtime;

  const response = await request.get('/api/ready');
  const body = (await response.json()) as {
    ready: boolean;
    checks: { name: string; ok: boolean | null }[];
  };

  expect(response.status()).toBe(200);
  expect(body.ready).toBe(true);

  // NOTHING FAILED - but a plain truthiness check over every ok is no
  // longer the way to say so.
  // R353 added the database check and R355 gives it a third state: a server
  // NOT marked as serving does not evaluate it and reports ok: null. Null
  // must not block (a build needs no database) and must not read as a pass
  // (a check that stopped running would hide).
  expect(body.checks.every((check) => check.ok !== false)).toBe(true);

  // And the database check is asserted directly, in the state that matches:
  //   not serving  present in the list, explicitly NOT EVALUATED (R355);
  //   serving      EVALUATED, and passed - the harness migrated the scratch
  //                database the image points at (R353).
  const database = body.checks.find((check) => check.name === 'database');

  expect(database, 'the check stays listed so its absence is visible').toBeDefined();
  expect(
    database?.ok,
    serving
      ? 'a serving server evaluates its database check (R353)'
      : 'a server not marked as serving leaves its database check unevaluated (R355)',
  ).toBe(serving ? true : null);
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

// ---------------------------------------------------------------------------
// R713: NO DEAD LINK. Every internal link on "/" - the page's own and the
// shell's - is requested and must answer 200; every in-page fragment must
// name an element that exists. The canvas carried a sign-in button and a sample-releve button
// with nowhere to go; neither ships, and this is the test
// that would have caught either.
// ---------------------------------------------------------------------------

/** Every internal link on the current page that does not resolve, named. */
async function brokenLinks(page: Page, request: APIRequestContext): Promise<string[]> {
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
  const broken: string[] = [];

  for (const href of [...new Set(hrefs)]) {
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      const found = await page.locator(`[id="${id}"]`).count();

      if (found === 0) broken.push(`${href} (no element with that id)`);
      continue;
    }

    // External links are not this test's subject; the page has none today.
    if (!href.startsWith('/')) continue;

    const response = await request.get(href, { maxRedirects: 0 });

    if (response.status() !== 200) broken.push(`${href} (${String(response.status())})`);
  }

  return broken;
}

test('every internal link on / resolves (R713)', async ({ page, request }) => {
  await page.goto('/');

  // PRESENCE FIRST: a page with no links would pass the walk perfectly.
  expect(await page.locator('main a[href]').count()).toBeGreaterThanOrEqual(4);

  expect(await brokenLinks(page, request)).toEqual([]);
});

test('the link walk catches a planted broken link (R713 positive control)', async ({
  page,
  request,
}) => {
  await page.goto('/');
  // Hydration first: React reconciles the document it hydrates, and a node
  // planted before it finishes can be removed underneath the walk.
  await page.waitForLoadState('networkidle');

  // THE PLANT, verified before its result is read (R180).
  await page.evaluate(() => {
    const planted = document.createElement('a');

    planted.href = '/cette-page-nexiste-pas';
    planted.dataset.planted = 'true';
    planted.textContent = 'x';
    document.querySelector('main')?.append(planted);

    const anchor = document.createElement('a');

    anchor.href = '#nulle-part';
    anchor.dataset.planted = 'true';
    anchor.textContent = 'y';
    document.querySelector('main')?.append(anchor);
  });
  expect(await page.locator('[data-planted]').count()).toBe(2);

  const broken = await brokenLinks(page, request);

  // And still there after the walk, so the walk saw it.
  expect(await page.locator('[data-planted]').count()).toBe(2);
  expect(broken).toContain('/cette-page-nexiste-pas (404)');
  expect(broken.some((entry) => entry.startsWith('#nulle-part'))).toBe(true);
});

test('the guide links the old home page carried are still on / (R720)', async ({ page }) => {
  // FW34's Guides section linked three guides. A2 has no such section; the
  // shell's footer links EVERY published guide on every page, so the
  // internal-linking surface is kept - this asserts it, guide by guide.
  await page.goto('/');

  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));

  for (const { href } of guideNavLinks()) {
    expect(hrefs, `${href} is no longer linked from /`).toContain(href);
  }
  expect(guideNavLinks().length).toBeGreaterThanOrEqual(3);
});
