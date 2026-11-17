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

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASE_SUITES,
  BROWSER_SUITES,
  CONTAINER_SUITES,
  DATABASE_SUITES,
  EVERY_SUITE,
  LATE_SUITES,
  RUNTIME_SUITES,
  PACKAGE_ROOT,
  REPO_ROOT,
  changedPaths,
  SELECTOR_PATTERNS,
  SUITE_COUNTS,
  containerHarnessFiles,
  containerPdfClosure,
  databaseClosure,
  describeSelection,
  readCount,
  stripAnsi,
  selectSuites,
} from '../../../scripts/gate-selection.mjs';

const SLASH = String.fromCharCode(47);
const BACKSLASH = String.fromCharCode(92);

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
    //
    // DISTINCT PATHS, because since R234 a path is reported once per pattern
    // it matches - CalculatorForm.module.scss is both `app/**` and
    // `**/*.module.scss`, and both reasons are true. The claim here is about
    // WHICH FILES fired, not how many reasons each had.
    expect([...new Set(matched.map((hit) => hit.path))].sort()).toEqual([
      'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.module.scss',
      'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx',
      'web/lib/fr/params.ts',
    ]);
  });

  it('selects e2e and visual for 2f2cbd2, which inherited the same failure', () => {
    const { suites, matched } = selectSuites(TWO_F_2CBD2);

    expect(suites).toContain('test:e2e');
    expect(suites).toContain('test:visual');

    // TWO PATHS SINCE R140, AND THAT IS THE RULING WORKING. This commit
    // also changed lib/params/handoff.ts, which produces the localStorage
    // payload - so under R140 it selects the browser suites on its own
    // merits rather than only because a component changed beside it.
    expect(matched.map((hit) => hit.path).sort()).toEqual([
      'web/app/(public)/calculateur-teletravail-frontalier/CalculatorForm.tsx',
      'web/lib/params/handoff.ts',
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

  it('reads a COLOURED runner, which is how CI prints it (FW31)', () => {
    // COPIED FROM A CI LOG, not invented: run 36039159222, the container job,
    // 24 September. vitest colourises when it decides it is talking to a
    // terminal, and puts an escape sequence between the label and the digits -
    // which every pattern in SUITE_COUNTS wants to be adjacent.
    //
    // NINE TESTS PASSED AND THE HARNESS REPORTED "no passing tests". R133's
    // guard against a suite that silently skipped everything fired on a suite
    // that had silently passed everything, because the parse returned null and
    // null is indistinguishable from zero. A guard that cannot read its
    // subject reports the absence of the subject.
    const coloured = ' \u001B[2m Tests \u001B[22m \u001B[1m\u001B[32m9 passed\u001B[39m\u001B[22m\u001B[90m (9)\u001B[39m\n';

    expect(readCount('test', coloured).ran).toBe(9);
    expect(readCount('test', coloured).failure).toBeUndefined();
  });

  it('strips only colour, never a digit', () => {
    // The narrow pattern matters: a wider one could eat part of the number it
    // was added to protect.
    expect(stripAnsi('\u001B[32m12 passed\u001B[39m')).toBe('12 passed');
    expect(stripAnsi('no escapes here')).toBe('no escapes here');
    expect(stripAnsi('')).toBe('');
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

  it('counts exactly the ten suites that report counts', () => {
    // R63 again: the assertions above would all still pass if a suite were
    // quietly dropped from the map and began being judged on exit code.
    //
    // FIVE SINCE R182. test:late re-runs the two checks whose subject
    // test:visual produces, and it gets a count pattern for the same
    // reason every other suite has one - a suite that reports nothing
    // must not read as a pass (R133). A late guard exempt from R133
    // would be a guard that runs at the right moment and says nothing.
    //
    // SIX SINCE R251. test:container is not vitest and not Playwright, so it
    // prints its own count line - which is the point: the rule is about
    // every suite reporting, not about the runner that happens to report.
    //
    // SEVEN SINCE R256. test:container:write makes the only production-write
    // claim in the repository, and a claim nobody counts is the shape that
    // let a 500 on the main use case live for three weeks.
    //
    // TEN SINCE R953. `pnpm lighthouse` is selectable now, and it is neither
    // vitest nor Playwright: it prints its own line once the desktop floor and
    // the slow-4G LCP have both passed, so a run that measured nothing cannot
    // read as a pass.
    expect(Object.keys(SUITE_COUNTS).sort()).toEqual([
      'lighthouse',
      'test',
      'test:container',
      'test:container:restore',
      'test:container:scheduler',
      'test:container:write',
      'test:db',
      'test:e2e',
      'test:late',
      'test:visual',
    ]);
  });
});

describe('the database layer selects its own suite (FW14)', () => {
  it.each([
    ['the schema', 'web/prisma/schema.prisma'],
    ['a migration', 'web/prisma/migrations/20260913075645_alert_subscriber/migration.sql'],
    ['the seed', 'web/prisma/seed.ts'],
    ['the client', 'web/lib/db/client.ts'],
    ['a database test', 'web/tests/db/alert-subscriber.test.ts'],
    ['the prisma config', 'web/prisma.config.ts'],
    ['the db vitest config', 'web/vitest.db.config.ts'],
  ])('%s selects test:db', (_label, path) => {
    expect(suitesFor([path]), path).toContain('test:db');
  });

  it('does not select test:db for anything else', () => {
    // NON-VACUITY. test:db needs a running PostgreSQL, so a selector that
    // asked for it on every change would make the gate unrunnable without
    // Docker - and the first person to hit that would take it back out.
    for (const path of ['web/app/page.tsx', 'web/lib/fr/params.ts', 'README.md']) {
      expect(suitesFor([path]), path).not.toContain('test:db');
    }
  });

  it('asks for both groups when a change touches both', () => {
    const suites = suitesFor(['web/app/api/alertes/route.ts', 'web/lib/db/client.ts']);

    expect(suites).toContain('test:e2e');
    expect(suites).toContain('test:visual');
    expect(suites).toContain('test:db');
  });

  it('orders the selection deterministically, because it goes in a commit', () => {
    // The same set in a different order every run would be one more thing
    // nobody can diff.
    expect(suitesFor(['web/lib/db/client.ts', 'web/app/page.tsx'])).toEqual([
      ...BASE_SUITES,
      'test:e2e',
      'test:visual',
      // FW31/R256. lib/db/client.ts selects the production-write suite as
      // well as test:db, and the pair is the point: test:db runs with
      // NODE_ENV=test, where this file's defect does not exist. The suite
      // that covered it could not see what went wrong in it.
      'test:container:write',
      'test:db',
      // R182: LAST, and after test:visual specifically. It is appended
      // outside the pattern loop precisely so it cannot land mid-list -
      // a late check that runs before its subject exists is the defect
      // the ruling names, wearing a new name.
      'test:late',
    ]);
  });
});

describe('the pattern list is the ruling, stated once', () => {
  it('is exactly the twenty-nine names R132 now carries', () => {
    // R63's shape: if a pattern were dropped, every table row above that
    // does not use it would still pass. This pins the list itself.
    //
    // R246 ADDED TWO, and this census is how they were noticed as a
    // deliberate act rather than absorbed: middleware.ts and next.config.ts
    // are invoked by Next, reachable from no import, and until FW28 matched
    // by nothing at all. R936 added the container PDF step's rule, R947
    // the database-stopped step's, and R953 the Lighthouse harness's.
    expect(SELECTOR_PATTERNS.map((pattern) => pattern.label).sort()).toEqual([
      '**/*.module.scss',
      'a baseline, which is the record test:visual compares against (R144)',
      'a runtime spec, which is its own project (R144)',
      'a spec file, which selects the suite it belongs to (R144)',
      'a visual spec, which test:e2e deliberately ignores (R144)',
      'app/**',
      'guide content, which IS rendered HTML (R140)',
      'identity.json, which a unit test asserts (R416)',
      'lib/fr/**',
      'lib/ui/**',
      'middleware.ts, which sets a header on a rendered response (R246)',
      'modules whose output reaches rendered HTML (R140)',
      'next.config.ts, which decides what every route is (R246)',
      'package.json and the lockfile, which decide what every suite is (R414)',
      'playwright.config.ts, which defines both browser projects (R247)',
      'playwright.runtime.config.ts, which is the runtime project (R247)',
      'pnpm-workspace.yaml and tsconfig.json, which decide whether anything compiles (R416)',
      'the Lighthouse harness, its plan, its config and the identity it checks, which define that suite (R247, R953)',
      'the container PDF step: its vitest files and what they read, the print page, the export route and what those alone render through (R936, R982, R990)',
      'the container e2e harness, which defines that suite (R247)',
      'the container, and what decides whether it serves (R251)',
      'the database layer (prisma/**, lib/db/**, tests/db/**, and anything test:db imports)',
      'the database-stopped step of the container e2e suite: the module that runs it and the verdict it reads (R947)',
      'the production write, and the client whose defect it catches (R256)',
      'the restore probe, which defines that suite (R247)',
      'the scheduler probe, which defines that suite (R247)',
      'the token layer (lib/ui/core/styles/**)',
      'tsconfig.parity.json, which the format-parity build compiles against (R416)',
      'tsconfig.scripts.json, which typecheck compiles against (R416)',
    ]);
  });

  it('gives every pattern a suite to require', () => {
    // A pattern with no suites would match, be reported as matched, and
    // change nothing about what runs.
    for (const pattern of SELECTOR_PATTERNS) {
      expect(pattern.suites.length, pattern.label).toBeGreaterThan(0);
    }
  });
});

describe('R140: output reaching rendered HTML is what selects, not the directory', () => {
  // THE RULING'S DURABLE HALF IS THE PRINCIPLE, not the list. FW14 measured
  // the hole: lib/params/codec.ts decides what the calculator's link notice
  // says, and on its own it selected neither browser suite. The notice is
  // asserted by both e2e and visual, so a codec change could have broken both
  // while the gate reported green - the exact FW13 shape R132 exists to close.
  //
  // The three directories below are a CONSEQUENCE of the principle, which is
  // why the principle is asserted too: a list is something somebody has to
  // remember to extend, and the next module will not be in it.

  it.each([
    ['the URL codec, which writes the link notice', 'web/lib/params/codec.ts'],
    ['the param schema', 'web/lib/params/schema.ts'],
    ['the alert domain, which the capture card renders', 'web/lib/alerts/status.ts'],
    ['the subscribe handler helpers', 'web/lib/alerts/subscribe.ts'],
    ['route content', 'web/lib/content/routes.ts'],
    ['the alerts path', 'web/lib/content/alertes.ts'],
  ])('%s selects e2e and visual', (_label, path) => {
    const suites = suitesFor([path]);

    expect(suites, path).toContain('test:e2e');
    expect(suites, path).toContain('test:visual');
  });

  it('closes the hole FW14 measured and reported', () => {
    // Before R140 this returned the base chain only, and FW14's increment 2
    // changed this exact file. The browser suites ran anyway - because app/**
    // changed in the same commit - which is luck, not a gate.
    const { suites, matched } = selectSuites(['web/lib/params/codec.ts']);

    expect(matched).toHaveLength(1);
    expect(suites).toEqual([...BASE_SUITES, 'test:e2e', 'test:visual', 'test:late']);
  });

  it('still selects nothing for a module whose output never reaches HTML', () => {
    // NON-VACUITY, and the judgement the principle actually asks for. The
    // engine is pure arithmetic: its output reaches the page THROUGH the
    // island, which is app/**, and that is what selects. A selector that
    // fired on every lib/** path would run the container suite on an engine
    // refactor and teach people to route around it.
    for (const path of [
      'web/lib/calc-engine/compute.ts',
      'web/lib/db/client.ts',
      'web/scripts/gate-clone.mjs',
      'relay/FW15.txt',
    ]) {
      const suites = suitesFor([path]);

      expect(suites, path).not.toContain('test:visual');
    }
  });
});

describe('R144: a test file selects the suite it belongs to', () => {
  // WHY THE RULING EXISTS, and it is FW15's own record rather than a
  // hypothetical. That task added e2e/analytics.spec.ts and the gate ran
  // the base chain; it then added a visual STATE and two baselines and the
  // gate ran the base chain again. Both were run by hand and both passed,
  // so nothing shipped unverified - but a broken spec would not have been
  // caught, twice in one task.
  //
  // IT IS THE SAME HOLE R132 CLOSED FROM THE OTHER SIDE. R132 asks "which
  // suites does this diff need"; a file that IS a suite needs itself, and
  // the selector could not see that.

  it('selects test:e2e for a spec, and NOT test:visual', () => {
    const { suites, matched } = selectSuites(['web/e2e/analytics.spec.ts']);

    expect(suites).toContain('test:e2e');
    expect(suites).not.toContain('test:visual');
    expect(matched[0]?.pattern).toBe('a spec file, which selects the suite it belongs to (R144)');
  });

  it('gives each of its three spec rules a DISTINCT label', () => {
    // THE BUG THIS CAUGHT, on the first run of the implementation. The
    // label is the UNION KEY: selectSuites walks SELECTOR_PATTERNS and
    // adds a pattern's suites when any matched hit carries that pattern's
    // label. Three rules sharing one label merged their suites, so an
    // ordinary spec selected test:visual and test:runtime as well - which
    // would have run the container on every e2e edit and looked like
    // thoroughness rather than a defect.
    const labels = SELECTOR_PATTERNS.map((pattern) => pattern.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('selects test:visual for a visual spec, and NOT test:e2e', () => {
    // THE DISCRIMINATION THAT MATTERS. A .visual.spec.ts is excluded from
    // the chromium project by testIgnore, so selecting test:e2e for one
    // would run a suite that deliberately does not contain it - a green
    // that measures nothing, which is the shape this repository keeps
    // finding.
    const { suites } = selectSuites(['web/e2e/calculateur.visual.spec.ts']);

    expect(suites).toContain('test:visual');
    expect(suites).not.toContain('test:e2e');
  });

  it('selects test:runtime for a runtime spec, which is neither', () => {
    // THE PARENTHETICAL IN R144 NAMES TWO CASES AND THE PRINCIPLE COVERS
    // THREE: "a changed file under e2e/ selects the suite it belongs to".
    // guard.runtime.spec.ts belongs to test:runtime - it is excluded from
    // BOTH other projects by testIgnore - so mapping it to test:e2e would
    // reproduce the defect one level down.
    const { suites } = selectSuites(['web/e2e/guard.runtime.spec.ts']);

    expect(suites).toContain('test:runtime');
    expect(suites).not.toContain('test:e2e');
    expect(suites).not.toContain('test:visual');
  });

  it('selects test:visual for a changed baseline', () => {
    // A baseline is not a test, it is the RECORD a test compares against.
    // Changing one changes what the suite asserts, which is the same
    // relationship a spec has to its suite.
    const { suites, matched } = selectSuites([
      'web/tests/visual/baselines/calculateur-vide-mobile.png',
    ]);

    expect(suites).toContain('test:visual');
    expect(matched[0]?.pattern).toBe('a baseline, which is the record test:visual compares against (R144)');
  });

  it('leaves a unit test to the base chain, which already runs it', () => {
    // NON-VACUITY, AND THE BOUNDARY OF THE RULING. tests/unit/** is run by
    // pnpm test, which is in the base chain of every selection - so a unit
    // test already selects its own suite and needs no pattern. A rule that
    // fired here would add a second execution, which is exactly the reason
    // test:a11y is deliberately not selected.
    const { suites, matched } = selectSuites(['web/tests/unit/meta/glob-canaries.test.ts']);

    expect(matched).toEqual([]);
    expect(suites).toEqual([...BASE_SUITES]);
  });

  it('still selects the database layer for a db test, not the spec rule', () => {
    // ORDER MATTERS AND THIS PINS IT. tests/db/** was already claimed by
    // the database pattern; the new rules must not steal it, or a db test
    // would select a browser suite and stop selecting test:db.
    const { suites } = selectSuites(['web/tests/db/privacy-claims.test.ts']);

    expect(suites).toContain('test:db');
    expect(suites).not.toContain('test:e2e');
  });
});

describe('R218: the database selection is derived from the import graph', () => {
  // WHY THIS REPLACED A PATH LIST. The list had been extended three times -
  // FW14 added three directories, FW23 found a fourth missing - which is R149's
  // signal that the defect is in the mechanism rather than in the entry nobody
  // added. FW23's increment 5 changed lib/entries/schema.ts, the API contract
  // that tests/db drives end to end, and the selector chose the base chain
  // only; test:db was run by hand.

  const closure = databaseClosure(PACKAGE_ROOT);

  it('found a real graph, so nothing below passes vacuously', () => {
    // R133. An empty closure would make every `has` below false and every
    // "is not selected" assertion true for the wrong reason.
    expect(closure.size).toBeGreaterThan(20);
    expect(closure.has('lib/db/client.ts')).toBe(true);
  });

  it('reaches the module that raised the question', () => {
    // THE CASE Q77 WAS ABOUT.
    expect(closure.has('lib/entries/schema.ts')).toBe(true);
    expect(selectSuites(['web/lib/entries/schema.ts']).suites).toContain('test:db');
  });

  it('reaches it although it imports no Prisma - which is the whole point', () => {
    // THE OBVIOUS FORWARD RULE WOULD HAVE MISSED THIS, and that is worth an
    // assertion rather than a comment. "A module that imports the Prisma
    // client selects test:db" is the natural way to say it and it is the wrong
    // direction: schema.ts imports no Prisma at all, it is imported BY write.ts,
    // which does. A forward rule would have left Q77's case exactly where it
    // was while appearing to have fixed it.
    const source = readFileSync(join(PACKAGE_ROOT, 'lib/entries/schema.ts'), 'utf8');

    expect(source).not.toContain('@prisma/client');
    expect(source).not.toContain('@/lib/db/client');
    expect(closure.has('lib/entries/schema.ts')).toBe(true);
  });

  it('reaches the route handlers the suite drives, not only the modules', () => {
    // R204: the entry point is the unit under test, so the route is in the
    // graph and a change to it selects the suite that drives it.
    expect(closure.has('app/api/v1/entries/route.ts')).toBe(true);
  });

  it('follows the graph transitively, not one hop', () => {
    // day.ts is imported by read.ts and write.ts, which are imported by the
    // route, which is imported by the test. Three hops from a seed.
    expect(closure.has('lib/entries/day.ts')).toBe(true);
  });

  it('does NOT reach the pure presentation layer', () => {
    // THE OTHER DIRECTION, and it is what stops this becoming "select
    // everything". A closure that swallowed the whole repository would make
    // test:db run on every change and the selection would stop meaning
    // anything - the failure mode R132 exists to prevent, arrived at from the
    // safe side.
    expect(closure.has('lib/ui/core/styles/tokens.scss')).toBe(false);
    expect(selectSuites(['web/lib/ui/core/styles/tokens.scss']).suites).not.toContain('test:db');
  });

  it('keeps the definitional paths as a floor, not as the rule', () => {
    // A migration and a config are not reachable through an import, so the
    // prefixes stay. They are no longer asked to KEEP UP, which is the part
    // that kept failing.
    expect(selectSuites(['web/prisma/migrations/20260101000000_x/migration.sql']).suites).toContain(
      'test:db',
    );
    expect(selectSuites(['web/vitest.db.config.ts']).suites).toContain('test:db');
  });

  it('seeds from every file the suite actually globs, at any depth', () => {
    // THE CLOSURE IS ONLY AS COMPLETE AS ITS SEEDS, and the first version of
    // seeds() read tests/db flat while vitest.db.config.ts globs every .test.ts
    // under it AT ANY DEPTH. It was correct only because no subdirectory exists
    // yet - R171's coincidence, inside the mechanism written to remove exactly
    // that, and invisible to the non-vacuity check because the other seeds
    // remain.
    //
    // So the seeds are compared against the GLOB rather than against a count
    // somebody typed. Add tests/db/entries/foo.test.ts and this fails until the
    // walk finds it.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : entry.name.endsWith('.test.ts')
            ? [join(dir, entry.name)]
            : [],
      );

    const globbed = walk(join(PACKAGE_ROOT, 'tests', 'db')).map((file) =>
      relative(PACKAGE_ROOT, file).split(sep).join(SLASH),
    );

    expect(globbed.length, 'no db test files found').toBeGreaterThan(10);

    for (const file of globbed) {
      expect(closure.has(file), `${file} is globbed by the suite but not seeded`).toBe(true);
    }
  });

  it('survives a path that no longer exists', () => {
    // A deleted file is a normal thing to find in a diff, and a closure that
    // threw on one would take the whole gate down at exactly the wrong moment.
    expect(() => selectSuites(['web/lib/entries/deleted-yesterday.ts'])).not.toThrow();
  });
});

describe('R221: the selector sees the whole repository, not only web/', () => {
  // ============================================================================
  // THE DEFECT: AN UNTRACKED FILE OUTSIDE web/ WAS INVISIBLE
  // ============================================================================
  //
  // Both git commands used to run with cwd: web, and the two disagree about
  // what a path is. `git diff --name-only` reports from the REPOSITORY ROOT
  // whichever directory it runs in; `git ls-files --others` reports relative to
  // the CURRENT one. A single real selection printed
  //
  //     web/prisma/schema.prisma                  (tracked)
  //     prisma/migrations/..._id/migration.sql    (untracked)
  //
  // for two files in the same directory.
  //
  // The inconsistency was absorbed by toPackagePath, which strips a leading
  // `web/` and passes an already-package-relative path through. Correct by
  // absorption rather than by design - and the half that was NOT absorbed is
  // that `ls-files --others` run from web/ cannot see outside it at all.
  //
  // Nothing selectable lives outside web/ today. `android/` arrives at AN1, and
  // a new top-level directory would be invisible on its FIRST commit, which is
  // the run where a missed suite costs the most.

  it('sees an untracked file planted at the repository root', () => {
    // R180: the plant is verified to have landed before its result is read -
    // and here the mechanism under test is one that could not see it at all.
    const planted = join(REPO_ROOT, 'r221-probe-untracked.txt');

    writeFileSync(planted, 'temporary, written by a test\n', 'utf8');

    try {
      expect(existsSync(planted), 'the plant did not land').toBe(true);

      const paths = changedPaths();

      // NON-VACUITY FIRST. An empty list would satisfy nothing below for the
      // right reason, and changedPaths returning [] is a plausible break.
      expect(paths.length).toBeGreaterThan(0);

      expect(
        paths,
        'an untracked file at the repository root is invisible to the selector',
      ).toContain('r221-probe-untracked.txt');
    } finally {
      rmSync(planted, { force: true });
    }
  });

  it('reports tracked and untracked paths in the SAME shape', () => {
    // THE OTHER HALF. Seeing the file is not enough if it is reported in a
    // different form from its tracked neighbours - that was the original
    // symptom, and it is what a future consumer would trip on.
    const planted = join(REPO_ROOT, 'web', 'r221-probe-in-web.txt');

    writeFileSync(planted, 'temporary, written by a test\n', 'utf8');

    try {
      const paths = changedPaths();

      // A file under web/ is reported WITH the prefix, exactly as `git diff`
      // reports a tracked one. Previously this came back as the bare name.
      expect(paths).toContain('web/r221-probe-in-web.txt');
      expect(paths).not.toContain('r221-probe-in-web.txt');
    } finally {
      rmSync(planted, { force: true });
    }
  });

  it('normalises separators, so a Windows path selects like any other', () => {
    // The selector matches on forward slashes. git on Windows does not always
    // agree with itself about which it emits, and a backslash would silently
    // match no rule at all - a file that selects nothing looks exactly like a
    // file that needs nothing.
    for (const path of changedPaths()) {
      expect(path, `${path} carries a backslash`).not.toContain(BACKSLASH);
    }
  });

  it('routes a top-level android/ path to no suite today, but SEES it', () => {
    // AN1's directory does not exist yet, so this asserts the thing that will
    // matter then: the path reaches the selector. What it selects is a
    // question for AN1; being invisible is not.
    const selection = selectSuites(['android/app/src/main/AndroidManifest.xml']);

    expect(selection.suites).toEqual([...BASE_SUITES]);
    expect(selection.matched).toEqual([]);
  });
});

describe('R234: a path selects the UNION of every pattern it matches', () => {
  // ==========================================================================
  // THE PROPERTY, NOT THE CASE
  // ==========================================================================
  //
  // `selectSuites` used `.find(...)` from R218 until FW25b, so a path in two
  // categories contributed only the suites of whichever pattern was DECLARED
  // FIRST. That is not one dropped suite: it is systematic under-selection
  // across every commit since, with the size of the gap set entirely by the
  // order of the pattern list.
  //
  // THE SUITE'S OWN SHAPE IS WHY IT SURVIVED - R175 on the mechanism R218
  // exists to be. One test asserted ONE path in ONE category. Another asserted
  // TWO paths in TWO categories. *One path in two categories* was never named,
  // and that is where it lived.
  //
  // So this asserts the PROPERTY rather than the instance: whatever patterns a
  // path matches, every one of their suites is selected. A pattern added at
  // the bottom of the list years from now cannot reintroduce the defect under
  // a pairing nobody thought to write a case for.

  const SAMPLE = [
    // The instance that exposed it: matched by app/** AND imported by
    // tests/db/print-route.test.ts, so also in the database closure.
    'web/app/releve/print/page.tsx',
    'web/app/api/v1/export/csv/route.ts',
    'web/lib/export/csv.ts',
    'web/lib/dossier/service.ts',
    'web/lib/ui/core/styles/tokens.scss',
    'web/lib/fr/dossier.ts',
    'web/prisma/schema.prisma',
    'web/app/page.tsx',
  ];

  it('is not vacuous: at least one real path matches more than one pattern', () => {
    // R133. Without this the property below is satisfied perfectly by a
    // repository in which no path is ever in two categories, and the test
    // would keep passing after somebody put `.find` back.
    const multi = SAMPLE.map((path) => selectSuites([path])).filter(
      (selection) => selection.matched.length > 1,
    );

    expect(multi.length).toBeGreaterThan(0);
  });

  it('selects every suite of every pattern it reports as matched', () => {
    for (const path of SAMPLE) {
      const { suites, matched } = selectSuites([path]);

      for (const hit of matched) {
        const pattern = SELECTOR_PATTERNS.find((candidate) => candidate.label === hit.pattern);

        expect(pattern, hit.pattern).toBeDefined();

        for (const suite of pattern?.suites ?? []) {
          expect(suites, path + ' -> ' + hit.pattern).toContain(suite);
        }
      }
    }
  });

  it('runs the database suite for a page a database test renders', () => {
    // The concrete instance, kept beside the property because a named case is
    // what makes a regression legible in a diff.
    const { suites } = selectSuites(['web/app/releve/print/page.tsx']);

    expect(suites).toContain('test:db');
    expect(suites).toContain('test:e2e');
  });
});

describe('EVERY_SUITE is asserted complete, not argued (R414)', () => {
  // IT IS WRITTEN OUT RATHER THAN DERIVED, because the constants it would
  // derive from are declared after ROOT_TOOL_CONFIGS needs it, and a const
  // cannot be read before it is initialised. A list that cannot be derived has
  // to be CHECKED, or it becomes a second description of the suites that drifts
  // from the first (R181) - and the drift is silent, because a missing suite
  // shows up only as a gate that quietly did less.

  it('contains every suite any selector pattern can emit', () => {
    const fromPatterns = new Set(SELECTOR_PATTERNS.flatMap((pattern) => pattern.suites));
    const missing = [...fromPatterns].filter((suite) => !EVERY_SUITE.includes(suite)).sort();

    expect(
      missing,
      'a suite a pattern can select but EVERY_SUITE does not name means a ' +
        'package.json or lockfile change would NOT run it - which is the hole ' +
        'R414 closes, reopening one suite at a time.',
    ).toEqual([]);
  });

  it('contains every suite named by a group constant', () => {
    // The groups are the other way a suite enters the vocabulary. One added to
    // a group and to no pattern yet would still have to run on a bump.
    const fromGroups = new Set([
      ...BASE_SUITES,
      ...BROWSER_SUITES,
      ...DATABASE_SUITES,
      ...RUNTIME_SUITES,
      ...LATE_SUITES,
      ...CONTAINER_SUITES,
    ]);
    const missing = [...fromGroups].filter((suite) => !EVERY_SUITE.includes(suite)).sort();

    expect(missing).toEqual([]);
  });

  it('names nothing pnpm cannot run', () => {
    // THE OTHER DIRECTION, and not symmetry for its own sake: the runner
    // executes `pnpm ${suite}`, so a name here that is not a script would fail
    // the whole chain on the day somebody bumps a dependency - the least
    // convenient moment for the selector to be wrong about itself.
    const scripts = (
      JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;

    expect(
      EVERY_SUITE.filter((suite) => !scripts[suite]),
      'EVERY_SUITE names a suite pnpm cannot run',
    ).toEqual([]);
  });
});

describe('R936: the files that decide the container PDF step select the suite that runs it', () => {
  // MEASURED BEFORE THIS RULE EXISTED (FW-PDF-A4): lib/export/pdf.ts and
  // tests/db/container-pdf.test.ts selected the base chain and test:db only.
  // In test:db the PDF tests SKIP - container-pdf.test.ts needs
  // CONTAINER_BASE_URL, which only scripts/container-e2e.mjs sets, and
  // export-pdf.test.ts's render blocks need a live server, which neither
  // gate:changed, gate:clone nor CI starts before test:db. So `format:
  // 'Letter'` in the renderer would have passed every gate this repository
  // runs, with the A4 assertion green because it never executed.
  //
  // R256's shape: the file whose defect a suite catches selects that suite.
  // R144's shape: a test file selects the suite it belongs to.

  // THE HARNESS'S OWN LIST, read from the harness (R206): a file it starts
  // running tomorrow is covered here the day it is added, or this fails.
  // FW-PRINT-PAGE-PIN (R990): the pattern that reads it moved into the
  // selector, which seeds the container PDF closure from the same list, so
  // there is one reader of the harness rather than two that can drift (R206).
  const harnessFiles = containerHarnessFiles(PACKAGE_ROOT);

  it('reads the harness vitest files from the harness, and finds the PDF one', () => {
    // PRESENCE FIRST (R169): an empty list would make the next test vacuous.
    expect(harnessFiles).toContain('tests/db/container-pdf.test.ts');
    expect(harnessFiles).toContain('tests/db/container-auth.test.ts');
    // FW-PDF-RENDER-GATE (R981): the 17 render tests that ran only by hand
    // run in the harness now, so both files are in its list - and, through
    // the next test, each selects the suite that runs it (R982).
    expect(harnessFiles).toContain('tests/db/export-pdf.test.ts');
    expect(harnessFiles).toContain('tests/db/verification-qr.test.ts');
  });

  it('selects test:container:e2e for every file the harness runs with vitest', () => {
    const missing = harnessFiles.filter(
      (path) => !suitesFor([`web/${path}`]).includes('test:container:e2e'),
    );

    expect(missing, 'a container-e2e vitest file that does not select its own suite').toEqual([]);
  });

  it.each([
    ['the renderer, whose format is what R935 asserts', 'web/lib/export/pdf.ts'],
    ['the page-size reader the assertion trusts', 'web/tests/support/pdf-pages.ts'],
    // R982, MEASURED (FW-PDF-RENDER-GATE): with no preferCSSPageSize the
    // `@page` rule is not inert. `size: a4 landscape` turned all 14 pages'
    // MediaBox landscape, which the A4 assertion refuses; `size: letter` kept
    // A4 paper and paginated 9 pages as 10. It decides the CSS page.
    ["the print page's @page rule, which decides the CSS page", 'web/app/releve/print/print.module.scss'],
    // R981: the files the harness now runs, named here as well as read from
    // the harness above, so dropping one from the rule fails by name.
    ['the render tests, through the route', 'web/tests/db/export-pdf.test.ts'],
    ['the verification block on the render', 'web/tests/db/verification-qr.test.ts'],
    // R981: the step's per-test verdict decides whether the step passes.
    ['the verdict the harness reads its passes with', 'web/scripts/container-render-verdict.mjs'],
  ])('selects test:container:e2e for %s', (_label, path) => {
    expect(suitesFor([path])).toContain('test:container:e2e');
  });

  it('keeps what those files selected before', () => {
    // A union, never a replacement (R234): the renderer still runs test:db,
    // where its refusals are proven without a browser.
    expect(suitesFor(['web/lib/export/pdf.ts'])).toContain('test:db');
    expect(suitesFor(['web/tests/db/container-pdf.test.ts'])).toContain('test:db');
    // R981: their refusal tests still run in test:db, with no server.
    expect(suitesFor(['web/tests/db/export-pdf.test.ts'])).toContain('test:db');
    expect(suitesFor(['web/tests/db/verification-qr.test.ts'])).toContain('test:db');
    // R982: the stylesheet keeps the browser suites it selected before.
    expect(suitesFor(['web/app/releve/print/print.module.scss'])).toEqual(
      expect.arrayContaining(['test:e2e', 'test:visual']),
    );
  });

  it('does not select the container for the rest of the export code', () => {
    // NON-VACUITY: a rule that fired on everything would make every export
    // edit a Docker build, and the first person to wait for one would take it
    // back out.
    //
    // export-pdf.test.ts USED TO BE IN THIS LIST. FW-PDF-RENDER-GATE (R981)
    // moved it: its render tests run in the harness now, so it selects the
    // harness's suite. export-csv.test.ts takes its place as the export test
    // that renders nothing.
    for (const path of ['web/lib/export/csv.ts', 'web/tests/db/export-csv.test.ts', 'web/app/page.tsx']) {
      expect(suitesFor([path]), path).not.toContain('test:container:e2e');
    }
  });
});

describe("R990: what the container PDF step renders and reads selects it (R267's second site)", () => {
  // MEASURED BEFORE THIS RULE (FW-PDF-RENDER-GATE QUESTION 1): the print page
  // and the export route selected test:e2e, test:visual, test:db and
  // test:late; live-server.ts, pdf-text.ts and pdf-image.ts the base chain and
  // test:db. None of those renders a PDF - no e2e spec touches /releve/print
  // or the export route, and in test:db the 17 render tests skip - so a
  // page.tsx edit that dropped the rail passed every gate.
  //
  // THE SET IS DERIVED FROM IMPORTS (scripts/gate-selection.mjs,
  // containerPdfClosure) and PINNED HERE AS A CENSUS: the graph decides what
  // selects, and this list is how a module joining or leaving is noticed as a
  // deliberate act rather than absorbed (the shape of the 27-name census).
  const closure = containerPdfClosure(PACKAGE_ROOT);

  it('is exactly what the import graph gives today', () => {
    expect([...closure].sort()).toEqual([
      // What the print page and the export route ALONE render through: every
      // product importer of each is already in this list.
      'app/api/v1/export/pdf/route.ts',
      'app/releve/print/page.tsx',
      'app/releve/print/print.module.scss',
      'lib/export/pdf.ts',
      'lib/export/print-token.ts',
      'lib/export/render-queue.ts',
      'lib/issuance/record.ts',
      'lib/ui/react/index.ts',
      'lib/verification/origin.ts',
      // The harness's vitest files, and every tests/ file they reach.
      'tests/db/container-auth.test.ts',
      'tests/db/container-pdf.test.ts',
      'tests/db/export-pdf.test.ts',
      'tests/db/support/live-server.ts',
      'tests/db/support/pdf-image.ts',
      'tests/db/support/pdf-text.ts',
      'tests/db/verification-qr.test.ts',
      'tests/support/css-page.ts',
      'tests/support/pdf-pages.ts',
    ]);
  });

  it('selects test:container:e2e for every file in it', () => {
    const missing = [...closure].filter(
      (path) => !suitesFor([`web/${path}`]).includes('test:container:e2e'),
    );

    expect(missing, 'a file the container PDF step renders or reads, not selecting it').toEqual([]);
  });

  it.each([
    // THE THREE THE PROMPT NAMED FIRST, AND THE THREE SUPPORT FILES.
    ['the print page the 17 and container-pdf render', 'web/app/releve/print/page.tsx'],
    ['the export route they call', 'web/app/api/v1/export/pdf/route.ts'],
    ['the reader that decides whether the 17 run at all', 'web/tests/db/support/live-server.ts'],
    ['the reader every text assertion goes through', 'web/tests/db/support/pdf-text.ts'],
    ['the reader the QR is decoded from', 'web/tests/db/support/pdf-image.ts'],
    // AND WHAT THE GRAPH ADDED, each imported by the page or the route alone.
    ['the print token the route mints and the page reads', 'web/lib/export/print-token.ts'],
    ['the render queue AC3 asserts the bound of', 'web/lib/export/render-queue.ts'],
    ['the issuance record R329 asserts', 'web/lib/issuance/record.ts'],
    ['the verification origin the QR block is printed from', 'web/lib/verification/origin.ts'],
    ['the barrel the page takes its rail from', 'web/lib/ui/react/index.ts'],
    // R991's reader of the served @page rule.
    ['the served @page reader R991 compares with', 'web/tests/support/css-page.ts'],
  ])('selects test:container:e2e for %s', (_label, path) => {
    expect(suitesFor([path])).toContain('test:container:e2e');
  });

  it.each([
    // THE OTHER DIRECTION, on the sharpest neighbours. "Alone" is the rule: a
    // module the page or route SHARES keeps the suites it selected, and
    // test:db renders the same page through its handler without a browser.
    ["the CSV route, the export route's neighbour", 'web/app/api/v1/export/csv/route.ts'],
    ['the dossier loader, shared with the dossier and CSV routes', 'web/lib/dossier/load.ts'],
    ['the dossier copy, which the verification page renders too', 'web/lib/fr/dossier.ts'],
    ['the rail component, which the calculator renders too', 'web/lib/ui/react/ThresholdRail/ThresholdRail.tsx'],
    // A TEST IS NOT AN IMPORTER: the queue's unit test imports it and selects
    // only what a unit test selects.
    ["the render queue's unit test", 'web/tests/unit/export/render-queue.test.ts'],
    ['the CSV export test, which renders nothing', 'web/tests/db/export-csv.test.ts'],
  ])('does NOT select test:container:e2e for %s', (_label, path) => {
    expect(suitesFor([path])).not.toContain('test:container:e2e');
  });

  it('keeps what those files selected before (a union, R234)', () => {
    expect(suitesFor(['web/app/releve/print/page.tsx'])).toEqual(
      expect.arrayContaining(['test:e2e', 'test:visual', 'test:db']),
    );
    expect(suitesFor(['web/app/api/v1/export/pdf/route.ts'])).toContain('test:db');
    expect(suitesFor(['web/tests/db/support/live-server.ts'])).toContain('test:db');
  });

  it('grows by exclusivity, proven on a graph whose every edge this test controls', () => {
    // R154: the mechanism is proven to deliver, in both directions, on a
    // fixture - not only on today's graph, where a wrong rule could still
    // happen to give the census above.
    const root = mkdtempSync(join(tmpdir(), 'container-pdf-closure-'));
    const write = (path: string, source: string): void => {
      mkdirSync(join(root, ...path.split(SLASH).slice(0, -1)), { recursive: true });
      writeFileSync(join(root, ...path.split(SLASH)), source);
    };

    try {
      write('scripts/container-e2e.mjs', "const FILES = ['tests/db/fixture.test.ts'];\n");
      write('tests/db/fixture.test.ts', "import { r } from './support/reader';\nimport { s } from '@/lib/shared';\n");
      write('tests/db/support/reader.ts', 'export const r = 1;\n');
      write('tests/db/unrelated.test.ts', "import { u } from './support/unrelated';\n");
      write('tests/db/support/unrelated.ts', 'export const u = 1;\n');
      write(
        'app/releve/print/page.tsx',
        "import styles from './print.module.scss';\nimport { a } from '@/lib/only-print';\nimport { s } from '@/lib/shared';\n",
      );
      write('app/releve/print/print.module.scss', '@page { size: a4; }\n');
      write('app/api/v1/export/pdf/route.ts', "import { q } from '@/lib/only-route';\n");
      write('lib/only-print.ts', "import { d } from './deep-only';\nexport const a = d;\n");
      write('lib/deep-only.ts', 'export const d = 1;\n');
      write('lib/only-route.ts', 'export const q = 1;\n');
      write('lib/shared.ts', 'export const s = 1;\n');
      write('app/page.tsx', "import { s } from '@/lib/shared';\n");
      // A unit test importing a page-only module does not make it shared.
      write('tests/unit/only-print.test.ts', "import { a } from '@/lib/only-print';\n");

      expect([...containerPdfClosure(root)].sort()).toEqual([
        'app/api/v1/export/pdf/route.ts',
        'app/releve/print/page.tsx',
        'app/releve/print/print.module.scss',
        'lib/deep-only.ts',
        'lib/only-print.ts',
        'lib/only-route.ts',
        'tests/db/fixture.test.ts',
        'tests/db/support/reader.ts',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('R947: the database-stopped step selects the suite that runs it', () => {
  // FW-DB-STOPPED. Plan Checkpoint D item 5's second half - the public site
  // keeps serving with the database stopped - is measured against the image
  // by scripts/container-db-stopped.mjs, which scripts/container-e2e.mjs runs
  // after its own teardown, and judged by container-db-stopped-verdict.mjs.
  //
  // A MODULE OF test:container:e2e, NOT A SUITE OF ITS OWN. A new script in
  // package.json selects EVERY suite on the commit that adds it (R414); this
  // keeps the claim in the suite that already builds and serves the image.
  // So the rule's claim - "this file decides what test:container:e2e does" -
  // is only true while the harness runs the step, and that is asserted below
  // rather than assumed (R154).
  const STEP = 'scripts/container-db-stopped.mjs';
  const VERDICT = 'scripts/container-db-stopped-verdict.mjs';

  it.each([
    ['the module that starts its own database, stops it and reads every answer', STEP],
    ['the verdict that decides what those answers mean', VERDICT],
  ])('selects test:container:e2e for %s', (_label, path) => {
    expect(suitesFor([`web/${path}`])).toContain('test:container:e2e');
  });

  it('selects nothing else: the step needs no browser run and no test:db', () => {
    // NARROW BY DESIGN (R251's argument): a gate that grows a test:db or a
    // visual run for a harness edit is a gate people route around.
    for (const path of [STEP, VERDICT]) {
      expect(suitesFor([`web/${path}`]), path).toEqual([...BASE_SUITES, 'test:container:e2e']);
    }
  });

  it('is run by the harness, so the rule maps a file to a suite that really runs it (R154)', () => {
    // PRESENCE OF THE CALL, NOT ONLY THE FILE. Delete the call and the step
    // stops running while this rule keeps "covering" it - a selector claim
    // that no gate would contradict.
    const harness = readFileSync(join(PACKAGE_ROOT, 'scripts', 'container-e2e.mjs'), 'utf8');

    expect(harness).toMatch(/import \{ runDatabaseStoppedPhase \} from '\.\/container-db-stopped\.mjs';/u);
    expect(harness).toMatch(/await runDatabaseStoppedPhase\(\{/u);
  });

  it('leaves the container PDF closure alone: neither module is something the PDF renders through', () => {
    // W3d's 18-path census (R990) pins the closure exactly; this names the
    // two files so a later import cannot quietly fold them into it.
    const closure = containerPdfClosure(PACKAGE_ROOT);

    expect(closure.has(STEP)).toBe(false);
    expect(closure.has(VERDICT)).toBe(false);
  });
});

describe('R953: `pnpm lighthouse` runs in a gate, selected by the files that decide what it does', () => {
  // FW-LIGHTHOUSE-CALC. Before this rule `lighthouse` was in NO gate: absent
  // from EVERY_SUITE, matched by no pattern, named by gate:clone only in the
  // list of steps it cannot run, and lighthouserc.json was ROOT_TOOL_CONFIGS'
  // second argued null - "configures `pnpm lighthouse`, which no gate, no
  // gate:clone step and no CI workflow runs". So R152's floor, R174's median
  // and R177's styles check held only when somebody chose to run them
  // (docs/audit-adversarial.md, PARK30-23).
  //
  // R247'S SHAPE, which is where the selector's own rules put it: the harness,
  // the module holding its routes, conditions and verdicts, its config, and
  // identity.json - which the harness reads for the service it refuses to
  // measure without and for the origin it builds with - select the suite.
  //
  // NOT HERE, AND RECORDED AS A QUESTION RATHER THAN DECIDED (R947's
  // precedent): the PAGES it measures. A page edit that pushed the
  // calculator's slow-4G LCP over 2.5 s is the defect R952 exists to catch,
  // and app/** selects e2e and visual, not this. Widening it is a production
  // build and 21 Chrome runs on every page edit, against a sampled number that
  // sits close to its line - a cost call for the operator, not for this task.
  const FILES = ['lighthouserc.json', 'identity.json', 'scripts/lighthouse.mjs', 'scripts/lighthouse-plan.mjs'];
  const LABEL =
    'the Lighthouse harness, its plan, its config and the identity it checks, which define that suite (R247, R953)';

  it.each(FILES)('selects lighthouse for %s', (path) => {
    expect(suitesFor([`web/${path}`])).toContain('lighthouse');
  });

  it('selects nothing else for the harness, its plan and its config: no browser suite, no database', () => {
    for (const path of ['lighthouserc.json', 'scripts/lighthouse.mjs', 'scripts/lighthouse-plan.mjs']) {
      expect(suitesFor([`web/${path}`]), path).toEqual([...BASE_SUITES, 'lighthouse']);
    }
  });

  it('keeps identity.json on the unit test that asserts it: a union, not a move (R234)', () => {
    const { suites, matched } = selectSuites(['web/identity.json']);

    expect(suites).toEqual([...BASE_SUITES, 'lighthouse']);
    expect(matched.map((hit) => hit.pattern)).toEqual([
      'identity.json, which a unit test asserts (R416)',
      LABEL,
    ]);
  });

  it('is a suite the dependency files select, like every other (R414)', () => {
    expect(EVERY_SUITE).toContain('lighthouse');
    expect(suitesFor(['web/package.json'])).toContain('lighthouse');
    expect(suitesFor(['web/pnpm-lock.yaml'])).toContain('lighthouse');
  });

  it('is run by gate:changed under the name it is selected by (R154)', () => {
    // gate-for-changes.mjs runs `pnpm ${suite}` for each selected suite, so
    // the suite's name has to BE the script that measures.
    const scripts = (
      JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;

    expect(scripts.lighthouse).toBe('node scripts/lighthouse.mjs');
  });

  it('names files the harness really reads, so the rule maps a file to a suite it decides (R154)', () => {
    // lighthouserc.json needs no line here: the desktop autorun passes no
    // --config, so lhci reads it from its working directory by name.
    const harness = readFileSync(join(PACKAGE_ROOT, 'scripts', 'lighthouse.mjs'), 'utf8');

    expect(harness).toMatch(/from '\.\/lighthouse-plan\.mjs';/u);
    expect(harness).toContain("'../identity.json'");
  });

  it('does NOT select it for the pages it measures: that widening is recorded, not decided', () => {
    for (const path of [
      'app/(public)/calculateur-teletravail-frontalier/page.tsx',
      'app/(public)/calculateur-lamal-cmu/page.tsx',
      'lib/ui/core/styles/tokens.scss',
    ]) {
      expect(suitesFor([`web/${path}`]), path).not.toContain('lighthouse');
    }
  });
});
