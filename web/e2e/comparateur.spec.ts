// web/e2e/comparateur.spec.ts
//
// /calculateur-lamal-cmu, driven in a real browser. FW-COMPARATEUR, R658.
//
// What is asserted here and nowhere else: the result as a reader gets it
// from the served page - two sides, three Swiss figures, the banner above the
// result, the converted figures beside their rate and date - and that the
// income typed reaches no request, no URL and no analytics payload while a
// comparison happens (with a positive control, as in the nojs spec).

import { expect, test } from '@playwright/test';
import { COMPARATOR_PATH } from '../lib/content/routes';
import { LAMAL_COPY } from '../lib/fr/lamal';
import { formatDate } from '../lib/ui/core';
import { formatRate } from '../lib/lamal/format';
import { DEFAULT_YEAR, EXCHANGE_RATE } from '../lib/lamal/years';

const INCOME = '73519';

async function fillHousehold(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#revenu-fiscal').fill(INCOME);
  await page.locator('#naissance-0').fill('1985');
  await page.getByRole('button', { name: LAMAL_COPY.form.persons.add }).click();
  await page.locator('#naissance-1').fill('2016');
}

test('compares the household: both sides, three Swiss figures, the banner above the result', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);
  await fillHousehold(page);
  await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();

  const panel = page.locator('[data-panel="comparison"]');

  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toHaveText(LAMAL_COPY.result.heading(DEFAULT_YEAR));
  await expect(panel.locator('[data-side="switzerland"] dt')).toHaveCount(3);
  await expect(panel.locator('[data-side="france"] dt')).toHaveCount(1);

  // R673: never a converted figure without its rate and date - the line sits
  // in the same card as the euros.
  const conversion = (await panel.locator('[data-conversion]').textContent()) ?? '';

  expect(conversion).toContain(formatRate(EXCHANGE_RATE.chfPerEurTenThousandths));
  expect(conversion).toContain(formatDate(EXCHANGE_RATE.date));

  // R664: the attribution, with its link to the dataset - under both
  // columns since FW-CALC-REDESIGN's addendum (R1415), out of the rail.
  await expect(page.locator('[data-result-sources] [data-attribution] a')).toHaveAttribute(
    'href',
    'https://opendata.swiss/fr/dataset/health-insurance-premiums',
  );

  // SPEC 9.6 / R658: the banner is above the result (R137, by position).
  const banner = await page.locator('[data-banner="irrevocable"]').boundingBox();
  const result = await panel.boundingBox();

  expect(banner).not.toBeNull();
  expect(result).not.toBeNull();
  expect((banner?.y ?? 0) + (banner?.height ?? 0)).toBeLessThanOrEqual(result?.y ?? 0);
  expect(await page.locator('[data-banner="irrevocable"]').count()).toBe(1);
});

test('the income reaches no request and no URL while comparing - with the recorder shown to work', async ({
  page,
}) => {
  await page.goto(COMPARATOR_PATH);

  const seen: string[] = [];

  page.on('request', (request) => {
    seen.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`);
  });

  await fillHousehold(page);
  await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();
  await expect(page.locator('[data-panel="comparison"]')).toBeVisible();

  // THE POSITIVE CONTROL: a request this page makes on purpose, recorded by
  // the same listener. A reload is one the test controls.
  await page.reload();

  expect(seen.some((line) => line.includes(COMPARATOR_PATH))).toBe(true);
  expect(seen.filter((line) => line.includes(INCOME))).toEqual([]);
  expect(page.url()).not.toContain(INCOME);
});

test('the frontalier defaults to WITHOUT accident cover, everybody else to WITH it (R667)', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);
  await page.getByRole('button', { name: LAMAL_COPY.form.persons.add }).click();

  await expect(page.locator('#accidents-0')).not.toBeChecked();
  await expect(page.locator('#accidents-1')).toBeChecked();
});

test('a field error names the field and shows no result', async ({ page }) => {
  await page.goto(COMPARATOR_PATH);
  await page.locator('#revenu-fiscal').fill('42 000,50');
  await page.locator('#naissance-0').fill('1985');
  await page.getByRole('button', { name: LAMAL_COPY.form.submit }).click();

  // By textContent: the message carries U+202F, which text matchers normalise (R71).
  expect(await page.locator('[role="alert"]').first().textContent()).toContain(LAMAL_COPY.errors.income);
  await expect(page.locator('[data-panel]')).toHaveCount(0);
});
