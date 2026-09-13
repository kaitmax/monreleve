// web/tests/unit/meta/gate-selection.test.ts
//
// RULING R132, as amended before its first use: THE GATE IS SELECTED BY
// CHANGED PATHS.
//
// WHY THE RULING EXISTS. FW13 put two red commits on main. Both passed
// `pnpm typecheck && pnpm lint && pnpm test && pnpm build` - the chain
// CLAUDE.md called green - and both failed CI on suites that chain does not
// contain: two live-region COUNT assertions in e2e/calculateur.spec.ts, and
// fourteen visual baselines at zero tolerance. The share row is a second
// aria-live region and adds 98 px to every calculator page, so both failures
// were the same edit seen by two suites nobody had run.
//
// WHY THE SELECTOR IS TESTED RATHER THAN TRUSTED. A path selector fails in a
// direction that looks like success: it runs, it prints a selection, it exits
// 0, and the suites it forgot are exactly the ones that would have failed.
// That is the shape of every defect FW11-FW13 turned up, so the selector gets
// the treatment - a table of paths with the answer stated, and the real paths
// of the two commits the ruling was written for.
//
// THE AMENDMENT IS ASSERTED HERE TOO, because it is the part most likely to
// be undone by somebody tidying. The first version of R132 named test:visual
// and test:a11y. test:a11y runs three files, all matched by pnpm test's own
// globs, so requiring it is ceremony; test:e2e was missing, and it is the
// suite that caught half the failure. a11y is still NAMED in the printed
// selection so that its absence reads as considered rather than forgotten.

import { describe, expect, it } from 'vitest';
import {
  BASE_SUITES,
  SELECTOR_PATTERNS,
  SUITE_COUNTS,
  describeSelection,
  readCount,
  selectSuites,
} from '../../../scripts/gate-selection.mjs';

/**
 * The two commits R132 was written for, by their real paths.
 *
 * Taken from `git show --stat fdca008` and `2f2cbd2`. Hardcoded rather than
 * read from git: CI clones shallowly, and a test that silently skips when a
 * commit is absent is the vacuous pass this file exists to prevent.
 */
const FDCA008 = [
  'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.module.scss',
  'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx',
  'web/lib/fr/params.ts',
  'web/tests/setup/address-bar.ts',
  'web/tests/unit/pages/calculateur.test.tsx',
  'web/tests/unit/pages/share-controls.test.tsx',
  'web/vitest.config.ts',
];

const TWO_F_2CBD2 = [
  'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx',
  'web/lib/params/handoff.ts',
  'web/tests/setup/browser-state.ts',
  'web/tests/unit/pages/storage-handoff.test.tsx',
  'web/vitest.config.ts',
];

/** The commit that moved the relay prompts. Text only; no code path. */
const RELAY_MOVE = ['relay/FW12.txt', 'relay/FW13.txt', 'relay/FW14.txt'];

const suitesFor = (paths: readonly string[]): readonly string[] =>
  selectSuites(paths).suites;

describe('R132: the paths that select the visual and end-to-end suites', () => {
  it.each([
    ['a public route component', 'web/app/(public)/calculateur/Form.tsx'],
    ['a UI component', 'web/lib/ui/react/PublicShell/PublicShell.tsx'],
    ['French copy', 'web/lib/fr/params.ts'],
    ['a CSS module anywhere', 'web/app/(public)/x/Thing.module.scss'],
    ['a CSS module under lib', 'web/lib/ui/react/Badge/Badge.module.scss'],
    ['the token layer', 'web/lib/ui/core/styles/tokens.scss'],
  ])('%s selects e2e and visual', (_label, path) => {
    const suites = suitesFor([path]);

    expect(suites, path).toContain('test:e2e');
    expect(suites, path).toContain('test:visual');
  });

  it.each([
    ['the engine', 'web/lib/calc-engine/compute.ts'],
    ['a unit test', 'web/tests/unit/pages/calculateur.test.tsx'],
    ['a script', 'web/scripts/check-budgets.mjs'],
    ['the vitest config', 'web/vitest.config.ts'],
    ['a relay prompt', 'relay/FW14.txt'],
    ['a report', 'REPORT-FW13.txt'],
    ['the readme', 'README.md'],
  ])('%s selects neither', (_label, path) => {
    const suites = suitesFor([path]);

    expect(suites, path).not.toContain('test:e2e');
    expect(suites, path).not.toContain('test:visual');
  });

  it('runs the base chain whatever changed, including nothing at all', () => {
    // A selector that could return an EMPTY chain would turn "the gate for
    // the paths you changed" into no gate at all for the right diff.
    for (const paths of [[], ['README.md'], FDCA008]) {
      expect(suitesFor(paths)).toEqual(expect.arrayContaining([...BASE_SUITES]));
    }
  });
});

describe('R132 against the two commits it was written for', () => {
  it('selects e2e and visual for fdca008, which went red on both', () => {
    // THE PROOF. This commit passed the old four-command chain and failed CI
    // on e2e and on the baselines. The selector has to fire on it, or the
    // ruling closes nothing.
    const { suites, matched } = selectSuites(FDCA008);

    expect(suites).toContain('test:e2e');
    expect(suites).toContain('test:visual');

    // And for the RIGHT reason: three of its paths match, and they are the
    // three that changed what a browser renders.
    expect(matched.map((hit) => hit.path).sort()).toEqual([
      'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.module.scss',
      'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx',
      'web/lib/fr/params.ts',
    ]);
  });

  it('selects e2e and visual for 2f2cbd2, which inherited the same failure', () => {
    const { suites, matched } = selectSuites(TWO_F_2CBD2);

    expect(suites).toContain('test:e2e');
    expect(suites).toContain('test:visual');
    expect(matched.map((hit) => hit.path)).toEqual([
      'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx',
    ]);
  });

  it('selects neither for the relay move, which touched no code', () => {
    // NON-VACUITY FOR THE TWO ABOVE. A selector that answered "run
    // everything" would satisfy them both and be worth nothing.
    const { suites, matched } = selectSuites(RELAY_MOVE);

    expect(matched).toEqual([]);
    expect(suites).toEqual([...BASE_SUITES]);
  });
});

describe('the amendment is part of the ruling, not a detail of it', () => {
  it('never requires test:a11y, whatever changed', () => {
    // Its three files are a strict subset of pnpm test's globs, so requiring
    // it is a second execution of tests already in the chain.
    for (const paths of [FDCA008, TWO_F_2CBD2, RELAY_MOVE, ['web/lib/ui/x.tsx']]) {
      expect(suitesFor(paths)).not.toContain('test:a11y');
    }
  });

  it('still NAMES a11y in what it prints, so its absence reads as a decision', () => {
    const printed = describeSelection(selectSuites(FDCA008));

    expect(printed).toContain('a11y');
    expect(printed).toContain('covered by pnpm test');
  });

  it('prints the suites it selected and why', () => {
    const printed = describeSelection(selectSuites(FDCA008));

    expect(printed).toContain('test:e2e');
    expect(printed).toContain('test:visual');
    expect(printed).toContain('lib/fr/**');
  });

  it('prints a selection even when nothing matched', () => {
    // The commit body records what ran. "Nothing matched" is a claim worth
    // recording, and an empty string in a commit message records nothing.
    const printed = describeSelection(selectSuites(RELAY_MOVE));

    expect(printed).toContain('no path matched');
    expect(printed).toContain('a11y');
  });
});

describe('R133: a suite that reports nothing must not read as a pass', () => {
  // THE OUTPUTS ARE REAL, copied from runs in this repository rather than
  // invented, because the thing being parsed is another tool's summary line
  // and an invented one asserts that my memory of the format is right.

  it('reads vitest when everything passed', () => {
    const counted = readCount('test', '      Tests  1940 passed (1940)\n');

    expect(counted.ran).toBe(1940);
    expect(counted.failure).toBeUndefined();
  });

  it('reads vitest when some failed', () => {
    const counted = readCount('test', '      Tests  10 failed | 1812 passed (1822)\n');

    expect(counted.ran).toBe(1812);
  });

  it('reads playwright', () => {
    expect(readCount('test:e2e', '  96 passed (1.6m)\n').ran).toBe(96);
    expect(readCount('test:visual', '  69 passed (1.9m)\n').ran).toBe(69);
  });

  it('FAILS on the exact output that fooled FW13 harness', () => {
    // The mutation runner passed --reporter=basic to a Vitest 5 that had
    // removed it. Four probes died here, having run ZERO tests, and the check
    // - "does the output say failed?" - read this as GREEN and reported four
    // surviving mutants. This is that output.
    const startupError = [
      '',
      '⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯',
      'Error: Failed to load custom Reporter from basic',
      '    at loadCustomReporterModule (file:///.../vitest/dist/chunks/index.js:18397:9)',
    ].join('\n');

    const counted = readCount('test', startupError);

    expect(counted.ran).toBeUndefined();
    expect(counted.failure).toContain('R133');
    expect(counted.failure).toContain('ran no tests');
  });

  it('FAILS on empty output, which is the same claim more quietly', () => {
    expect(readCount('test', '').failure).toBeDefined();
    expect(readCount('test:e2e', '').failure).toBeDefined();
    expect(readCount('test:visual', '').failure).toBeDefined();
  });

  it('FAILS on a count of zero', () => {
    // "0 passed" is a positive signal of nothing having happened, which is
    // the no-gradients shape: a walk over a missing directory reporting
    // "0 tests" and exiting 0.
    expect(readCount('test:e2e', '  0 passed (0ms)\n').failure).toContain('0 passed');
  });

  it('says plainly when a suite has no count to have', () => {
    // tsc, eslint and next build report success by saying nothing. That is
    // not a failure - it is a different kind of signal, and the distinction
    // has to survive into the summary or "passed" gets read as "measured".
    for (const suite of ['typecheck', 'lint', 'build']) {
      const counted = readCount(suite, 'whatever it printed');

      expect(counted.counted, suite).toBe(false);
      expect(counted.failure, suite).toBeUndefined();
    }
  });

  it('fails when the count is below the floor it was given', () => {
    // "N tests ran" is half of R133; "N >= expected" is the other half, and
    // it is the half that catches a suite which SHRANK. A spec file that
    // stops being collected still exits 0 and still prints a number - just a
    // smaller one - which is exactly how FW8's .test.tsx glob went unnoticed.
    const counted = readCount('test:visual', '  49 passed (1.2m)\n', 69);

    expect(counted.ran).toBe(49);
    expect(counted.failure).toContain('49');
    expect(counted.failure).toContain('69');
  });

  it('passes at the floor and above it', () => {
    expect(readCount('test:visual', '  69 passed\n', 69).failure).toBeUndefined();
    expect(readCount('test:visual', '  70 passed\n', 69).failure).toBeUndefined();
  });

  it('still requires a count when a floor is given', () => {
    // A missing count must not be read as "floor not applicable".
    expect(readCount('test:e2e', 'nothing to see', 96).failure).toContain('R133');
  });

  it('keeps the >= 1 check when no floor is given', () => {
    expect(readCount('test:e2e', '  0 passed\n', undefined).failure).toBeDefined();
    expect(readCount('test:e2e', '  1 passed\n', undefined).failure).toBeUndefined();
  });

  it('counts exactly the three suites that report counts', () => {
    // R63 again: the assertions above would all still pass if a suite were
    // quietly dropped from the map and began being judged on exit code.
    expect(Object.keys(SUITE_COUNTS).sort()).toEqual(['test', 'test:e2e', 'test:visual']);
  });
});

describe('the pattern list is the ruling, stated once', () => {
  it('is exactly the five R132 names', () => {
    // R63's shape: if a pattern were dropped, every table row above that
    // does not use it would still pass. This pins the list itself.
    expect(SELECTOR_PATTERNS.map((pattern) => pattern.label).sort()).toEqual([
      '**/*.module.scss',
      'app/**',
      'lib/fr/**',
      'lib/ui/**',
      'the token layer (lib/ui/core/styles/**)',
    ]);
  });
});
