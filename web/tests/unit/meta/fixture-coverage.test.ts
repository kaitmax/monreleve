// web/tests/unit/meta/fixture-coverage.test.ts
//
// ENGINE-PARITY (R348). The web-side proof of the fixture-section coverage
// census. The ONE definition is web/scripts/fixture-coverage.mjs (gate:clone and
// FixtureCoverageTest.kt both run it); this drives that CLI the same way, as a
// subprocess - no import, so no hand-written .d.mts to drift (R185).
//
// R154: a mechanism is proven to DELIVER, not merely proven not to fail. The
// positive case asserts the real repository passes AND that the scan is not
// vacuous (it found sections across files). The negative cases build a throwaway
// root and assert the census catches the two failures it exists to catch - a
// section one engine does not read, and an orphan fixture - each named.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'web', 'scripts', 'fixture-coverage.mjs');

interface CensusRun {
  readonly status: number;
  readonly out: string;
}

function runCensus(root?: string): CensusRun {
  try {
    const out = execFileSync('node', [SCRIPT, ...(root === undefined ? [] : [root])], {
      encoding: 'utf8',
    });

    return { status: 0, out };
  } catch (err: unknown) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };

    return {
      status: failure.status ?? 1,
      out: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

const tempRoots: string[] = [];

/** A throwaway repo root with the three trees the census reads. */
function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'fixture-coverage-test-'));

  tempRoots.push(root);
  mkdirSync(join(root, 'fixtures'), { recursive: true });
  mkdirSync(join(root, 'web', 'tests'), { recursive: true });
  mkdirSync(join(root, 'android', 'app', 'src', 'test', 'kotlin'), { recursive: true });

  return root;
}

afterAll(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('R348 fixture-section coverage census', () => {
  it('passes on the real repository, and the scan is not vacuous (R133)', () => {
    const result = runCensus();

    expect(result.status).toBe(0);
    expect(result.out).toContain('fixture coverage: OK');
    // "N section(s) across M file(s)" with N, M > 0 - a census that found nothing
    // would be a pass by absence.
    expect(result.out).toMatch(/[1-9]\d* section\(s\) across [1-9]\d* file\(s\)/);
  });

  it('fails, naming the section, when one engine reads the file but not a section (R154)', () => {
    const root = makeRoot();

    writeFileSync(join(root, 'fixtures', 'demo.json'), JSON.stringify({ cases: [1] }));
    // References the file by name, but never reads its "cases" section.
    writeFileSync(
      join(root, 'web', 'tests', 'demo.test.ts'),
      'const loaded = loadFixture("demo.json");\n',
    );

    const result = runCensus(root);

    expect(result.status).toBe(1);
    expect(result.out).toContain('demo.json');
    expect(result.out).toContain('cases');
  });

  it('fails, naming the fixture, when no engine reads it at all (orphan)', () => {
    const root = makeRoot();

    writeFileSync(join(root, 'fixtures', 'orphan.json'), JSON.stringify({ cases: [1] }));

    const result = runCensus(root);

    expect(result.status).toBe(1);
    expect(result.out).toContain('orphan.json');
    expect(result.out).toContain('NO engine');
  });
});
