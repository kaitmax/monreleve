// web/e2e/mon-releve.nojs.spec.ts
//
// THE ACCOUNT AREA WITH SCRIPTING OFF. FW-WEB-ACCOUNT (R346, R899-R902, R906).
//
// The two sign-in steps and sign-out are plain <form method="post">s answered
// by 303s, so the whole journey must work with JavaScript disabled - this
// project runs with it disabled. It also holds R900's RUNTIME half, presence
// first (R169's corollary):
//
//   1. the browser STORES the cookie (Secure on http://localhost included),
//      with exactly the stated attributes;
//   2. a request to the account area CARRIES it;
//   3. then, and only then: no public route's request carries it, and no
//      public response sets one.
//
// The code typed is minted into the same database after the real form asked
// for one - see e2e/support/database.ts for the seam and where the mailed
// code is proven instead.

import { expect, test } from '@playwright/test';
import { APP_NAME } from '../lib/fr';
import { MON_RELEVE_COPY } from '../lib/fr/mon-releve';
import { visibleRoutes } from '../lib/content/routes';
import { ACCOUNT_PATHS } from '../lib/web-account/paths';
import { SESSION_COOKIE } from '../lib/web-account/cookie';
import { e2eDatabase, e2ePrisma, mintCode, uniqueAddress } from './support/database';

const database = e2eDatabase();

test.describe('the account area without JavaScript', () => {
  test.skip(!database.ok, database.ok ? '' : database.reason);

  let email = '';

  test.beforeEach(async () => {
    email = uniqueAddress('nojs');

    const prisma = await e2ePrisma();

    await prisma.user.create({ data: { email, name: 'Camille Rey', canton: 'GE', employmentRate: 100 } });
  });

  test.afterEach(async () => {
    const prisma = await e2ePrisma();

    await prisma.user.deleteMany({ where: { email } });
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  });

  test('signs in by code, holds one cookie, and signs out', async ({ page, context }) => {
    // Signed out, the page is not shown: the area sends the reader to step one.
    const first = await page.goto(ACCOUNT_PATHS.home);

    expect(first?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.signIn);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(MON_RELEVE_COPY.signIn.title);

    // Step one: the address, posted by the browser's own form.
    await page.getByLabel(MON_RELEVE_COPY.signIn.emailLabel).fill(email);
    await page.getByRole('button', { name: MON_RELEVE_COPY.signIn.submit }).click();

    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.code);
    expect(page.url(), 'the address must not travel in clear').not.toContain('monreleve.test');
    await expect(page.getByText(MON_RELEVE_COPY.code.requested(email))).toBeVisible();
    expect(await context.cookies(), 'step one must not set a cookie').toEqual([]);

    // Step two: the code.
    await page.getByLabel(MON_RELEVE_COPY.code.codeLabel).fill(await mintCode(email));
    await page.getByRole('button', { name: MON_RELEVE_COPY.code.submit }).click();

    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.home);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);

    // 1. STORED, with exactly the stated attributes.
    const cookies = await context.cookies();

    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: SESSION_COOKIE.name,
      path: SESSION_COOKIE.path,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });
    // Host-only: no leading dot, the host the page was served from.
    expect(cookies[0]?.domain).toBe(new URL(page.url()).hostname);

    // Sign-out, by the page's own form.
    await page.getByRole('button', { name: MON_RELEVE_COPY.page.signOut }).click();

    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.signIn);
    await expect(page.getByText(MON_RELEVE_COPY.states.deconnecte)).toBeVisible();
    expect(await context.cookies(), 'sign-out must remove the cookie').toEqual([]);

    // And the page is refused again.
    await page.goto(ACCOUNT_PATHS.home);
    expect(new URL(page.url()).pathname).toBe(ACCOUNT_PATHS.signIn);
  });

  test('R900: the cookie reaches the account area and no public route', async ({ page }) => {
    await page.goto(ACCOUNT_PATHS.signIn);
    await page.getByLabel(MON_RELEVE_COPY.signIn.emailLabel).fill(email);
    await page.getByRole('button', { name: MON_RELEVE_COPY.signIn.submit }).click();
    await page.getByLabel(MON_RELEVE_COPY.code.codeLabel).fill(await mintCode(email));
    await page.getByRole('button', { name: MON_RELEVE_COPY.code.submit }).click();

    // 2. PRESENCE FIRST: a request to the area carries it.
    const own = await page.goto(ACCOUNT_PATHS.home);
    const ownHeaders = (await own?.request().allHeaders()) ?? {};

    expect(ownHeaders.cookie ?? '', 'the account page request did not carry the cookie').toContain(
      `${SESSION_COOKIE.name}=`,
    );

    // 3. Then every public route the registry shows a reader.
    const routes = visibleRoutes().map((route) => route.path);

    expect(routes.length).toBeGreaterThanOrEqual(8);

    for (const route of routes) {
      const response = await page.goto(route);

      expect(response?.status(), `${route} did not serve`).toBe(200);

      const sent = (await response?.request().allHeaders()) ?? {};

      expect(sent.cookie, `${route} was sent the account cookie`).toBeUndefined();
      expect(await response?.headerValue('set-cookie'), `${route} set a cookie`).toBeNull();
    }
  });
});
