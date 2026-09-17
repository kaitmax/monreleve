// web/tests/unit/meta/check-ordering.test.ts
//
// RULING R182: A CHECK RUNS AFTER THE THING IT CHECKS FOR CAN EXIST.
//
// ORDER IS PART OF A GUARD'S SPECIFICATION, and this file is where that stops
// being a sentence in CLAUDE.md and becomes a thing the suite refuses.
//
// THE CLASS IS NEW AND IT IS NOT THE ONE FW17-FW20 KEPT FINDING. Those were
// guards verifying the absence of the WRONG THING - an assertion satisfied by
// a mechanism that produced nothing at all. These verify the RIGHT thing at
// the WRONG MOMENT. Every one of them is individually, correctly true when it
// runs; what is false is the implication a reader draws from a green gate.
//
// THE TWO INSTANCES, both with subjects produced by test:visual:
//
//   distdir-leaks.test.ts  reads tsconfig.json and next-env.d.ts, which the
//                          visual container rewrites to its per-run distDir
//                          and scripts/visual.mjs restores afterwards. FW20b
//                          found both files dirty AFTER a green gate: the
//                          detector had run minutes before the run that
//                          corrupted them, and `tsc --noEmit` exits 0 on a
//                          dead /// <reference path>, so nothing else
//                          objected.
//
//   og-image.test.ts       asserts public/opengraph-image.png is
//                          byte-identical to tests/visual/baselines/
//                          og-card.png - a baseline PRODUCED by
//                          e2e/og.visual.spec.ts. The drift check for the
//                          card this product serves to Twitter and LinkedIn
//                          runs before the step that can make it drift.
//
// TWICE RATHER THAN MOVED, which is the half of R182 worth arguing. The early
// run catches a leak INHERITED from a previous crashed run - which is the
// state FW20b actually found the tree in - and the late run catches one this
// gate created. Moving them would trade one blind spot for the other.
//
// WHAT THIS FILE ASSERTS is the wiring, not the checks: that the late suite
// exists, that it names exactly the files whose subject test:visual produces,
// and that the gate appends it after test:visual whenever test:visual runs.
// The checks themselves are asserted where they live.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROWSER_SUITES, LATE_SUITES, selectSuites } from '../../../scripts/gate-selection.mjs';

const WEB = process.cwd();

const packageJson = JSON.parse(
  readFileSync(join(WEB, 'package.json'), 'utf8'),
) as { readonly scripts: Record<string, string> };

/**
 * The checks whose subject a later step in the chain produces.
 *
 * NAMED, NOT PATTERN-MATCHED. A pattern over "tests that read a baseline"
 * would have to guess, and the judgement here is not mechanical: it is
 * whether the artefact the check reads is written by something the gate runs
 * afterwards. Two files today, each with the producer named.
 */
const LATE_CHECKS: ReadonlyArray<{ readonly file: string; readonly producedBy: string }> = [
  {
    file: 'tests/unit/meta/distdir-leaks.test.ts',
    producedBy: 'scripts/visual.mjs rewrites tsconfig.json and next-env.d.ts',
  },
  {
    file: 'tests/unit/meta/og-image.test.ts',
    producedBy: 'e2e/og.visual.spec.ts writes tests/visual/baselines/og-card.png',
  },
];

describe('R182: the late checks have a suite of their own', () => {
  it('declares one, and it names every late check', () => {
    const script = packageJson.scripts['test:late'];

    expect(script, 'package.json has no test:late script').toBeDefined();

    for (const { file, producedBy } of LATE_CHECKS) {
      expect(script, `${file} is a late check (${producedBy}) and test:late omits it`).toContain(
        file,
      );
    }
  });

  it('still runs them early too, because the two runs catch different things', () => {
    // NOT A DUPLICATE. `pnpm test` has no explicit file list - it runs
    // vitest's globs - so the early run is automatic and the assertion is
    // that nothing has excluded these two from it.
    const config = readFileSync(join(WEB, 'vitest.config.ts'), 'utf8');

    for (const { file } of LATE_CHECKS) {
      expect(config, `${file} has been excluded from the early run`).not.toContain(file);
    }
  });

  it('is appended after test:visual whenever test:visual is selected', () => {
    // THE ORDERING ASSERTION, and it is the point of the file. A suite that
    // exists but runs first is the defect R182 names, wearing a new name.
    const { suites } = selectSuites(['web/lib/fr/legal.ts']);

    expect(suites, 'a lib/fr change must select the browser suites').toContain('test:visual');
    expect(suites, 'and the late suite with them').toContain('test:late');

    expect(
      suites.indexOf('test:late'),
      'test:late must come AFTER test:visual, which is the whole ruling',
    ).toBeGreaterThan(suites.indexOf('test:visual'));
  });

  it('is absent when nothing browser-facing changed, because nothing can leak', () => {
    // THE OTHER HALF, so the suite is not merely always-on. If test:visual
    // does not run, nothing rewrites tsconfig.json or og-card.png, and a
    // second execution of two file-reading tests would be noise.
    const { suites } = selectSuites(['web/scripts/suite-floor.json']);

    expect(suites).not.toContain('test:visual');
    expect(suites, 'no visual run, nothing to re-check').not.toContain('test:late');
  });

  it('LATE_SUITES and BROWSER_SUITES do not overlap', () => {
    // A suite in both would run twice for one reason rather than once for
    // each of two, which is a different claim and a confusing selection.
    for (const suite of LATE_SUITES) {
      expect(BROWSER_SUITES, `${suite} is in both lists`).not.toContain(suite);
    }
  });
});
