// web/e2e/mon-releve.spec.ts
//
// R906: THE ROUND TRIP IN A BROWSER, WITH SCRIPTING ON. FW-WEB-ACCOUNT.
//
// The header's "Se connecter" -> the address -> the code -> the page with the
// year's figures -> the CSV and the PDF downloaded (bytes non-empty, types
// right) -> sign-out -> the cookie gone and the page refused. Every hop is the
// real route handler behind the real form.
//
// THE SEAM (e2e/support/database.ts): the code typed is minted into the same
// database after the form asked for one, because the server's outbox is not
// reachable from here and no HTTP surface returns a code. The mailed code is
// proven in-process by tests/db/web-round-trip.test.ts.
//
// THE PDF IS RENDERED BY THE SERVER UNDER TEST (Chromium through
// lib/export/respond-pdf.ts), so this spec is also the browser-level proof that the
// account path reaches the same renderer as /api/v1/export/pdf.

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { APP_NAME } from '../lib/fr';
import { MON_RELEVE_COPY } from '../lib/fr/mon-releve';
import { SHELL_COPY } from '../lib/fr/shell';
import { ACCOUNT_PATHS } from '../lib/web-account/paths';
import { SESSION_COOKIE } from '../lib/web-account/cookie';
import { currentTaxYear } from '../lib/content/tax-year';
import { accountYears } from '../lib/web-account/year';
import { e2eDatabase, e2ePrisma, mintCode, uniqueAddress } from './support/database';

const database = e2eDatabase();

test.describe('R906: the account round trip, scripting on', () => {
  test.skip(!database.ok, database.ok ? '' : database.reason);

  let email = '';

  // Web Ruling 32: the page shows the current tax year and the one before. The
  // day is recorded in the one before, so it is in the past whatever the date,
  // and the year is read from its source (R171).
  const [current, year] = accountYears(currentTaxYear());

  test.beforeEach(async () => {
    email = uniqueAddress('js');

    const prisma = await e2ePrisma();
    const user = await prisma.user.create({
      data: { email, name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    });
    await prisma.entry.create({
      data: {
        userId: user.id,
        dayDate: new Date(`${String(year)}-01-05T00:00:00.000Z`),
        portion: 'FULL',
        kind: 'HOME',
        clientMutationId: crypto.randomUUID(),
      },
    });
  });

  test.afterEach(async () => {
    const prisma = await e2ePrisma();

    await prisma.user.deleteMany({ where: { email } });
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  });

  test('header link -> code -> figures -> CSV and PDF -> sign-out', async ({ page, context }) => {
    test.setTimeout(120_000);

    await page.goto('/');
    await page.getByRole('link', { name: SHELL_COPY.signIn }).first().click();
    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.signIn);

    await page.getByLabel(MON_RELEVE_COPY.signIn.emailLabel).fill(email);
    await page.getByRole('button', { name: MON_RELEVE_COPY.signIn.submit }).click();
    await expect(page).toHaveURL((url) => url.pathname === ACCOUNT_PATHS.code);
    await page.getByLabel(MON_RELEVE_COPY.code.codeLabel).fill(await mintCode(email));
    await page.getByRole('button', { name: MON_RELEVE_COPY.code.submit }).click();

    await expect(page).toHaveURL((url) => url.pathname === ACCOUNT_PATHS.home);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
    // Both years, no selector (Web Ruling 32): one section each, newest first.
    await expect(page.locator('section[data-year]')).toHaveCount(2);
    expect(await page.locator('section[data-year]').evaluateAll((sections) => sections.map((section) => section.getAttribute('data-year')))).toEqual([String(current), String(year)]);
    await expect(page.locator('[data-figure="declarableRate"]').first()).toBeVisible();
    expect((await context.cookies()).map((cookie) => cookie.name)).toEqual([SESSION_COOKIE.name]);

    // The CSV.
    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: MON_RELEVE_COPY.page.downloadCsv(year) }).click(),
    ]);
    const csvBytes = readFileSync(String(await csv.path()));

    expect(csv.suggestedFilename()).toMatch(/\.csv$/u);
    expect(csvBytes.length).toBeGreaterThan(0);

    // The PDF, rendered by the server's Chromium through the shared pipeline.
    const [pdf] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      page.getByRole('button', { name: MON_RELEVE_COPY.page.downloadPdf(year) }).click(),
    ]);
    const pdfBytes = readFileSync(String(await pdf.path()));

    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/u);
    expect(pdfBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    // Sign-out: the cookie gone, the page refused.
    await page.getByRole('button', { name: MON_RELEVE_COPY.page.signOut }).click();
    await expect(page.getByText(MON_RELEVE_COPY.states.deconnecte)).toBeVisible();
    expect(await context.cookies()).toEqual([]);

    await page.goto(ACCOUNT_PATHS.home);
    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.signIn);
  });
});
