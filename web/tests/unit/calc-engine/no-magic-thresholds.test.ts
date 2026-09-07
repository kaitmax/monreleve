// web/tests/unit/calc-engine/no-magic-thresholds.test.ts
//
// SPEC section 7.1: "A magic 0.4 or 240 anywhere in the code is a review
// rejection." SPEC section 7.7: "RuleSet is the only place a threshold may
// appear." This makes that mechanical rather than a review habit.
//
// rules.ts is the one exempt file - it is where the constants live.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENGINE_DIR = join(process.cwd(), 'lib', 'calc-engine');
const EXEMPT = new Set(['rules.ts']);

/** The thresholds. A literal equal to one of these is the defect. */
const FORBIDDEN = [0.4, 0.499, 240, 10];

/**
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
  return readFileSync(join(ENGINE_DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\b\d+(?:\.\d+)?e-?\d+\b/gi, ' ');
}

function offendingLiterals(source: string): number[] {
  const literals = source.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  return literals.map(Number).filter((value) => FORBIDDEN.includes(value));
}

function engineFiles(): string[] {
  return readdirSync(ENGINE_DIR).filter(
    (name) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !EXEMPT.has(name),
  );
}

describe('no bare threshold literals outside rules.ts', () => {
  it('finds engine files to inspect, so the guard cannot pass vacuously', () => {
    expect(engineFiles().length).toBeGreaterThan(0);
  });

  for (const file of engineFiles()) {
    it(`${file} carries no bare 0.4, 0.499, 240 or 10`, () => {
      expect(offendingLiterals(strippedSource(file))).toEqual([]);
    });
  }

  it('rules.ts does carry them - it is the single source', () => {
    const source = strippedSource('rules.ts');

    for (const threshold of FORBIDDEN) {
      expect(offendingLiterals(source)).toContain(threshold);
    }
  });
});
