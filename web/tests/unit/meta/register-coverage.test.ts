// web/tests/unit/meta/register-coverage.test.ts
//
// R442/R443 (FW-PARK-IDS). THE CITATION PATTERN SEES THE WHOLE NAMESPACE.
//
// WHAT WAS WRONG, AND IT WAS NOT WHAT THE HEADER SAID. register-coverage.mjs
// held `/\bPARKAN?-\d+\b/g` and described itself as collecting "every PARK-<n>
// and PARKAN-<n>". `PARKAN?` is the five letters PARKA followed by an OPTIONAL
// N, so what it actually matched was PARKAN-<n> and PARKA-<n> - a shape no
// report has ever used. It never matched `PARK-12`, and it never matched a
// lettered id. On 5e87a4a it reported "39 cited id(s) across 115 report(s)",
// and all thirty-nine were PARKAN-<n>: the entire PARK-<n> series and every
// PARK-<letter><n> were invisible to the check that exists to make a citation
// followable.
//
// THE WIDENED PATTERN IS FITTED TO A CENSUS, not guessed. Every id shape in
// REPORT-*.txt, relay/ and parking.md is PARK-<n>, PARKAN-<n> or
// PARK-<ONE letter><n>. `[A-Z]?` rather than `[A-Z]*` is the whole of the
// difference between fitting it and over-reaching: `PARK-FW34-LAUNCH` is a
// real citation of a different shape, and `[A-Z]*\d+\b` matches `PARK-FW34`
// out of it - the hyphen that follows IS a word boundary - which would report
// a cited id that exists nowhere. See PARK-25.
//
// R443: THE GAP IS DEMONSTRATED, NOT ASSERTED. The first test runs the OLD
// pattern over the same fixture the widened check is driven on, and the
// positive control is that the old pattern still finds PARKAN-45 there - an
// absence assertion satisfied by an empty fixture would prove nothing. The
// relay prompt's wording for that control named PARK-12 as well; it cannot,
// because the old pattern never matched it, which is the finding rather than
// a failure of the control.
//
// R204: the CLI is driven as a subprocess, the way the two gates drive it
// (gate:clone and RegisterCoverageTest.kt both shell out to the same file).
// No import, so no hand-written .d.mts to drift (R185).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'web', 'scripts', 'register-coverage.mjs');

/**
 * The pattern as it stood at 5e87a4a, web/scripts/register-coverage.mjs:49.
 *
 * A literal here is the ONE case R171 allows: the value IS the assertion. This
 * is a historical artefact pinned to a commit, not a second copy of a live
 * rule - the live rule is exercised through the CLI below, never transcribed.
 */
const PATTERN_AS_AT_5E87A4A = /\bPARKAN?-\d+\b/g;

/** Ids of all three real shapes, plus every near-miss the census turned up. */
const CITING_REPORT = [
  'An entry in the numbered series: PARK-12, and another, PARK-4.',
  'An Android-era id: PARKAN-45.',
  'Lettered ids from the KMP and Android chains: PARK-K6, PARK-U3, PARK-B1,',
  'PARK-I1 and PARK-A2.',
  '',
  'None of the following is an id of this register, and none may be reported:',
  'PARKED, PARKING, PARKS, a bare PARK- with nothing after it, PARK-item,',
  'PARKAN-NNN, PARKA-7, PARK4-2, PARK5b-1, PARK30-19, PARK31-6 and',
  'PARK-FW34-LAUNCH.',
].join('\n');

const REAL_IDS = ['PARK-12', 'PARK-4', 'PARKAN-45', 'PARK-K6', 'PARK-U3', 'PARK-B1', 'PARK-I1', 'PARK-A2'];
const NEAR_MISSES = [
  'PARKED',
  'PARKING',
  'PARKS',
  'PARK-item',
  'PARKAN-NNN',
  'PARKA-7',
  'PARK4-2',
  'PARK5b-1',
  'PARK30-19',
  'PARK31-6',
  'PARK-FW34',
  'PARK-FW34-LAUNCH',
];

interface CheckRun {
  readonly status: number;
  readonly out: string;
}

function runCheck(root?: string): CheckRun {
  try {
    const out = execFileSync('node', [SCRIPT, ...(root === undefined ? [] : [root])], {
      encoding: 'utf8',
    });

    return { status: 0, out };
  } catch (err: unknown) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };

    return { status: failure.status ?? 1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

const tempRoots: string[] = [];

/** A throwaway repo root holding one parking.md and one report. */
function makeRoot(parking: string, report: string): string {
  const root = mkdtempSync(join(tmpdir(), 'register-coverage-test-'));

  tempRoots.push(root);
  writeFileSync(join(root, 'parking.md'), parking);
  writeFileSync(join(root, 'REPORT-FIXTURE.txt'), report);

  return root;
}

/** A real entry body, so nothing is flagged as a placeholder. */
function entriesFor(ids: readonly string[]): string {
  return ids.map((id) => `## ${id} - fixture entry\n\nA body with content in it.\n`).join('\n');
}

afterAll(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('R443 - the gap, demonstrated on the fixture rather than asserted', () => {
  it('the pattern as at 5e87a4a finds PARKAN-45, misses both other shapes, and matches a shape nobody uses', () => {
    const found = CITING_REPORT.match(PATTERN_AS_AT_5E87A4A) ?? [];

    // THE POSITIVE CONTROL. The old pattern is working on this text; what it
    // misses, it misses because of the pattern and not because of the fixture.
    expect(found).toContain('PARKAN-45');

    // The whole numbered series and every lettered id were invisible to it.
    for (const id of ['PARK-12', 'PARK-4', 'PARK-K6', 'PARK-U3', 'PARK-B1', 'PARK-I1', 'PARK-A2']) {
      expect(found).not.toContain(id);
    }

    // THE OTHER HALF OF THE SAME TYPO, and the reason this is not merely a
    // pattern that was too narrow: PARKA? + optional N also matches PARKA-<n>,
    // a shape the census finds zero instances of. It was simultaneously blind
    // to two real series and open to one that does not exist.
    expect(found).toEqual(['PARKAN-45', 'PARKA-7']);
  });
});

describe('R442 - the widened check, driven through the CLI both gates run', () => {
  it('names every real id in the fixture when parking.md covers none of them', () => {
    const result = runCheck(makeRoot('# register\n', CITING_REPORT));

    expect(result.status).toBe(1);

    for (const id of REAL_IDS) {
      expect(result.out).toContain(`${id} is cited by REPORT-FIXTURE.txt`);
    }
  });

  it('reports no near-miss as an id, with a real id present to prove the scan ran (R169)', () => {
    const nearMissesOnly = [
      'PARKED, PARKING, PARKS, a bare PARK- with nothing after it, PARK-item,',
      'PARKAN-NNN, PARKA-7, PARK4-2, PARK5b-1, PARK30-19, PARK31-6,',
      'PARK-FW34-LAUNCH - and one real id so this is not an absence assertion',
      'satisfied by an empty scan: PARKAN-45.',
    ].join('\n');

    const result = runCheck(makeRoot('# register\n', nearMissesOnly));

    // PRESENCE FIRST: the scan ran and found the one real id.
    expect(result.status).toBe(1);
    expect(result.out).toContain('PARKAN-45 is cited by REPORT-FIXTURE.txt');

    // And it found exactly that one - one problem line, no near-miss named.
    expect(result.out.match(/is cited by/g)).toHaveLength(1);

    for (const token of NEAR_MISSES) {
      expect(result.out).not.toContain(token);
    }
  });

  it('passes once every cited id has a real entry, and counts all three shapes', () => {
    const result = runCheck(makeRoot(entriesFor(REAL_IDS), CITING_REPORT));

    expect(result.status).toBe(0);
    expect(result.out).toContain(`register coverage: OK - ${REAL_IDS.length} cited id(s) across 1 report(s)`);
  });

  it('flags a placeholder under a LETTERED heading too - the heading matcher moved with it (R267)', () => {
    const placeholder = '## PARK-K6 - fixture entry\n\nNot transcribed.\n';
    const flagged = runCheck(makeRoot(placeholder, 'Cites PARK-K6 and nothing else.'));

    expect(flagged.status).toBe(1);
    expect(flagged.out).toContain('PARK-K6 carries the "Not transcribed" placeholder');

    // POSITIVE CONTROL: the same heading with a real body passes, so the
    // failure above is the placeholder and not the lettered heading itself.
    const real = runCheck(makeRoot(entriesFor(['PARK-K6']), 'Cites PARK-K6 and nothing else.'));

    expect(real.status).toBe(0);
  });
});

describe('R445 - the real repository, after the widening', () => {
  it('passes, and cites more ids than the narrow pattern did at 5e87a4a', () => {
    const result = runCheck();

    expect(result.status).toBe(0);
    expect(result.out).toContain('register coverage: OK');

    const cited = /OK - (\d+) cited id\(s\) across (\d+) report\(s\)/.exec(result.out);

    expect(cited).not.toBeNull();

    // 39 is what the check reported on 5e87a4a, the commit this widening was
    // measured against. A count that did not rise means the widening found
    // nothing, which R445 makes a stop condition rather than a pass.
    expect(Number(cited?.[1])).toBeGreaterThan(39);
    expect(Number(cited?.[2])).toBeGreaterThan(0);
  });
});
