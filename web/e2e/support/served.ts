// web/e2e/support/served.ts
//
// R169's COROLLARY: AN ABSENCE ASSERTION IS ONLY MEANINGFUL ONCE PRESENCE IS
// ESTABLISHED.
//
// R169 settles WHOSE server is answering, once, before the run. This settles
// the other half, per route: that the page under test is the page, and not an
// error page that satisfies the assertion by having nothing in it.
//
// THE ASSERTIONS THIS PROTECTS ARE ALL OF THE SAME SHAPE, and it is the shape
// this project keeps being bitten by:
//
//   R127   "the document does not scroll sideways at 320 dp"     true of a 404
//   R127   "every element is inside the viewport"                true of a 404,
//                                                                because all of
//                                                                nothing is
//   analytics  "loads no analytics, sets no cookie, calls no
//              third party"                                      true of a 404
//
// Each is a claim about a PAGE, and each is satisfied by the absence of one.
// FW20 measured what that is worth: pointed at another product's server, 91
// tests passed.
//
// WHY THE STATUS AND NOT THE MARKUP. Our own not-found page renders a <main>
// and an <h1>, so neither presence discriminates it from a real page - a
// check on either would look like a precondition and be none. The HTTP status
// is the one signal a 404 cannot fake, and it is what every caller here needs:
// they are asserting about routes that are supposed to exist.

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Navigate, and refuse to continue unless the route actually served.
 *
 * Returns nothing: callers go on to measure the page they asked for, and a
 * helper that returned a response would invite them to check it a second time
 * in their own words.
 */
export async function goToServedPage(page: Page, route: string): Promise<void> {
  const response = await page.goto(route);

  expect(
    response?.status(),
    `${route} did not serve: the assertions below would pass on an error page ` +
      'without testing anything (R169 corollary)',
  ).toBe(200);
}
