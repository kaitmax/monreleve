// web/e2e/calculateur.nojs.spec.ts
//
// SPEC 9.3 asks the calculator PAGE to be meaningful without JavaScript -
// not the calculation. The result is a client island and says so: with
// scripting off a shared link carries no figures, and the page shows its
// empty state rather than a default that is not the sender's scenario. The
// alert sign-up is the opposite case - a real POST form that works outright.
//
// MOVED HERE BY FW-FORECAST'S INCREMENT 0 (R346). These assertions lived
// beside their JavaScript-enabled neighbours, and each turned scripting off
// for itself - some by test.use, some by building a context by hand. The
// policy now belongs to the nojs PROJECT, which is the only thing that
// collects this file, so nothing here configures scripting. The assertions
// are unchanged; only the way the page is obtained is.

import { expect, test } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';
import { currentTaxYear } from '../lib/content/tax-year';
import { CALCULATEUR_COPY } from '../lib/fr/calculateur';
import { ALERTES_COPY } from '../lib/fr/alertes';
import { ruleSetFor } from '../lib/calc-engine';
import { formatPercent } from '../lib/ui/core';

const YEAR = currentTaxYear();
const RULES = ruleSetFor(YEAR);

const ceiling = (rate: number): string => {
  const percent = rate * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
};

const FISCAL = ceiling(RULES.fiscalCeiling);
const SOCIAL = ceiling(RULES.socialCeiling);
const GENEVA_C_URL = `${CALCULATOR_PATH}?canton=GE&tt=84&mfr=24&decompte=dj`;
const NBSP = String.fromCharCode(0x00a0);

test.describe('with JavaScript disabled (AC3)', () => {
  test('the page is meaningful: heading, intro, all three paragraphs', async ({ page }) => {
    const response = await page.goto(CALCULATOR_PATH);

    expect(response?.status()).toBe(200);

    // BY textContent, not toContainText: the copy carries U+00A0 before its
    // punctuation (R91) and Playwright's text matchers normalise both sides,
    // so they could not tell a no-break space from a plain one. R71.
    const body = (await page.locator('main').textContent()) ?? '';

    expect(body).toContain(CALCULATEUR_COPY.title);
    expect(body).toContain(CALCULATEUR_COPY.intro(FISCAL, SOCIAL));
    expect(body).toContain(CALCULATEUR_COPY.fiscal(FISCAL));
    expect(body).toContain(CALCULATEUR_COPY.social(SOCIAL));
    expect(body).toContain(CALCULATEUR_COPY.missions(FISCAL));
  });

  test('never a blank shell - the copy is in the SERVED html', async ({ page }) => {
    // The distinction that matters. Without scripting there is no hydration,
    // so anything present here was rendered on the server. A page that
    // rendered its copy on the client would pass every jsdom test and fail
    // this one.
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main.length).toBeGreaterThan(400);
    expect(await page.locator('h1').count()).toBe(1);
  });

  test('shows the tax year (R55), resolved on the server', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    const main = (await page.locator('main').textContent()) ?? '';

    // R154: the year itself, then the sentence around it. See the unit
    // test of the same name for why the second alone proves nothing.
    expect(main).toContain(String(YEAR));
    expect(main).toContain(CALCULATEUR_COPY.yearCaption(YEAR));
  });

  test('renders the form, so the page is not a wall of prose', async ({ page }) => {
    // AC3's second clause: "the page shows the full explanatory copy, THE
    // FORM, and no result". With scripting off the island never hydrates, but
    // it is a Server Component render first - so the controls are in the
    // served HTML and a user can at least see what the tool asks for.
    await page.goto(CALCULATOR_PATH);

    for (const label of [
      CALCULATEUR_COPY.form.canton.label,
      CALCULATEUR_COPY.form.rate.label,
      CALCULATEUR_COPY.form.days.label,
    ]) {
      await expect(page.getByText(label, { exact: true }), label).toBeVisible();
    }
  });

  test('renders NO result, only the invitation to start one', async ({ page }) => {
    // AC3's third clause, and it CHANGED SHAPE at increment 4. This asserted
    // that no aria-live region existed at all, which was right when there was
    // no form: an empty live region announces nothing on every navigation.
    //
    // Now the region has a job, so the requirement is the one AC3 actually
    // states - no RESULT - and the region says why rather than sitting empty.
    // Scoped to the region because the explanatory copy below it legitimately
    // contains the ceiling as a percentage.
    await page.goto(CALCULATOR_PATH);

    // TWO REGIONS SINCE FW13, AND BOTH ARE NAMED. This counted every
    // [aria-live] on the page and expected one; increment 4 added the share
    // row’s confirmation and it became two. The count is not loosened to a
    // presence check - two polite regions is a decision, three would be an
    // accident - so each is identified by what it is.
    //
    // Unscoped here on purpose: with scripting off, Next's route announcer
    // never mounts, so this page really does carry exactly these two.
    const region = page.locator('#resultat');
    const shareStatus = page.locator('[data-share-status]');

    await expect(page.locator('[aria-live]')).toHaveCount(2);
    await expect(region).toHaveCount(1);
    await expect(shareStatus).toHaveCount(1);

    // The share row has announced nothing, because nothing has happened.
    expect((await shareStatus.textContent()) ?? '').toBe('');

    // textContent, not toHaveText: the note is compared by codepoint and
    // Playwright's text matchers normalise both sides (R66/R71).
    const text = (await region.textContent()) ?? '';

    expect(text).toBe(CALCULATEUR_COPY.result.empty);
    expect(text).not.toContain('%');
  });

  test('the shell is still there, so the page is navigable', async ({ page }) => {
    await page.goto(CALCULATOR_PATH);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});

test.describe('with JavaScript disabled, a link carries no result (FW13)', () => {
  test('shows the empty state, not a wrong answer', async ({ page }) => {
    // THE COST OF THE RULING, AND SINCE R351 IT IS NO LONGER PAID BY THE
    // READER. The island reads the URL on mount, so with no scripting this
    // page has no prefill and says so rather than showing a default
    // calculation that is not the sender's scenario. That has not changed
    // and this assertion is unchanged with it: the calculator is static by
    // FW13's measured ruling and must stay that way.
    //
    // WHAT CHANGED IS WHERE THE ANSWER LIVES. The form on this page now
    // submits by GET to /calculateur-teletravail-frontalier/resultat, which
    // computes the same figures on the server from the same codec and the
    // same engine. So "no result HERE" is a statement about this route
    // rather than about the product, and e2e/resultat.nojs.spec.ts asserts
    // the other half - a real 39,16 % with scripting off. Neither file
    // states the arrangement on its own.
    await page.goto(GENEVA_C_URL);

    const main = (await page.locator('main').textContent()) ?? '';

    expect(main).not.toContain(`39,16${NBSP}%`);
    expect(main).toContain(CALCULATEUR_COPY.result.empty);
    expect(main).toContain(CALCULATEUR_COPY.fiscal(FISCAL));
  });
});

  test('shows the error without JavaScript, which is why it is CSS', async ({ page }) => {
    // THE CASE THAT DECIDED THE MECHANISM. An island-rendered status would
    // leave this reader with no message at all: they mistype an address, the
    // form posts, and the page comes back looking untouched.

    await page.goto(CALCULATOR_PATH);

    await page.getByLabel(ALERTES_COPY.emailLabel).fill('pas-une-adresse');
    await page.getByRole('button', { name: ALERTES_COPY.submit }).click();

    // Revealed by :target, with no scripting anywhere.
    await expect(page.locator('#alerte-adresse-invalide')).toBeVisible();
    await expect(page.locator('#alerte-ok')).toBeHidden();
  });

  test('accepts a subscription without JavaScript', async ({ page }) => {

    await page.goto(CALCULATOR_PATH);

    await page.getByLabel(ALERTES_COPY.emailLabel).fill('sans-js@example.com');
    await page.getByRole('button', { name: ALERTES_COPY.submit }).click();

    await expect(page.locator('#alerte-ok')).toBeVisible();

    // ONE MESSAGE, NOT SIX. Every status is in the DOM; exactly one is shown.
    const shown = await page.evaluate(
      () =>
        [...document.querySelectorAll('[role="status"][id^="alerte-"]')].filter(
          (node) => getComputedStyle(node).display !== 'none',
        ).length,
    );

    expect(shown).toBe(1);
  });
