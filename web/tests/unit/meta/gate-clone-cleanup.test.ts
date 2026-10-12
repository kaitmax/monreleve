// web/tests/unit/meta/gate-clone-cleanup.test.ts
//
// FW32, AC1: a failed gate:clone run must not leak its temp clone.
// process.exit() does not unwind to a pending finally (a documented Node.js
// semantic, not a bug in gate-clone.mjs) - so every process.exit(1) call
// that used to sit inside its own try block bypassed the cleanup that sat
// in that try's finally. This is the fence against that returning.
//
// A SOURCE SCAN, not an import: gate-clone.mjs is a top-level script with
// real side effects (a git clone, spawnSync, a scratch database) on every
// execution, which is why AC1's actual proof (REPORT-FW32.txt, THE LEAK) is
// three full runs with a forced failure planted at each of the three
// step-failure sites, each checked against the real temp directory and the
// real scratch database afterward - too slow and too side-effecting to
// belong in `pnpm test`. What belongs here is cheaper and different: a
// static guarantee that nobody re-introduces the exact class of bug this
// task fixed, the way RadiusTest.kt and FencesTest.kt do for the Android
// side and R147's scans do elsewhere on this one.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = join(import.meta.dirname, '../../../scripts/gate-clone.mjs');
const SOURCE = readFileSync(SOURCE_PATH, 'utf8');

/**
 * Strips `//` and `/* *\/` comments before any pattern match below runs.
 * Without this, the header comments explaining what USED TO be wrong (which
 * quote `process.exit(1)` verbatim, in prose, on purpose) would self-trigger
 * the very check meant to catch a real regression - the same shape AN1's
 * FencesTest.kt documents for Kotlin KDoc quoting its own fence's targets.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CODE = stripComments(SOURCE);

describe('gate-clone.mjs cleans up on every failure path (FW32, AC1)', () => {
  it('the top-level try block never calls process.exit - only throw', () => {
    const tryStart = CODE.indexOf('\ntry {');
    const catchStart = CODE.indexOf('\n} catch (err) {');

    expect(tryStart, 'expected a top-level try block').toBeGreaterThan(-1);
    expect(catchStart, 'expected a matching catch after it').toBeGreaterThan(tryStart);

    const tryBody = CODE.slice(tryStart, catchStart);

    expect(tryBody).not.toContain('process.exit(');
  });

  it('exactly five step-failure paths throw GateCloneFailure - register-coverage (R327), fixture-coverage (R348), the clone/HEAD mismatch, the steps loop, the database loop', () => {
    const matches = CODE.match(/throw new GateCloneFailure/g) ?? [];

    // R327 added the register-coverage step and ENGINE-PARITY (R348) added the
    // fixture-coverage step (web/scripts/fixture-coverage.mjs, the one definition
    // FixtureCoverageTest.kt also runs). Each throws like every other step-failure
    // path so the finally's cleanup runs on its failure too - which is exactly the
    // invariant FW32 AC1 guards, not a new exception to it.
    expect(matches.length).toBe(5);
  });

  it('the catch sets exitCode for an expected failure and rethrows anything else', () => {
    expect(CODE).toContain('} catch (err) {');
    expect(CODE).toContain('if (err instanceof GateCloneFailure) {');
    expect(CODE).toMatch(/process\.exitCode = 1;/);
    expect(CODE).toMatch(/\}\s*else\s*\{\s*throw err;\s*\}/);
  });

  it('finally always runs the one cleanup function, unconditionally', () => {
    expect(CODE).toMatch(/\}\s*finally\s*\{\s*await cleanup\(\);\s*\}/);
  });

  it('cleanup() removes the clone with force:true, so a concurrent second call is harmless', () => {
    expect(CODE).toContain('async function cleanup() {');
    expect(CODE).toMatch(/rmSync\(clone, \{ recursive: true, force: true \}\)/);
  });

  it('SIGINT and SIGTERM are both registered, and process.exit appears nowhere except their shared handler', () => {
    expect(CODE).toContain("process.on('SIGINT'");
    expect(CODE).toContain("process.on('SIGTERM'");

    const exitCalls = [...CODE.matchAll(/process\.exit\(/g)];

    expect(exitCalls.length, 'expected exactly one process.exit( call in the whole file').toBe(1);

    const onSignalStart = CODE.indexOf('async function onSignal');
    const onSignalEnd = CODE.indexOf("process.on('SIGINT'");

    expect(onSignalStart, 'expected an onSignal function').toBeGreaterThan(-1);
    expect(exitCalls[0]!.index).toBeGreaterThan(onSignalStart);
    expect(exitCalls[0]!.index).toBeLessThan(onSignalEnd);
  });
});
