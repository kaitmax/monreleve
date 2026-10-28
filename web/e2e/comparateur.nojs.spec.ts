// web/e2e/comparateur.nojs.spec.ts
//
// /calculateur-lamal-cmu with JavaScript disabled. FW-COMPARATEUR, R658.
//
// THE COMPARISON NEEDS JAVASCRIPT AND SAYS SO; NOTHING TYPED LEAVES THE PAGE.
// The arithmetic runs in the browser precisely so that no income is ever sent
// (R658). Without scripting there is therefore no figure - and what a reader
// must still get is the explanation, the irrevocability banner and the list
// of what the comparison leaves out, all from the server; and a native form
// submission (Enter in the income field) must not put the income in a URL.
//
// ABSENCE NEEDS A POSITIVE CONTROL (the prompt; R169's corollary). "No
// request carried the income" is satisfied by a test that recorded no
// requests at all. So the same recorder must first be seen to catch the
// submission itself - the navigation the Enter key causes - and only then is
// its silence about the income evidence.

import { expect, test } from '@playwright/test';
import { COMPARATOR_PATH } from '../lib/content/routes';
import { LAMAL_COPY } from '../lib/fr/lamal';

/** A figure nobody would type by accident, so a hit can only be ours. */
const INCOME = '73519';

test.describe('with JavaScript disabled', () => {
  test('the page explains itself from the server: heading, lead, banner, limits', async ({ page }) => {
    const response = await page.goto(COMPARATOR_PATH);

    expect(response?.status()).toBe(200);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(await page.locator('h1').count()).toBe(1);
    expect(main).toContain(LAMAL_COPY.title);
    expect(main).toContain(LAMAL_COPY.intro);
    expect(main).toContain(LAMAL_COPY.banner.heading);
    expect(main).toContain(LAMAL_COPY.banner.body);
    expect(main).toContain(LAMAL_COPY.limitsHeading);
    expect(main).toContain(LAMAL_COPY.noScript);
    // No result without scripting - a figure would mean the server computed
    // from something it was sent.
    expect(await page.locator('[data-panel]').count()).toBe(0);
  });

  test('a native submission carries no income - and the recorder is shown to see the submission', async ({
    page,
  }) => {
    await page.goto(COMPARATOR_PATH);

    const seen: string[] = [];

    page.on('request', (request) => {
      seen.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`);
    });

    await page.locator('#revenu-fiscal').fill(INCOME);
    await page.locator('#naissance-0').fill('1985');

    const navigation = page.waitForEvent('framenavigated');

    await page.locator('#revenu-fiscal').press('Enter');
    await navigation;

    // THE POSITIVE CONTROL: the recorder caught the submission's own request
    // to this page. Without it, the assertion below would hold vacuously.
    expect(seen.some((line) => line.includes(COMPARATOR_PATH))).toBe(true);

    // AND THE INCOME IS NOWHERE: not in a request URL, not in a body, not in
    // the address bar.
    expect(seen.filter((line) => line.includes(INCOME))).toEqual([]);
    expect(page.url()).not.toContain(INCOME);
  });
});
