// web/e2e/home.nojs.spec.ts
//
// R346: the home page's calculator form, driven with scripting off.
//
// THE GAP THIS CLOSES. FW34 built `/` with a real server-rendered form -
// `<form method="get" action={CALCULATOR_PATH}>` - precisely so that a reader
// with no JavaScript can still reach the calculator with their figures in the
// URL. tests/unit/pages/home.test.tsx asserts the MARKUP is a GET form; no
// test had ever submitted it. "It is a GET form" and "submitting it lands a
// reader on the calculator with their answers" are different claims, and only
// a browser with scripting disabled can make the second.
//
// WHY A GET FORM IS THE WHOLE MECHANISM. A browser serialises the fields into
// the query string and navigates - no script involved. The calculator then
// reads those parameters on the server. So the journey either works from the
// markup or it does not work at all, which is what this suite is for.
//
// javaScriptEnabled: false comes from the nojs PROJECT, not from this file.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';
import { goToServedPage } from './support/served';

test.describe('the home calculator form with JavaScript OFF', () => {
  test('is served as a GET form pointed at the calculator', async ({ page }) => {
    await goToServedPage(page, '/');

    // PRESENCE FIRST (R169's corollary): every assertion below is about what
    // submitting this form does, and all of them would pass vacuously against
    // a page that served no form at all.
    const form = page.locator('main form');

    await expect(form).toHaveCount(1);
    await expect(form).toHaveAttribute('method', /get/i);
    await expect(form).toHaveAttribute('action', CALCULATOR_PATH);
  });

  test('submitting it lands on the calculator carrying what was typed', async ({ page }) => {
    await goToServedPage(page, '/');

    const form = page.locator('main form');
    const named = await form
      .locator('input[name], select[name]')
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement | HTMLSelectElement).name),
      );

    // The form carries its fields by NAME, which is what a GET submission
    // serialises. A field without one is silently dropped from the query
    // string - the defect this would catch.
    expect(named.length, 'the form has no named fields to submit').toBeGreaterThanOrEqual(2);

    await form.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForLoadState('load');

    const landed = new URL(page.url());

    expect(landed.pathname, 'the form did not navigate to the calculator').toBe(CALCULATOR_PATH);

    // Every named field reached the query string. Asserted per field rather
    // than on the whole string, so a failure names the one that was dropped.
    for (const name of named) {
      expect(landed.searchParams.has(name), `${name} is missing from the query string`).toBe(true);
    }
  });

  test('the calculator it lands on is itself served without scripting', async ({ page }) => {
    // The other half of the journey: arriving is worth nothing if the page
    // that receives the reader is a blank shell waiting for hydration. SPEC
    // 9.3 asks the PAGE to be meaningful without JavaScript - not the
    // calculation, which is an island and says so.
    await goToServedPage(page, '/');

    await page.locator('main form button[type="submit"]').first().click();
    await page.waitForLoadState('load');

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main.length, 'the calculator served an empty shell').toBeGreaterThan(400);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});
