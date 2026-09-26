// web/tests/unit/meta/gate-clone-sweep.test.ts
//
// FW32, increment 4: THE LEAK'S SECOND LIFE. Increment 1 fixed both known
// causes of a leaked clone; this bounds the damage when cleanup fails for a
// cause nobody has found yet (or, on this machine, a SIGKILL-equivalent
// kill neither increment 1's signal handler nor a plain SIGTERM can stop -
// see REPORT-FW32.txt, THE LEAK). Nine clones accumulated over eleven days
// because nothing ever looked; sweepStaleClones() looks at the start of
// every run.
//
// A SOURCE SCAN for the shape, matching this file's siblings - the actual
// proof is adversarial and real (REPORT-FW32.txt, THE SWEEP): a genuinely
// aged fake clone and a fresh one placed in the real temp directory, a real
// `node scripts/gate-clone.mjs` run, and the printed sweep count checked
// against which directory survived.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(import.meta.dirname, '../../../scripts/gate-clone.mjs'), 'utf8');

describe('gate-clone.mjs sweeps stale clones before creating its own (FW32, increment 4)', () => {
  it('the sweep runs before this run\'s own clone is created, so it cannot sweep itself', () => {
    const sweepCallIndex = SOURCE.indexOf('const swept = sweepStaleClones();');
    const ownCloneIndex = SOURCE.indexOf("const clone = mkdtempSync(join(tmpdir(), 'monreleve-clone-'));");

    expect(sweepCallIndex, 'expected a sweepStaleClones() call').toBeGreaterThan(-1);
    expect(ownCloneIndex, 'expected this run\'s own clone creation').toBeGreaterThan(-1);
    expect(sweepCallIndex).toBeLessThan(ownCloneIndex);
  });

  it('STALE_HOURS is a small number of hours, not a guess left as a TODO', () => {
    const match = SOURCE.match(/const STALE_HOURS = (\d+);/);

    expect(match, 'expected a numeric STALE_HOURS constant').not.toBeNull();

    const hours = Number(match![1]);

    // Every full chain measured this task (REPORT-FW32.txt, THE SWEEP)
    // finished in single-digit minutes; this only asserts the constant
    // stays in the "hours, not minutes, not days" band the reasoning
    // requires, not the exact value.
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it('only directories named monreleve-clone- are ever candidates for the sweep', () => {
    expect(SOURCE).toContain("entry.name.startsWith('monreleve-clone-')");
  });

  it('the sweep result is printed, count and reclaimed size, never silently applied', () => {
    expect(SOURCE).toContain('swept     no stale clones');
    expect(SOURCE).toMatch(/swept\s+\$\{swept\.count\}/);
  });

  it('directorySize and rmSync are both used, so a sweep counts what it actually reclaims', () => {
    expect(SOURCE).toContain('function directorySize(path)');
    expect(SOURCE).toMatch(/const size = directorySize\(path\);\s*\n\s*rmSync\(path/);
  });
});
