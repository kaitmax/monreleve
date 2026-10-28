// web/tests/unit/calc-engine/verification-trace.test.ts
//
// Ruling R23. Every fixture case carries source_url, verified_by and
// verified_on. They are EMPTY until the operator fills them at Checkpoint A
// against the primary source, so a case with empty fields is VISIBLY
// unverified rather than silently assumed correct.
//
// This test asserts the fields EXIST, so a case cannot be added without them.
// It deliberately does NOT assert they are filled: a green suite that depended
// on verification would create pressure to put something in the boxes, which
// is the opposite of what the trace is for. Instead it REPORTS the count, so
// the state is visible on every run.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FIXTURE_DIR = join(process.cwd(), '..', 'fixtures');

interface TracedCase {
  readonly id: string;
  readonly source_url?: string;
  readonly verified_by?: string;
  readonly verified_on?: string;
}

interface TracedFile {
  readonly verificationTrace?: string;
  readonly cases?: readonly TracedCase[];
  readonly missionCapCases?: readonly TracedCase[];
}

const FILES = ['geneva-cases.json', 'denominator-cases.json', 'rate-cases.json'] as const;

const TRACE_FIELDS = ['source_url', 'verified_by', 'verified_on'] as const;

function load(name: string): TracedFile {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as TracedFile;
}

function casesOf(file: TracedFile): readonly TracedCase[] {
  return [...(file.cases ?? []), ...(file.missionCapCases ?? [])];
}

describe('verification trace on the fixtures (ruling R23)', () => {
  for (const name of FILES) {
    describe(name, () => {
      const file = load(name);
      const cases = casesOf(file);

      it('has cases to inspect, so the guard cannot pass vacuously', () => {
        expect(cases.length).toBeGreaterThan(0);
      });

      it('records why the fields exist and why they may be empty', () => {
        expect(file.verificationTrace).toContain('R23');
      });

      for (const field of TRACE_FIELDS) {
        it(`every case declares ${field}`, () => {
          const missing = cases
            .filter((testCase) => typeof testCase[field] !== 'string')
            .map((testCase) => testCase.id);

          expect(missing).toEqual([]);
        });
      }
    });
  }

  it('reports how many cases are still unverified, without failing on it', () => {
    let total = 0;
    let unverified = 0;

    for (const name of FILES) {
      for (const testCase of casesOf(load(name))) {
        total += 1;
        const filled = TRACE_FIELDS.every((field) => (testCase[field] ?? '') !== '');
        if (!filled) unverified += 1;
      }
    }

    console.log(
      `\n  VERIFICATION TRACE: ${unverified} of ${total} fixture cases are unverified` +
        `${unverified === total ? ' (all of them - Checkpoint A has not run)' : ''}.\n`,
    );

    // Asserted only to be internally consistent. Never that unverified is 0:
    // that is the operator's gate, not a code gate.
    expect(unverified).toBeLessThanOrEqual(total);
    expect(total).toBeGreaterThan(0);
  });
});
