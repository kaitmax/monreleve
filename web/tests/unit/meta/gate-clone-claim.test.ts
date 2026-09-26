// web/tests/unit/meta/gate-clone-claim.test.ts
//
// FW32, AC3: WHAT THE VERIFIER CLAIMS. gate:clone already named, per step,
// why a suite could not run here and the claim it was therefore not making
// (FW31, R256) - but "GATE:CLONE PASSED" followed by a list of suite names
// still left a reader to assemble the POSITIVE claim themselves, the way a
// list of names read as soundness on every production build that wrote zero
// rows (REPORT-FW31.txt). This is the one sentence that states it: "this
// commit builds and passes X, Y, Z from a clean checkout."
//
// A SOURCE SCAN, matching gate-clone-cleanup.test.ts and gate-clone-ansi.
// test.ts - gate-clone.mjs is a top-level script with real side effects,
// and the claim sentence was verified end to end in increment 2's real
// gate:clone run (REPORT-FW32.txt records its exact wording there). This
// guards the SHAPE: one source for what ran, never two lists that can drift
// apart from each other.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(import.meta.dirname, '../../../scripts/gate-clone.mjs'), 'utf8');

describe('gate-clone.mjs states its claim, not only its suite list (FW32, AC3)', () => {
  it('the "ran" line and the claim sentence share one source', () => {
    const ranStepsDeclaration = SOURCE.match(/const ranSteps = `[^`]*`;/);

    expect(ranStepsDeclaration, 'expected one const ranSteps = `...` declaration').not.toBeNull();

    // Both consumers reference the same variable rather than re-deriving it.
    expect(SOURCE).toContain('`  ran     ${ranSteps}`');
    expect(SOURCE).toContain('this commit builds and passes ${ranSteps} from a clean checkout');
  });

  it('the claim sentence names what a clean checkout lacks, not only what ran', () => {
    expect(SOURCE).toMatch(/no \.env, no prior node_modules/);
  });

  it('the negative claim list (R256, from FW31) is still intact alongside the new positive one', () => {
    expect(SOURCE).toContain('NOT RUN HERE, AND THE CLAIM EACH ONE IS THEREFORE NOT MAKING');
  });
});
