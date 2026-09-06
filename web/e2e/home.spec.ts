// web/e2e/home.spec.ts
// Smoke coverage for the e2e harness, and the half of FW1 AC1 that only a real
// browser can prove: that Inter is reaching the page with tabular numerals on.

import { expect, test } from '@playwright/test';
import { APP_NAME } from '../lib/fr';

const ORIGIN = 'http://localhost:3000';

test('/ responds 200 and renders the product name from lib/fr', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
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
