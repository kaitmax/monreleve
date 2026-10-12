// web/e2e/guides.nojs.spec.ts
//
// R136: content ships zero client JavaScript, so content must not NEED any.
// A crawler that runs no script and a reader on a bad connection see the
// same article - its prose, its headings, its links and its outline.
//
// MOVED HERE BY FW-FORECAST'S INCREMENT 0 (R346). These assertions lived
// beside their JavaScript-enabled neighbours, and each turned scripting off
// for itself - some by test.use, some by building a context by hand. The
// policy now belongs to the nojs PROJECT, which is the only thing that
// collects this file, so nothing here configures scripting. The assertions
// are unchanged; only the way the page is obtained is.

import { expect, test } from '@playwright/test';

const FIXTURE = '/guides/fixture-modele-article';

test.describe('a guide with JavaScript OFF', () => {
  test('serves the whole article with JavaScript disabled', async ({ page }) => {
    // R136: content ships zero client JavaScript, so content must not NEED
    // any. A crawler that runs no script and a reader on a bad connection see
    // the same article.

    await page.goto(FIXTURE);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-prose] h2').first()).toBeVisible();
    await expect(page.locator('[data-prose] a').first()).toBeVisible();
  });

  test('the outline needs no JavaScript either', async ({ page }) => {

    await page.goto(FIXTURE);

    // R136: the outline is links and CSS. No active-item highlight ships -
    // see TableOfContents.module.scss for why - so there is nothing here
    // that a script would have had to turn on.
    await expect(page.locator('[data-toc] a').first()).toBeVisible();
  });
});
