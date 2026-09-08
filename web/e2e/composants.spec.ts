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
