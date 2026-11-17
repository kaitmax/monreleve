// web/tests/unit/meta/gate-clone-summary.test.ts
//
// R955: EVERY TEST STEP'S COUNT IS PRINTED IN FULL.
//
// gate:clone printed the last 14 lines of each step's stdout+stderr, in that
// order, and nothing else. Every suite prints its summary to STDOUT and its
// noise to STDERR, so the tail a reader saw was the noise: canvas warnings
// under `pnpm test`, docker's build log under the production write, and the
// middle of the size table, whose header and the calculator's own row (A 0.1
// spare) were cut off. A red suite still failed the step; a run with FEWER
// tests than before read exactly like a full one (C1b's deviation 6; Queue
// Rulings 21-22 for the size figures).
//
// THE FIXTURES ARE REAL BYTES, joined the way run() joins them (stdout, then
// stderr):
// - vitest's stdout: vitest 5.0.0, captured on 2026-11-16 from single test
//   files spawned the way run() spawns a step (piped, shell: true) - passed,
//   FORCE_COLOR=1, filtered to skips, and a throwaway failing file (deleted).
// - the stderr under `pnpm test`, `pnpm test:db` and the production write:
//   the tails W3c's gate:clone printed for those steps (its log,
//   C:/wt/fw-annex-rendered/.annex-evidence/gate-clone-1.log).
// - the size table: a whole `pnpm size` run on db68601
//   (C:/wt/fw-web-account/.webaccount-evidence/b0-db68601-size.log), with
//   pnpm's "$ node ..." echo on stderr, where pnpm prints it.
// - the production write's line: read out of container-write.mjs itself, so
//   a change to its wording fails here rather than in a clone (R181).
//
// Characters outside ASCII are transcribed by codepoint (R96).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readCount, stripAnsi } from '../../../scripts/gate-selection.mjs';
import { readStepSummary } from '../../../scripts/gate-clone-parts.mjs';
import { withoutComments } from '@/tests/support/quoted-spans';

const WEB = join(import.meta.dirname, '..', '..', '..');
const GATE_CLONE = withoutComments(readFileSync(join(WEB, 'scripts', 'gate-clone.mjs'), 'utf8'));
const CONTAINER_WRITE = readFileSync(join(WEB, 'scripts', 'container-write.mjs'), 'utf8');

const ESC = '\u001b';
const HEAVY_RIGHT_POINTER = '\u276f';
const MULTIPLICATION_SIGN = '\u00d7';

/** What run() keeps of a step's output: stdout, then stderr. */
const captured = (stdout: string, stderr: string): string => `${stdout}${stderr}`;

/** What run() used to print, and still prints first: the last 14 lines. */
const tailOf = (output: string): string => output.split('\n').slice(-14).join('\n');

const VITEST_PASSED = [
  '',
  ' RUN  v5.0.0 C:/wt/fw-gate-clone-admin/web',
  '',
  '',
  ' Test Files  1 passed (1)',
  '      Tests  4 passed (4)',
  '   Start at  23:21:30',
  '   Duration  502ms (transform 60%, setup 16%, import 12%, worker 6%, tests 5%)',
  '',
  '',
].join('\n');

const VITEST_COLOUR = [
  '',
  `${ESC}[1m${ESC}[30m${ESC}[46m RUN ${ESC}[49m${ESC}[39m${ESC}[22m ${ESC}[36mv5.0.0 ${ESC}[39m${ESC}[90mC:/wt/fw-gate-clone-admin/web${ESC}[39m`,
  '',
  '',
  `${ESC}[2m Test Files ${ESC}[22m ${ESC}[1m${ESC}[32m1 passed${ESC}[39m${ESC}[22m${ESC}[90m (1)${ESC}[39m`,
  `${ESC}[2m      Tests ${ESC}[22m ${ESC}[1m${ESC}[32m4 passed${ESC}[39m${ESC}[22m${ESC}[90m (4)${ESC}[39m`,
  `${ESC}[2m   Start at ${ESC}[22m 23:21:33`,
  `${ESC}[2m   Duration ${ESC}[22m 578ms${ESC}[2m (transform 61%, setup 15%, import 13%, tests 6%, worker 5%)${ESC}[22m`,
  '',
  '',
].join('\n');

const VITEST_SKIPPED = [
  '',
  ' RUN  v5.0.0 C:/wt/fw-gate-clone-admin/web',
  '',
  '',
  ' Test Files  1 passed | 1 skipped (2)',
  '      Tests  3 passed | 6 skipped (9)',
  '   Start at  23:21:35',
  '   Duration  568ms (transform 60%, setup 18%, import 10%, worker 7%, tests 3%)',
  '',
  '',
].join('\n');

const VITEST_FAILED = [
  '',
  ' RUN  v5.0.0 C:/wt/fw-gate-clone-admin/web',
  '',
  ` ${HEAVY_RIGHT_POINTER} tests/unit/meta/zz-w6-capture-fail.test.ts (4 tests | 1 failed | 1 todo) 20ms`,
  `   ${MULTIPLICATION_SIGN} fails 12ms`,
  '',
  ' Test Files  1 failed (1)',
  '      Tests  1 failed | 2 passed | 1 todo (4)',
  '     Errors  1 error',
  '   Start at  23:21:52',
  '   Duration  470ms (transform 46%, setup 23%, tests 13%, worker 11%, import 5%, environment 1%)',
  '',
  '',
].join('\n');

const CANVAS_WARNING =
  "Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package";

/** The 13 lines (and the final newline) W3c's log shows under `--- pnpm test ---`. */
const TEST_STDERR = [
  ...Array.from({ length: 9 }, () => CANVAS_WARNING),
  'R348: a shared fixture section is not consumed by every engine that reads its file:',
  '  - demo.json: web (TypeScript) reads this file but NOT its section "cases" (consumed by neither engine) - a shared section one engine does not read is the mission-cap near-miss (R348)',
  'R348: a shared fixture section is not consumed by every engine that reads its file:',
  "  - orphan.json is in fixtures/ but NO engine's test suite reads it - an orphan fixture cannot catch a divergence (R133/R246)",
  '',
].join('\n');

const RULE = '-'.repeat(127);

const SIZE_ROWS = [
  '/                                             public      114.0    13.4   14.7   47.1  pass (A 11.0 spare, B 11.6 spare)',
  '/_not-found                                   public      108.4     7.8    7.9   47.1  pass (A 16.6 spare, B 17.2 spare)',
  '/a-propos                                     public      108.5     7.9    7.9   47.1  pass (A 16.5 spare, B 17.1 spare)',
  '/alertes                                      public      108.5     7.9   14.7   47.1  pass (A 16.5 spare, B 17.1 spare)',
  '/alertes/confirmation/[etat]                  public      108.3     7.7    7.9   47.1  pass (A 16.7 spare, B 17.3 spare)',
  '/alertes/desinscription/[etat]                public      108.3     7.7    7.9   47.1  pass (A 16.7 spare, B 17.3 spare)',
  '/application                                  public      108.4     7.8    8.5   47.1  pass (A 16.6 spare, B 17.2 spare)',
  '/calculateur-lamal-cmu                        public      122.7    22.1   14.7   47.1  pass (A 2.3 spare, B 2.9 spare)',
  '/calculateur-teletravail-frontalier           public      124.9    24.3   14.7   47.1  pass (A 0.1 spare, B 0.7 spare)',
  '/calculateur-teletravail-frontalier/resultat  public      109.8     9.2   14.7   47.1  pass (A 15.2 spare, B 15.8 spare)',
  '/cgu                                          public      108.4     7.8    7.9   47.1  pass (A 16.6 spare, B 17.2 spare)',
  '/confidentialite                              public      108.4     7.8    7.9   47.1  pass (A 16.6 spare, B 17.2 spare)',
  '/guides                                       public      108.3     7.7    8.4   47.1  pass (A 16.7 spare, B 17.3 spare)',
  '/guides/[slug]                                public      109.7     9.1   14.7   47.1  pass (A 15.3 spare, B 15.9 spare)',
  '/mentions-legales                             public      108.4     7.8    7.9   47.1  pass (A 16.6 spare, B 17.2 spare)',
  '/releve-annuel                                public      108.5     7.9    7.9   47.1  pass (A 16.5 spare, B 17.1 spare)',
  '/releve/print                                 public      102.0     1.4    7.6   47.1  pass (A 23.0 spare, B 23.6 spare)',
  '/sources                                      public      108.5     7.9    7.9   47.1  pass (A 16.5 spare, B 17.1 spare)',
  '/tarifs                                       public      108.5     7.9    7.9   47.1  pass (A 16.5 spare, B 17.1 spare)',
  '/verifier/[code]                              public      108.3     7.7    3.5   47.1  pass (A 16.7 spare, B 17.3 spare)',
];

const SIZE_HEADER =
  'route                                         bucket   js total   delta    css  fonts  verdict';

const SIZE_TABLE = [
  'First-load JS per route (gzip level 9). Ruling R2 gates:',
  '  GATE A  total <= 125.0 KiB',
  '  GATE B  delta <= 25.0 KiB over the 100.6 KiB framework floor',
  '',
  SIZE_HEADER,
  RULE,
  ...SIZE_ROWS,
  RULE,
];

const SIZE_STDOUT = [
  '',
  ...SIZE_TABLE,
  'css   reported, never gated: it is not JS.',
  'fonts reported, never gated: 47.1 KiB preloaded (latin subset), 130.2 KiB across 2 file(s) on disk. woff2 is already compressed.',
  'polyfills excluded: 38.6 KiB gzip / 110.0 KiB raw, served nomodule.',
  'framework floor: 100.6 KiB, measured on next 15.5.25 / react 19.2.8, 07.09.2026.',
  '',
  'All gated routes pass both gates.',
  '',
].join('\n');

const SIZE_STDERR = '$ node scripts/check-budgets.mjs\n';

/** container-write.mjs's own summary sentence, read from its source (R181). */
const WRITE_TEMPLATE = /`\\n(Production write checks {2})\$\{checks\}( passed \()\$\{checks\}(\))`/u.exec(
  CONTAINER_WRITE,
);
const FAILED_TEMPLATE = /`\\n\$\{failures\.length\}( FAILED:)`/u.exec(CONTAINER_WRITE);

function writeLine(checks: number): string {
  if (WRITE_TEMPLATE === null) throw new Error('container-write.mjs no longer prints its checks line');

  return `${WRITE_TEMPLATE[1]}${checks}${WRITE_TEMPLATE[2]}${checks}${WRITE_TEMPLATE[3]}`;
}

function failedLine(failures: number): string {
  if (FAILED_TEMPLATE === null) throw new Error('container-write.mjs no longer prints its FAILED line');

  return `${failures}${FAILED_TEMPLATE[1]}`;
}

const writeStdout = (checks: number): string =>
  [
    '',
    '=== the production write (FW31, R256) ===',
    'image monreleve:write   port 3120   database monreleve_container_write',
    '',
    '--- cleanup ---',
    'dropped monreleve_container_write',
    '',
    writeLine(checks),
    '',
  ].join('\n');

/** The 13 docker build lines (and the final newline) W3c's log shows under `--- pnpm test:container:write ---`. */
const WRITE_STDERR = [
  '#24 exporting layers',
  '#24 exporting layers 3.9s done',
  '#24 exporting manifest sha256:45f49aab93628da51c77c9259de026f18e87247733493a60056d32e47395ebb8 0.0s done',
  '#24 exporting config sha256:33452b09bc0c533dcef07fc9ebf6a0eda5d3ed90b9af1dc0f3e2294599d4cc59 0.0s done',
  '#24 exporting attestation manifest sha256:f0c5565177e16151f26da85a856ea913a70996c48cb62c994fb12ba528929bbf 0.0s done',
  '#24 exporting manifest list sha256:e9835873691e602ed6665d97af62d210f5252d8000d91ec4a25a210e3a500c3e 0.0s done',
  '#24 naming to docker.io/library/monreleve:fw-annex-rendered',
  '#24 naming to docker.io/library/monreleve:fw-annex-rendered done',
  '#24 unpacking to docker.io/library/monreleve:fw-annex-rendered',
  '#24 unpacking to docker.io/library/monreleve:fw-annex-rendered 1.6s done',
  '#24 DONE 5.7s',
  '',
  'View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/97neviwy88oxh0hcpyuj1r3a8',
  '',
].join('\n');

const TEST_OUTPUT = captured(VITEST_PASSED, TEST_STDERR);
const SIZE_OUTPUT = captured(SIZE_STDOUT, SIZE_STDERR);
const WRITE_OUTPUT = captured(writeStdout(10), WRITE_STDERR);

function found(label: string, kind: Parameters<typeof readStepSummary>[1], output: string) {
  const read = readStepSummary(label, kind, output);

  if (!read.found) throw new Error(`expected a summary for ${label}, got: ${read.why}`);

  return read;
}

describe('R955: the 14-line tail is why a count was invisible (the fixtures reproduce it)', () => {
  it('the fixtures read at all, so nothing below passes vacuously', () => {
    expect(WRITE_TEMPLATE, 'container-write.mjs prints "Production write checks  N passed (N)"').not.toBeNull();
    expect(FAILED_TEMPLATE, 'container-write.mjs prints "N FAILED:"').not.toBeNull();
    expect(TEST_OUTPUT).toContain('      Tests  4 passed (4)');
  });

  it('pnpm test: the tail is stderr noise and holds no count, while the whole output does', () => {
    expect(tailOf(TEST_OUTPUT)).not.toMatch(/Tests\s+\d+/u);
    expect(tailOf(TEST_OUTPUT)).toContain(CANVAS_WARNING);
    expect(readCount('test', TEST_OUTPUT).ran).toBe(4);
  });

  it('pnpm size: the tail starts mid-table, without its header or the calculator row', () => {
    const tail = tailOf(SIZE_OUTPUT);

    expect(tail).not.toContain(SIZE_HEADER);
    expect(tail).not.toContain('/calculateur-teletravail-frontalier           public      124.9');
    expect(SIZE_OUTPUT).toContain('/calculateur-teletravail-frontalier           public      124.9');
  });

  it('pnpm test:container:write: the tail is docker build output, without the checks line', () => {
    expect(tailOf(WRITE_OUTPUT)).not.toContain(writeLine(10));
    expect(WRITE_OUTPUT).toContain(writeLine(10));
  });

  it('gate-clone.mjs still prints exactly that tail: the summary comes in addition, not instead (R959)', () => {
    expect(GATE_CLONE).toContain("process.stdout.write(`${output.split('\\n').slice(-14).join('\\n')}\\n`);");
  });
});

describe('R955: readStepSummary reads the suite\'s own summary from the whole output', () => {
  it('pnpm test: the Test Files and Tests lines, as vitest printed them', () => {
    const read = found('pnpm test', 'vitest', TEST_OUTPUT);

    expect(read.lines).toEqual([' Test Files  1 passed (1)', '      Tests  4 passed (4)']);
    expect(read.counts).toEqual({ passed: 4, failed: 0, skipped: 0, todo: 0, total: 4, files: 1, errors: 0 });
    expect(read.phrase).toBe('4 of 4 tests passed, 1 file');
  });

  it('reads it after stripAnsi (R206, R266): the coloured capture gives the same lines', () => {
    const output = captured(VITEST_COLOUR, TEST_STDERR);

    expect(/Tests {2}\d+ passed/u.test(output), 'the raw bytes really are colour-split').toBe(false);
    expect(found('pnpm test', 'vitest', output).lines).toEqual(found('pnpm test', 'vitest', TEST_OUTPUT).lines);
  });

  it('skipped tests and files are counted, not folded into passed', () => {
    const read = found('pnpm test:db', 'vitest', captured(VITEST_SKIPPED, ''));

    expect(read.lines).toEqual([' Test Files  1 passed | 1 skipped (2)', '      Tests  3 passed | 6 skipped (9)']);
    expect(read.counts).toMatchObject({ passed: 3, skipped: 6, total: 9, files: 2 });
    expect(read.phrase).toBe('3 of 9 tests passed, 6 skipped, 2 files');
  });

  it('a red run keeps its failed, todo and Errors lines, which is when a short count matters most', () => {
    const read = found('pnpm test', 'vitest', captured(VITEST_FAILED, ''));

    expect(read.lines).toEqual([
      ' Test Files  1 failed (1)',
      '      Tests  1 failed | 2 passed | 1 todo (4)',
      '     Errors  1 error',
    ]);
    expect(read.counts).toEqual({ passed: 2, failed: 1, skipped: 0, todo: 1, total: 4, files: 1, errors: 1 });
    expect(read.phrase).toBe('2 of 4 tests passed, 1 todo, 1 failed, 1 error, 1 file');
  });

  it('agrees with gate:changed\'s own reader on every capture: one line, two readers, no drift (R206)', () => {
    for (const stdout of [VITEST_PASSED, VITEST_COLOUR, VITEST_SKIPPED, VITEST_FAILED]) {
      const output = captured(stdout, TEST_STDERR);

      expect(found('pnpm test', 'vitest', output).counts.passed).toBe(readCount('test', output).ran);
    }
  });

  it('reads Windows line endings the same', () => {
    const output = captured(VITEST_SKIPPED.split('\n').join('\r\n'), '');

    expect(found('pnpm test:db', 'vitest', output).lines).toEqual(
      found('pnpm test:db', 'vitest', captured(VITEST_SKIPPED, '')).lines,
    );
  });

  it('reads the LAST summary when a step printed two', () => {
    const read = found('pnpm test', 'vitest', captured(`${VITEST_SKIPPED}${VITEST_PASSED}`, ''));

    expect(read.counts.passed).toBe(4);
  });

  it('pnpm size: the whole per-route table, title to closing rule, whatever the tail kept', () => {
    const read = found('pnpm size', 'size', SIZE_OUTPUT);

    expect(read.lines).toEqual(SIZE_TABLE);
    expect(read.lines).toContain(
      '/calculateur-teletravail-frontalier           public      124.9    24.3   14.7   47.1  pass (A 0.1 spare, B 0.7 spare)',
    );
    expect(read.counts).toEqual({ routes: 20 });
    expect(read.phrase).toBe('20 routes measured');
  });

  it('pnpm test:container:write: its checks line, from the docker-buried output', () => {
    const read = found('pnpm test:container:write', 'production-write', WRITE_OUTPUT);

    expect(read.lines).toEqual([writeLine(10)]);
    expect(read.counts).toEqual({ passed: 10, failed: 0 });
    expect(read.phrase).toBe('10 checks passed');
    expect(read.counts.passed).toBe(readCount('test:container:write', WRITE_OUTPUT).ran);
  });

  it('pnpm test:container:write: a red run keeps its FAILED count beside the passed one', () => {
    const output = captured(writeStdout(9), `${WRITE_STDERR}\n${failedLine(1)}\n  - a check: what went wrong\n`);
    const read = found('pnpm test:container:write', 'production-write', output);

    expect(read.lines).toEqual([writeLine(9), failedLine(1)]);
    expect(read.counts).toEqual({ passed: 9, failed: 1 });
    expect(read.phrase).toBe('9 checks passed, 1 failed');
  });
});

describe('R955: a summary that cannot be found is NO RESULT, and the step is named', () => {
  function missing(label: string, kind: Parameters<typeof readStepSummary>[1], output: string): string {
    const read = readStepSummary(label, kind, output);

    if (read.found) throw new Error(`expected no summary for ${label}, read: ${read.lines.join(' / ')}`);

    expect(read.why).toContain(label);
    expect(read.why).toContain('NO RESULT');

    return read.why;
  }

  it('pnpm test cut to its tail - what the log used to show - has no summary', () => {
    missing('pnpm test', 'vitest', tailOf(TEST_OUTPUT));
  });

  it('a Test Files line with no Tests line beneath it is not a summary', () => {
    missing('pnpm test', 'vitest', ' Test Files  1 passed (1)\n   Start at  23:21:30\n');
  });

  it('a Tests line on its own - a test printing one, say - is not a summary', () => {
    missing('pnpm test', 'vitest', '      Tests  5 passed (5)\n');
  });

  it('pnpm size with its rows gone FAILS, though its verdict sentence - the only thing the old check read - is still there', () => {
    const rowless = captured(SIZE_STDOUT.replace(`${SIZE_ROWS.join('\n')}\n`, ''), SIZE_STDERR);

    expect(rowless).not.toContain('/calculateur-teletravail-frontalier');
    expect(/All gated routes pass both gates/u.test(stripAnsi(rowless)), 'R133\'s check alone reads this as a pass').toBe(
      true,
    );
    missing('pnpm size', 'size', rowless);
  });

  it('pnpm size with no table at all has no summary', () => {
    missing('pnpm size', 'size', 'All gated routes pass both gates.\n');
  });

  it('pnpm size with a malformed row is not read as a table', () => {
    missing('pnpm size', 'size', SIZE_OUTPUT.replace('/cgu                                          public      108.4', '/cgu public ???'));
  });

  it('pnpm test:container:write with no checks line has no summary', () => {
    missing('pnpm test:container:write', 'production-write', captured(writeStdout(10).replace(writeLine(10), ''), WRITE_STDERR));
  });

  it('an unknown reader is a defect in the script, not a gate verdict, so it throws', () => {
    expect(() =>
      readStepSummary('pnpm test', 'junit' as Parameters<typeof readStepSummary>[1], TEST_OUTPUT),
    ).toThrow(/junit/u);
  });
});

describe('R955 in gate-clone.mjs: the steps that report a count declare their reader', () => {
  it.each([
    ['pnpm test', 'test', 'vitest'],
    ['pnpm size', 'size', 'size'],
    ['pnpm test:db', 'test:db', 'vitest'],
    ['pnpm test:container:write', 'test:container:write', 'production-write'],
  ])('%s is read as %s', (label, script, kind) => {
    const tuple = new RegExp(
      `'${label}',\\s*'pnpm',\\s*\\['${script}'\\],\\s*/[^\\n]*/[a-z]*,\\s*'${kind}',?\\s*\\]`,
      'u',
    );

    expect(GATE_CLONE).toMatch(tuple);
  });

  it('run() reads the summary from the whole output, before it judges the exit code', () => {
    const reads = GATE_CLONE.indexOf('readStepSummary(label, summary, output)');
    const judges = GATE_CLONE.indexOf('if (child.status !== 0) {');

    expect(reads, 'run() reads the summary').toBeGreaterThan(-1);
    expect(judges).toBeGreaterThan(-1);
    expect(reads).toBeLessThan(judges);
  });

  it('a missing summary fails the step with the reader\'s reason, after the exit code and R133\'s check', () => {
    const r133 = GATE_CLONE.indexOf('if (!expect.test(stripAnsi(output))) {');
    const r955 = GATE_CLONE.indexOf('return { ok: false, why: read.why, output };');

    expect(r955, 'a missing summary returns ok: false').toBeGreaterThan(-1);
    expect(r955).toBeGreaterThan(r133);
  });
});
