// web/e2e/not-found.spec.ts
//
// The 404, asserted where the status code is real.
//
// WHY THIS CANNOT BE A UNIT TEST. Rendering app/not-found.tsx in jsdom would
// prove the markup and nothing about the thing that matters most: that the
// response carries 404 rather than 200. A "soft 404" - the right page with the
// wrong status - is the classic version of this bug, it looks perfect in a
// browser, and it tells crawlers the page exists. Only a real request answers
// it.
//
// The second claim is the shell. A 404 outside the (public) route group gets no
// group layout, so app/not-found.tsx composes PublicShell itself - see that
// file. If that composition were dropped, the page would still render and still
// return 404, and only an assertion on the landmarks would notice.

import { expect, test } from '@playwright/test';
import { NOT_FOUND_COPY } from '../lib/fr';

test('an unknown URL answers 404, not 200', async ({ page }) => {
  const response = await page.goto('/cette-page-nexiste-pas');

  expect(response?.status()).toBe(404);
});

test('the 404 is inside the public shell', async ({ page }) => {
  await page.goto('/cette-page-nexiste-pas');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
});

test('it has one h1 and two ways out', async ({ page }) => {
  await page.goto('/cette-page-nexiste-pas');

  await expect(page.locator('h1')).toHaveCount(1);

  const main = page.getByRole('main');

  // Scoped to main: the shell's header and footer carry links of their own,
  // and an unscoped count would pass on a page whose own links were gone.
  await expect(main.getByRole('link')).toHaveCount(2);
  // FROM THE COPY CONSTANT, NOT A LITERAL, AND R126 IS WHY. These two read
  // as hand-typed French until the apostrophe sweep moved the copy to
  // U+2019 and this assertion went red against correct copy - the only
  // breakage in 1722 tests, because every other assertion imports its
  // string. A literal here is a second copy of the words, and the second
  // copy is always the one that goes stale.
  //
  // getByRole matches an accessible name EXACTLY ON CODEPOINTS, both sides
  // (R66), so it is the one matcher where a typographic apostrophe cannot
  // be normalised away. That is what makes the constant necessary rather
  // than merely tidy.
  await expect(main.getByRole('link', { name: NOT_FOUND_COPY.calculator, exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: NOT_FOUND_COPY.home, exact: true })).toBeVisible();
});

test('it does not apologise or illustrate', async ({ page }) => {
  await page.goto('/cette-page-nexiste-pas');

  const main = page.getByRole('main');

  // The prompt's "no illustration, no oups" as an assertion. A future copy
  // edit reaching for either is the likely regression, and both are the kind
  // of change nobody would think to test for.
  await expect(main.locator('img, svg')).toHaveCount(0);
  await expect(main).not.toContainText('Oups', { ignoreCase: true });
});

test('the 404 text starts at the left edge of the measure', async ({ page }) => {
  await page.goto('/cette-page-nexiste-pas');

  // Left-aligned, per the prompt. Asserted as computed style rather than by
  // eye, because "centre" is the default a redesign drifts towards.
  const align = await page
    .locator('h1')
    .evaluate((element) => getComputedStyle(element).textAlign);

  expect(['start', 'left']).toContain(align);
});
