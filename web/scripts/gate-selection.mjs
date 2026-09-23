// web/scripts/gate-selection.mjs
//
// RULING R132, as amended before its first use: THE GATE IS SELECTED BY
// CHANGED PATHS, not by the person running it.
//
// WHY. FW13 put two red commits on main. fdca008 and 2f2cbd2 each passed
// `pnpm typecheck && pnpm lint && pnpm test && pnpm build` - the chain
// CLAUDE.md defined as green - and each failed CI on suites that chain does
// not contain: two live-region COUNT assertions in e2e/calculateur.spec.ts,
// and fourteen visual baselines at zero tolerance. One edit, two suites
// nobody had run, an hour of red on main.
//
// The judgement version of this rule - "run the visual suite when you think
// you changed pixels" - is the version that failed. I did not think I had
// changed pixels; I had added a row to a form. So the selection is made from
// the diff, which cannot be optimistic about what it touched.
//
// THE AMENDMENT, recorded here because the script is where somebody will read
// it. The first version of R132 required test:visual and test:a11y. Measured
// against the two commits the ruling was written for:
//
//   test:a11y runs three files - lib/ui/react/accessibility.test.tsx,
//   tests/unit/pages/accessibility.test.tsx and
//   accessibility-calculateur.test.tsx - every one of them matched by
//   pnpm test's own globs. It is a strict subset of a suite already in the
//   chain, so requiring it is a second execution, not more coverage.
//
//   test:e2e was missing from the list, and it is the suite that caught half
//   the failure. The jsdom live-region count died inside fdca008, where
//   pnpm test caught it; the two counts in e2e/calculateur.spec.ts survived
//   to CI red and were not fixed until cc8605a.
//
// A selector that fires correctly and then runs the WRONG suites is worse
// than no selector, because it produces a green that looks path-aware. So
// a11y is still named in what this prints - "covered by pnpm test" - which
// keeps its absence a decision somebody can read rather than an omission
// somebody re-adds in six months.
//
// PURE. No git, no spawning, no process exit: this file answers "given these
// paths, which suites" and nothing else, so the answer can be asserted in a
// unit test rather than inferred from a gate run. gate-for-changes.mjs is the
// half that talks to git and runs things.

/**
 * Suites that report how much work they did, and the shape of that report.
 *
 * R133: A HARNESS ASSERTS A POSITIVE SIGNAL, NEVER INFERS FROM ABSENCE.
 * FW13's mutation harness passed --reporter=basic to a Vitest 5 that had
 * removed it; every probe died at startup having run ZERO tests, and the
 * check - "does the output say failed?" - read that silence as GREEN and
 * reported four surviving mutants.
 *
 * So a suite listed here must PRINT a number, and a missing number is a
 * failure rather than a pass. Suites not listed have no count to have -
 * tsc, eslint and next build report success by saying nothing - and are
 * judged by exit code, which the summary says out loud so that "passed" is
 * never quietly read as "was measured".
 */
export const SUITE_COUNTS = Object.freeze({
  // "Tests  1940 passed (1940)" and "Tests  10 failed | 1812 passed (1822)".
  test: /Tests {2}(?:\d+ failed \| )?(\d+) passed/,
  // Playwright: "96 passed (1.6m)".
  'test:e2e': /(\d+) passed/,
  'test:visual': /(\d+) passed/,
  // Also vitest, against its own config.
  'test:db': /Tests {2}(?:\d+ failed \| )?(\d+) passed/,
  // R182 re-runs two files, so it is vitest again. It gets a pattern for
  // the same reason every other suite has one: a suite that reports
  // nothing must not read as a pass (R133).
  'test:late': /Tests {2}(?:\d+ failed \| )?(\d+) passed/,
});

/**
 * What a finished suite actually reported.
 *
 * `floor` is the other half of R133: "N tests ran AND N >= expected". The
 * first half catches a suite that died; the second catches one that SHRANK,
 * which is the quieter failure - a spec file that stops being collected still
 * exits 0 and still prints a number, just a smaller one. That is how FW8's
 * .test.tsx glob went unnoticed, and scripts/suite-floor.json has held the
 * line for vitest ever since. The visual and end-to-end suites had no such
 * floor until this sweep.
 *
 * @param {string} suite
 * @param {string} output
 * @param {number} [floor] the count below which this is a failure
 * @returns {{counted: boolean, ran?: number, failure?: string}}
 */
export function readCount(suite, output, floor) {
  const pattern = SUITE_COUNTS[suite];

  if (pattern === undefined) return { counted: false };

  const found = pattern.exec(output);

  if (found === null) {
    return {
      counted: true,
      failure:
        `pnpm ${suite} exited 0 but printed no count. A suite that reports ` +
        'nothing must not read as a pass (R133): either the runner changed ' +
        'its summary format, or it ran no tests.',
    };
  }

  const ran = Number(found[1]);

  if (!Number.isFinite(ran) || ran < 1) {
    return { counted: true, failure: `pnpm ${suite} reported ${found[1]} passed` };
  }

  if (typeof floor === 'number' && ran < floor) {
    return {
      counted: true,
      ran,
      failure:
        `pnpm ${suite} ran ${ran} tests, floor is ${floor}. A count that ` +
        'dropped ON PURPOSE is a deliberate edit to scripts/suite-floor.json ' +
        'with the reason in the commit message; a count that dropped by ' +
        'accident is what this check is for.',
    };
  }

  return { counted: true, ran };
}

/** Always run, whatever changed. The chain CLAUDE.md used to call green. */
/**
 * Every source file the database suite transitively depends on. R218.
 *
 * ============================================================================
 * DERIVED FROM THE IMPORT GRAPH, NOT FROM A LIST SOMEBODY REMEMBERS TO EXTEND
 * ============================================================================
 *
 * The path list had been extended three times - FW14 added three directories,
 * FW23 found a fourth missing - which is R149's signal that the defect is in the
 * mechanism rather than in the entry nobody added. Same move as the mesh checker
 * deriving from the registry instead of from a hand-kept copy of it.
 *
 * THE DIRECTION MATTERS, AND THE OBVIOUS ONE IS WRONG. "A module that imports
 * the Prisma client selects test:db" does not cover the case that raised the
 * question: `lib/entries/schema.ts` imports no Prisma at all - it is imported BY
 * `write.ts`, which does. Measured before this was built, which is why this
 * walks the graph from the SUITE outward rather than from each file inward.
 *
 * The question the selector actually asks is "could changing this file break
 * test:db?", and that is answered by reachability FROM the suite's own test
 * files. Everything they import, and everything those import, is in scope.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** web/, derived from this file's own location rather than from process.cwd(). */
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The repository root, which is NOT the package root. */
export const REPO_ROOT = join(PACKAGE_ROOT, '..');

/**
 * Every path the working tree has changed, from the repository root.
 *
 * ============================================================================
 * BOTH GIT COMMANDS RUN FROM THE SAME PLACE (R221)
 * ============================================================================
 *
 * They used to run from web/, and the two disagreed about what a path IS:
 * `git diff --name-only` reports from the REPOSITORY ROOT whichever directory
 * it runs in, while `git ls-files --others` reports relative to the CURRENT
 * one. A single selection printed
 *
 *     web/prisma/schema.prisma                  (tracked)
 *     prisma/migrations/..._id/migration.sql    (untracked)
 *
 * for two files in the same directory.
 *
 * THE HARMLESS HALF: `toPackagePath` strips a leading `web/` and passes an
 * already-package-relative path through unchanged, so both forms happened to
 * land on the right rule. Correct by absorption, not by design.
 *
 * THE HALF THAT WOULD HAVE BITTEN: `ls-files --others` run from web/ CANNOT
 * SEE an untracked file outside it. Everything selectable lives under web/
 * today - but `android/` arrives at AN1, and a new top-level directory would
 * be invisible on exactly the commit where it matters most, its first. A test
 * plants a file at the repository root and asserts this function sees it.
 *
 * IT LIVES HERE RATHER THAN IN gate-for-changes.mjs because that script runs
 * the gate on import. A function a test cannot import without running the
 * thing it is testing is a function with no test.
 */
export function changedPaths(cwd = REPO_ROOT) {
  const git = (args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

  const raw = [
    ...git(['diff', '--name-only', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];

  // NORMALISED ONCE, HERE, rather than by each consumer guessing. Backslashes
  // because this runs on Windows; the set because a file can be reported by
  // both commands.
  return [...new Set(raw.map((path) => path.split('\\').join('/')))].sort();
}

/** Extensions tried when a specifier carries none, in resolution order. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '/index.ts', '/index.tsx'];

/**
 * Every import specifier in a source file.
 *
 * A REGEX RATHER THAN A PARSER, deliberately. The alternative is a TypeScript
 * program, which costs seconds on every gate run to answer a question this
 * answers in milliseconds. It over-matches - a specifier inside a comment or a
 * string counts - and over-matching is the SAFE direction here: the cost is
 * running test:db when it was not needed, never skipping it when it was.
 */
function specifiersOf(source) {
  const found = [];

  for (const match of source.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/gu)) {
    if (match[1] !== undefined) found.push(match[1]);
  }

  return found;
}

/** A specifier resolved to a file under the package, or null for anything else. */
function resolve(root, fromFile, specifier) {
  let base;

  if (specifier.startsWith('@/')) {
    base = join(root, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = join(dirname(fromFile), specifier);
  } else {
    // A bare package - node_modules, or `node:fs`. Not ours, so not a subject.
    return null;
  }

  if (existsSync(base) && statSync(base).isFile()) return base;

  for (const extension of EXTENSIONS) {
    const candidate = base + extension;

    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
}

/**
 * Every *.test.ts under tests/db - the suite's own entry points.
 *
 * RECURSIVE, BECAUSE THE SUITE IS. vitest.db.config.ts globs every
 * .test.ts under tests/db AT ANY DEPTH, and the first version of this read the
 * directory flat. It was correct only because no subdirectory exists yet - R171's
 * coincidence, inside the mechanism written to remove exactly that. A test
 * asserts every file the glob would match is in the closure, so the day
 * somebody adds tests/db/entries/ this stays honest.
 */
function seeds(root) {
  const dir = join(root, 'tests', 'db');

  if (!existsSync(dir)) return [];

  const found = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);

      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.test.ts')) found.push(full);
    }
  }

  return found;
}

/**
 * The closure, as package-relative POSIX paths.
 *
 * Memoised per root: `selectSuites` asks once per changed path and the graph
 * does not move inside a run.
 */
const CACHE = new Map();

export function databaseClosure(root) {
  const key = root;
  const cached = CACHE.get(key);

  if (cached !== undefined) return cached;

  const queue = seeds(root);
  const seen = new Set();

  while (queue.length > 0) {
    const file = queue.pop();

    if (file === undefined || seen.has(file)) continue;

    seen.add(file);

    let source;

    try {
      source = readFileSync(file, 'utf8');
    } catch {
      // A file that cannot be read contributes nothing. It is not an error:
      // a deleted file is a normal thing to find in a diff.
      continue;
    }

    for (const specifier of specifiersOf(source)) {
      const target = resolve(root, file, specifier);

      if (target !== null && !seen.has(target)) queue.push(target);
    }
  }

  const closure = new Set(
    [...seen].map((file) => relative(root, file).split('\\').join('/')),
  );

  CACHE.set(key, closure);

  return closure;
}

// ============================================================================
// RULING R246: THE FRAMEWORK'S ENTRY POINTS ARE ENUMERATED, AND EACH ONE IS
// ASSERTED TO BE COVERED BY A SELECTOR RULE
// ============================================================================
//
// AN ENTRY POINT IS REACHABLE FROM NO IMPORT, BY DEFINITION. instrumentation.ts,
// middleware.ts, next.config.ts and everything Next routes to under app/** are
// invoked BY THE FRAMEWORK rather than by a module, so R218's import-derived
// closure cannot see them however far it walks. A closure is the right
// mechanism for a library and is STRUCTURALLY BLIND to an entry point - not
// incomplete, blind, and no amount of walking fixes it.
//
// WHAT IT COST BEFORE IT WAS A RULE. FW27 added `startScheduler()` and wired it
// into instrumentation.ts, which is its ONLY caller. instrumentation.ts matched
// no pattern in the list below, so a commit touching that file alone would have
// run the base chain and NOT test:db - the suite that starts the scheduler and
// asserts both queues register. It is covered today only because
// tests/db/scheduled-jobs.test.ts imports it. That is the right fix - a file
// enters the closure by being REACHABLE, not by being listed - and it is also
// INCIDENTAL: delete that one import and the coverage leaves with it, in
// silence. The guard turns that silence into a failure.
//
// TWO HALVES, AND THEY ARE DIFFERENT MECHANISMS ON PURPOSE.
//
//   app/**     DISCOVERED, by Next's filename conventions. A route added
//              tomorrow is enumerated on the day it is written, with nobody
//              remembering to list it.
//   the root   CLOSED-WORLD. Every code file at the package root is either a
//              framework entry point or a tool's config, and one that is
//              NEITHER fails. Discovery cannot help here: there is no
//              convention to walk, the set is small enough to classify, and
//              the root is exactly where R246's gap was.
//
// THE LIMIT, STATED RATHER THAN HOPED: a convention Next ADDS - some future
// app/**/proxy.ts - would not be in APP_ENTRY_STEMS and would not be found.
// The closed-world root check is what bounds that, because a new root-level
// convention arrives as a new root-level FILE and fails as unclassified.

/**
 * The filename stems Next.js routes to under app/**.
 *
 * Next matches these before any extension, and `page.dev.tsx` is a `page` -
 * R129's dev-route mechanism works by making `dev.tsx` a page extension, so
 * the stem is read up to the FIRST dot rather than the last.
 */
export const APP_ENTRY_STEMS = Object.freeze([
  'page',
  'layout',
  'route',
  'not-found',
  'error',
  'global-error',
  'loading',
  'template',
  'default',
  'sitemap',
  'robots',
  'manifest',
  'opengraph-image',
  'twitter-image',
  'icon',
  'apple-icon',
]);

/**
 * Framework entry points at the package root, as conventions rather than as
 * files: one that does not exist is simply not found.
 *
 * instrumentation-client.ts is named although this product has none. It is a
 * convention Next already supports, so naming it now means the day somebody
 * adds one it is enumerated rather than invisible - which is the whole of
 * R246 applied to its own list.
 */
export const ROOT_ENTRY_POINTS = Object.freeze([
  'instrumentation.ts',
  'instrumentation-client.ts',
  'middleware.ts',
  'next.config.ts',
]);

/**
 * Root code files that are a TOOL's entry point, not the framework's.
 *
 * They are classified rather than ignored, so the root check is closed-world:
 * a new file at the root is neither of these until somebody decides which it
 * is, and until then the guard fails.
 *
 * THEY ARE DELIBERATELY NOT ASSERTED TO BE COVERED, and that is a smaller
 * claim than it looks. vitest.config.ts configures `test`, which is in
 * BASE_SUITES and therefore always runs; prisma.config.ts and
 * vitest.db.config.ts are already named by the database rule. What that leaves
 * is the two Playwright configs, which is a real gap of the same shape and is
 * reported rather than fixed here - R246 rules on the FRAMEWORK's entry
 * points, and widening a gate is an "ask first" item.
 */
export const ROOT_TOOL_CONFIGS = Object.freeze([
  // FOUND BY THE CHECK, NOT BY THE AUTHOR. `.stylelintrc.mjs` is a dotfile,
  // so the hand survey of the root that produced this list - an `ls` - did
  // not list it, and the closed-world assertion failed on its first run
  // naming a file its own author had missed. R178's point arriving inside the
  // mechanism written to make it: a list is wrong the day it is written.
  '.stylelintrc.mjs',
  'eslint.config.mjs',
  'next-env.d.ts',
  'playwright.config.ts',
  'playwright.runtime.config.ts',
  'prisma.config.ts',
  'vitest.config.ts',
  'vitest.db.config.ts',
]);

/** Extensions Next will route to. */
const ENTRY_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** Every code file directly at the package root, for the closed-world check. */
export function rootCodeFiles(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && ENTRY_EXTENSIONS.some((extension) => entry.name.endsWith(extension)),
    )
    .map((entry) => entry.name)
    .sort();
}

/**
 * Every file the framework invokes, as package-relative POSIX paths.
 *
 * @param {string} root the package root
 * @returns {string[]}
 */
export function frameworkEntryPoints(root) {
  const found = ROOT_ENTRY_POINTS.filter((name) => existsSync(join(root, name)));
  const appDir = join(root, 'app');
  const stack = existsSync(appDir) ? [appDir] : [];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }

      const dot = entry.name.indexOf('.');

      if (dot < 1) continue;

      // The stem is read to the FIRST dot and the extension from the LAST, so
      // `page.dev.tsx` is a page and `CalculatorForm.tsx` is not.
      const stem = entry.name.slice(0, dot);

      if (!APP_ENTRY_STEMS.includes(stem)) continue;
      if (!ENTRY_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;

      found.push(relative(root, full).split('\\').join('/'));
    }
  }

  return found.sort();
}

/**
 * Those of `points` that no selector rule claims.
 *
 * An empty `matched` is the signal: `selectSuites` returns one hit per pattern
 * a path satisfies (R234), so nothing matched means the base chain and nothing
 * else - a change to that file would run typecheck, lint, test and build, and
 * whatever suite actually exercises it would not run.
 *
 * @param {readonly string[]} points
 * @returns {string[]}
 */
export function uncoveredEntryPoints(points) {
  return points.filter((point) => selectSuites([point]).matched.length === 0);
}

export const BASE_SUITES = Object.freeze(['typecheck', 'lint', 'test', 'build']);

/** What a change to something the browser renders requires. */
export const BROWSER_SUITES = Object.freeze(['test:e2e', 'test:visual']);

/**
 * What a change to the database layer requires. FW14 increment 1.
 *
 * test:db is not in pnpm test and deliberately so: it needs a running
 * PostgreSQL, and folding it into the primary loop command would make that
 * command depend on a service. The predictable end of that road is somebody
 * mocking the database to get pnpm test green, at which point the tests stop
 * asserting what PostgreSQL does - which is the only reason they exist.
 *
 * So it is selected instead, which is exactly what R132 is for.
 */
export const DATABASE_SUITES = Object.freeze(['test:db']);

/**
 * The R81 guard, which is its own Playwright project and its own config.
 *
 * It is not in BROWSER_SUITES and must not be: it runs against a server
 * started with FRONTALIER_RUNTIME=1 and NO configured origin, so running
 * it beside the ordinary e2e suite would assert the opposite of what is
 * true there. R144 needs it as a selectable suite because a changed
 * *.runtime.spec.ts belongs to it and to nothing else.
 */
export const RUNTIME_SUITES = Object.freeze(['test:runtime']);

/**
 * RULING R182: A CHECK RUNS AFTER THE THING IT CHECKS FOR CAN EXIST.
 *
 * ORDER IS PART OF A GUARD’S SPECIFICATION. Two checks in tests/unit/meta
 * read artefacts that `test:visual` PRODUCES, and both of them sit inside
 * `pnpm test`, which this chain runs four steps earlier:
 *
 *   distdir-leaks.test.ts  tsconfig.json and next-env.d.ts, which the
 *                          visual container rewrites to its per-run
 *                          distDir and scripts/visual.mjs restores after.
 *   og-image.test.ts       public/opengraph-image.png against
 *                          tests/visual/baselines/og-card.png, which
 *                          e2e/og.visual.spec.ts writes.
 *
 * FW20b MEASURED THE COST. After a fully green gate, both files pointed
 * at a dead .next-visual-<pid> directory. The detector had run minutes
 * before the run that corrupted them, and `tsc --noEmit` exits 0 on a
 * dead /// <reference path>, so nothing else objected. The leak would
 * have been committed and caught by the NEXT task.
 *
 * TWICE, NOT MOVED, and that is the deliberate half. The early run catches
 * a leak INHERITED from a previous crashed run - the state FW20b actually
 * found the tree in - and this late run catches one the current gate
 * created. Moving them would trade one blind spot for the other.
 */
export const LATE_SUITES = Object.freeze(['test:late']);

/**
 * R132's patterns, in the order they are reported.
 *
 * RULING R140 GIVES THE TEST FOR ADDING ONE, and it is the durable half of
 * this file: ANY MODULE WHOSE OUTPUT REACHES RENDERED HTML SELECTS THE
 * BROWSER SUITES, WHATEVER DIRECTORY IT LIVES IN. The list below is a
 * consequence of that rule, not a thing to remember to extend - because the
 * next module will not be on anybody's list.
 *
 * HOW TO JUDGE A NEW MODULE, in one question: can a change to it alter a
 * byte that a browser receives, without any file already matched here
 * changing too? If yes, it belongs.
 *
 *   lib/params/**   decides what the link notice SAYS. e2e and visual both
 *                   assert that notice.                     -> belongs
 *   lib/alerts/**   the capture card renders its copy and its status
 *                   vocabulary.                             -> belongs
 *   lib/content/**  route paths, the sitemap, page content. -> belongs
 *   lib/calc-engine pure arithmetic. Its output reaches the page THROUGH
 *                   the island, which is app/** - and that is what
 *                   selects.                                -> does not
 *   lib/db/**       nothing it produces is rendered; it selects test:db
 *                   instead.                                -> does not
 *
 * FW14 MEASURED THE HOLE THIS CLOSES AND DID NOT CLOSE IT. Its increment 2
 * changed lib/params/codec.ts; the browser suites ran only because app/**
 * changed in the same commit. That is luck, not a gate - and it is the FW13
 * shape exactly, which is what R132 exists to prevent.
 *
 * The token layer comes first although lib/ui/** already covers it: a change
 * to tokens.scss is worth naming as a token change in the printed selection,
 * and first-match-wins would otherwise label it "lib/ui/**" and lose that.
 */
export const SELECTOR_PATTERNS = Object.freeze([
  {
    // R144, and it comes FIRST because first-match-wins: e2e/**/*.visual
    // .spec.ts must be judged before any other rule can claim it.
    //
    // A .visual.spec.ts is EXCLUDED from the chromium project by
    // testIgnore, so selecting test:e2e for one would run a suite that
    // deliberately does not contain it - a green measuring nothing.
    label: 'a visual spec, which test:e2e deliberately ignores (R144)',
    suites: ['test:visual'],
    matches: (path) => path.startsWith('e2e/') && path.endsWith('.visual.spec.ts'),
  },
  {
    // The runtime guard is its own project and its own config, excluded
    // from both others. R144 names two cases in its parenthetical and
    // states the principle as "the suite it belongs to"; this is the
    // third case, judged by that principle rather than added beyond it.
    label: 'a runtime spec, which is its own project (R144)',
    suites: RUNTIME_SUITES,
    matches: (path) => path.startsWith('e2e/') && path.endsWith('.runtime.spec.ts'),
  },
  {
    // Everything else under e2e/ is the ordinary suite - including
    // e2e/baseline.ts and other helpers, which are not specs but decide
    // what every spec asserts.
    // ITS SCOPE IS STATED, NOT INHERITED FROM ITS POSITION (R234).
    //
    // This used to be a bare `startsWith('e2e/')`, correct only because it was
    // declared AFTER the two specialisations above and the selector took the
    // first match. That made declaration order load-bearing: moving this line
    // up would have silently made every visual spec select test:e2e, a suite
    // that deliberately excludes it.
    //
    // Now the three are genuinely disjoint, so the selector can take the union
    // of everything a path matches - which is what a path in two ORTHOGONAL
    // categories (a page that a database test renders) needs - without a
    // specialisation being swallowed by its own general case.
    label: 'a spec file, which selects the suite it belongs to (R144)',
    suites: ['test:e2e'],
    matches: (path) =>
      path.startsWith('e2e/') &&
      !path.endsWith('.visual.spec.ts') &&
      !path.endsWith('.runtime.spec.ts'),
  },
  {
    // A BASELINE IS NOT A TEST, IT IS THE RECORD A TEST COMPARES AGAINST,
    // and changing one changes what the suite asserts. That is the same
    // relationship a spec has to its suite, which is why R144 covers
    // both in one sentence.
    label: 'a baseline, which is the record test:visual compares against (R144)',
    suites: ['test:visual'],
    matches: (path) => path.startsWith('tests/visual/baselines/'),
  },
  {
    label: 'the token layer (lib/ui/core/styles/**)',
    suites: BROWSER_SUITES,
    matches: (path) => path.startsWith('lib/ui/core/styles/'),
  },
  {
    label: 'app/**',
    suites: BROWSER_SUITES,
    matches: (path) => path.startsWith('app/'),
  },
  {
    // R246, first live instance. R140's question - can a change to it alter a
    // byte a browser receives, without any file already matched changing too?
    // - is answered by the file's only statement: it sets X-Robots-Tag on the
    // calculator. Three tests in e2e/calculateur.spec.ts assert that header
    // and its two absences, and none of them would have run.
    //
    // It is named on its own rather than folded into a "root files" rule
    // because the printed selection is read by a person deciding whether the
    // right suites ran, and "middleware" says what "the package root" does not.
    label: 'middleware.ts, which sets a header on a rendered response (R246)',
    suites: BROWSER_SUITES,
    matches: (path) => path === 'middleware.ts',
  },
  {
    // R246, second live instance, and the broader of the two: trailingSlash
    // decides which URLs answer 200, pageExtensions decides whether /dev/**
    // is in the build at all (R129), and distDir decides where the visual
    // container photographs from (R98). None of those is a module whose
    // output reaches HTML - each decides what the HTML IS.
    label: 'next.config.ts, which decides what every route is (R246)',
    suites: BROWSER_SUITES,
    matches: (path) => path === 'next.config.ts',
  },
  {
    label: 'lib/ui/**',
    suites: BROWSER_SUITES,
    matches: (path) => path.startsWith('lib/ui/'),
  },
  {
    label: 'lib/fr/**',
    suites: BROWSER_SUITES,
    matches: (path) => path.startsWith('lib/fr/'),
  },
  {
    label: '**/*.module.scss',
    suites: BROWSER_SUITES,
    matches: (path) => path.endsWith('.module.scss'),
  },
  {
    // R140. Three directories, one reason: each produces something a
    // browser receives. Grouped under a label that states the reason
    // rather than the paths, because the printed selection is read by a
    // person deciding whether the right suites ran.
    // GUIDE CONTENT IS RENDERED HTML - it is not a module whose OUTPUT
    // reaches a browser, it is the bytes themselves. R140 asks: can a
    // change to it alter a byte a browser receives without any file
    // already matched changing too? An article is nothing but that.
    //
    // FW17 found it missing: nine typography fixes in the fixture changed
    // every rendered page and the gate ran the base chain. FW17 protocol
    // item 2 states the rule - content changes select the browser suites -
    // and this is what makes it true.
    label: 'guide content, which IS rendered HTML (R140)',
    suites: BROWSER_SUITES,
    matches: (path) => path.startsWith('content/'),
  },
  {
    label: 'modules whose output reaches rendered HTML (R140)',
    suites: BROWSER_SUITES,
    matches: (path) =>
      path.startsWith('lib/params/') ||
      path.startsWith('lib/alerts/') ||
      path.startsWith('lib/content/'),
  },
  {
    // FW14 increment 1: "R132's selection must include the database
    // suites." One entry rather than five, because the printed selection is
    // read by a person and "the database layer" says more than a path does.
    label: 'the database layer (prisma/**, lib/db/**, tests/db/**, and anything test:db imports)',
    suites: DATABASE_SUITES,
    // R218: THE LIST IS A FLOOR; THE GRAPH IS THE RULE.
    //
    // The four path prefixes stay because they are DEFINITIONAL - a migration,
    // a new lib/db module nothing imports yet, a config - and none of them is
    // reachable through an import. What they are no longer asked to do is keep
    // up: `lib/entries/schema.ts` is the API contract tests/db drives end to
    // end, it matched none of these, and FW23 ran test:db by hand to cover it.
    //
    // The closure answers the question the list was standing in for: could
    // changing this file break test:db? Note that the obvious forward rule -
    // "a module that imports the Prisma client" - would NOT have caught
    // schema.ts, which imports no Prisma and is merely imported by something
    // that does. Measured before this was written.
    matches: (path) =>
      path.startsWith('prisma/') ||
      path.startsWith('lib/db/') ||
      path.startsWith('tests/db/') ||
      path === 'prisma.config.ts' ||
      path === 'vitest.db.config.ts' ||
      databaseClosure(PACKAGE_ROOT).has(path),
  },
]);

/**
 * Repo-relative to web-relative.
 *
 * git reports paths from the repository ROOT even when it is run inside web/,
 * so everything arrives as "web/app/..." while R132's patterns are written
 * from the package root. Backslashes are normalised because this runs on
 * Windows and the patterns are not.
 */
const toPackagePath = (path) => path.split('\\').join('/').replace(/^web\//, '');

/**
 * Which suites this diff requires.
 *
 * @param {readonly string[]} paths changed paths, as git reports them
 * @returns {{suites: string[], matched: {path: string, pattern: string}[]}}
 */
export function selectSuites(paths) {
  const matched = [];

  for (const path of paths) {
    const candidate = toPackagePath(path);

    // ============================================================================
    // EVERY PATTERN A PATH MATCHES, NOT THE FIRST (R234)
    // ============================================================================
    //
    // This was `.find(...)` from R218 until FW25b, so a path belonging to two
    // categories contributed only the suites of whichever pattern was DECLARED
    // FIRST. The size of the gap was set by declaration order in the list
    // below and by nothing else.
    //
    // THE INSTANCE THAT EXPOSED IT: `app/releve/print/page.tsx` is matched by
    // `app/**` (line ~474) and is also imported by `tests/db/print-route.test.ts`,
    // so it is in the database closure (line ~523). `find` returned `app/**`,
    // and the change that added a row type to the document did not run the
    // database suite that renders it.
    //
    // THE SUITE'S SHAPE IS WHY IT SURVIVED, and it is R175's shape on the
    // mechanism R218 exists to be: one test asserted ONE path in ONE category,
    // another asserted TWO paths in TWO categories, and *one path in two
    // categories* was never named. Two correct tests bounding a property from
    // opposite sides, with the case in the middle unexamined.
    for (const pattern of SELECTOR_PATTERNS) {
      if (pattern.matches(candidate)) matched.push({ path, pattern: pattern.label });
    }
  }

  // The union, in a fixed order: the base chain, then each group in the
  // order SELECTOR_PATTERNS declares it. Deterministic because this string
  // goes into commit bodies, and a selection that reordered itself between
  // runs would be one more thing nobody can diff.
  const suites = [...BASE_SUITES];

  for (const pattern of SELECTOR_PATTERNS) {
    if (!matched.some((hit) => hit.pattern === pattern.label)) continue;

    for (const suite of pattern.suites) {
      if (!suites.includes(suite)) suites.push(suite);
    }
  }

  // R182: LAST, AND ONLY WHEN THERE IS SOMETHING TO RE-CHECK. Appended
  // after the pattern loop rather than from a pattern, because a
  // pattern contributes its suites at ITS position in the list and the
  // whole point of these two is that they come after test:visual.
  //
  // Conditional on test:visual for the other half: with no visual run,
  // nothing rewrites tsconfig.json or og-card.png, and a second
  // execution of two file-reading tests would be noise rather than a
  // guard.
  if (suites.includes('test:visual')) {
    for (const suite of LATE_SUITES) {
      if (!suites.includes(suite)) suites.push(suite);
    }
  }

  return { suites, matched };
}

/**
 * The selection as text, for the terminal and for the commit body.
 *
 * R132 requires the selection to be PRINTED and RECORDED. Recorded matters
 * more than printed: a commit that says which suites ran is a commit somebody
 * can audit six months later, and the failure this ruling exists to prevent
 * was invisible precisely because nothing said what had not been run.
 */
export function describeSelection({ suites, matched }) {
  const lines = ['gate selection (R132):'];

  if (matched.length === 0) {
    lines.push('  no path matched the selector - base chain only');
  } else {
    lines.push(`  ${matched.length} path(s) matched:`);

    for (const hit of matched) lines.push(`    ${hit.path}  ->  ${hit.pattern}`);
  }

  lines.push(`  suites: ${suites.join(', ')}`);
  lines.push(
    "  a11y: covered by pnpm test - test:a11y's three files are a subset of",
  );
  lines.push('        its globs, so requiring it separately is a second run');

  return lines.join('\n');
}
