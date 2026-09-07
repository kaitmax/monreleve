// web/tests/unit/calc-engine/no-snapshots.test.ts
//
// SPEC 7.6: "No snapshot tests in this module - a snapshot records what the
// code did, not what the rule requires; it would bless a wrong interpretation
// of the 40% rule and then defend it against correction."
//
// tasks/plan.md says a CI grep enforces that. This is the grep, as a test, so
// it runs everywhere the suite runs rather than only in CI.
//
// It covers BOTH directories, which the plan's wording does not make obvious:
// lib/calc-engine, where a snapshot could only appear by accident, and
// tests/unit/calc-engine, where it actually could - the engine's tests live
// outside the engine because the import fence forbids them inside it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  join(process.cwd(), 'lib', 'calc-engine'),
  join(process.cwd(), 'tests', 'unit', 'calc-engine'),
];

const FORBIDDEN = ['toMatchSnapshot', 'toMatchInlineSnapshot', 'toMatchFileSnapshot'];

/**
 * This file is excluded from its own scan. It holds the forbidden matcher
 * names as string literals in code, not in comments, so stripping comments
 * does not hide them and the guard would otherwise report itself as the sole
 * offender - which is both wrong and the kind of failure that gets a guard
 * deleted rather than fixed.
 */
const SELF = 'no-snapshots.test.ts';

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFilesUnder(path);
    if (entry === SELF) return [];

    return /\.(ts|tsx|mts|cts)$/.test(entry) ? [path] : [];
  });
}

const files = ROOTS.flatMap(sourceFilesUnder);

describe('no snapshot tests in the engine (SPEC 7.6)', () => {
  it('finds files to inspect, so the guard cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('no file uses %s', (matcher) => {
    const offenders = files.filter((file) => {
      // Strip comments: this very file names all three matchers in its own
      // prose, and so may a comment explaining why they are banned.
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');

      return source.includes(matcher);
    });

    expect(offenders).toEqual([]);
  });

  it('also has no snapshot directory or .snap file', () => {
    const snapshotArtefacts = files.filter((file) => file.includes('__snapshots__'));

    expect(snapshotArtefacts).toEqual([]);
    for (const root of ROOTS) {
      expect(readdirSync(root).filter((entry) => entry.endsWith('.snap'))).toEqual([]);
    }
  });
});
