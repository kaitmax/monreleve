// web/e2e/rail-parity.spec.ts
//
// AC1: "Byte-identical output for the same RailData in Node and in a browser."
// SPEC 6.3: one implementation, rendered in the browser, the PDF and the OG
// image; SPEC 21 makes the byte-identity a ship criterion.
//
// WHAT THIS CAN AND CANNOT CATCH, stated because the difference matters.
//
// It CAN catch an environment-dependent primitive: an Intl call whose ICU
// data differs, a Number->string conversion that diverged, a locale-sensitive
// comparison. Those are real and they are what the criterion is about.
//
// It CANNOT catch a reordering of the geometry's arithmetic, because both
// sides run the same source. Measured in FW7: 376 * (49.9 / 100) is
// "187.624" while 376 * 49.9 / 100 is "187.62399999999997" - algebraically
// identical, four bytes apart, and this test would pass with either. That
// hazard is closed in geometry.ts by rounding every coordinate to three
// decimals, which makes the arithmetic order irrelevant to the output; this
// test is not the guard for it, and pretending otherwise would leave the real
// gap uncovered.
//
// THE COMPARISON IS ON THE RETURN VALUE, never a DOM round-trip. Measured:
// assigning an SVG string containing U+00A0 to innerHTML and reading
// outerHTML back returns &nbsp; in its place, so a round-trip compares the
// browser's re-serialisation rather than the generator's output.

import { expect, test } from '@playwright/test';
import { ruleSetFor } from '../lib/calc-engine';
import { renderRailSvg } from '../lib/ui/core/rail/renderRailSvg';
import type { RailData } from '../lib/ui/core/rail/geometry';

const RULES = ruleSetFor(2026);
const THRESHOLDS = {
  fiscalCeiling: RULES.fiscalCeiling,
  socialCeiling: RULES.socialCeiling,
};

const ZONES = ['compliant', 'fiscal-exposure', 'social-switch'] as const;
const VARIANTS = ['inline', 'compact', 'social'] as const;

/** Every variant x zone, plus the rates that carry a formatting decision. */
const MATRIX: RailData[] = [
  ...VARIANTS.flatMap((variant) =>
    ZONES.map((zone) => ({ percentage: 39.16, zone, width: 376, height: 8, variant })),
  ),
  // The rates: an exact zero, the Geneva figure, both ceilings exactly, a
  // repeating fraction, the full track, and the two clamping cases.
  ...[0, 4.16, 34.58, 39.16, 40, 49.9, 66.666_666_666, 100, -5, 140].map((percentage) => ({
    percentage,
    zone: 'compliant' as const,
    width: 376,
    height: 8,
    variant: 'inline' as const,
  })),
  // A width that produces a long fraction on every derived coordinate.
  { percentage: 33.33, zone: 'fiscal-exposure', width: 317, height: 8, variant: 'inline' },
  // The thumbnail width the Checkpoint A artifact is taken at.
  { percentage: 39.16, zone: 'compliant', width: 200, height: 8, variant: 'inline' },
];

const codepoints = (text: string): string =>
  [...text].map((c) => c.codePointAt(0)!.toString(16)).join(' ');

/** The first index at which two strings differ, or -1. */
const firstDifference = (a: string, b: string): number => {
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index++) {
    if (a[index] !== b[index]) return index;
  }

  return a.length === b.length ? -1 : limit;
};

test.describe('renderRailSvg renders identical bytes in Node and the browser', () => {
  test('every case in the matrix matches', async ({ page }) => {
    await page.goto('/dev/rail-parity');
    await page.waitForFunction(() => window.__railParityReady === true);

    const differences: string[] = [];

    for (const data of MATRIX) {
      const inNode = renderRailSvg(data, THRESHOLDS);

      // Non-finite values are not in this matrix; the unavailable state is
      // covered by the unit suite, and passing NaN across the CDP boundary
      // would test Playwright's serialisation rather than the rail.
      const inBrowser = await page.evaluate(
        ([payload, thresholds]) => window.__renderRailSvg!(payload, thresholds),
        [data, THRESHOLDS] as const,
      );

      if (inBrowser !== inNode) {
        const at = firstDifference(inNode, inBrowser);
        differences.push(
          `${data.variant}/${data.zone}/${data.percentage}@${data.width} differs at ${at}\n` +
            `  node:    ${codepoints(inNode.slice(Math.max(0, at - 8), at + 8))}\n` +
            `  browser: ${codepoints(inBrowser.slice(Math.max(0, at - 8), at + 8))}`,
        );
      }
    }

    expect(differences).toEqual([]);
  });

  test('the matrix is large enough to be worth running', async () => {
    // A parity test over two cases proves almost nothing. Pinned so the
    // matrix cannot be quietly trimmed to make a failure go away.
    expect(MATRIX.length).toBeGreaterThanOrEqual(20);
    expect(new Set(MATRIX.map((d) => d.variant)).size).toBe(3);
    expect(new Set(MATRIX.map((d) => d.zone)).size).toBe(3);
  });

  test('the browser really is executing the generator, not echoing a fixture', async ({
    page,
  }) => {
    // Guarding the guard. If the page returned a constant, or the harness
    // silently compared Node against Node, every assertion above would pass.
    // These two inputs must produce DIFFERENT strings in the browser, and the
    // browser's answer must track the input rather than the expectation.
    await page.goto('/dev/rail-parity');
    await page.waitForFunction(() => window.__railParityReady === true);

    const first = await page.evaluate(
      ([payload, thresholds]) => window.__renderRailSvg!(payload, thresholds),
      [MATRIX[0]!, THRESHOLDS] as const,
    );
    const second = await page.evaluate(
      ([payload, thresholds]) => window.__renderRailSvg!(payload, thresholds),
      [{ ...MATRIX[0]!, percentage: 12.34 }, THRESHOLDS] as const,
    );

    expect(first).not.toBe(second);
    expect(second).toContain('12,34');
  });

  test('a DOM round-trip would have given a different answer', async ({ page }) => {
    // The reason the comparison is on the return value. This documents the
    // hazard by demonstrating it: the same string, put through innerHTML and
    // read back, is not the same string.
    await page.goto('/dev/rail-parity');
    await page.waitForFunction(() => window.__railParityReady === true);

    const { direct, roundTripped } = await page.evaluate(
      ([payload, thresholds]) => {
        const svg = window.__renderRailSvg!(payload, thresholds);
        const host = document.createElement('div');
        host.innerHTML = svg;

        return { direct: svg, roundTripped: host.firstElementChild?.outerHTML ?? '' };
      },
      [MATRIX[0]!, THRESHOLDS] as const,
    );

    expect(direct).toContain('\u00A0');
    expect(roundTripped).not.toBe(direct);
    expect(roundTripped).toContain('&nbsp;');
  });
});
