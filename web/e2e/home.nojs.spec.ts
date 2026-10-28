// web/e2e/home.nojs.spec.ts
//
// R346: the home page's no-JS journey, driven with scripting off.
//
// SINCE FW-HOME-A2 THE FORM IS THE COUNTER. The A2 home page replaced FW34's
// calculator card with a counter of two sliders - a client island - and the
// no-JS journey R346 and R351 protect had to survive that. It does, because
// the counter is a GET form to the page that ANSWERS (RESULT_PATH): its
// sliders are native range controls named after the calculator's own
// parameters, and a <noscript> block inside it adds a canton choice and a
// submit button. With scripting on, that block does not exist and the island
// answers live; with scripting off, a reader moves the sliders, chooses a
// canton and submits, and the server computes the answer.
//
// AND THE SERVER FIGURE IS THERE BEFORE ANY SCRIPT (R711): the counter's
// first render is the engine's answer for its opening position, so a reader
// with no JavaScript sees a real rate, not an empty box.
//
// javaScriptEnabled: false comes from the nojs PROJECT, not from this file.

import { expect, test } from '@playwright/test';
import { RESULT_PATH } from '../lib/content/routes';
import { goToServedPage } from './support/served';

test.describe('the home counter with JavaScript OFF', () => {
  test('is served as a GET form pointed at the page that answers', async ({ page }) => {
    await goToServedPage(page, '/');

    // PRESENCE FIRST (R169's corollary): every assertion below is about what
    // submitting this form does, and all of them would pass vacuously against
    // a page that served no form at all.
    const form = page.locator('main form[data-counter]');

    await expect(form).toHaveCount(1);
    await expect(form).toHaveAttribute('method', /get/i);
    await expect(form).toHaveAttribute('action', RESULT_PATH);
  });

  test('shows the server figure and a submit button only a no-JS reader gets', async ({ page }) => {
    await goToServedPage(page, '/');

    const form = page.locator('main form[data-counter]');

    // The engine's figure is in the HTML: a rate, digits and a percent sign.
    const rate = (await form.locator('[data-counter-rate] p').first().textContent()) ?? '';

    expect(rate, 'the counter served no figure').toMatch(/[0-9]+,[0-9]+/u);
    expect(rate).toContain('%');

    // The noscript block is live with scripting off.
    await expect(form.locator('button[type="submit"]')).toBeVisible();
    await expect(form.locator('select[name="canton"]')).toBeVisible();
  });

  test('submitting it lands on the result page carrying every named field', async ({ page }) => {
    await goToServedPage(page, '/');

    const form = page.locator('main form[data-counter]');
    const named = await form
      .locator('input[name], select[name]')
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement | HTMLSelectElement).name),
      );

    // The two sliders, the fixed method, and the canton: a field without a
    // name is silently dropped from the query string - the defect this catches.
    expect(named.length, 'the form has too few named fields').toBeGreaterThanOrEqual(4);

    await form.locator('button[type="submit"]').click();
    await page.waitForLoadState('load');

    const landed = new URL(page.url());

    expect(landed.pathname, 'the form did not navigate to the result page').toBe(RESULT_PATH);

    for (const name of named) {
      expect(landed.searchParams.has(name), `${name} is missing from the query string`).toBe(true);
    }
  });

  test('the page it lands on ANSWERS, with no scripting anywhere', async ({ page }) => {
    await goToServedPage(page, '/');

    await page.locator('main form[data-counter] button[type="submit"]').click();
    await page.waitForLoadState('load');

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main.length, 'the result page served an empty shell').toBeGreaterThan(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    // A RATE, IN TWO ASSERTIONS, for the reason the result page's own suite
    // gives: the figure carries U+00A0 before its percent sign (R91).
    expect(main, 'the result page carried no figure').toMatch(/[0-9]+,[0-9]+/u);
    expect(main, 'the figure is not a percentage').toContain('%');
  });
});
