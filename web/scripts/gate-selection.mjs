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
  // R251's suite is not vitest: it prints its own line for the same reason
  // every other suite has one - a suite that reports nothing must not read
  // as a pass.
  'test:container': /Container checks {2}(\d+) passed/,
  // The scheduler probe measures something - executions across two replicas -
  // so it reports a number rather than being judged on its exit code alone.
  'test:container:scheduler': /Scheduler checks {2}(\d+) passed/,
  // The restore probe counts what it asserted about a backup that was
  // actually restored, so it reports a number rather than an exit code.
  'test:container:restore': /Restore checks {2}(\d+) passed/,
  // FW31/R256. A suite that reports nothing must not read as a pass, and this
  // one makes the only production-write claim in the repository.
  'test:container:write': /Production write checks {2}(\d+) passed/,
});

/**
 * A runner's output with its colour codes removed.
 *
 * EVERY COUNT PATTERN ABOVE ASSUMES THE DIGITS SIT IMMEDIATELY AFTER THE
 * LABEL, and a colouring runner puts an escape sequence between them: vitest
 * prints `Tests  \u001B[1m\u001B[32m9 passed\u001B[39m`, which
 * `/Tests {2}(\d+) passed/` cannot match. It matches locally because output
 * captured through a pipe is not a TTY and vitest does not colourise; it fails
 * wherever the runner decides otherwise.
 *
 * FW31 FOUND THIS IN CI, AND THE WAY IT FAILED IS WHY IT IS A FUNCTION RATHER
 * THAN A REGEX REPEATED TWICE. scripts/container-e2e.mjs carried its own copy
 * of the same pattern. Nine tests passed, the parse returned null, and the
 * harness reported "the auth round trip reported NO PASSING TESTS" - R133's
 * guard against a suite that silently skipped everything, firing on a suite
 * that had silently passed everything. A guard that cannot read its subject
 * reports the absence of the subject, which is the most expensive way for a
 * guard to be wrong.
 *
 * @param {string} output
 * @returns {string}
 */
export function stripAnsi(output) {
  // CSI colour sequences only. That is all a runner emits here, and a wider
  // pattern could eat a digit it was never meant to touch.
  //
  // no-control-regex IS DISABLED HERE AND NOWHERE ELSE, because the thing
  // being removed IS a control character: U+001B is what starts every escape
  // sequence, and a function that strips them cannot avoid naming it. The
  // rule exists to catch a control character that arrived in a pattern by
  // accident - a literal tab or NUL somebody pasted - which is the opposite
  // of this case. The alternative, building the pattern with
  // String.fromCharCode(27), would satisfy the linter by hiding the
  // character from it, which is evasion rather than a fix (R181).
  // eslint-disable-next-line no-control-regex -- U+001B is the subject, not an accident
  return output.replace(/\u001B\[[0-9;]*m/gu, '');
}

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

  const found = pattern.exec(stripAnsi(output));

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
// R990: WHAT THE CONTAINER PDF STEP RENDERS AND READS, FROM THE IMPORT GRAPH
// ============================================================================
//
// R267's SECOND SITE (FW-PDF-RENDER-GATE QUESTION 1). The R936/R982 rule named
// the step's vitest files, the renderer, the page reader and the @page rule.
// It did not name the print page those tests render, the export route they
// call, or the support files they read the result with - so a page.tsx edit
// that dropped the rail ran test:e2e, test:visual and test:db, where the 15
// render tests SKIP, and passed every gate (no e2e spec touches /releve/print
// or the export route).
//
// THE SET IS READ FROM IMPORTS, NOT TYPED (R218's lesson, on a second suite).
// Two halves:
//
// 1. WHAT THE PRINT PAGE AND THE EXPORT ROUTE *ALONE* RENDER THROUGH. Seeded
//    from the two framework entry points, which no import reaches (R246, so
//    they are enumerated), and grown by EXCLUSIVITY: a module joins when every
//    product file importing it is already in the set. lib/export/render-queue
//    joins (only the route imports it); lib/dossier/load does not (the dossier
//    and CSV routes import it too).
//
//    WHY "ALONE" AND NOT THE WHOLE REACH. The route imports the database
//    client, the dossier and the calculation engine, so its full reach is half
//    the product, and every edit to it would pay a Docker build - a gate people
//    route around (R251). A shared module keeps the suites it already selects:
//    test:db renders the same page through its handler, without a browser
//    (print-route.test.ts, annex-rendered.test.ts).
//
//    A TEST IS NOT AN IMPORTER here. tests/unit/export/render-queue.test.ts
//    imports the queue to prove it; that does not make the queue shared.
//
//    OVER-MATCHING IS THE UNSAFE DIRECTION HERE, unlike in databaseClosure: a
//    specifier in another file's comment would make a module look shared and
//    drop it. gate-selection.test.ts pins the result as a census, so a module
//    leaving fails by name instead of quietly.
//
// 2. EVERY tests/ FILE THE HARNESS'S VITEST FILES REACH. Seeded from the
//    harness's own list (R206: read from container-e2e.mjs, its one home), so
//    live-server.ts - which decides whether the 17 run at all - pdf-text.ts
//    and pdf-image.ts are in because the tests import them, and the next
//    reader is in the day it is imported.

/** The step's framework entry points (R246: enumerated, since no import reaches them). */
const PRINT_ENTRY_POINTS = Object.freeze([
  'app/releve/print/page.tsx',
  'app/api/v1/export/pdf/route.ts',
]);

/** The package's test directories. Nothing in them makes a module shared. */
const TEST_ROOTS = Object.freeze(['tests', 'e2e']);

const isTestPath = (path) =>
  TEST_ROOTS.some((dir) => path.startsWith(`${dir}/`)) || /\.(test|spec)\.tsx?$/u.test(path);

const packagePath = (root, file) => relative(root, file).split('\\').join('/');

/**
 * The vitest files scripts/container-e2e.mjs runs, read from the harness.
 *
 * ONE READER (R206). The harness keeps them as single-quoted literals so this
 * pattern can read them; gate-selection.test.ts requires the PDF file among
 * them, so a harness this cannot read fails there by name rather than seeding
 * an empty closure.
 */
export function containerHarnessFiles(root) {
  const harness = join(root, 'scripts', 'container-e2e.mjs');

  if (!existsSync(harness)) return [];

  const listed = [...readFileSync(harness, 'utf8').matchAll(/'(tests\/db\/[\w.-]+\.test\.ts)'/gu)];

  return [...new Set(listed.map((match) => match[1]))];
}

const PRINT_CACHE = new Map();

/**
 * What the container PDF step renders and reads (R990), as package-relative
 * POSIX paths. Memoised per root, as databaseClosure is.
 */
export function containerPdfClosure(root) {
  const cached = PRINT_CACHE.get(root);

  if (cached !== undefined) return cached;

  // Every product code file, and the package files it imports.
  const edges = new Map();
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop();

    if (dir === undefined) continue;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // node_modules and every dot-directory (.next, .next-visual-*, a
      // session's evidence folder): none of them is product source.
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

      const full = join(dir, entry.name);
      const path = packagePath(root, full);

      if (entry.isDirectory()) {
        if (!TEST_ROOTS.includes(path)) stack.push(full);
        continue;
      }

      if (!/\.(ts|tsx|mts|mjs)$/u.test(entry.name) || isTestPath(path)) continue;

      edges.set(
        path,
        specifiersOf(readFileSync(full, 'utf8'))
          .map((specifier) => resolve(root, full, specifier))
          .filter((target) => target !== null)
          .map((target) => packagePath(root, target)),
      );
    }
  }

  const importers = new Map();

  for (const [from, targets] of edges) {
    for (const target of targets) {
      if (!importers.has(target)) importers.set(target, new Set());

      importers.get(target).add(from);
    }
  }

  // 1. The exclusive closure of the two entry points.
  const closure = new Set(PRINT_ENTRY_POINTS.filter((path) => existsSync(join(root, path))));

  for (let grew = true; grew; ) {
    grew = false;

    for (const member of [...closure]) {
      for (const target of edges.get(member) ?? []) {
        if (closure.has(target) || isTestPath(target)) continue;

        if ([...(importers.get(target) ?? [])].every((from) => closure.has(from))) {
          closure.add(target);
          grew = true;
        }
      }
    }
  }

  // 2. The harness's vitest files and every tests/ file they reach.
  const queue = containerHarnessFiles(root).map((path) => join(root, path));
  const seen = new Set();

  while (queue.length > 0) {
    const file = queue.pop();

    if (file === undefined || seen.has(file) || !existsSync(file)) continue;

    seen.add(file);
    closure.add(packagePath(root, file));

    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      const target = resolve(root, file, specifier);

      if (target !== null && packagePath(root, target).startsWith('tests/')) queue.push(target);
    }
  }

  PRINT_CACHE.set(root, closure);

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
 * Root code files that are a TOOL's entry point, not the framework's - each
 * mapped to THE SUITE IT CONFIGURES.
 *
 * ============================================================================
 * RULING R247: A CONFIG THAT DECIDES WHAT A SUITE DOES BELONGS TO THAT SUITE
 * ============================================================================
 *
 * FW28 shipped this as a bare LIST, classified but not asserted, on the
 * argument that most of them were covered anyway: vitest.config.ts configures
 * `test`, which is in BASE_SUITES and always runs; the two lint configs the
 * same; prisma.config.ts and vitest.db.config.ts are already named by the
 * database rule. That left the two Playwright configs, which the report raised
 * as a question rather than closing.
 *
 * THE ASYMMETRY WAS THE TELL. vitest.config.ts is covered BY ACCIDENT OF
 * WHERE ITS SUITE SITS - it configures a suite that happens to be in the base
 * chain - while playwright.config.ts configures one that is selected, and so
 * was covered by nothing. Two configs of identical kind, opposite outcomes,
 * and the difference had nothing to do with either file. That is a policy
 * nobody chose.
 *
 * SO THE MAP REPLACES THE LIST, and the value is the obligation: a test
 * asserts that changing each of these SELECTS the suite it names. For
 * `lint` and `test` that is satisfied by BASE_SUITES and the assertion is
 * trivially true, which is the point - the same rule covers both cases and
 * the coverage stops depending on which side of the base chain a suite
 * landed on.
 *
 * `null` is for a file that configures no suite, and it is a claim that has
 * to survive being read: next-env.d.ts is GENERATED by Next, is in the
 * repository only because tsconfig references it, and nothing reads it to
 * decide what any suite does.
 *
 * THE VALUE IS AN OBLIGATION, NOT AN INVENTORY. It names the suites that MUST
 * run when this file changes, which is a smaller and checkable claim than
 * "everything this file touches". vitest.config.ts also configures test:a11y
 * and test:late; naming `test` is what the rule needs and what it can prove.
 *
 * playwright.config.ts IS PLURAL, and finding that out is why the values are
 * arrays. It defines BOTH projects - `chromium`, which is test:e2e, and
 * `visual`, which scripts/visual.mjs runs in its container - and it holds
 * snapshotPathTemplate, which decides where the baselines live. Mapping it to
 * test:e2e alone would have been the same under-statement this ruling exists
 * to remove, one file over.
 */
/**
 * Every suite this selector can emit. FW-SELECTOR-PACKAGE, R414.
 *
 * FOR THE FILES THAT DECIDE WHETHER ANYTHING RUNS AT ALL. package.json
 * defines what every suite IS - the command `pnpm <suite>` resolves to -
 * and pnpm-lock.yaml decides what each one runs AGAINST. Neither names a
 * suite it belongs to, because they belong to all of them.
 *
 * THE OPERATOR RULED THIS RATHER THAN LEAVING IT TO JUDGEMENT, and the
 * reasoning is worth keeping where the list is:
 *
 *   A dependency bump can break anything, and NOTHING IN THE DIFF TELLS
 *   YOU WHAT. A selector that tried to be clever here - full run for a
 *   scripts change, something narrower for dependencies - is exactly how
 *   the next uncovered file gets through.
 *
 *   They are RARE. Dependencies are not bumped daily, so the full matrix
 *   on each one costs little in total.
 *
 *   The other side is NOT KNOWING, which is the outcome every gate in
 *   this repository exists to prevent.
 *
 * IF BUMPS EVER BECOME FREQUENT ENOUGH TO HURT, revisit it WITH
 * MEASUREMENTS rather than with an intuition about cost. That condition is
 * part of the ruling, not a softening of it.
 *
 * WRITTEN OUT RATHER THAN DERIVED, because the constants it would derive
 * from are declared below this point and a const cannot be read before it
 * is initialised. The list is therefore ASSERTED complete against those
 * constants and against every selector pattern, so a suite added anywhere
 * and not added here fails rather than being quietly left out (R154).
 */
export const EVERY_SUITE = Object.freeze([
  'typecheck',
  'lint',
  'test',
  'build',
  'test:e2e',
  'test:visual',
  'test:runtime',
  'test:db',
  'test:late',
  'test:container',
  'test:container:e2e',
  'test:container:scheduler',
  'test:container:restore',
  'test:container:write',
  // Made selectable by this task: tsconfig.parity.json configures it, and a
  // config whose suite cannot be selected is the hole R247 is about. It runs
  // in `pnpm gate` and in gate:clone already; it simply could not be CHOSEN.
  'parity:check',
]);

export const ROOT_TOOL_CONFIGS = Object.freeze({
  // FOUND BY THE CHECK, NOT BY THE AUTHOR. `.stylelintrc.mjs` is a dotfile,
  // so the hand survey of the root that produced this list - an `ls` - did
  // not list it, and the closed-world assertion failed on its first run
  // naming a file its own author had missed. R178's point arriving inside the
  // mechanism written to make it: a list is wrong the day it is written.
  Dockerfile: ['test:container'],
  '.dockerignore': ['test:container'],
  '.stylelintrc.mjs': ['lint'],
  'eslint.config.mjs': ['lint'],
  'next-env.d.ts': null,
  'playwright.config.ts': ['test:e2e', 'test:visual'],
  'playwright.runtime.config.ts': ['test:runtime'],
  'prisma.config.ts': ['test:db'],
  'vitest.config.ts': ['test'],
  'vitest.db.config.ts': ['test:db'],

  // THE TWO THAT DECIDE WHETHER ANYTHING RUNS AT ALL (R414). Every entry
  // above names the one suite it configures; these name all of them,
  // because that is what they decide. See EVERY_SUITE for the ruling.
  //
  // THIS COMMIT IS THE INSTANCE THAT FOUND IT (R178): a change to
  // package.json's `test:db` script - what that suite RUNS - selected
  // typecheck, lint, test and build, and matched no rule at all.
  // vitest.db.config.ts, which merely CONFIGURES test:db, was mapped.
  // The file that configures a suite was covered; the file that decides
  // what the suite IS was not.
  'package.json': EVERY_SUITE,
  'pnpm-lock.yaml': EVERY_SUITE,

  // ==========================================================================
  // FOUND BY THE WIDENED CENSUS, NOT BY THE AUTHOR (R178, R416)
  // ==========================================================================
  //
  // The ruling named package.json and pnpm-lock.yaml. Teaching the census to
  // see data files surfaced SIX MORE at this root, every one of them
  // previously selecting nothing beyond the base chain. That is the class
  // R416 asks to close rather than the instance, and these are the evidence
  // that the class was real.

  // THE SAME CLASS AS THE TWO ABOVE, and FW14 measured it. Its own header
  // records that an unanswered dependency build script made "every `pnpm
  // run` and every `pnpm exec`" die inside pnpm's dependency-status check:
  // `pnpm typecheck` stopped working and the message was about build
  // scripts. A file that can stop every suite from starting belongs to all
  // of them. Leaving it out because the ruling did not name it is the
  // half-applied finding R267 forbids.
  'pnpm-workspace.yaml': EVERY_SUITE,

  // EVERY TYPESCRIPT TOOL RESOLVES THROUGH IT, which is wider than it looks:
  // not only typecheck and build, but vitest, and the e2e specs too -
  // e2e/application.spec.ts and e2e/guides.spec.ts import through the `@/`
  // alias this file defines. Break the alias and nothing compiles anywhere,
  // including the image.
  'tsconfig.json': EVERY_SUITE,

  // `typecheck` is literally `tsc --noEmit && tsc -p tsconfig.scripts.json`.
  // A narrow, provable obligation - which is the shape the doc above asks
  // for: the suites that MUST run, not everything the file touches.
  'tsconfig.scripts.json': ['typecheck'],

  // IT CONFIGURES A CHECK THAT RUNS AND COULD NOT BE CHOSEN. parity:check
  // is in `pnpm gate` and in gate:clone's step list, so it is not unused -
  // but gate:changed had no way to select it, so editing this file ran the
  // base chain and the parity check went unrun until push. `null` would
  // have been the easy answer and a false one: null means the file
  // configures nothing that is run. The answer is a suite (R251).
  'tsconfig.parity.json': ['parity:check'],

  // READ BY tests/unit/content/identity.test.ts, which is in `test`. Also by
  // scripts/lighthouse.mjs, which no gate runs - so `test` is the whole
  // obligation rather than a partial one.
  'identity.json': ['test'],

  // NULL, AND THE CLAIM IS CHECKED RATHER THAN ASSUMED. It configures
  // `pnpm lighthouse`, and lighthouse appears in no gate, no gate:clone step
  // and no CI workflow - it is run by a person, deliberately (R174 runs it
  // three times and asserts a median, which is not a thing a gate does).
  // So it configures no suite that is RUN, which is exactly what null means
  // here. If lighthouse ever joins a gate, this entry is where that shows.
  'lighthouserc.json': null,
});

/** Extensions Next will route to. */
const ENTRY_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Root files with no extension that still determine what runs (R251).
 *
 * THE EXTENSION SCAN CANNOT SEE THESE, and that is the point. `Dockerfile`
 * decides what exists to run at all, and it matched nothing - neither a
 * selector rule nor the closed-world census, because the census was looking
 * for code and a Dockerfile is not code. R251's general form is what
 * corrects it: source, config, schema, CONTAINER.
 */
const ROOT_EXTENSIONLESS = ['Dockerfile', '.dockerignore'];

/**
 * Root files that are DATA rather than code and still decide what runs.
 * FW-SELECTOR-PACKAGE, R416.
 *
 * SEPARATE FROM ENTRY_EXTENSIONS ON PURPOSE. That list is also what the
 * import-graph walk follows, and a walk that started following .json
 * would be a different and much larger change than widening a census of
 * one directory.
 *
 * WHY THIS SET. R251 widened the census for `Dockerfile` because "the
 * closed-world root census could not see a Dockerfile - it scanned for
 * code extensions and a Dockerfile is not code". That closed the INSTANCE
 * and left the CLASS open: package.json is .json, which is not code
 * either, and it decides what every suite is. The class is "a root file
 * that decides what runs and is not code", and at this root that is
 * configuration and lockfiles - .json, .yaml, .yml, .toml.
 *
 * WHAT IT STILL DOES NOT SEE, and why that is not an omission: the root
 * also holds `.env`, `.env.example`, `.gitignore` and two `.tsbuildinfo`
 * files. None matches these extensions. The first two are secrets and a
 * sample of them, which decide nothing about which suite runs; the last
 * two are generated output. If a future root file is none of those and
 * still decides something, it arrives as a new extension and this list is
 * where it goes - which is the same argument R246 made for its own
 * convention list, against the person writing it.
 */
const ROOT_CONFIG_EXTENSIONS = ['.json', '.yaml', '.yml', '.toml'];

/**
 * Every root file that can determine what runs, for the closed-world check.
 *
 * Named `rootCodeFiles` when it only looked at extensions; it now answers the
 * broader question R251 asks, and the name follows the question rather than
 * the implementation.
 */
export function rootCodeFiles(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (ENTRY_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ||
          ROOT_CONFIG_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ||
          ROOT_EXTENSIONLESS.includes(entry.name)),
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
 * RULING R251: A FILE THAT DETERMINES WHAT RUNS, OR WHETHER IT RUNS, BELONGS
 * TO A SUITE.
 *
 * The general form of R247, stated once so the next category does not need a
 * ruling of its own. Source, config, schema, container - if no suite covers
 * it, THAT IS THE FINDING, and the answer is a suite rather than an
 * exemption.
 *
 * WHAT IT COVERS HERE. scripts/entrypoint.mjs decides whether the container
 * serves AT ALL (R250), which makes it a runtime component by any reading;
 * the Dockerfile and .dockerignore decide what exists to run. None of the
 * three matched any pattern, so a commit touching only the file that can
 * refuse every deploy would have run the base chain.
 *
 * DELIBERATELY NARROW, because a slow suite is a suite people route around.
 * Four container runs and one probe: the refusal matrix and the image's
 * structural facts. Anything needing a database, a browser or a rendered
 * page belongs to test:db or test:e2e, which already own those claims.
 */
export const CONTAINER_SUITES = Object.freeze(['test:container']);

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
    // R247. It defines BOTH Playwright projects - `chromium` for test:e2e and
    // `visual` for the container run - and snapshotPathTemplate, which decides
    // where every baseline is written and read. A change here can alter what
    // either suite asserts without touching a single spec, which is R144's
    // reason for selecting a suite from its own files, one level up: a config
    // is to its suite what a baseline is to the test that compares against it.
    label: 'playwright.config.ts, which defines both browser projects (R247)',
    suites: BROWSER_SUITES,
    matches: (path) => path === 'playwright.config.ts',
  },
  {
    // The runtime guard is its own project and its own config (R144's third
    // case), so its config selects that suite and only that suite.
    label: 'playwright.runtime.config.ts, which is the runtime project (R247)',
    suites: RUNTIME_SUITES,
    matches: (path) => path === 'playwright.runtime.config.ts',
  },
  {
    // ========================================================================
    // THE TWO FILES THAT DECIDE WHETHER ANY SUITE RUNS AT ALL (R414)
    // ========================================================================
    //
    // Every other root config above names the one suite it configures.
    // These name all of them: package.json DEFINES what each suite is - the
    // command `pnpm <suite>` resolves to - and pnpm-lock.yaml decides what
    // every one of them runs against.
    //
    // FOUND BY A COMMIT THAT CHANGED `test:db` AND DID NOT RUN IT (R178).
    // FW-PRISMA-GENERATE edited the test:db script so it regenerates the
    // Prisma client first - a change to what that suite RUNS - and the
    // selector answered with the base chain and `matched: []`. Meanwhile
    // vitest.db.config.ts, which merely CONFIGURES test:db, was mapped.
    // The file that configures a suite was covered; the file that decides
    // what the suite IS was not.
    //
    // EVERY SUITE, AND NOT A CLEVERER RULE. The tempting version reads which
    // keys moved - scripts["test:db"] selects test:db, dependencies selects
    // everything - and it is the version that fails: a script can change what
    // a DIFFERENT suite does (db:generate is chained into test:db; gate:changed
    // is itself a script), so key-to-suite is not a function. A dependency
    // bump can break anything and nothing in the diff says what. These files
    // change rarely, so the full matrix costs little in total - and the other
    // side is not knowing, which is what every gate here exists to prevent.
    label: 'package.json and the lockfile, which decide what every suite is (R414)',
    suites: EVERY_SUITE,
    matches: (path) => path === 'package.json' || path === 'pnpm-lock.yaml',
  },
  {
    // R416. pnpm-workspace.yaml can stop every `pnpm run` from starting
    // (FW14), and tsconfig.json defines the alias every tool resolves
    // through - including the e2e specs. Same obligation as the two above,
    // reached by the same argument.
    label: 'pnpm-workspace.yaml and tsconfig.json, which decide whether anything compiles (R416)',
    suites: EVERY_SUITE,
    matches: (path) => path === 'pnpm-workspace.yaml' || path === 'tsconfig.json',
  },
  {
    // R416. The narrow, provable obligations: one config, one suite.
    label: 'tsconfig.scripts.json, which typecheck compiles against (R416)',
    suites: ['typecheck'],
    matches: (path) => path === 'tsconfig.scripts.json',
  },
  {
    // R416. parity:check runs in `pnpm gate` and gate:clone but could not be
    // SELECTED by gate:changed, so a change to its config went unchecked
    // until push. A suite rather than an exemption (R251).
    label: 'tsconfig.parity.json, which the format-parity build compiles against (R416)',
    suites: ['parity:check'],
    matches: (path) => path === 'tsconfig.parity.json',
  },
  {
    // R416. The service identity, asserted by a unit test.
    label: 'identity.json, which a unit test asserts (R416)',
    suites: ['test'],
    matches: (path) => path === 'identity.json',
  },
  {
    // R251. The image and the thing that decides whether it serves.
    //
    // lib/deploy/placeholders.mjs is here AND in the database closure, which
    // is only expressible because R234 takes every pattern a path matches
    // rather than the first: it is the entrypoint's contract and it is
    // imported by print-token.ts. One file, two orthogonal categories.
    // THE IMAGE ITSELF, and what decides whether it serves at all. These
    // select the FAST container suite - structural facts and the refusal
    // matrix - because they are touched often and a fifteen-minute gate is a
    // gate people route around. CI runs all three container suites on every
    // push, which is where the heavier claims are answered.
    label: 'the container, and what decides whether it serves (R251)',
    suites: CONTAINER_SUITES,
    matches: (path) =>
      path === 'Dockerfile' ||
      path === '.dockerignore' ||
      path === 'scripts/entrypoint.mjs' ||
      path === 'scripts/container-check.mjs' ||
      path === 'lib/deploy/placeholders.mjs',
  },
  {
    // R247 EXACTLY: a harness selects the suite it DEFINES, not a neighbour's.
    // container-scheduler.mjs used to select test:container, which meant the
    // file that decides what the scheduler probe does could change without
    // the scheduler probe running - the defect R247 was written for, inside
    // the rule that implements it.
    label: 'the container e2e harness, which defines that suite (R247)',
    suites: Object.freeze(['test:container:e2e']),
    matches: (path) => path === 'scripts/container-e2e.mjs',
  },
  {
    // FW-PDF-A4 (R936). test:container:e2e is the ONLY suite any gate runs in
    // which a PDF is rendered: its vitest step sets CONTAINER_BASE_URL, and
    // test:db's render tests skip without a live server, which neither
    // gate:changed, gate:clone nor CI starts. Before this rule the renderer
    // and the container PDF test selected test:db alone, so `format:
    // 'Letter'` passed every gate with the A4 assertion never executed.
    //
    // R144's shape for the harness's own vitest files (a test file selects
    // the suite it belongs to), and R256's for the renderer and the reader
    // the A4 verdict goes through (the file whose defect a suite catches
    // selects that suite). tests/unit/meta/gate-selection.test.ts reads the
    // harness's file list from the harness, so a third file is caught there.
    //
    // FW-PDF-RENDER-GATE (R981, R982) added four:
    // - export-pdf.test.ts and verification-qr.test.ts, whose 17 render tests
    //   ran only by hand until the harness ran them against the image;
    // - the verdict module the harness reads those runs with;
    // - print.module.scss, for its `@page` rule. MEASURED, it is not inert
    //   while lib/export/pdf.ts sets no preferCSSPageSize: `size: a4
    //   landscape` turned every page's MediaBox landscape (the A4 assertion
    //   refuses it), and `size: letter` kept A4 paper but paginated 9 pages
    //   as 10. It decides the CSS page the renderer lays the document on.
    //
    // FW-PRINT-PAGE-PIN (R990), R267's second site: the print page, the export
    // route, what those two alone render through, and every tests/ file the
    // harness's vitest files read - derived by containerPdfClosure above. The
    // named paths stay as the FLOOR (R218's shape): the verdict module is
    // reachable through no import, and the rest are what W2 and W3b proved by
    // name.
    label:
      'the container PDF step: its vitest files and what they read, the print page, the export route and what those alone render through (R936, R982, R990)',
    suites: Object.freeze(['test:container:e2e']),
    matches: (path) =>
      path === 'tests/db/container-auth.test.ts' ||
      path === 'tests/db/container-pdf.test.ts' ||
      path === 'tests/db/export-pdf.test.ts' ||
      path === 'tests/db/verification-qr.test.ts' ||
      path === 'scripts/container-render-verdict.mjs' ||
      path === 'lib/export/pdf.ts' ||
      path === 'tests/support/pdf-pages.ts' ||
      path === 'app/releve/print/print.module.scss' ||
      containerPdfClosure(PACKAGE_ROOT).has(path),
  },
  {
    label: 'the scheduler probe, which defines that suite (R247)',
    suites: Object.freeze(['test:container:scheduler']),
    matches: (path) => path === 'scripts/container-scheduler.mjs',
  },
  {
    // The restore probe. A backup nobody has restored is a hope, and this is
    // the one file whose change could make that proof stop proving anything.
    label: 'the restore probe, which defines that suite (R247)',
    suites: Object.freeze(['test:container:restore']),
    matches: (path) => path === 'scripts/backup-restore.mjs',
  },
  {
    // FW31/R256. The production-write probe, and THE ONE FILE WHOSE DEFECT IT
    // EXISTS TO CATCH.
    //
    // lib/db/client.ts already selects test:db through R218's import closure,
    // and test:db runs with NODE_ENV=test - the environment in which the
    // Prisma client memoises and the defect does not exist. So the suite that
    // covered this file was structurally incapable of seeing what went wrong
    // in it. That is R175's shape: two checks bounding a property and an
    // unexamined space between them, and the space was the product's main use
    // case for three weeks.
    //
    // The harness selects the suite it DEFINES (R247); the client selects the
    // suite that would have CAUGHT it.
    label: 'the production write, and the client whose defect it catches (R256)',
    suites: Object.freeze(['test:container:write']),
    matches: (path) => path === 'scripts/container-write.mjs' || path === 'lib/db/client.ts',
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
