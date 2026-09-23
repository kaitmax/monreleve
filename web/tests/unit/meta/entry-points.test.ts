// web/tests/unit/meta/entry-points.test.ts
//
// RULING R246: EVERY FRAMEWORK ENTRY POINT IS COVERED BY A SELECTOR RULE.
//
// AN ENTRY POINT IS REACHABLE FROM NO IMPORT, BY DEFINITION. That is not a
// gap in R218's closure, it is the closure's shape: it walks outward from
// tests/db's own files and reaches everything they import, and nothing
// imports instrumentation.ts, middleware.ts, next.config.ts or a page. The
// framework invokes them. No amount of walking arrives at a root.
//
// THE INSTANCE THAT PRODUCED THE RULING. FW27 added `startScheduler()` and
// wired it into instrumentation.ts - its only caller. A commit touching that
// file alone would have selected the base chain and NOT test:db, the suite
// that starts the scheduler and asserts both queues register. It is covered
// today because tests/db/scheduled-jobs.test.ts imports it, which is the
// correct fix and an INCIDENTAL one: the coverage lives in an import
// somebody could delete while tidying, and its removal would be silent.
//
// WHAT THIS FILE FOUND ON ITS FIRST RUN, which is the evidence rather than a
// planted case (R178): `middleware.ts` and `next.config.ts` matched NO rule
// at all. middleware.ts sets X-Robots-Tag on the calculator - a byte the
// browser receives, asserted by three tests in e2e/calculateur.spec.ts that a
// change to it would not have run. next.config.ts decides trailingSlash,
// pageExtensions and distDir, so it decides what every route IS.
//
// R175's shape, stated so the next one is recognised: the selector had a test
// asserting each PATTERN behaves, and a test asserting the database closure is
// complete. Between "every pattern is correct" and "the closure reaches
// everything it should" sat "and some files are reached by neither", which is
// where all three of these lived.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_ENTRY_STEMS,
  PACKAGE_ROOT,
  ROOT_ENTRY_POINTS,
  ROOT_TOOL_CONFIGS,
  frameworkEntryPoints,
  rootCodeFiles,
  selectSuites,
  uncoveredEntryPoints,
} from '../../../scripts/gate-selection.mjs';

const ENTRY_POINTS = frameworkEntryPoints(PACKAGE_ROOT);

/**
 * A floor, not the count.
 *
 * R63: an enumeration that found nothing would report perfect coverage, and
 * "all of nothing is covered" is the vacuous pass every guard in this
 * directory exists to refuse. The number is deliberately well below the real
 * one - this asserts the walk WORKED, and the census below asserts what it
 * found.
 */
const PLAUSIBLE_FLOOR = 40;

describe('R246: the framework invokes these, so no import graph can reach them', () => {
  it('enumerated a plausible number of entry points', () => {
    expect(
      ENTRY_POINTS.length,
      `found ${ENTRY_POINTS.length} framework entry points, expected at least ` +
        `${PLAUSIBLE_FLOOR}. A walk that found nothing would report every ` +
        'entry point covered.',
    ).toBeGreaterThanOrEqual(PLAUSIBLE_FLOOR);
  });

  it('found each KIND of entry point, not many of one kind', () => {
    // The count above is satisfied by fifty pages and no root files, which is
    // exactly the shape that hid the defect. So: one assertion per kind.
    expect(ENTRY_POINTS, 'the root instrumentation hook').toContain('instrumentation.ts');
    expect(ENTRY_POINTS, 'the root middleware').toContain('middleware.ts');
    expect(ENTRY_POINTS, 'the root build config').toContain('next.config.ts');

    expect(
      ENTRY_POINTS.filter((path) => path.endsWith('/page.tsx')).length,
      'pages under app/**',
    ).toBeGreaterThan(5);

    expect(
      ENTRY_POINTS.filter((path) => path.endsWith('/route.ts')).length,
      'route handlers under app/**',
    ).toBeGreaterThan(5);

    expect(
      ENTRY_POINTS.filter((path) => path.endsWith('/layout.tsx')).length,
      'layouts under app/**',
    ).toBeGreaterThan(0);

    // R129's dev routes are pages only when FRONTALIER_DEV_ROUTES=1, and the
    // stem is still `page`. They are read to the FIRST dot for this reason;
    // reading to the last would drop all six and nothing would say so.
    expect(
      ENTRY_POINTS.filter((path) => path.endsWith('/page.dev.tsx')).length,
      'page.dev.tsx is a page - the stem is read to the first dot',
    ).toBeGreaterThan(0);
  });

  it('every framework entry point is claimed by at least one selector rule', () => {
    const uncovered = uncoveredEntryPoints(ENTRY_POINTS);

    expect(
      uncovered,
      'these are invoked by Next and matched by no rule in SELECTOR_PATTERNS, ' +
        'so a commit touching one ALONE selects the base chain and nothing ' +
        'else. Nothing imports them, so R218’s closure cannot reach them ' +
        'either. Add a rule, or - where a test genuinely does import it - an ' +
        'import that puts it in the closure.',
    ).toEqual([]);
  });

  it('names the suites each root entry point selects, so a silent narrowing shows', () => {
    // The assertion above is satisfied by ANY rule matching. These three are
    // the files R246 was written about, so what they select is stated rather
    // than left to whichever pattern happens to claim them.
    const suitesFor = (path: string): string[] => selectSuites([path]).suites;

    expect(suitesFor('middleware.ts'), 'middleware sets a header on a rendered response').toContain(
      'test:e2e',
    );
    expect(suitesFor('next.config.ts'), 'the config decides what every route is').toContain(
      'test:e2e',
    );

    // instrumentation.ts is covered THROUGH the database closure, because
    // tests/db/scheduled-jobs.test.ts imports it. That is the right mechanism
    // and a fragile fact: this assertion is what makes deleting the import
    // loud instead of silent.
    expect(
      suitesFor('instrumentation.ts'),
      'instrumentation.ts starts the scheduler and is covered because ' +
        'tests/db/scheduled-jobs.test.ts imports it. If this failed, that ' +
        'import was removed and the only caller of startScheduler() is ' +
        'unguarded again.',
    ).toContain('test:db');
  });

  it('would report an entry point that no rule claims', () => {
    // THE DETECTOR'S OWN CHECK (R133/R154). The assertion above is green on a
    // repaired tree, and a `uncoveredEntryPoints` that always returned [] -
    // a typo in the matcher, an inverted condition - would be green too.
    // The live instances are the evidence and they are in the report; this is
    // the mechanism, proven on a path chosen because no rule can match it.
    const fabricated = 'somewhere-no-rule-reaches/entry.ts';

    expect(
      selectSuites([fabricated]).matched,
      'the fabricated path must genuinely match nothing, or this proves nothing',
    ).toEqual([]);

    expect(uncoveredEntryPoints([fabricated]), 'and the detector reports it').toEqual([fabricated]);

    // And it does not report a covered one, so it is not simply returning
    // its argument.
    expect(uncoveredEntryPoints(['app/layout.tsx']), 'a covered path is not reported').toEqual([]);
  });
});

describe('R246: the package root is closed-world', () => {
  // DISCOVERY CANNOT HELP AT THE ROOT - there is no convention to walk, and a
  // future root-level entry point is one nobody has heard of yet. So every
  // code file here is classified, and one that is neither a framework entry
  // point nor a tool's config FAILS until somebody decides which it is. This
  // is the half that makes the stated limit of APP_ENTRY_STEMS survivable: a
  // new root convention arrives as a new root FILE.
  const ROOT_FILES = rootCodeFiles(PACKAGE_ROOT);

  it('read the root at all', () => {
    expect(ROOT_FILES.length, 'no code files found at the package root').toBeGreaterThan(5);
    expect(ROOT_FILES, 'the walk reaches .ts').toContain('next.config.ts');
    expect(ROOT_FILES, 'the walk reaches .mjs').toContain('eslint.config.mjs');
  });

  it('every root code file is classified', () => {
    const classified = new Set([...ROOT_ENTRY_POINTS, ...Object.keys(ROOT_TOOL_CONFIGS)]);
    const unclassified = ROOT_FILES.filter((name) => !classified.has(name));

    expect(
      unclassified,
      'a code file at the package root belongs to Next or to a tool, and ' +
        'which one decides whether it needs a selector rule. Add it to ' +
        'ROOT_ENTRY_POINTS (and give it a rule) or to ROOT_TOOL_CONFIGS.',
    ).toEqual([]);
  });

  it('the two lists are disjoint, and every tool config named still exists', () => {
    const toolConfigs = Object.keys(ROOT_TOOL_CONFIGS);
    const overlap = ROOT_ENTRY_POINTS.filter((name) => toolConfigs.includes(name));

    expect(overlap, 'a file cannot be both the framework’s and a tool’s').toEqual([]);

    // A list that named files nobody has any more would grow stale in the
    // direction that hides things: a dead entry classifies nothing, and the
    // next real file gets added beside it without anybody noticing the list
    // had stopped describing the directory.
    const missing = toolConfigs.filter((name) => !existsSync(join(PACKAGE_ROOT, name)));

    expect(missing, 'ROOT_TOOL_CONFIGS names files that are not there').toEqual([]);
  });

  it('R247: a config selects the suite it configures', () => {
    // THE ASYMMETRY THIS REMOVES. vitest.config.ts was covered because the
    // suite it configures happens to sit in BASE_SUITES; playwright.config.ts
    // configures a suite that is SELECTED, so it was covered by nothing. Two
    // files of identical kind with opposite outcomes, and the difference had
    // nothing to do with either file - a policy nobody chose.
    //
    // One assertion over both cases is the repair. Where the suite is in the
    // base chain this is trivially true, and that is exactly why it belongs
    // here: coverage stops depending on which side of the base chain a suite
    // landed on.
    const uncovered = Object.entries(ROOT_TOOL_CONFIGS).flatMap(([config, required]) => {
      if (required === null) return [];

      const selected = selectSuites([config]).suites;

      // EVERY suite it names, not the first. playwright.config.ts defines both
      // browser projects, and a check that stopped at one would have been
      // satisfied by half the answer.
      return required
        .filter((suite) => !selected.includes(suite))
        .map((suite) => `${config} does not select ${suite}`);
    });

    expect(
      uncovered,
      'a config decides what its suite DOES, so changing it has to run that ' +
        'suite. Add a selector rule, or - if it genuinely configures nothing ' +
        'that is run - map it to null and say why.',
    ).toEqual([]);
  });

  it('a null in the map is a claim, not a blank', () => {
    // An exemption that can be left empty by accident is an exemption that
    // grows (R206's corollary). Each null is read back here so that adding
    // one is a deliberate act somebody has to defend, rather than the second
    // entry in an established habit.
    const exempt = Object.entries(ROOT_TOOL_CONFIGS)
      .filter(([, suite]) => suite === null)
      .map(([config]) => config);

    expect(
      exempt,
      'next-env.d.ts is generated by Next and read by nothing that decides ' +
        'what a suite does. Any other exemption needs its own argument.',
    ).toEqual(['next-env.d.ts']);
  });

  it('APP_ENTRY_STEMS holds conventions, not paths', () => {
    // Cheap, and it catches the edit that would break discovery silently:
    // a stem written as `page.tsx` or `app/page` matches no filename stem and
    // would quietly stop finding that kind of entry point.
    for (const stem of APP_ENTRY_STEMS) {
      expect(stem, `${stem} should be a bare stem`).not.toContain('.');
      expect(stem, `${stem} should be a bare stem`).not.toContain('/');
    }

    expect(APP_ENTRY_STEMS, 'the two that carry every route').toContain('page');
    expect(APP_ENTRY_STEMS).toContain('route');
  });
});
