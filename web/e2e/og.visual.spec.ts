// web/e2e/og.visual.spec.ts
//
// The social card is MADE here. This is not a picture of the card taken for
// review - it is the render the product ships, and scripts/og-sync.mjs copies
// it to public/opengraph-image.png.
//
// WHY THE CARD IS RENDERED BY A BROWSER. renderRailSvg returns a string whose
// every colour and type value is a var() reference, because an SVG attribute
// holding var() resolves under a cascade and degrades without one - fill goes
// BLACK, font-size goes 16 px, height goes to ZERO. The generator is right to
// be written that way, and it means the card has to be rasterised somewhere a
// cascade exists.
//
// next/og was measured first and cannot do it: rasterising the SVG as a
// nested <img> silently drops every <text> node (the bands and ticks paint,
// the product name and both tick labels vanish, and the PNG is byte-identical
// with or without a font passed to ImageResponse), and handing satori the
// elements inline fails loudly with "<text> nodes are not currently
// supported". Either way the card ships without words on it.
//
// A browser is also the renderer SPEC 6.3 already names for the other two
// outputs, so the card is not a second implementation of the rail. R37's
// container is what makes a browser deterministic here: one image, one font
// stack, one renderer, pinned to the installed Playwright version.
//
// THE FONT IS THE PRODUCT'S. public/fonts carries Inter as woff2, which is
// the format satori and resvg both refuse; here it is simply the font the
// page loads, which is the whole argument for rendering the card in the page.

import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { expectElementBaseline, pngSize } from './baseline';
import { SOCIAL_HEIGHT, SOCIAL_WIDTH } from '../lib/ui/core/rail/geometry';

const BASELINE = join(process.cwd(), 'tests', 'visual', 'baselines', 'og-card.png');

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/og');
  // Without this the first capture is taken mid-swap and the card bakes in a
  // fallback face - and unlike a colour, nobody reviewing the picture would
  // know which face was meant.
  await page.evaluate(() => document.fonts.ready);
});

test('R142 PRECONDITION: two captures of one card are byte-identical', async ({ page }) => {
  // BEFORE ANY OTHER ASSERTION ABOUT BYTES. e2e/og.spec.ts compares a
  // nine-param URL against a bare one and calls the result a privacy
  // property; that reading is only available if the card is deterministic for
  // ONE input first. Two byte arrays can differ for reasons with no privacy
  // content at all.
  //
  // A failure here is a rendering defect - a font that had not finished
  // loading, an animation, a subpixel-positioned element - and is fixed at
  // the cause. Never a tolerance, never a skip.
  const card = page.getByTestId('og-card');

  const first = await card.screenshot();
  const second = await card.screenshot();

  expect(
    first.equals(second),
    'The card is not deterministic within one page. Nothing downstream that ' +
      'compares its bytes means anything until this passes.',
  ).toBe(true);
});

test('the card matches the shipped baseline, at the social dimensions', async ({ page }) => {
  await expectElementBaseline(page.getByTestId('og-card'), 'og-card.png');

  // R128, exactly rather than as an inequality. The rail gallery's social
  // tiles are 1200 x 636: an inline-block host puts the SVG on a text
  // baseline and adds a descender row underneath. Six grey pixels along the
  // bottom edge of a social card is precisely the defect that ships because
  // nobody reads a picture's dimensions.
  const { width, height } = pngSize(BASELINE);

  expect(width).toBe(SOCIAL_WIDTH);
  expect(height).toBe(SOCIAL_HEIGHT);
});

test('the card carries no rate, whatever the harness computes (R44)', async ({ page }) => {
  // The generic guarantee, read off the live DOM rather than trusted from the
  // generator's unit tests. A social card that acquired a rate would still
  // match its baseline the day the baseline was regenerated with it.
  const digits = await page.getByTestId('og-card').locator('svg text').allTextContents();

  expect(digits.length).toBeGreaterThan(0);
  expect(digits.some((line) => line.includes('%'))).toBe(true);

  // The two tick labels are percentages and belong there - they name the
  // thresholds. What must never appear is the harness's OWN rate.
  expect(digits.join(' ')).not.toContain('34,58');
});
