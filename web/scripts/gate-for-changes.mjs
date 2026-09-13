// web/scripts/gate-for-changes.mjs
//
// RULING R132's other half: read the diff, print the selection, run it.
// gate-selection.mjs decides WHICH suites; this one talks to git and to the
// suites themselves, which is why the deciding is not in here - a pure
// function can be asserted in a unit test, and a script that spawns pnpm
// cannot.
//
//   node scripts/gate-for-changes.mjs           select and RUN
//   node scripts/gate-for-changes.mjs --print   select and print only
//
// --print exists for the commit body. R132 requires the selection to be
// recorded, not just displayed, and the failure it guards against was
// invisible precisely because nothing on record said which suites had not
// run.
//
// WHAT COUNTS AS CHANGED. Everything not yet in HEAD: staged, unstaged, and
// UNTRACKED. The untracked half matters more than it looks - a brand-new
// component is untracked until the moment it is added, and `git diff` alone
// would report a diff that does not contain the one file the increment is
// about.
//
// R133 IS APPLIED TO THIS FILE FROM ITS FIRST LINE, because this is the
// script most exposed to the failure that ruling is about. FW13's mutation
// harness passed --reporter=basic to a Vitest 5 that had removed it; every
// probe died at startup having run ZERO tests, and the check - "does the
// output say failed?" - read that silence as GREEN. So a suite that reports
// a count must produce one here, and an absent count is a failure rather
// than a pass. Exit codes are trusted only where there is no count to have:
// tsc, eslint and next build report success by saying nothing, and the
// printed summary says which of the two each suite got.

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeSelection, readCount, selectSuites } from './gate-selection.mjs';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * R133's second half: N >= expected, not merely N > 0.
 *
 * The floors live in scripts/suite-floor.json, which already held vitest's
 * and now holds the other two. Until this sweep the visual and end-to-end
 * suites had no floor at all: a spec file that stopped being collected
 * would exit 0 and print a smaller number, and nothing compared that number
 * to anything.
 */
const floors = JSON.parse(
  readFileSync(join(web, 'scripts', 'suite-floor.json'), 'utf8'),
);

const FLOOR_FOR = {
  test: floors.tests,
  'test:e2e': floors.e2e,
  'test:visual': floors.visual,
  'test:db': floors.db,
};


function changedPaths() {
  const git = (args) =>
    execFileSync('git', args, { cwd: web, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

  // Tracked changes against HEAD, plus files git has never seen.
  return [
    ...git(['diff', '--name-only', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
}

/** Run one command, streaming its output and keeping a copy to measure. */
function run(command) {
  return new Promise((done) => {
    const child = spawn(command, { cwd: web, shell: true });
    let output = '';

    const take = (chunk) => {
      const text = String(chunk);

      output += text;
      process.stdout.write(text);
    };

    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => done({ code: code ?? 1, output }));
  });
}

const printOnly = process.argv.includes('--print');
const paths = changedPaths();
const selection = selectSuites(paths);

console.log(describeSelection(selection));

if (printOnly) process.exit(0);

console.log('');

const measured = [];

for (const suite of selection.suites) {
  console.log(`--- pnpm ${suite} ------------------------------------------`);

  const { code, output } = await run(`pnpm ${suite}`);

  if (code !== 0) {
    console.error('');
    console.error(`GATE FAILED at pnpm ${suite} (exit ${code}).`);
    console.error(describeSelection(selection));
    process.exit(1);
  }

  const counted = readCount(suite, output, FLOOR_FOR[suite]);

  if (counted.failure !== undefined) {
    // R133. The FW13 shape exactly: the tool changed, printed nothing this
    // script recognised, and exited in a way that could be read as success.
    console.error('');
    console.error(`GATE FAILED: ${counted.failure}`);
    process.exit(1);
  }

  measured.push(
    counted.counted ? `${suite}: ${counted.ran} passed` : `${suite}: exit 0 (no count to check)`,
  );
}

console.log('');
console.log('GATE PASSED for the paths changed.');
console.log(describeSelection(selection));
console.log('  measured:');
for (const line of measured) console.log(`    ${line}`);
