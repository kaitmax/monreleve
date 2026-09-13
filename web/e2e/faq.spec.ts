// web/e2e/faq.spec.ts
//
// The FAQ in a real browser: the keyboard path, and the property the whole
// design rests on.
//
// WHY THE KEYBOARD IS HERE AND NOT IN jsdom. jsdom implements the summary
// CLICK activation - measured, and the unit test asserts it - but it does not
// map Enter or Space on a focused summary to that activation. A unit test
// claiming otherwise would be asserting its own stub. Chromium does what a
// reader's keyboard does.
//
// AND THE ANSWERS ARE IN THE HTML WITH NO JAVASCRIPT AT ALL. That is what
// makes the FAQPage structured data honest rather than cloaking, and it is
// worth proving against the served bytes rather than against a component: the
// text has to survive the build, the server render, and a browser with
// scripting disabled.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';

test.describe('the inline FAQ', () => {
  test('opens and closes from the keyboard alone', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const first = page.locator('[data-faq] details').first();
    const summary = first.locator('summary');

    await expect(first).not.toHaveAttribute('open', /.*/);

    await summary.focus();
    await expect(summary).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('open', /.*/);

    await page.keyboard.press('Enter');
    await expect(first).not.toHaveAttribute('open', /.*/);
  });

  test('reaches every question by Tab, in document order', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const summaries = page.locator('[data-faq] summary');

    await expect(summaries).toHaveCount(3);

    // From the first summary, Tab must reach the second and third: a closed
    // answer contributes no tab stop of its own, so the questions are
    // consecutive.
    await summaries.first().focus();
    await page.keyboard.press('Tab');
    await expect(summaries.nth(1)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(summaries.nth(2)).toBeFocused();
  });

  test('serves every answer with JavaScript disabled', async ({ browser }) => {
    // THE ASSERTION THE STRUCTURED DATA DEPENDS ON. increment 3 publishes
    // these answers as FAQPage; a claim a reader cannot see is cloaking, and
    // "cannot see" includes a crawler that runs no script. A context with
    // JavaScript off is the closest thing to that reader.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(CALCULATOR_PATH);

    const answers = await page.locator('[data-faq] details > p').allTextContents();

    expect(answers.length).toBe(3);

    for (const answer of answers) {
      expect(answer.length).toBeGreaterThan(80);
    }

    await context.close();
  });
});
