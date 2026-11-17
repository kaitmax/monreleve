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
import { SECTION_ID } from '../app/(public)/calculateur-lamal-cmu/section-ids';
import { LAMAL_COPY } from '../lib/fr/lamal';
import { LAMAL_PAGE_COPY } from '../lib/fr/lamal-page';
import { RAPPEL_COPY } from '../lib/fr/rappel';
import { LANDING_STATES, landingFragment } from '../lib/rappel/landing';

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

  // FW-DELAI-RAPPEL. LAMAL_COPY.noScript says « Rien de ce que vous saisissez
  // n'est envoyé ni enregistré », and it is rendered ONLY inside <noscript>.
  // The reminder form - the one thing on this page that sends an address and
  // a date - exists only once the island has computed a date, so a reader who
  // can read that sentence has no form to type into. This ties the sentence's
  // scope to the page rather than to a comment: the note is shown, the date
  // can be typed, and no reminder form appears.
  test('the no-script note stays true: with no JavaScript there is no reminder form to send anything', async ({
    page,
  }) => {
    await page.goto(COMPARATOR_PATH);

    expect((await page.locator('main').textContent()) ?? '').toContain(LAMAL_COPY.noScript);

    await page.locator('#date-evenement').fill('2026-11-30');

    await expect(page.locator('[data-deadline-helper]')).toHaveCount(1);
    await expect(page.locator('[data-reminder-form]')).toHaveCount(0);
  });

  // FW-COMPARATEUR-A2-PAGE (W20, R1048): the artboard's static sections are
  // server HTML. With scripting off the reader still gets the long h1, every
  // section under its heading, and chips that are real in-page links - one
  // is followed, and the address bar and the target show it worked.
  test('the A2 sections and their chips are served without JavaScript', async ({ page }) => {
    await page.goto(COMPARATOR_PATH);

    expect((await page.locator('h1').textContent()) ?? '').toBe(LAMAL_PAGE_COPY.heading);

    const main = (await page.locator('main').textContent()) ?? '';

    for (const heading of [
      LAMAL_PAGE_COPY.final.heading,
      LAMAL_PAGE_COPY.family.heading,
      LAMAL_PAGE_COPY.scope.heading,
      LAMAL_PAGE_COPY.france.heading,
      LAMAL_PAGE_COPY.switzerland.heading,
      LAMAL_PAGE_COPY.sources.heading,
    ]) {
      expect(main, heading).toContain(heading);
    }

    const chips = page.getByRole('navigation', { name: LAMAL_PAGE_COPY.onThisPage }).getByRole('link');
    const hrefs = await chips.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

    expect(hrefs.length).toBe(Object.keys(SECTION_ID).length);
    for (const href of hrefs) {
      await expect(page.locator(href), href).toHaveCount(1);
    }

    // Follow one: "Sources", the last section, far below the fold.
    await chips.filter({ hasText: LAMAL_PAGE_COPY.sources.heading }).click();
    await expect(page).toHaveURL(new RegExp(`#${SECTION_ID.sources}$`, 'u'));
    await expect(page.locator(`#${SECTION_ID.sources}`)).toBeInViewport();
  });

  // The links in the messages land here with a fragment, and CSS :target
  // reveals the outcome - no script involved, as the alert card's statuses.
  test('a link\x27s outcome is revealed by its fragment, with no JavaScript', async ({ page }) => {
    await page.goto(`${COMPARATOR_PATH}#${landingFragment(LANDING_STATES.deleted)}`);

    const shown = page.locator(`#${landingFragment(LANDING_STATES.deleted)}`);

    await expect(shown).toBeVisible();
    expect(await shown.textContent()).toContain(RAPPEL_COPY.outcomes.deleted.heading);
    await expect(page.locator('[data-rappel-outcome]:visible')).toHaveCount(1);
  });
});
