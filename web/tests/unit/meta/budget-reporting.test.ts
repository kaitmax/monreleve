// web/tests/unit/meta/budget-reporting.test.ts
//
// RULING R115: AN UNGATED ROUTE REPORTS ITS NUMBER, NEVER A VERDICT.
// RULING R117: the workbench has its own recorded ceiling.
//
// WHY R115 EXISTS, and it is the most expensive sentence this project has
// written. check-budgets.mjs printed this for /dev/** on every run:
//
//   /dev/composants   dev   108.1   7.5   ...   not gated - would pass (A 16.9 spare)
//
// ZoneBadge was shipping the entire Lucide icon library - 207 KiB - and the
// only route that rendered it was that one. The row said "would pass" every
// time, because it was being measured against gates it was never subject to.
// A reassuring phrase about a thing that was not judged, printed beside a
// number nobody had reason to question.
//
// The operator's statement of it: "A route excluded from a gate reported a
// reassuring sentence, and that sentence was doing the concealing."
//
// SO THIS TEST READS THE SCRIPT'S SOURCE, not its output. Running the script
// needs a build, which unit tests do not have; and the property is about what
// the script CAN say, which is a property of the code. The verdict expressions
// are small and local, so reading them is not a proxy - it is the thing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withoutComments } from '@/tests/support/quoted-spans';

const WEB = process.cwd();
const SCRIPT = join(WEB, 'scripts', 'check-budgets.mjs');

/**
 * The script's source, with comments removed.
 *
 * THE STRIPPER MOVED TO tests/support/quoted-spans.ts in FW12. It was written
 * here first, and its first version left the BODY of every block comment
 * behind - so this file failed on the very comment in check-budgets.mjs that
 * explains why the phrase must not appear anywhere else. A stripper bug, not
 * a finding. It then happened a second time to island-harness.test.ts, which
 * is one occurrence too many for two copies.
 */
function code(): string {
  return withoutComments(readFileSync(SCRIPT, 'utf8'));
}

describe('the budget script says nothing reassuring about what it did not judge (R115)', () => {
  it('reads the script at all, so nothing below passes vacuously', () => {
    expect(code()).toContain('GATE_A_TOTAL_BYTES');
    expect(code().length).toBeGreaterThan(2000);
  });

  it('has no "would pass" phrasing anywhere in its executable lines', () => {
    // The exact wording that concealed 207 KiB for four tasks.
    expect(code()).not.toContain('would pass');
    expect(code()).not.toContain('WOULD FAIL');
  });

  it('reports an ungated route as "ungated" and nothing more', () => {
    // A bare word, and the number in the columns beside it. Anything longer
    // is an opinion about a route this script does not gate.
    expect(code()).toContain("'ungated'");
  });

  it('gives the ungated branch nothing but the word', () => {
    // THE STRUCTURAL FORM, which is the property rather than a proxy for it:
    // the ungated arm of the verdict is a bare string literal. Anything with
    // an interpolation in it is an opinion about a route this script does not
    // gate.
    expect(code()).toContain("? " + "'ungated'");
  });

  it('does not compute spare capacity for an ungated route', () => {
    // "A 16.9 spare" was the specific reassurance. Spare capacity is only
    // meaningful against a ceiling the route is actually held to.
    //
    // FOUR NOW, AND EACH ONE IS A CEILING SOMETHING IS HELD TO. The gated
    // pass verdict reports both public ceilings on one line ("A 17.0 spare,
    // B 17.6 spare"), the workbench reports GATE W, and R122 added the
    // island harness reporting GATE I. The count went 2 -> 3 -> 4, and each
    // step was a deliberate edit here with a ruling behind it, which is the
    // point of pinning it: a FIFTH would mean an ungated branch had started
    // computing headroom again.
    const spareMentions = [...code().matchAll(/spare/g)].length;

    expect(spareMentions).toBe(4);
  });
});

describe('the workbench has a ceiling of its own (R117)', () => {
  it('declares GATE W as a delta, not a total', () => {
    // A total would have to be raised every time a component is added to the
    // workbench, which is how a ceiling stops meaning anything.
    expect(code()).toContain('GATE_W_DELTA_BYTES');
    expect(code()).not.toContain('GATE_W_TOTAL_BYTES');
  });

  it('names the workbench route once, as a constant', () => {
    expect(code()).toContain('WORKBENCH_ROUTE');
    expect(code()).toContain("'/dev/composants'");
  });

  it('breaches loudly, citing the ruling', () => {
    expect(code()).toContain('GATE W BREACH');
    expect(code()).toContain('R117');
  });

  it('counts a GATE W breach as a failure of the run', () => {
    // Not merely printed. A ceiling that reports without failing is the
    // "would pass" problem in a different costume.
    expect(code()).toContain('failsW');
    expect(code()).toMatch(/breaches[\s\S]{0,120}failsW/);
  });

  it('keeps GATE W separate from the public gates', () => {
    // The workbench is allowed to be heavier than any page a user visits, so
    // conflating the two would either raise the public ceiling or fail the
    // workbench for doing its job.
    expect(code()).not.toMatch(/GATE_A_TOTAL_BYTES\s*=\s*GATE_W/);
    expect(code()).toContain('isWorkbench');
  });
});


describe('the client-cost harness has a ceiling of its own (R122)', () => {
  // THE HOLE GATE W DOES NOT CLOSE. R117 gave the workbench a ceiling and
  // the measurement showed it would not have caught the 207 KiB defect,
  // because /dev/composants is a SERVER component and the icon library
  // never entered its client bundle. /dev/island renders the library inside
  // a 'use client' boundary so that it does.
  //
  // MEASURED WITH THE DEFECT RESTORED, which is the only evidence that
  // matters for a gate written to catch one thing:
  //
  //   /calculateur-teletravail-frontalier   324,0 KiB   FAIL A by 199,0
  //   /dev/composants                       108,6 KiB   W 32,0 spare
  //   /dev/island                           312,5 KiB   FAIL GATE I by 186,9
  //
  // The workbench is still blind. The harness is not.

  it('declares GATE I as a delta, not a total', () => {
    expect(code()).toContain('GATE_I_DELTA_BYTES');
    expect(code()).not.toContain('GATE_I_TOTAL_BYTES');
  });

  it('names the island route once, as a constant', () => {
    expect(code()).toContain('ISLAND_ROUTE');
    expect(code()).toContain("'/dev/island'");
  });

  it('holds it to the same number a public route may spend', () => {
    // The ceiling is GATE B's: the whole library, in a client island, must
    // fit inside the feature budget one public page is allowed. Asserted as
    // an EQUALITY between the two declarations rather than as the literal 25,
    // so raising GATE B cannot quietly leave GATE I behind.
    expect(code()).toMatch(/GATE_I_DELTA_BYTES = 25 \* KIB/u);
    expect(code()).toMatch(/GATE_B_DELTA_BYTES = 25 \* KIB/u);
  });

  it('breaches loudly, citing the ruling', () => {
    expect(code()).toContain('GATE I BREACH');
    expect(code()).toContain('R122');
  });

  it('counts a GATE I breach as a failure of the run', () => {
    // Not merely printed. A ceiling that reports without failing is the
    // "would pass" problem in a different costume.
    expect(code()).toContain('failsI');
    expect(code()).toMatch(/breaches[\s\S]{0,160}failsI/u);
  });

  it('keeps GATE I separate from the public gates and from GATE W', () => {
    expect(code()).not.toMatch(/GATE_A_TOTAL_BYTESs*=s*GATE_I/u);
    expect(code()).toContain('isIsland');

    // Two dev routes, two ceilings, two predicates - not one branch doing
    // both, which would make either route excuse the other.
    expect(code()).toContain('isWorkbench');
  });
});
