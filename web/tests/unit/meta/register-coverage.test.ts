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
// THE WIDENED PATTERN IS FITTED TO A CENSUS, not guessed. At R442 every id
// shape in REPORT-*.txt, relay/ and parking.md was PARK-<n>, PARKAN-<n> or
// PARK-<ONE letter><n>. `[A-Z]?` rather than `[A-Z]*` was then the whole of the
// difference between fitting it and over-reaching: `PARK-FW34-LAUNCH` is a
// real citation of a different shape, and `[A-Z]*\d+\b` matches `PARK-FW34`
// out of it - the hyphen that follows IS a word boundary - which would report
// a cited id that exists nowhere. See PARK-25.
//
// R679 (FW-PARK-IDS-2, below) later allowed two letters and moved that
// protection to a boundary after the digits; the R680 tests pin it on the
// exact string.
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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// ---------------------------------------------------------------------------
// ONE ID, ONE ENTRY - the duplicate-heading check and its frozen exemption.
//
// WHAT WAS BLIND. The check asked whether a heading EXISTS. Two headings with
// the same id satisfy that exactly as well as one does, so an id allocated by
// two tasks merges in silence and a reader following the citation lands on
// whichever entry comes first in the file. Renaming the ids in one collision
// fixes that collision and leaves the next one just as invisible, which is why
// the fix here is the check rather than the rename.
//
// THE EXEMPTION IS THREE IDS AND IS FROZEN. PARK-F1, PARK-F2 and PARK-F3 were
// each allocated by FW-FOLLOWUP and by FW-FUTURE-DAY for different findings.
// The reports citing them are history on main, so renaming is unavailable, and
// leaving the check unwritten would keep the register permanently blind to the
// case it exists for. Asserted-exactly-three, not merely-three (R206's
// corollary): a fourth exemption must survive its own argument.
//
// BOTH DIRECTIONS, because an allowlist that exempts everything passes a
// negative test perfectly (R196's shape).
// ---------------------------------------------------------------------------

const SHARED = ['PARK-F1', 'PARK-F2', 'PARK-F3'] as const;

/** parking.md with two entries under one id, at line numbers this test knows. */
function twoEntriesUnder(id: string): string {
  return [
    '# register', //                    line 1
    '', //                              line 2
    `## ${id} - the first entry`, //    line 3
    '', //                              line 4
    'A body with content in it.', //    line 5
    '', //                              line 6
    `## ${id} - the second entry`, //   line 7
    '', //                              line 8
    'A body with content in it.', //    line 9
    '',
  ].join('\n');
}

describe('one id, one entry - the duplicate-heading check', () => {
  it('fails on a genuine duplicate and names BOTH line numbers', () => {
    const result = runCheck(makeRoot(twoEntriesUnder('PARK-P1'), 'Cites PARK-P1 once.'));

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARK-P1 has 2 "## PARK-P1 -" headings in parking.md (lines 3, 7)');

    // Exactly one duplicate problem - the id is reported once, not once per heading.
    expect(result.out.match(/headings in parking\.md \(lines/g)).toHaveLength(1);
  });

  it('does not fail for the three ids two tasks genuinely share', () => {
    const parking = SHARED.map((id) => twoEntriesUnder(id).replace('# register\n\n', '')).join('\n');
    const result = runCheck(makeRoot(parking, `Cites ${SHARED.join(', ')}.`));

    expect(result.status).toBe(0);
    expect(result.out).toContain('register coverage: OK');
  });

  it('exempts those three and NOTHING ELSE, proven in one fixture', () => {
    // THE POSITIVE CONTROL FOR THE ALLOWLIST. An exemption list that swallowed
    // every duplicate would pass the test above perfectly; what says it does
    // not is a fixture where an exempt id and a non-exempt id are BOTH
    // duplicated and only one of them is reported.
    const parking = [
      twoEntriesUnder('PARK-F1').replace('# register\n\n', ''),
      twoEntriesUnder('PARK-P1').replace('# register\n\n', ''),
    ].join('\n');

    const result = runCheck(makeRoot(parking, 'Cites PARK-F1 and PARK-P1.'));

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARK-P1 has 2 "## PARK-P1 -" headings');
    expect(result.out).not.toContain('PARK-F1 has 2');
    expect(result.out.match(/headings in parking\.md \(lines/g)).toHaveLength(1);
  });

  it('ignores a repeated heading that is not an id of this register', () => {
    // The matcher is still the ID shape, so parking.md's own repeated section
    // headings are not a register collision. PARKAN-45 is duplicated alongside
    // them so the scan is proven to have run (R169).
    const parking = [
      '## STATUS LEDGER',
      '',
      'A body with content in it.',
      '',
      '## STATUS LEDGER',
      '',
      'A body with content in it.',
      '',
      '## PARKAN-45 - the only real entry here',
      '',
      'A body with content in it.',
      '',
    ].join('\n');

    const result = runCheck(makeRoot(parking, 'Cites PARKAN-45.'));

    expect(result.status).toBe(0);
    expect(result.out).toContain('register coverage: OK');
  });
});

// ---------------------------------------------------------------------------
// R679/R680 (FW-PARK-IDS-2). TWO LETTERS, AND THE BOUNDARY THAT MAKES THEM SAFE.
//
// Every single letter A-Z was taken by 28.10.2026, so sessions parked as
// UNNUMBERED-<n> in their reports. R679 widens the series to one OR TWO
// capital letters. The reason R456 stopped at one is PARK-FW34-LAUNCH: with
// only `\b` after the digits, a two-letter pattern reads PARK-FW34 out of it,
// because the hyphen that follows IS a word boundary. So the widening carries
// a boundary refusing a following "-", letter, digit (or underscore, which
// `\b` already refused), and these tests pin it on that exact string.
// ---------------------------------------------------------------------------

/**
 * THE COUNTERFACTUAL, pinned as a literal (R171: the value IS the assertion).
 * This is the two-letter pattern WITHOUT the boundary - what R679 would have
 * been had it only widened the letter class. It is never the live rule; the
 * live rule is exercised through the CLI below.
 */
const TWO_LETTERS_WITHOUT_THE_BOUNDARY = /\bPARK(?:AN)?-[A-Z]{0,2}\d+\b/g;

describe('R680 - the trap, on its exact string', () => {
  it('a two-letter pattern without the boundary reads PARK-FW34 out of PARK-FW34-LAUNCH', () => {
    const found = 'PARK-FW34-LAUNCH, beside PARKAN-45.'.match(TWO_LETTERS_WITHOUT_THE_BOUNDARY) ?? [];

    // Positive control: the counterfactual is working on this text.
    expect(found).toContain('PARKAN-45');
    // And it reads a phantom out of the longer token - the reason for the boundary.
    expect(found).toContain('PARK-FW34');
  });

  it('PARK-FW34-LAUNCH does NOT resolve as PARK-FW34 - with a real id present to prove the scan ran (R169)', () => {
    const result = runCheck(makeRoot('# register\n', 'The launch list is PARK-FW34-LAUNCH; see also PARKAN-45.'));

    // PRESENCE FIRST: the one real id is reported, so the scan ran.
    expect(result.status).toBe(1);
    expect(result.out).toContain('PARKAN-45 is cited by REPORT-FIXTURE.txt');
    expect(result.out.match(/is cited by/g)).toHaveLength(1);

    // And the longer token produced no id at all, truncated or otherwise.
    expect(result.out).not.toContain('PARK-FW34');
  });

  it('PARK-FW34 written as its own token DOES resolve', () => {
    const result = runCheck(makeRoot('# register\n', 'A token of its own: PARK-FW34.'));

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARK-FW34 is cited by REPORT-FIXTURE.txt');
  });
});

describe('R679 - one or two capital letters, and nothing longer read as shorter', () => {
  const TWO_LETTER_IDS = ['PARK-AB1', 'PARK-FT12', 'PARK-IB11'];

  it('a two-letter id resolves, alongside every shape that resolved before', () => {
    const report = `Two letters: ${TWO_LETTER_IDS.join(', ')}. ${CITING_REPORT}`;
    const result = runCheck(makeRoot('# register\n', report));

    expect(result.status).toBe(1);

    for (const id of [...TWO_LETTER_IDS, ...REAL_IDS]) {
      expect(result.out).toContain(`${id} is cited by REPORT-FIXTURE.txt`);
    }
  });

  it('passes once the two-letter ids have entries, and counts them', () => {
    const report = `Two letters: ${TWO_LETTER_IDS.join(', ')}. ${CITING_REPORT}`;
    const result = runCheck(makeRoot(entriesFor([...TWO_LETTER_IDS, ...REAL_IDS]), report));

    expect(result.status).toBe(0);
    expect(result.out).toContain(
      `register coverage: OK - ${TWO_LETTER_IDS.length + REAL_IDS.length} cited id(s) across 1 report(s)`,
    );
  });

  it('refuses a following hyphen, letter, digit or underscore, and three letters - with a real id present (R169)', () => {
    const longer = [
      'PARK-AB1-LAUNCH, PARK-AB1x, PARK-AB1_x, PARK-ABC1, PARK-A1-era, PARKAN-2-era,',
      'and the one real id: PARKAN-45.',
    ].join('\n');

    const result = runCheck(makeRoot('# register\n', longer));

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARKAN-45 is cited by REPORT-FIXTURE.txt');
    expect(result.out.match(/is cited by/g)).toHaveLength(1);

    for (const shorter of ['PARK-AB1 ', 'PARK-AB ', 'PARK-BC1', 'PARK-A1 ', 'PARKAN-2 ']) {
      expect(result.out).not.toContain(shorter);
    }
  });

  it('the duplicate-heading check covers two-letter ids too, naming both lines', () => {
    const result = runCheck(makeRoot(twoEntriesUnder('PARK-FT1'), 'Cites PARK-FT1 once.'));

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARK-FT1 has 2 "## PARK-FT1 -" headings in parking.md (lines 3, 7)');
  });
});

// ---------------------------------------------------------------------------
// R680's census found two ids in reports on main that the widening makes
// resolvable and that are NOT entries: PARK-FW34 (REPORT-FW-PARK-IDS.txt,
// naming the phantom a wrong pattern would read) and PARK-ZZ1
// (REPORT-KMP-DT.txt, naming an id the one-letter rule did not match). The
// reports are history and are not edited, so they are a frozen list of
// (report, id) PAIRS - never bare ids, because exempting the id PARK-FW34 would
// exempt the very string R680 tests. BOTH DIRECTIONS are asserted (R196): a
// listed pair passes; the same id cited by any other report still fails; and a
// listed id that GAINS a heading fails, because the citation would then resolve
// to an entry its report never meant.
// ---------------------------------------------------------------------------

const PHANTOMS = ['REPORT-FW-PARK-IDS.txt:PARK-FW34', 'REPORT-KMP-DT.txt:PARK-ZZ1'] as const;

/** A throwaway root whose reports carry the given names, with one parking.md. */
function makeRootWith(parking: string, reports: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'register-coverage-test-'));

  tempRoots.push(root);
  writeFileSync(join(root, 'parking.md'), parking);

  for (const [name, text] of Object.entries(reports)) {
    writeFileSync(join(root, name), text);
  }

  return root;
}

describe('the phantom citations - frozen at two pairs, both directions', () => {
  const PHANTOM_REPORTS = {
    'REPORT-FW-PARK-IDS.txt': 'would truncate it to a phantom `PARK-FW34`. Also PARKAN-45.',
    'REPORT-KMP-DT.txt': 'and did not match "PARK-ZZ1" - the one-letter rule.',
  };

  it('each listed phantom, cited by its own report with no heading, does not fail', () => {
    const result = runCheck(makeRootWith(entriesFor(['PARKAN-45']), PHANTOM_REPORTS));

    // Presence: PARKAN-45 is counted, so the scan ran; the phantoms are not.
    expect(result.status).toBe(0);
    expect(result.out).toContain('register coverage: OK - 1 cited id(s) across 2 report(s)');
  });

  it('the same id cited by ANY OTHER report still fails', () => {
    const result = runCheck(
      makeRootWith(entriesFor(['PARKAN-45']), { ...PHANTOM_REPORTS, 'REPORT-NEXT.txt': 'Cites PARK-ZZ1.' }),
    );

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARK-ZZ1 is cited by REPORT-NEXT.txt but has no "## PARK-ZZ1 -" heading');
  });

  it('a listed phantom that gains a heading fails, naming it', () => {
    const result = runCheck(makeRootWith(entriesFor(['PARKAN-45', 'PARK-ZZ1']), PHANTOM_REPORTS));

    expect(result.status).toBe(1);
    expect(result.out).toContain('PARK-ZZ1 is a phantom citation');
    expect(result.out).not.toContain('PARK-FW34 is a phantom citation');
  });

  it('names exactly those two pairs, read out of the script itself', () => {
    const source = readFileSync(SCRIPT, 'utf8');
    const declared = /const PHANTOM_CITATIONS = Object\.freeze\(\[([^\]]*)\]\)/.exec(source);

    expect(declared).not.toBeNull();

    const ids = (declared?.[1] ?? '')
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter((entry) => entry !== '');

    expect(ids).toEqual([...PHANTOMS]);
  });
});

describe('R681 - the register reports which series are taken', () => {
  it('names the one- and two-letter series and the highest numbers its headings use', () => {
    const parking = entriesFor(['PARK-K6', 'PARK-K7', 'PARK-FT1', 'PARK-FT2', 'PARK-A1', 'PARK-12', 'PARK-4', 'PARKAN-45']);
    const result = runCheck(makeRoot(parking, 'Cites PARK-K6.'));

    expect(result.status).toBe(0);
    expect(result.out).toContain('series taken: one letter A K; two letters FT; PARK-<n> up to 12; PARKAN-<n> up to 45');
  });

  it('the real register: every single letter is taken, so a new series has two', () => {
    const result = runCheck();

    expect(result.status).toBe(0);
    expect(result.out).toContain('series taken: one letter A B C D E F G H I J K L M N O P Q R S T U V W X Y Z;');
  });
});

describe('the exemption list is frozen at three', () => {
  it('names exactly PARK-F1, PARK-F2 and PARK-F3, read out of the script itself', () => {
    // READ FROM SOURCE RATHER THAN IMPORTED, and the reason is mechanical: this
    // is an .mjs in a strict TypeScript project with no .d.mts, so importing it
    // to count an array would create exactly the hand-written declaration R185
    // forbids leaving unasserted. The tests above prove the list DELIVERS; this
    // one proves it has not GROWN, which no behavioural test can do for an id
    // nobody has thought of yet.
    const source = readFileSync(SCRIPT, 'utf8');
    const declared = /const SHARED_IDS = Object\.freeze\(\[([^\]]*)\]\)/.exec(source);

    expect(declared).not.toBeNull();

    const ids = (declared?.[1] ?? '')
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter((entry) => entry !== '');

    expect(ids).toEqual([...SHARED]);
  });
});
