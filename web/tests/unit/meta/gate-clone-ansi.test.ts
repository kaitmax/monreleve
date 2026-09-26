// web/tests/unit/meta/gate-clone-ansi.test.ts
//
// FW32, AC2: THE SILENCE. gate-clone.mjs's run() tested each step's `expect`
// pattern against RAW spawnSync output. vitest's own summary line splits
// "Test Files" from its digits with colour codes -
// `Test Files\x1b[22m \x1b[1m\x1b[32m164 passed...` - and \s+ does not
// bridge an escape sequence, so a run that had just passed 2907/2907 read
// as silence and failed this exact check, deterministically, on every fresh
// clone this task tried (REPORT-FW32.txt, THE SILENCE). NOT an environment
// or resource defect - R265's own hypothesis, tested first, reproduced
// identically at 17 GB free as at the original 8.5 GB, and was disproved by
// that measurement rather than by argument.
//
// NOT A NEW DEFECT CLASS: REPORT-FW31.txt's own PUSH PROOF already named
// "one in gate-clone" among nine colour-fragile patterns and closed only
// container-e2e.mjs's instance (SUITE_COUNTS, via stripAnsi in readCount).
// This is that instance, closed the same way - imported, not copied (R206).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../../../scripts/gate-selection.mjs';

const SOURCE_PATH = join(import.meta.dirname, '../../../scripts/gate-clone.mjs');
const SOURCE = readFileSync(SOURCE_PATH, 'utf8');

/**
 * Transcribed by codepoint (R96), not pasted as rendered text: \x1b is the
 * literal ESC byte vitest's colour output puts before every "[...m" code, in
 * the exact positions captured from a real fresh-clone `pnpm test` run that
 * had just passed 2907/2907 tests (REPORT-FW32.txt, THE SILENCE) - not an
 * invented string, the one that broke the old check.
 */
const ESC = '\x1b';
const REAL_VITEST_SUMMARY_FIXTURE = `${ESC}[2m Test Files ${ESC}[22m ${ESC}[1m${ESC}[32m164 passed${ESC}[39m${ESC}[22m${ESC}[90m (164)${ESC}[39m\n`;

const TEST_PASS_PATTERN = /Test Files\s+\d+ passed/;

describe('gate-clone.mjs strips ANSI before checking a step passed (FW32, AC2)', () => {
  it('the captured fixture is genuinely colour-broken against the raw pattern - the failure this fixes, reproduced from real bytes', () => {
    expect(TEST_PASS_PATTERN.test(REAL_VITEST_SUMMARY_FIXTURE)).toBe(false);
  });

  it('stripAnsi + the same pattern reads the same fixture as a pass', () => {
    expect(TEST_PASS_PATTERN.test(stripAnsi(REAL_VITEST_SUMMARY_FIXTURE))).toBe(true);
  });

  it('gate-clone.mjs imports stripAnsi from gate-selection.mjs rather than a local copy (R206)', () => {
    expect(SOURCE).toContain("import { stripAnsi } from './gate-selection.mjs';");
  });

  it('the expect check in run() tests stripAnsi(output), not raw output', () => {
    expect(SOURCE).toMatch(/if \(!expect\.test\(stripAnsi\(output\)\)\) \{/);
    // Guards against a partial fix that strips for display but checks raw -
    // the display line is allowed to stay coloured; only the CHECK must not.
    expect(SOURCE).not.toMatch(/if \(!expect\.test\(output\)\) \{/);
  });
});
