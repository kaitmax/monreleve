// web/e2e/composants.spec.ts
//
// The claims about the workbench that only a real browser can settle
// (ruling R61: assertions go in the environment that can actually answer
// them). Everything here reads a COMPUTED value. jsdom would return the
// literal "var(--colour-warning)" and the declaration text, proving that the
// stylesheet says something rather than that the browser did it.
//
// AC3: "RateDisplay shows no numeric jitter: font-feature-settings includes
// tnum." Jitter is what happens when 1 and 7 have different advance widths
// and a figure changes width as it counts up. The unit suite asserts the
// DECLARATION exists; this asserts the browser applied it.

import { expect, test } from '@playwright/test';
import { goToServedPage } from './support/served';
import { ctaHrefIfLive } from '../lib/content/routes';
import { SHELL_COPY } from '../lib/fr/shell';

// #B7791F, the warning token, as Chromium serialises a computed colour.
const WARNING_RGB = 'rgb(183, 121, 31)';

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/composants');
});

test('every figure is set in tabular numerals (AC3)', async ({ page }) => {
  // Both rates in the divergent specimen: the Display figure and the H3
  // beneath it. The second is the one a careless implementation misses,
  // because it is added later and inherits nothing.
  const paragraphs = page.getByTestId('rate-divergent').locator('p');

  for (const index of [0, 2]) {
    const applied = await paragraphs.nth(index).evaluate((node) => {
      const style = getComputedStyle(node);

      return {
        features: style.fontFeatureSettings,
        variant: style.fontVariantNumeric,
      };
    });

    expect(applied.features).toContain('tnum');
    expect(applied.variant).toContain('tabular-nums');
  }
});

test('the warning band carries its colour at Display size, and only there (R57)', async ({
  page,
}) => {
  // The measured basis: #B7791F is 3,43:1 on the canvas, below the 4,5 AA
  // wants for normal text, but above the 3,0 bar for large text. Display
  // 48/600 is large; the ZoneBadge chip label at 15/500 is not, which is why
  // that one is text-primary instead. This asserts the exception is taken
  // where it is legal.
  const rate = page.getByTestId('rate-exposure').locator('p').first();
  const style = await rate.evaluate((node) => {
    const computed = getComputedStyle(node);

    return {
      colour: computed.color,
      size: Number.parseFloat(computed.fontSize),
      weight: computed.fontWeight,
    };
  });

  expect(style.colour).toBe(WARNING_RGB);

  // WCAG's large-text threshold is 18,66 px bold or 24 px otherwise. Asserted
  // rather than assumed, because the exception above is only sound while this
  // stays true - shrink the Display token and the colour becomes a violation
  // with nothing else to notice it.
  expect(style.size).toBeGreaterThanOrEqual(24);
  expect(Number(style.weight)).toBeGreaterThanOrEqual(600);
});

// ---------------------------------------------------------------------------
// AC2: the keyboard path through the mobile header, at 360 px.
//
// THIS IS WHERE THE Tab CLAIM LIVES, and it cannot live anywhere else. The
// unit tests assert aria-expanded, Escape and focus return - all of which
// fireEvent can drive - but they cannot assert TRAVERSAL:
// @testing-library/user-event is not a dependency (adding one is ask-first),
// fireEvent cannot simulate Tab at all, and jsdom has no layout, so it could
// not answer what is reachable even if it could press the key.
//
// A real browser at a real viewport can. 360 x 800 is tasks/plan.md's
// reference device, and it is below the 768 breakpoint, so the hamburger is
// the header the test meets.
// ---------------------------------------------------------------------------

test.describe('the mobile header keyboard path (AC2)', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/composants');
    await page.evaluate(() => document.fonts.ready);
  });

  const shell = (page: import('@playwright/test').Page) => page.getByTestId('shell-desktop');

  test('Tab reaches the trigger, and the CTA when there is one', async ({ page }) => {
    // The CTA is OUTSIDE the panel, so it must be reachable while the menu is
    // shut. That is the requirement most easily lost in a mobile layout.
    //
    // RULING R85 MADE THE BUTTON CONDITIONAL, so the assertion is too: while
    // /application is only planned the header renders no CTA at all, and a
    // test that simply stopped looking for it would be indistinguishable from
    // one where the CTA had fallen inside the mobile panel - the exact
    // regression this test exists to catch. So the absence is asserted
    // together with its REASON.
    const trigger = shell(page).getByRole('button', { name: 'Ouvrir le menu' });
    const cta = shell(page).getByRole('link', { name: 'Suivre mes jours' });

    await expect(trigger).toBeVisible();

    if (ctaHrefIfLive(SHELL_COPY.ctaHref) === null) {
      await expect(cta).toHaveCount(0);
    } else {
      await expect(cta).toBeVisible();
    }

    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Forward from the trigger: wordmark, then the CTA. The desktop nav is
    // display:none at this width, so its links must NOT be in the tab order -
    // a nav that is merely invisible is the keyboard trap this whole component
    // is guarded against.
    const reached: string[] = [];

    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press('Tab');
      reached.push(
        await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '(none)'),
      );
    }

    // The wordmark is always in the path; the CTA only when it exists.
    expect(reached.join(' | ')).toContain('frontalier');

    if (ctaHrefIfLive(SHELL_COPY.ctaHref) !== null) {
      expect(reached.join(' | ')).toContain('Suivre mes jours');
    }
  });

  test('the collapsed desktop nav is NOT in the tab order', async ({ page }) => {
    // display:none, not visibility:hidden - asserted through the browser,
    // which is the only place the difference is real.
    //
    // SCOPED TO THE NAV, AND exact. Playwright matches an accessible name as
    // a case-insensitive SUBSTRING by default - unlike Testing Library, which
    // matches the whole string - so { name: "Guides" } also matched the
    // footer link "Tous les guides", which is correctly visible. The first
    // version of this test failed against a correct page for that reason.
    // Another matching asymmetry to keep beside R71.
    const nav = shell(page).getByRole('navigation', { name: 'Navigation principale' });

    await expect(nav.getByRole('link', { name: 'Guides', exact: true })).toBeHidden();
  });

  test('Escape closes the panel and returns focus to the trigger', async ({ page }) => {
    const trigger = shell(page).getByRole('button', { name: 'Ouvrir le menu' });

    await trigger.click();

    const open = shell(page).getByRole('button', { name: 'Fermer le menu' });

    await expect(open).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');

    await expect(shell(page).getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(shell(page).getByRole('button', { name: 'Ouvrir le menu' })).toBeFocused();
  });

  test('every panel link is reachable and at least 44 px tall', async ({ page }) => {
    // SPEC 16 and FD2 both require it of anything tappable, and a real browser
    // is the only place a box can be measured.
    await shell(page).getByRole('button', { name: 'Ouvrir le menu' }).click();

    const panel = shell(page).locator('[data-mobile-panel]');
    const links = panel.getByRole('link');
    const count = await links.count();

    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox();

      expect(box?.height ?? 0, `panel link ${index} is under 44 px`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('no horizontal scroll at the narrowest supported width', () => {
  // SPEC 16: "Verified at 320px with no horizontal scroll." The prompt tests
  // the keyboard path at 360, which is plan.md's reference device - these are
  // DIFFERENT claims and only one of them was in the prompt. Added because
  // 320 is the one the spec actually states, and nothing else was checking it.
  //
  // AGAINST A PRODUCT PAGE, NOT THE WORKBENCH. Pointed at /dev/composants
  // first, it failed with 114 px of overflow - correctly: the workbench shows
  // a rail specimen fixed at 376 px, which is wider than a 320 px viewport by
  // design. SPEC 16 is a claim about pages a reader visits, and measuring it
  // on a dev harness would either report a defect that is not one or force
  // the harness to distort the specimens it exists to show.
  test.use({ viewport: { width: 320, height: 800 } });

  test('the document does not scroll sideways at 320 px', async ({ page }) => {
    await goToServedPage(page, '/');
    await page.evaluate(() => document.fonts.ready);

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;

      return root.scrollWidth - root.clientWidth;
    });

    expect(overflow, 'the page scrolls horizontally at 320 px').toBeLessThanOrEqual(0);
  });

  test('at 360 px the header row still clears the gutter, per FD2', async ({ page }) => {
    // FD2:7 states the constraint the briefs actually make: the layout "must
    // also hold at 360 px, so nothing sits within 8 px of a gutter". Nothing
    // was checking it, and the header is where it bites - a 44 px tap target,
    // a wordmark and an always-visible CTA on one 56 px row.
    //
    // BOTH WIDTHS ARE ASSERTED because they are different claims. 320 is
    // SPEC 16's and asks only that the page not scroll sideways; 360 is FD2's
    // and asks for breathing room. Fixing the 320 overflow by compressing the
    // row could have eaten the 360 margin, and only this test would notice.
    await page.setViewportSize({ width: 360, height: 800 });
    await goToServedPage(page, '/');
    await page.evaluate(() => document.fonts.ready);

    // MEASURED ON THE LAST THING IN THE ROW, whatever that is. R85 removed the
    // CTA while /application is planned, and FD2's claim is about the ROW, not
    // about one button: nothing may sit within 8 px of the gutter. So this
    // measures the rightmost element of the header bar - the CTA when it is
    // there, the wordmark when it is not - which keeps the assertion true in
    // both states instead of deleting a constraint the brief actually makes.
    const clearance = await page.evaluate(() => {
      const bar = document.querySelector('header > div');

      if (bar === null) throw new Error('no header bar to measure');

      const children = [...bar.children];

      if (children.length === 0) throw new Error('the header bar is empty');

      const rightmost = children
        .map((child) => child.getBoundingClientRect().right)
        .reduce((a, b) => Math.max(a, b), 0);

      return document.documentElement.clientWidth - rightmost;
    });

    expect(clearance, 'the header row sits inside FD2 8 px gutter margin').toBeGreaterThanOrEqual(8);
  });
});
