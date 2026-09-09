// web/e2e/home.spec.ts
// Smoke coverage for the e2e harness, and the half of FW1 AC1 that only a real
// browser can prove: that Inter is reaching the page with tabular numerals on.

import { expect, test } from '@playwright/test';
import { HOME_COPY } from '../lib/fr';
import { SHELL_COPY } from '../lib/fr/shell';

const ORIGIN = 'http://localhost:3000';

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
  expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(HOME_COPY.heading);

  // And the codepoint itself, named, so a reader of a failure knows what to
  // look for. U+00A0 is indistinguishable from a space on screen and in a diff.
  expect(HOME_COPY.heading).toContain(String.fromCharCode(0x00a0));
});

test('/ is wrapped in the public shell, header and footer both', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: SHELL_COPY.navLabel })).toBeAttached();
});

test('the footer says a review has not happened yet (R51)', async ({ page }) => {
  // The whole point of R51, asserted on a real public page: while
  // LAST_REGULATORY_REVIEW is null the footer must carry the in-progress
  // sentence and NO date. A dd.mm.yyyy here would be the most damaging
  // string on the site - the claim a reader would most reasonably rely on,
  // and false.
  await page.goto('/');

  const footer = page.getByRole('contentinfo');

  await expect(footer).toContainText(SHELL_COPY.reviewPending);
  await expect(footer).not.toContainText(/[0-9]{2}[.][0-9]{2}[.][0-9]{4}/);
});

test('exactly one h1 on the page', async ({ page }) => {
  // PublicShell must not add one. Two h1s is the kind of thing that looks
  // fine and quietly breaks a document outline.
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('figures are set in tabular numerals', async ({ page }) => {
  await page.goto('/');
  const figure = page.getByTestId('tabular-proof');

  // Both properties are asserted on purpose. font-variant-numeric does not
  // populate font-feature-settings, so checking only the modern property
  // would leave the OpenType feature unverified - which is the thing AC1
  // actually asks about.
  const featureSettings = await figure.evaluate(
    (el) => getComputedStyle(el).fontFeatureSettings,
  );
  const variantNumeric = await figure.evaluate(
    (el) => getComputedStyle(el).fontVariantNumeric,
  );
  const fontFamily = await figure.evaluate((el) => getComputedStyle(el).fontFamily);

  expect(featureSettings).toContain('tnum');
  expect(variantNumeric).toContain('tabular-nums');
  expect(fontFamily).toContain('Inter Variable');
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
  const body = (await response.json()) as { ready: boolean; checks: { ok: boolean }[] };

  expect(response.status()).toBe(200);
  expect(body.ready).toBe(true);
  expect(body.checks.every((check) => check.ok)).toBe(true);
});
