// web/e2e/home.nojs.spec.ts
//
// R346: the home page's calculator form, driven with scripting off.
//
// THE GAP THIS CLOSES. FW34 built `/` with a real server-rendered form,
// precisely so that a reader with no JavaScript can still reach an answer
// with their figures in the URL. tests/unit/pages/home.test.tsx asserts the
// MARKUP is a GET form; no test had ever submitted it. "It is a GET form"
// and "submitting it lands a reader on their answer" are different claims,
// and only a browser with scripting disabled can make the second.
//
// WHERE IT POINTS CHANGED UNDER R351, AND THAT IS THE POINT OF SUBMITTING
// IT. The action was CALCULATOR_PATH, which was honest when FW34 wrote it
// and did not answer: that route is static by FW13 ruling and its island
// reads the URL on mount, so with scripting off the form handed its reader
// a page showing the same empty state as the bare path. Measured on a
// production build before the change. It now posts to RESULT_PATH, which
// computes on the server - so these tests assert a FIGURE rather than
// merely an arrival.
//
// WHY A GET FORM IS THE WHOLE MECHANISM. A browser serialises the fields into
// the query string and navigates - no script involved. The calculator then
// reads those parameters on the server. So the journey either works from the
// markup or it does not work at all, which is what this suite is for.
//
// javaScriptEnabled: false comes from the nojs PROJECT, not from this file.

import { expect, test } from '@playwright/test';
import { RESULT_PATH } from '../lib/content/routes';
import { goToServedPage } from './support/served';

test.describe('the home calculator form with JavaScript OFF', () => {
  test('is served as a GET form pointed at the page that answers', async ({ page }) => {
    await goToServedPage(page, '/');

    // PRESENCE FIRST (R169's corollary): every assertion below is about what
    // submitting this form does, and all of them would pass vacuously against
    // a page that served no form at all.
    const form = page.locator('main form');

    await expect(form).toHaveCount(1);
    await expect(form).toHaveAttribute('method', /get/i);
    await expect(form).toHaveAttribute('action', RESULT_PATH);
  });

  test('submitting it lands on the result page carrying what was typed', async ({ page }) => {
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

    expect(landed.pathname, 'the form did not navigate to the result page').toBe(RESULT_PATH);

    // Every named field reached the query string. Asserted per field rather
    // than on the whole string, so a failure names the one that was dropped.
    for (const name of named) {
      expect(landed.searchParams.has(name), `${name} is missing from the query string`).toBe(true);
    }
  });

  test('the page it lands on ANSWERS, with no scripting anywhere', async ({ page }) => {
    // THE ASSERTION THE OLD DESTINATION COULD NOT CARRY. This test used to
    // check that the landing page was not a blank shell - more than 400
    // characters and one h1 - which was everything there was to check while
    // it landed on a page that could not calculate. Both of those would
    // still pass today on a page showing an empty state.
    //
    // So it asserts the figure instead. The form carries real defaults (a
    // canton, the example telework days), so an answer is owed, and a
    // percentage in this HTML was put there by the server.
    await goToServedPage(page, '/');

    await page.locator('main form button[type="submit"]').first().click();
    await page.waitForLoadState('load');

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main.length, 'the result page served an empty shell').toBeGreaterThan(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    // A RATE, IN TWO ASSERTIONS. The figure carries U+00A0 before its percent
    // sign (R91), so one pattern spanning both would have to spell a no-break
    // space in a regex - which is exactly the kind of literal that reads as a
    // plain space to the next person. The digits and the sign are checked
    // separately instead.
    expect(main, 'the result page carried no figure').toMatch(/[0-9]+,[0-9]+/u);
    expect(main, 'the figure is not a percentage').toContain('%');
  });
});
