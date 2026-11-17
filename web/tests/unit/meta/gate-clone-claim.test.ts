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
// R956: THE CLAIM LINE CARRIES THE COUNTS. The list was a hand-typed template
// of step names, so "passes test" read the same at 3 765 tests as at 37. Now
// each step is recorded as it completes, with the count its own summary gave
// (R955), and the "ran" line and the claim are both rendered from that one
// record - so the claim cannot name a step that did not run, and cannot carry
// a number the summary did not print (R206).
//
// A SOURCE SCAN for the wiring, matching gate-clone-cleanup.test.ts and
// gate-clone-ansi.test.ts - gate-clone.mjs is a top-level script with real
// side effects - plus describeRan itself, which renders the record.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeRan } from '../../../scripts/gate-clone-parts.mjs';
import { withoutComments } from '@/tests/support/quoted-spans';

const SOURCE = readFileSync(join(import.meta.dirname, '../../../scripts/gate-clone.mjs'), 'utf8');
const CODE = withoutComments(SOURCE);

describe('gate-clone.mjs states its claim, with the counts it read (FW32 AC3, R956)', () => {
  it('the "ran" line and the claim sentence share one source: the record of what ran', () => {
    expect(CODE).toContain('const ranSteps = describeRan(ran);');
    expect(CODE).toContain('`  ran     ${ranSteps}`');
    expect(CODE).toContain('this commit builds and passes ${ranSteps} from a clean checkout');
  });

  it('no hand-typed list of step names is left to drift from what ran', () => {
    expect(CODE).not.toMatch(/['"`]register-coverage, fixture-coverage/u);
  });

  it('every step is recorded as it completes, with the count its summary gave', () => {
    expect(CODE).toContain("ran.push({ step: 'register-coverage' });");
    expect(CODE).toContain("ran.push({ step: 'fixture-coverage' });");
    // The steps loop and the database loop: each pnpm step is recorded under
    // its script's name, which is the name the list always used.
    expect(CODE.match(/ran\.push\(\{ step: args\[0\], counts: result\.counts \}\);/gu)).toHaveLength(2);
  });

  it('describeRan puts each count beside its own step, and leaves a step without one bare', () => {
    expect(
      describeRan([
        { step: 'install' },
        { step: 'test', counts: '3765 of 3765 tests passed, 190 files' },
        { step: 'size', counts: '20 routes measured' },
        { step: 'db:deploy' },
      ]),
    ).toBe('install, test (3765 of 3765 tests passed, 190 files), size (20 routes measured), db:deploy');
  });

  it('describeRan of nothing is nothing, never a claim about steps that did not run', () => {
    expect(describeRan([])).toBe('');
  });

  it('the claim sentence names what a clean checkout lacks, not only what ran', () => {
    expect(SOURCE).toMatch(/no \.env, no prior node_modules/u);
  });

  it('the negative claim list (R256, from FW31) is still intact alongside the positive one', () => {
    expect(SOURCE).toContain('NOT RUN HERE, AND THE CLAIM EACH ONE IS THEREFORE NOT MAKING');
  });
});
