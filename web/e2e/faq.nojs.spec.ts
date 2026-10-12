// web/e2e/faq.nojs.spec.ts
//
// The FAQ is a details/summary list, so its answers are in the served
// markup. The calculator publishes them as FAQPage structured data, and a
// claim a reader cannot see is cloaking - where "cannot see" includes a
// crawler that runs no script.
//
// MOVED HERE BY FW-FORECAST'S INCREMENT 0 (R346). These assertions lived
// beside their JavaScript-enabled neighbours, and each turned scripting off
// for itself - some by test.use, some by building a context by hand. The
// policy now belongs to the nojs PROJECT, which is the only thing that
// collects this file, so nothing here configures scripting. The assertions
// are unchanged; only the way the page is obtained is.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';

test.describe('the FAQ with JavaScript OFF', () => {
  test('serves every answer with JavaScript disabled', async ({ page }) => {
    // THE ASSERTION THE STRUCTURED DATA DEPENDS ON. increment 3 publishes
    // these answers as FAQPage; a claim a reader cannot see is cloaking, and
    // "cannot see" includes a crawler that runs no script. A context with
    // JavaScript off is the closest thing to that reader.

    await page.goto(CALCULATOR_PATH);

    const answers = await page.locator('[data-faq] details > p').allTextContents();

    expect(answers.length).toBe(3);

    for (const answer of answers) {
      expect(answer.length).toBeGreaterThan(80);
    }
  });
});
