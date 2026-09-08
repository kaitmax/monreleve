// web/e2e/composants.visual.spec.ts
//
// FW8 increment 5: a screenshot baseline per component per state.
//
// RUNS ONLY IN THE CONTAINER (ruling R37). playwright.config.ts puts these in
// their own `visual` project, which `pnpm test:e2e` excludes; `pnpm
// test:visual` runs them inside mcr.microsoft.com/playwright pinned to the
// installed version. A baseline made against one font stack and compared
// against another fails as a MISSING FILE rather than as a diff - and then
// passes on the next run by comparing that file against itself, which is a
// green that means nothing.
//
// THE RAIL IS NOT HERE. e2e/rail.visual.spec.ts already holds ten baselines
// over the full variant x zone matrix, taken in the container against
// app/dev/rail-gallery, including the `social` variant the workbench has no
// reason to show. Re-baselining the same pixels from a second page would
// double the maintenance and halve the meaning of a diff - two files to
// update, and a reviewer left asking which one is the contract. The rail
// appears on the workbench for the axe sweep and for human review.
//
// Taken through the real cascade, in a page, for the reason the rail spec
// records: the colours and type are var() references, and an undefined custom
// property renders black at 16 px Times - identically for every state, so a
// set of baselines taken without the token layer would all pass and all be
// wrong.

import { expect, test } from '@playwright/test';

// The four components whose screenshot contract lives on this page, each with
// every state the workbench renders. The ids are the contract with
// app/dev/composants/page.tsx.
const SPECIMENS = [
  'badge-compliant',
  'badge-mission',
  'badge-regime',
  'badge-social',
  'rate-compliant',
  'rate-exposure',
  'rate-social',
  'rate-divergent',
  'metric-positive',
  'metric-negative',
  'legal-standing',
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/composants');
  // The fonts must be loaded before anything is captured, or the first
  // screenshot is taken mid-swap and the baseline bakes in a fallback face.
  await page.evaluate(() => document.fonts.ready);
});

for (const specimen of SPECIMENS) {
  test(specimen, async ({ page }) => {
    await expect(page.getByTestId(specimen)).toHaveScreenshot(`composants-${specimen}.png`);
  });
}

test('the four badge states are visually distinct, not four identical chips', async ({ page }) => {
  // The failure the baselines cannot catch: an undefined custom property
  // renders BLACK rather than as nothing, and identically everywhere. Four
  // baselines of four identical chips would all pass and all be wrong.
  //
  // SPEC section 12 caps the palette at three status colours for four
  // statuses, so regime-lost and social-switch necessarily SHARE
  // --colour-error. Requiring four distinct fills would therefore be wrong -
  // three is the correct answer, and the fourth axis is the glyph, which is
  // why the icon names are asserted to be distinct too.
  const chips = await page.evaluate(() => {
    const read = (id: string) => {
      const host = document.querySelector(`[data-testid="${id}"]`);
      const chip = host?.querySelector('[data-status]');
      const icon = host?.querySelector('svg');

      return {
        fill: chip ? getComputedStyle(chip).backgroundColor : '',
        // The path data is the glyph's identity: two Lucide icons with the
        // same outline would be the failure this is looking for.
        glyph: icon?.innerHTML ?? '',
      };
    };

    return ['badge-compliant', 'badge-mission', 'badge-regime', 'badge-social'].map(read);
  });

  expect(new Set(chips.map((chip) => chip.fill)).size).toBe(3);
  expect(new Set(chips.map((chip) => chip.glyph)).size).toBe(4);

  for (const chip of chips) {
    expect(chip.fill).not.toBe('rgb(0, 0, 0)');
    expect(chip.fill).toMatch(/^rgb/);
    expect(chip.glyph).not.toBe('');
  }
});

test('the negative metric shows no minus sign in the rendered text', async ({ page }) => {
  // The unit test asserts this on the markup; this asserts it on what the
  // browser actually laid out, which is where a CSS content rule or a font
  // ligature could still have reintroduced one.
  //
  // SCOPED TO THE FIGURE, and the first version was not. Reading the whole
  // specimen made this fail on a correct page, because the label that REPLACES
  // the original - "Jours au-dessus du seuil" - contains a hyphen, and so does
  // any French text that happens to be compound. The claim was never "this
  // card contains no hyphen"; it is "the number carries no sign".
  const figure = page.getByTestId('metric-negative').locator('[data-negative="true"]');

  await expect(figure).toBeVisible();

  const rendered = await figure.innerText();

  expect(rendered).not.toContain(String.fromCharCode(45));
  expect(rendered).not.toContain(String.fromCharCode(0x2212));
  expect(rendered.trim()).toBe('6');
});
