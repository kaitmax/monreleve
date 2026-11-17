// web/e2e/rappel-delai.spec.ts
//
// FW-DELAI-RAPPEL, R918 and R225: the reminder form in the comparator's
// "Votre délai" helper, driven in a real browser against the served page.
//
// WHAT ONLY A BROWSER CAN SAY:
//   - the form appears once a date is computed, and not before;
//   - the request it makes carries the address and the COMPUTED end date and
//     NOTHING ELSE from the page - not the event, not its date, not the
//     income typed above (R750), read off the request body itself, with the
//     recorder shown to work (a positive control, as comparateur.spec.ts);
//   - the confirmation state is on the rendered page after the server
//     answers (R225);
//   - a link's outcome is revealed on the comparator by its fragment.
//
// THE DATES ARE THE READER'S, FROM THE REAL CLOCK (R171): the event is a day a
// month from today, so the computed end is always far enough away for the
// form to be offered and for the server to accept it.

import { expect, test } from '@playwright/test';
import { COMPARATOR_PATH } from '../lib/content/routes';
import { LAMAL_COPY } from '../lib/fr/lamal';
import { RAPPEL_COPY } from '../lib/fr/rappel';
import { RAPPEL_FORM_COPY } from '../lib/fr/rappel-form';
import { optionPeriodEnd } from '../lib/lamal/deadline';
import { DELETE_ENDPOINT, DELETE_PATH, LANDING_STATES, landingFragment } from '../lib/rappel/landing';
import { REMINDER_ENDPOINT } from '../lib/rappel/status';
import { DAYS_BEFORE, localDay, shiftDays } from '../lib/rappel/window';

/** A figure nobody would type by accident, so a hit can only be ours. */
const INCOME = '73519';

/** The event a month from the reader's today. */
const EVENT = shiftDays(localDay(), 30) ?? '';
const END = optionPeriodEnd(EVENT) ?? '';

/** Each test posts from its own address, so the rate limit never couples them. */
let seq = 0;

test.beforeEach(async ({ page }) => {
  seq += 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.77.${seq}.${Math.floor(Math.random() * 250) + 1}` });
});

test('the form appears only once a date is computed', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);

  await expect(page.locator('[data-reminder-form]')).toHaveCount(0);

  await page.locator('#date-evenement').fill(EVENT);

  const form = page.locator('[data-reminder-form]');

  await expect(form).toBeVisible();
  await expect(form.getByLabel(RAPPEL_FORM_COPY.label)).toBeVisible();
  await expect(form.getByRole('button', { name: RAPPEL_FORM_COPY.submit })).toBeVisible();
});

test(`no form for a date fewer than ${DAYS_BEFORE} days away (R916, the conservative choice)`, async ({ page }) => {
  await page.goto(COMPARATOR_PATH);
  // An event three months back ends about today: well inside the fourteen days.
  await page.locator('#date-evenement').fill(shiftDays(localDay(), -85) ?? '');

  await expect(page.locator('[data-deadline-end]')).not.toHaveAttribute('data-deadline-end', '');
  await expect(page.locator('[data-reminder-form]')).toHaveCount(0);
});

test('sends the address and the computed date, and nothing else from the page (R750)', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);

  const seen: string[] = [];

  page.on('request', (request) => {
    seen.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`);
  });

  // Something the comparator holds, typed but never compared: it must not travel.
  await page.locator('#revenu-fiscal').fill(INCOME);
  await page.locator('#date-evenement').fill(EVENT);

  const posted = page.waitForRequest((request) => request.url().endsWith(REMINDER_ENDPOINT));

  await page.getByLabel(RAPPEL_FORM_COPY.label).fill(`rappel-e2e-${seq}@monreleve.test`);
  await page.getByRole('button', { name: RAPPEL_FORM_COPY.submit }).click();

  const request = await posted;
  const body = new URLSearchParams(request.postData() ?? '');

  // The positive control: the recorder caught the one request made on purpose.
  expect(seen.some((line) => line.includes(REMINDER_ENDPOINT))).toBe(true);

  expect(request.method()).toBe('POST');
  expect(new URL(request.url()).search).toBe('');
  expect([...body.keys()].sort()).toEqual(['date', 'email']);
  expect(body.get('date')).toBe(END);
  expect(body.get('email')).toBe(`rappel-e2e-${seq}@monreleve.test`);

  // Not the income, not the event's own date, anywhere, in any request.
  expect(seen.filter((line) => line.includes(INCOME))).toEqual([]);
  expect(seen.filter((line) => line.includes(EVENT))).toEqual([]);
  expect(page.url()).not.toContain(INCOME);
});

test('R225: the confirmation state is on the rendered page once the server answers', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);
  await page.locator('#date-evenement').fill(EVENT);
  await page.getByLabel(RAPPEL_FORM_COPY.label).fill(`rappel-etat-${seq}@monreleve.test`);
  await page.getByRole('button', { name: RAPPEL_FORM_COPY.submit }).click();

  const sent = page.locator('[data-reminder-sent]');

  await expect(sent).toBeVisible();
  expect(await sent.textContent()).toBe(RAPPEL_COPY.answers.ok);
  await expect(sent).toHaveAttribute('role', 'status');
  await expect(page.locator('[data-reminder-form]')).toHaveCount(0);
});

test('an address the server refuses is named on the field, and nothing is confirmed', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);
  await page.locator('#date-evenement').fill(EVENT);
  await page.getByLabel(RAPPEL_FORM_COPY.label).fill('pas-une-adresse');
  await page.getByRole('button', { name: RAPPEL_FORM_COPY.submit }).click();

  const field = page.getByLabel(RAPPEL_FORM_COPY.label);

  await expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(await page.locator('[data-reminder-form] [role="alert"]').first().textContent()).toContain(
    RAPPEL_COPY.answers.invalid,
  );
  await expect(page.locator('[data-reminder-sent]')).toHaveCount(0);
});

test('a link lands on the comparator with its outcome revealed, and only that one', async ({ page }) => {
  await page.goto(`${COMPARATOR_PATH}#${landingFragment(LANDING_STATES.confirmed)}`);

  const shown = page.locator(`#${landingFragment(LANDING_STATES.confirmed)}`);

  await expect(shown).toBeVisible();
  expect(await shown.textContent()).toContain(RAPPEL_COPY.outcomes.confirmed.heading);
  await expect(page.locator('[data-rappel-outcome]:visible')).toHaveCount(1);
});

test('the confirm route itself lands there: an unknown token reveals "no longer valid"', async ({ page }) => {
  await page.goto(`/api/rappel-delai/confirm?token=${'0'.repeat(64)}`);

  await expect(page).toHaveURL(new RegExp(`${COMPARATOR_PATH}#${landingFragment(LANDING_STATES.unknown)}$`, 'u'));
  await expect(page.locator(`#${landingFragment(LANDING_STATES.unknown)}`)).toBeVisible();
  await expect(page.locator('[data-rappel-outcome]:visible')).toHaveCount(1);
});

test('R1002: the delete link opens a page with one button posting the token, and opening it deletes nothing', async ({
  page,
}) => {
  const token = 'd'.repeat(64);
  const response = await page.goto(`${DELETE_PATH}?token=${token}`);

  expect(response?.status()).toBe(200);

  const form = page.locator('form[method="post"]');

  await expect(form).toHaveCount(1);
  await expect(form).toHaveAttribute('action', DELETE_ENDPOINT);
  await expect(form.locator('input[type="hidden"][name="token"]')).toHaveValue(token);
  await expect(form.locator('button')).toHaveCount(1);

  // Opening it changed nothing a browser can see: the page is still there,
  // and no outcome is on it. The row itself is asserted in tests/db.
  await page.reload();
  await expect(form.getByRole('button', { name: RAPPEL_COPY.deletePage.button })).toBeVisible();
});

test('R1002: with JavaScript too, the button lands on the comparator with the outcome revealed', async ({ page }) => {
  await page.goto(`${DELETE_PATH}?token=${'e'.repeat(64)}`);
  await page.getByRole('button', { name: RAPPEL_COPY.deletePage.button }).click();

  const shown = page.locator(`#${landingFragment(LANDING_STATES.deleted)}`);

  await expect(shown).toBeVisible();
  await expect(shown).toContainText(RAPPEL_COPY.outcomes.deleted.heading);
});

test('no outcome is shown on a plain visit', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);

  await expect(page.locator('[data-rappel-outcome]')).toHaveCount(Object.keys(LANDING_STATES).length);
  await expect(page.locator('[data-rappel-outcome]:visible')).toHaveCount(0);
  // The helper's own warning, by key, is untouched by the form.
  expect(await page.locator('[data-deadline-warning]').textContent()).toBe(LAMAL_COPY.deadline.warning);
});
