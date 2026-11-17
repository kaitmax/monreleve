// web/e2e/rappel-suppression.nojs.spec.ts
//
// FW-DELAI-RAPPEL, R1002 (R346): THE DELETE LINK'S PAGE WORKS WITH NO
// JAVASCRIPT. It is a plain form - method="post", the token in a hidden field,
// one button - and pressing the button lands on the comparator, where CSS
// :target reveals the outcome the handler's 303 named.
//
// THE TOKEN IS ONE NO MESSAGE EVER CARRIED. From a browser, a deletion and "no
// row for this link" read the same (R1003), so this is the journey a person
// holding a real link takes, and no row is needed to drive it. That the row
// actually goes is asserted against the database, through the same page and
// handler, in tests/db/rappel-delai-suppression.test.ts.

import { expect, test } from '@playwright/test';
import { RAPPEL_COPY } from '../lib/fr/rappel';
import { DELETE_PATH, LANDING_STATES, landingFor, landingFragment } from '../lib/rappel/landing';

const TOKEN = 'c'.repeat(64);

test('with no JavaScript, the one button posts and lands on the outcome, revealed by its fragment', async ({ page }) => {
  const response = await page.goto(`${DELETE_PATH}?token=${TOKEN}`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(RAPPEL_COPY.deletePage.heading);

  const form = page.locator('form[method="post"]');

  await expect(form).toHaveCount(1);
  await expect(form.locator('button')).toHaveCount(1);

  await form.getByRole('button', { name: RAPPEL_COPY.deletePage.button }).click();

  const landed = new URL(page.url());

  expect(`${landed.pathname}${landed.hash}`).toBe(landingFor(LANDING_STATES.deleted));

  const shown = page.locator(`#${landingFragment(LANDING_STATES.deleted)}`);

  await expect(shown).toBeVisible();
  await expect(shown).toContainText(RAPPEL_COPY.outcomes.deleted.heading);
  await expect(page.locator('[data-rappel-outcome]:visible')).toHaveCount(1);
});
