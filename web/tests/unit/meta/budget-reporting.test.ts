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

const WEB = process.cwd();
const SCRIPT = join(WEB, 'scripts', 'check-budgets.mjs');

/**
 * The script's source, with comments removed.
 *
 * BLOCK COMMENTS ARE TRACKED, not guessed from the line's first characters.
 * The first version of this filtered lines beginning with a slash or a star,
 * which left the BODY of every block comment behind - and this file's subject
 * is a phrase that now appears in check-budgets.mjs only inside a block
 * comment explaining why it must not appear anywhere else. So the test failed
 * on its own documentation, which is a stripper bug and not a finding.
 */
function code(): string {
  const NEWLINE = String.fromCharCode(10);
  const lines = readFileSync(SCRIPT, 'utf8').split(NEWLINE);
  const kept: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      // A single-line /* ... */ opens and closes on the same line.
      if (!trimmed.includes('*/')) inBlock = true;
      continue;
    }

    if (trimmed.startsWith('//')) continue;

    kept.push(line);
  }

  return kept.join(NEWLINE);
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
    // THREE, and the first version of this said two - which was simply wrong
    // rather than a finding. The gated pass verdict reports BOTH ceilings on
    // one line ("A 17.0 spare, B 17.6 spare"), so two of the three are that
    // line and the third is the workbench's own. A fourth would mean an
    // ungated branch had started computing headroom again.
    const spareMentions = [...code().matchAll(/spare/g)].length;

    expect(spareMentions).toBe(3);
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
