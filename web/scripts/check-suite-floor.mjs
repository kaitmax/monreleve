// web/scripts/check-suite-floor.mjs
//
// RULING R63. The include globs in vitest.config.ts have a failure mode that
// produces no symptom: a glob that stops matching removes its files from the
// run, every assertion they carried silently stops being checked, and
// `pnpm test` still exits 0. The summary line changes - and nothing in this
// repo compares that line against anything.
//
// This repo has already met the near miss. FW8's component tests are .test.tsx
// and the glob at the time ended in .test.ts, which matches neither of them.
// It was caught only because those tests were NEW and someone was waiting to
// see them run. The same break under an EXISTING suite has no such tell.
//
// The check has to come from outside the run, because the thing being
// detected is a file that did not run, and a file that did not run cannot
// fail. Two nets, in order of sharpness:
//
//   1  THE CANARIES. tests/ and lib/ each hold a __glob-canary.test.ts and a
//      __glob-canary.test.tsx whose only job is to be collected. This script
//      finds them on disk and requires vitest to have collected every one.
//      Naming the missing file turns a broken glob into a one-line diagnosis
//      rather than a hunt. tests/unit/meta/glob-canaries.test.ts holds the
//      other half: it reads the real config and requires a canary for every
//      (directory, extension) pair the globs claim, so ADDING a glob without
//      a canary fails too, and the scheme cannot quietly come to cover a
//      shrinking fraction of the config.
//
//   2  THE FLOOR. Counts recorded in suite-floor.json, which may only go UP.
//      This catches what the canaries cannot: a whole suite dropped for a
//      reason that is not about globs - an exclude that grew, a directory
//      renamed, a describe callback that returned early. A floor rather than
//      an equality so that ADDING tests never edits that file; a REDUCTION
//      has to be a deliberate edit carrying a reason, which is the point.
//
// TWO SOURCES, BECAUSE THEY SEE DIFFERENT THINGS.
//
// `vitest list` is a STATIC collector - measured, not assumed: it reports
// ZoneBadge.test.tsx's looped block as "... > status > renders the label",
// with the loop variable unresolved, and counts eleven call sites where
// twenty-one tests actually run. That makes it cheap enough to run before the
// suite, and exactly right for "did the glob match this FILE" - but its test
// count would not notice a parametrised block whose fixture array had been
// emptied, because the call site survives.
//
// So the file floor and the canaries come from `list`, and the TEST floor is
// read from the JSON report of a real run when one is passed with --report.
// CI produces that report as a second reporter on a run it was making anyway,
// so the strong number costs nothing there.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const CANARY = '__glob-canary.test.';
const ROOTS = ['tests', 'lib'];
const SKIP = new Set(['node_modules', '.next', 'baselines']);

/** Repo-relative with forward slashes, so Windows and Linux compare equal. */
const norm = (path) => relative(web, path).split(sep).join('/');

function canariesOnDisk() {
  const found = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (entry.name.startsWith(CANARY)) found.push(norm(full));
    }
  };

  for (const root of ROOTS) walk(join(web, root));

  return found.sort();
}

function collectedFiles() {
  // Spawned through process.execPath rather than `pnpm exec`: the pnpm shim
  // is a .cmd on Windows, which execFileSync cannot run without a shell.
  //
  // The bin is located through the package manifest rather than by naming
  // vitest/vitest.mjs directly - that subpath is not listed in the package's
  // exports and resolving it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
  const manifest = require.resolve('vitest/package.json');
  const { bin: bins } = require(manifest);
  const bin = join(dirname(manifest), typeof bins === 'string' ? bins : bins.vitest);

  const out = execFileSync(process.execPath, [bin, 'list', '--json'], {
    cwd: web,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  // vitest may print resolver noise before the payload.
  const start = out.indexOf('[');
  if (start === -1) throw new Error('vitest list produced no JSON');

  return new Set(JSON.parse(out.slice(start)).map((test) => norm(test.file)));
}

const flag = process.argv.indexOf('--report');
const reportPath = flag === -1 ? undefined : process.argv[flag + 1];

const floor = JSON.parse(readFileSync(join(web, 'scripts', 'suite-floor.json'), 'utf8'));
const canaries = canariesOnDisk();
const files = collectedFiles();
const failures = [];

// Without this the loop below would pass by having nothing to check - the
// exact shape of vacuous green this whole script exists to detect.
if (canaries.length === 0) {
  failures.push('no canary files on disk, so the collection check would pass vacuously');
}

for (const canary of canaries) {
  if (!files.has(canary)) {
    failures.push(`${canary} exists but vitest did not collect it - an include glob has stopped matching`);
  }
}

if (files.size < floor.files) {
  failures.push(`collected ${files.size} test files, floor is ${floor.files}`);
}

let ran;

if (reportPath === undefined) {
  console.log('no --report given: the runtime test floor is not checked in this run');
} else if (!existsSync(resolve(web, reportPath))) {
  failures.push(`--report ${reportPath} does not exist; a missing report must not read as a pass`);
} else {
  const report = JSON.parse(readFileSync(resolve(web, reportPath), 'utf8'));

  ran = report.numTotalTests;

  if (typeof ran !== 'number') {
    failures.push(`${reportPath} carries no numTotalTests`);
  } else if (ran < floor.tests) {
    failures.push(`ran ${ran} tests, floor is ${floor.tests}`);
  }
}

if (failures.length > 0) {
  console.error('SUITE FLOOR FAILED');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('');
  console.error(`floor: ${floor.files} files, ${floor.tests} tests (scripts/suite-floor.json)`);
  console.error(`run:   ${files.size} files, ${ran ?? 'not measured'} tests`);
  console.error('');
  console.error('A count that dropped ON PURPOSE is a deliberate edit to suite-floor.json');
  console.error('with the reason in the commit message. A count that dropped by accident is');
  console.error('what this check is for.');
  process.exit(1);
}

const tail = ran === undefined ? '' : `, ${ran} tests ran`;

console.log(`suite floor OK - ${files.size} files collected, ${canaries.length} canaries present${tail}`);
