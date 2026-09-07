// web/tests/unit/calc-engine/no-magic-thresholds.test.ts
//
// SPEC section 7.1: "A magic 0.4 or 240 anywhere in the code is a review
// rejection." SPEC section 7.7: "RuleSet is the only place a threshold may
// appear." This makes that mechanical rather than a review habit.
//
// rules.ts is the one exempt file - it is where the constants live.

import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENGINE_DIR = join(process.cwd(), 'lib', 'calc-engine');

/**
 * lib/ui/core is scanned too, from FW6 onward. SPEC 7.7 says RuleSet is the
 * only place a threshold may appear, and once zones.ts exists lib/ui/core is
 * the second most tempting place to write a bare 40 or 49.9 - the rail bands
 * are literally those numbers. zoneFor takes them as a parameter instead, and
 * this is what stops that decaying into a hardcoded copy.
 */
const UI_CORE_DIR = join(process.cwd(), 'lib', 'ui', 'core');

const SCANNED_DIRS = [ENGINE_DIR, UI_CORE_DIR];

/**
 * Scoped to a path rather than a basename. With the recursive walk below, a
 * bare 'rules.ts' would exempt any file of that name anywhere under either
 * tree - a lib/ui/core/rules.ts would inherit the engine's exemption for
 * free. Only the one real home of the constants is exempt.
 */
const EXEMPT = new Set([join(ENGINE_DIR, 'rules.ts')]);

/**
 * The RuleSet values, in the units RuleSet stores them. A literal equal to one
 * of these is the defect anywhere except rules.ts, which is their home.
 */
const FORBIDDEN = [0.4, 0.499, 240, 10];

/**
 * The same two ceilings in PERCENTAGE form, which is how they appear on the
 * rail: bands 0-40 / 40-49.9 / >= 49.9. These are forbidden EVERYWHERE
 * including rules.ts, because they are derived values - fiscalCeiling * 1e2 -
 * and never stored. A literal 40 in lib/ui/core would be a hardcoded copy of
 * the threshold the whole product turns on, in a unit the guard's fraction
 * list cannot see.
 */
const FORBIDDEN_PERCENT_FORMS = [40, 49.9];

/**
 * KNOWN BYPASS, recorded here under ruling R43 because it has been
 * DEMONSTRATED rather than merely imagined: this guard cannot see a number
 * inside a template literal.
 *
 * The strip below removes each backticked run whole, INCLUDING its ${...}
 * interpolations. Measured in FW7:
 *
 *   const FISCAL_TICK = 40;                  -> CAUGHT
 *   const svg = `<rect x="${w * 40 / 1e2}"/>`;  -> NOT CAUGHT
 *   `${formatPercent(49.9, 1)}`                 -> NOT CAUGHT
 *
 * So a module that builds markup - which is exactly what lib/ui/core/rail is
 * - can carry both ceilings in plain sight and this file will stay green.
 *
 * FW7 does NOT rely on that hole: railGeometry takes ZoneThresholds as a
 * parameter (R35), so the ceilings arrive from the RuleSet and no literal is
 * written. But the next person to reach for this guard as the enforcement
 * behind something load-bearing needs to see the gap before they lean on it,
 * not after.
 *
 * Closing it is possible - strip only the literal chunks of a template and
 * keep the interpolations - and is deliberately NOT done here: R43 asked for
 * the bypass to be named at the fence, and narrowing the strip would change
 * what this file accepts in files that currently pass.
 *
 * Comments are stripped first: the engine documents its own formulae, so
 * "ceil(240 * rate/100)" appears legitimately in prose and must not trip the
 * check. Only executable literals are inspected.
 *
 * Exponential literals are stripped too, per ruling R17. A scaling factor is
 * written 1e1, 1e2, 1e4, 1e6 - never a bare 10 or 100 - precisely so that this
 * guard can keep 10 forbidden as the mission cap without also forbidding
 * every decimal-place divisor. Before R17 that exemption existed only by
 * accident, because \b\d+\b happens not to match inside "1e6"; stripping them
 * explicitly makes the exemption intentional and survives a change to the
 * literal regex.
 */
function strippedSource(file: string): string {
  return (
    readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      // String literals go too. rules.ts's `sources` array quotes its own
      // citations - "Fiscal ceiling 40% of annual working time", "Social
      // ceiling 49.9%" - and a threshold named in a citation is the opposite
      // of a hardcoded one. Only arithmetic can misuse a number, and a string
      // is not arithmetic.
      .replace(/'(?:[^'\\\n]|\\.)*'/g, ' ')
      .replace(/"(?:[^"\\\n]|\\.)*"/g, ' ')
      .replace(/`(?:[^`\\]|\\.)*`/g, ' ')
      .replace(/\b\d+(?:\.\d+)?e-?\d+\b/gi, ' ')
  );
}

function offendingLiterals(source: string): number[] {
  const literals = source.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  return literals.map(Number).filter((value) => FORBIDDEN.includes(value));
}

/**
 * Every scanned source file, as a full path, minus the exempt one.
 *
 * RECURSIVE, deliberately. Until FW6 this read one directory level, which was
 * true of the engine (flat) and false of lib/ui/core the moment FW6 added
 * lib/ui/core/format/{number,date}.ts - the guard would have stopped applying
 * halfway through the task that extended it here, and both the fraction list
 * and the percentage list would have gone quietly out of force in the one
 * directory most likely to write a bare 40. The vacuity test below is not
 * enough on its own to catch that: it only requires one file per scanned
 * directory, which the top-level files already satisfied.
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

function scannedFiles(): string[] {
  return SCANNED_DIRS.flatMap(walk).filter((path) => !EXEMPT.has(path));
}

/** Last three path segments, so a test name reads lib/ui/core/zones.ts. */
const label = (file: string) => file.split(/[\\/]/).slice(-3).join('/');

describe('no bare threshold literals outside rules.ts', () => {
  it('descends into subdirectories - guarding the guard', () => {
    // Proven against a tree built here rather than against the repo, because
    // both scanned directories are currently flat: a non-recursive walk
    // would pass every other test in this file today and go silently out of
    // force the moment a subdirectory appears. lib/ui/core/format/ is the
    // one FW6 adds.
    const root = mkdtempSync(join(tmpdir(), 'threshold-walk-'));
    mkdirSync(join(root, 'nested', 'deeper'), { recursive: true });
    writeFileSync(join(root, 'top.ts'), 'export const a = 1;');
    writeFileSync(join(root, 'nested', 'mid.tsx'), 'export const b = 2;');
    writeFileSync(join(root, 'nested', 'deeper', 'low.ts'), 'export const c = 3;');
    writeFileSync(join(root, 'nested', 'ignored.scss'), 'a { color: red; }');

    expect(walk(root).map((file) => basename(file)).sort()).toEqual([
      'low.ts',
      'mid.tsx',
      'top.ts',
    ]);
  });

  it('finds files to inspect in every scanned directory, so the guard cannot pass vacuously', () => {
    expect(scannedFiles().length).toBeGreaterThan(0);
    for (const dir of SCANNED_DIRS) {
      expect(scannedFiles().filter((file) => file.startsWith(dir)).length).toBeGreaterThan(0);
    }
  });

  for (const file of scannedFiles()) {
    it(`${label(file)} carries no bare 0.4, 0.499, 240 or 10`, () => {
      expect(offendingLiterals(strippedSource(file))).toEqual([]);
    });
  }

  it('rules.ts does carry them - it is the single source', () => {
    const source = strippedSource(join(ENGINE_DIR, 'rules.ts'));

    for (const threshold of FORBIDDEN) {
      expect(offendingLiterals(source)).toContain(threshold);
    }
  });

  for (const file of [...scannedFiles(), join(ENGINE_DIR, 'rules.ts')]) {
    it(`${label(file)} carries no bare 40 or 49.9 either`, () => {
      const literals = strippedSource(file).match(/\b\d+(?:\.\d+)?\b/g) ?? [];
      const offenders = literals
        .map(Number)
        .filter((value) => FORBIDDEN_PERCENT_FORMS.includes(value));

      expect(offenders).toEqual([]);
    });
  }
});
