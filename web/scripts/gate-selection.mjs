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

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** web/, derived from this file's own location rather than from process.cwd(). */
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
    label: 'a spec file, which selects the suite it belongs to (R144)',
    suites: ['test:e2e'],
    matches: (path) => path.startsWith('e2e/'),
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
    const hit = SELECTOR_PATTERNS.find((pattern) => pattern.matches(candidate));

    if (hit !== undefined) matched.push({ path, pattern: hit.label });
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
