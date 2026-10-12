// web/e2e/burger.spec.ts
//
// FW-SHELL-BURGER: the phone menu in the SHARED header, and the one claim no
// other suite can make - IT WORKS WITH JAVASCRIPT OFF.
//
// WHY THIS SUITE EXISTS AT ALL. FW9 built the phone menu as a React useState
// disclosure: the panel is `{menuOpen ? <div/> : null}`, so with scripting
// disabled the button is inert and the navigation is simply gone. Every
// existing check passed anyway, because jsdom runs the handler and Playwright's
// default context runs the script - the two environments that cannot see the
// defect. A `details`/`summary` disclosure is native browser behaviour and
// needs no script, which is what design/home's phone view draws.
//
// javaScriptEnabled: false IS THE WHOLE POINT, and it is a real reader state:
// a script that fails to load, a corporate proxy, a locked-down browser. The
// server still renders the markup, so the menu either works from the markup or
// it does not work at all.
//
// R169's corollary: presence before absence. Every test here establishes that
// the page served (goToServedPage refuses anything but a 200) and that the
// summary is there, before asserting anything about what opening it reveals.

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CALCULATOR_PATH } from '../lib/content/routes';
import { MENU_ACTION, SHELL_COPY } from '../lib/fr/shell';
import { goToServedPage } from './support/served';

/** FD2's reference phone, and the width the shell folds at. */
const PHONE = { width: 390, height: 844 };

// BY ELEMENT, NOT BY ROLE. A <summary> has no stable mapped ARIA role across
// engines - it is exposed as a disclosure triangle rather than a button - so
// getByRole('button') finds nothing even when the markup is correct. The
// accessible NAME is what matters here and it is asserted directly below.
const summary = (page: Page) => page.getByRole('banner').locator('summary');
const panel = (page: Page) => page.getByRole('banner').locator('[data-mobile-panel]');

test.describe('the phone menu with JavaScript OFF', () => {
  test.use({ viewport: PHONE, javaScriptEnabled: false });

  test('opens from the markup alone, and shows every destination', async ({ page }) => {
    await goToServedPage(page, '/');

    // PRESENCE FIRST. Without this, "the panel has no links" and "there is no
    // panel at all" are the same passing assertion (R169's corollary).
    await expect(summary(page)).toBeVisible();
    await expect(panel(page)).toBeHidden();

    await summary(page).click();

    await expect(panel(page)).toBeVisible();

    const labels = await panel(page)
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ''));

    // The desktop navigation's own destinations, in its own order, plus the
    // calculator action the prompt adds. Non-vacuity: a panel that rendered
    // nothing would satisfy a subset check.
    expect(labels.length).toBeGreaterThanOrEqual(5);
    expect(labels).toContain(MENU_ACTION.label);
  });

  test('every panel link is at least 44 px tall (D40)', async ({ page }) => {
    await goToServedPage(page, '/');
    await summary(page).click();

    const links = panel(page).getByRole('link');
    const count = await links.count();

    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox();

      expect(box?.height ?? 0, `panel link ${index} is under 44 px`).toBeGreaterThanOrEqual(44);
    }
  });

  test('the action leads to the calculator, and following it closes the menu', async ({ page }) => {
    await goToServedPage(page, '/');
    await summary(page).click();

    await panel(page).getByRole('link', { name: MENU_ACTION.label }).click();
    await page.waitForLoadState('load');

    expect(new URL(page.url()).pathname).toBe(CALCULATOR_PATH);
    // A fresh document renders the disclosure closed, so the menu does not
    // follow the reader to the next page. No script is involved.
    await expect(panel(page)).toBeHidden();
  });

  test('the summary carries an accessible name and a focus ring', async ({ page }) => {
    await goToServedPage(page, '/');

    // The name a screen reader announces, asserted on the element itself.
    await expect(summary(page)).toHaveAttribute('aria-label', SHELL_COPY.menuOpen);

    await summary(page).focus();
    await expect(summary(page)).toBeFocused();

    // READ WHILE IT IS ACTUALLY FOCUSED. getComputedStyle's second argument is
    // for pseudo-ELEMENTS, so passing ':focus-visible' silently returns the
    // resting style and the assertion would be about nothing (R154). Focused,
    // the engine's own ring is in the computed value.
    //
    // `outline: none` with nothing in its place is what this guards against -
    // FieldGroup writes exactly that for inputs, and copied onto a summary it
    // would leave a keyboard reader with no indication at all.
    const ring = await summary(page).evaluate((node) => {
      const style = getComputedStyle(node);

      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });

    expect(ring.outlineStyle, 'the focus ring is suppressed').not.toBe('none');
    expect(ring.outlineWidth).toBeGreaterThan(0);
  });

  test('the OPEN panel does not scroll the page sideways at the 320 floor (R127)', async ({
    page,
  }) => {
    // THE EXISTING 320 CHECKS NEVER OPEN IT. narrow.spec.ts, guides-narrow
    // and the composants overflow test all measure a page whose menu is shut,
    // so the panel - 300 px wide inside a 20 px gutter, with a min-width that
    // can only grow - has never been measured at the floor SPEC 16 states.
    // That is R175's unexamined space: two checks bounding the viewport from
    // either side and the widest element in the product between them.
    await page.setViewportSize({ width: 320, height: 800 });
    await goToServedPage(page, '/');

    await summary(page).click();
    await expect(panel(page)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow, 'the open menu makes the page scroll sideways at 320 dp').toBeLessThanOrEqual(
      0,
    );
  });

  test('above the breakpoint the menu is gone and the desktop navigation is back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goToServedPage(page, '/');

    await expect(summary(page)).toBeHidden();
    await expect(
      page.getByRole('banner').getByRole('navigation', { name: SHELL_COPY.navLabel }),
    ).toBeVisible();
  });
});
