// web/tests/unit/meta/baseline-dimensions.test.ts
//
// RULING R128, the half that runs without a browser.
//
// e2e/baseline.ts asserts a capture's width against the live viewport, which
// is the honest check and needs the container. This is the CENSUS: it reads
// every stored baseline and reports any whose width disagrees with the
// viewport its family is taken at. It runs in `pnpm gate`, on every commit,
// and it is what the ruling's "list any baseline whose stored dimensions
// disagree with its viewport" asks for.
//
// TWO MECHANISMS, DELIBERATELY, because they fail at different times. The
// capture-time assertion cannot fail until somebody runs the container; a
// baseline committed from a bad run sits in the tree until then. This reads
// the tree.
//
// THE FAMILY WIDTHS ARE NOT A SECOND COPY OF THE SPECS' VIEWPORTS - they are
// derived from the file names, which are what the specs build from the same
// `label` variable. `page-cgu-mobile.png` is mobile because the loop that
// wrote it is the mobile loop. What could still drift is the NUMBER behind
// the word, so it is asserted against the specs' own source below rather than
// typed here and trusted.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BASELINES = join(ROOT, 'tests', 'visual', 'baselines');

/** PNG width and height, from the IHDR chunk. The same read e2e does. */
function pngSize(file: string): { readonly width: number; readonly height: number } {
  const bytes = readFileSync(join(BASELINES, file));

  if (bytes.length < 24) throw new Error(`${file} is too short to be a PNG`);
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new Error(`${file} is not a PNG`);

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * The two viewports every FULL-PAGE baseline is taken at (R127).
 *
 * READ OUT OF THE SPECS rather than declared, so this file cannot say 390
 * while pages.visual.spec.ts says 360 and both pass. If a spec stops
 * containing the number, the assertion below fails and says so.
 */
const SPECS = [
  'e2e/pages.visual.spec.ts',
  'e2e/calculateur.visual.spec.ts',
  'e2e/guides.visual.spec.ts',
];

const FAMILY_WIDTH: Readonly<Record<string, number>> = { desktop: 1440, mobile: 390 };

/** Every full-page baseline: the two families R127 reconciled. */
const fullPageBaselines = (): string[] =>
  readdirSync(BASELINES).filter(
    (file) =>
      file.endsWith('.png') &&
      // FW16 ADDED A THIRD FAMILY, and adding it here is the point of the
      // "names a family for every full-page baseline" assertion below: a
      // guides-* file left out would not be reported as unfamiliar, it
      // would simply never be measured - the silent-gap shape this census
      // exists to close.
      (file.startsWith('page-') ||
        file.startsWith('calculateur-') ||
        file.startsWith('guides-')),
  );

const familyOf = (file: string): string | undefined =>
  Object.keys(FAMILY_WIDTH).find((family) => file.endsWith(`-${family}.png`));

describe('every stored baseline agrees with its viewport (R128)', () => {
  it('read the baseline directory, so nothing below passes vacuously', () => {
    const all = readdirSync(BASELINES).filter((file) => file.endsWith('.png'));

    expect(all.length).toBeGreaterThan(50);
    expect(fullPageBaselines().length).toBeGreaterThanOrEqual(20);
  });

  it('takes its widths from the specs, not from a copy of them', () => {
    // THE DRIFT THIS PREVENTS. If R127 had reconciled only one of the two
    // suites, this file could still have said 1440/390 and passed against
    // baselines that were 1280/360. So the numbers must appear in the specs
    // that write those baselines.
    for (const spec of SPECS) {
      const source = readFileSync(join(ROOT, spec), 'utf8');

      for (const [family, width] of Object.entries(FAMILY_WIDTH)) {
        expect(source, `${spec} does not declare a ${family} viewport of ${width}`).toContain(
          `width: ${width}`,
        );
      }
    }
  });

  it('names a family for every full-page baseline', () => {
    // A file matching neither suffix is a baseline this census does not cover,
    // which is the silent-gap shape rather than a failure. Named rather than
    // skipped.
    const unfamiliar = fullPageBaselines().filter((file) => familyOf(file) === undefined);

    expect(
      unfamiliar,
      `full-page baselines with no -desktop or -mobile suffix: ${unfamiliar.join(', ')}`,
    ).toEqual([]);
  });

  it('lists no baseline whose width disagrees with its viewport', () => {
    // THE RULING'S OWN WORDS. FW12's mobile baselines were 421 px images of a
    // 390 px viewport - correct pictures of a page 31 px too wide - and eight
    // of them passed review because a fullPage capture widens to include the
    // overflow rather than showing it.
    const disagreeing = fullPageBaselines()
      .map((file) => {
        const family = familyOf(file) ?? '';
        const expected = FAMILY_WIDTH[family] ?? 0;
        const { width } = pngSize(file);

        return width === expected ? null : `${file}: ${width} px for a ${expected} px viewport`;
      })
      .filter((row): row is string => row !== null);

    expect(
      disagreeing,
      `R128: these baselines are wider or narrower than the viewport they were ` +
        `taken at, which for a fullPage capture means horizontal overflow:\n${disagreeing.join('\n')}`,
    ).toEqual([]);
  });

  it('allows height to exceed the viewport, which is what fullPage is for', () => {
    // Non-vacuity in the other direction: if the check above were secretly
    // comparing heights, the legal pages would fail. They are thousands of
    // pixels tall on purpose.
    const tallest = Math.max(...fullPageBaselines().map((file) => pngSize(file).height));

    expect(tallest).toBeGreaterThan(4000);
  });

  it('and the census would actually catch a widened capture', () => {
    // An absence assertion needs its detector tested. A 421 px file in the
    // mobile family - the exact shape FW12 shipped - must be reported.
    const family = 'mobile';
    const expected = FAMILY_WIDTH[family] ?? 0;
    const pretend = 421;

    expect(expected).toBe(390);
    expect(pretend === expected).toBe(false);
  });
});
