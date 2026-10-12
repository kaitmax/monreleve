// web/tests/unit/meta/visual-zero-tolerance.test.ts
//
// RULING R114: A VISUAL BASELINE RUNS AT ZERO TOLERANCE. When a diff is
// environmental, the CAUSE is removed - never allowanced, never masked.
//
// WHY THIS IS A TEST AND NOT A CONVENTION. I allowanced one, defended it in a
// report as something that "cannot hide a real regression", and it hid one
// within the hour: R109 turned five number inputs into text inputs, removing
// every spinner, and all six calculator baselines silently declined to
// regenerate because each change came in under maxDiffPixels: 600.
// --update-snapshots only rewrites a baseline whose comparison FAILS, so a
// tolerance does not merely weaken the check - it freezes the picture. Caught
// because git status showed no baseline changed when six should have.
//
// THE OPERATOR'S STATEMENT OF THE FAILURE MODE, which is the general form:
// "that's the failure mode of every tolerance: it hides exactly the change you
// weren't expecting."
//
// SO THIS ASSERTS THE ABSENCE OF THREE ESCAPE HATCHES:
//
//   maxDiffPixels / maxDiffPixelRatio  an allowance on the whole image
//   threshold                          a per-pixel colour allowance
//   mask                               hiding a region from comparison
//
// stylePath is NOT forbidden and is the sanctioned pattern: it removes the
// CAUSE by neutralising an unreproducible renderer before the shot, leaving
// every pixel compared. e2e/visual-select.css is the worked example.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd();
const E2E = join(WEB, 'e2e');

/** Options that trade away exactness. R114 forbids all of them. */
const FORBIDDEN_OPTIONS: readonly string[] = [
  'maxDiffPixels',
  'maxDiffPixelRatio',
  'threshold',
  'mask:',
  'maskColor',
];

function visualSpecs(): readonly string[] {
  return readdirSync(E2E).filter((name) => name.endsWith('.visual.spec.ts'));
}

describe('every visual spec compares at zero tolerance (R114)', () => {
  it('finds the visual specs, so nothing below passes vacuously', () => {
    const specs = visualSpecs();

    expect(specs.length).toBeGreaterThanOrEqual(3);
    expect(specs).toContain('calculateur.visual.spec.ts');
    expect(specs).toContain('pages.visual.spec.ts');
  });

  it.each(visualSpecs())('%s carries no tolerance option', (spec) => {
    const source = readFileSync(join(E2E, spec), 'utf8');

    // Comment lines are stripped: these files DISCUSS the withdrawn
    // tolerance at length, and the prose explaining why it is gone must not
    // be what makes the test fail. Only executable lines are judged.
    const code = source
      .split(String.fromCharCode(10))
      .filter((line) => {
        const trimmed = line.trim();

        return !(
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*')
        );
      })
      .join(String.fromCharCode(10));

    for (const option of FORBIDDEN_OPTIONS) {
      expect(
        code.includes(option),
        `${spec} uses ${option}. R114: when a diff is environmental the CAUSE ` +
          'is removed - see e2e/visual-select.css for the stylePath pattern.',
      ).toBe(false);
    }
  });

  // -------------------------------------------------------------------------
  // THE CONFIG STATES ZERO. IT DOES NOT MERELY DECLINE TO STATE A TOLERANCE.
  //
  // THIS TEST USED TO ASSERT THE OPPOSITE, and that is the defect it now
  // exists to prevent. It read "has no project-wide tolerance in the
  // Playwright config either" and forbade the WORD `threshold` anywhere in
  // playwright.config.ts - so the one line that makes R114 true,
  // `threshold: 0`, was the one line it rejected.
  //
  // WHAT IT COST, MEASURED (FW-SHELL-BURGER). Playwright counts a pixel as
  // different only when its YIQ delta exceeds the threshold, and DEFAULTS
  // THAT THRESHOLD TO 0.2 - a 20 % per-pixel colour allowance that is in
  // force precisely while nobody writes the word. The burger put a 1 px
  // border (--colour-border-strong on white, delta 0.119) and a recoloured
  // glyph (brand over text-primary, delta 0.098) into the header of EVERY
  // page. Both sit under 0.2, so `pnpm test:visual` reported 108 passed /
  // 3 failed - twice, deterministically - certifying 34 phone baselines as
  // unchanged while the rendered header had visibly changed. Cropping the
  // stored baseline beside the live render showed a bordered button against
  // a borderless one at identical dimensions.
  //
  // AND THE PICTURE WAS FROZEN, which is the half that makes it serious:
  // --update-snapshots only rewrites a baseline whose comparison FAILS, so
  // those 34 could not be regenerated at all. That is this file's own header
  // story - maxDiffPixels: 600 freezing six calculator baselines - one layer
  // down: FW13 removed the explicit allowances and never set the default to
  // zero, so the explicit hatch was closed and the implicit one left open.
  //
  // AN ABSENCE ASSERTION IS SATISFIED BY ABSENCE. The rule is R154's: prove
  // the mechanism DELIVERS, never that nobody opted out of it. So the value
  // is read from the config object rather than grepped out of its source - a
  // string scan cannot tell `threshold: 0` from `threshold: 0.2`, which is
  // the only distinction that matters here.
  // EVERY Playwright config, not only the one that happens to take the
  // screenshots today (R267). playwright.runtime.config.ts captures none, so
  // it was outside the finding - and "outside the finding" is exactly how a
  // second site stays open until somebody reads the report back. A config
  // that is silent about tolerance is a config that has accepted 0.2, whether
  // or not it has yet taken a picture.
  const CONFIGS = ['playwright.config', 'playwright.runtime.config'] as const;

  it('finds every Playwright config, so the census below is not vacuous', () => {
    const onDisk = readdirSync(WEB).filter(
      (name) => name.startsWith('playwright.') && name.endsWith('.config.ts'),
    );

    expect(onDisk.length, 'no Playwright config found at the package root').toBeGreaterThan(0);
    expect(
      onDisk.map((name) => name.replace(/\.ts$/u, '')).sort(),
      'a Playwright config exists that this test does not read - classify it',
    ).toEqual([...CONFIGS].sort());
  });

  it.each(CONFIGS)('%s sets a project-wide ZERO tolerance, which the default does not', async (
    name,
  ) => {
    const config = (await import(`@/${name}`)).default;
    const screenshot = config.expect?.toHaveScreenshot;

    expect(
      screenshot,
      `${name}.ts sets no expect.toHaveScreenshot, so Playwright applies its ` +
        'own threshold of 0.2 - a 20 % per-pixel colour allowance that R114 ' +
        'forbids and that no spec-level scan can see.',
    ).toBeDefined();

    expect(screenshot?.threshold, 'threshold must be exactly 0 (R114, R345)').toBe(0);
    expect(screenshot?.maxDiffPixels, 'maxDiffPixels must be exactly 0 (R114, R345)').toBe(0);
  });

  it('still allows stylePath, which removes causes rather than hiding them', () => {
    // Non-vacuity of a different kind: if the forbidden list were so broad
    // that the sanctioned fix also tripped it, the rule would push the next
    // environmental diff back toward a tolerance.
    const spec = readFileSync(join(E2E, 'calculateur.visual.spec.ts'), 'utf8');

    expect(spec).toContain('stylePath');
    for (const option of FORBIDDEN_OPTIONS) {
      expect('stylePath'.includes(option), option).toBe(false);
    }
  });
});
