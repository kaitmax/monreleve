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

  it('has no project-wide tolerance in the Playwright config either', () => {
    // A default in expect.toHaveScreenshot would apply to every baseline at
    // once and would be invisible from the specs, which is worse than a local
    // one.
    const config = readFileSync(join(WEB, 'playwright.config.ts'), 'utf8');
    const code = config
      .split(String.fromCharCode(10))
      .filter((line) => !line.trim().startsWith('//'))
      .join(String.fromCharCode(10));

    for (const option of FORBIDDEN_OPTIONS) {
      expect(code.includes(option), `playwright.config.ts sets ${option}`).toBe(false);
    }
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
