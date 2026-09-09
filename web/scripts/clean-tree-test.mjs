// web/scripts/clean-tree-test.mjs
//
// RULING R94: "the local gate is the CI command. pnpm test:coverage on a tree
// where public/ has been moved aside, before any commit that touches a test's
// file access."
//
// WHY THIS SCRIPT EXISTS, and it is not hypothetical. FW10 shipped a test that
// walked app/, lib/ and public/. web/public is NOT tracked by git -
// scripts/copy-fonts.mjs creates it - so in a clean checkout readdirSync threw
// ENOENT while the module was still being evaluated. The file reported
// "0 test", the run exited 1, and CI was red for five consecutive commits
// while every local run passed, because a build had already made the directory
// on this machine.
//
// A test that reads the filesystem is a test with a hidden dependency on how
// the working tree got into its current state. This reproduces the one
// condition that differs between here and CI, which is the condition nothing
// else checks.
//
// IT RESTORES public/ WHATEVER HAPPENS. The directory holds generated font
// files - `pnpm fonts` rebuilds it - but losing it mid-run would break every
// subsequent build until someone worked out why, so the restore is in a
// finally and is verified before the exit code is propagated.

import { existsSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = dirname(dirname(fileURLToPath(import.meta.url)));
const live = join(web, 'public');
const stashed = join(web, 'public.clean-tree-stash');

if (existsSync(stashed)) {
  console.error(
    `${stashed} already exists - a previous run was interrupted. Rename it back to public/ before running this again.`,
  );
  process.exit(1);
}

const moved = existsSync(live);

if (moved) renameSync(live, stashed);
else console.log('public/ does not exist here, which is already the CI condition.');

let status = 1;

try {
  const run = spawnSync('pnpm', ['test:coverage'], {
    cwd: web,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  status = run.status ?? 1;
} finally {
  if (moved) {
    renameSync(stashed, live);

    if (!existsSync(live)) {
      console.error('FAILED TO RESTORE public/ - run `pnpm fonts` before anything else.');
      process.exit(1);
    }

    console.log('public/ restored.');
  }
}

if (status === 0) {
  console.log('\nclean-tree check passed: no test depends on a generated directory.');
} else {
  // SAYS WHAT HAPPENED, NOT WHAT CAUSED IT. The first version of this
  // asserted "a test read a path that does not exist" - which is R94's
  // reason for the check and the usual cause, but not something this script
  // can know. It cost real time once: a test that had merely grown slow
  // enough to hit vitest's 5 s timeout under the worker cap failed here, and
  // the message sent me hunting a filesystem dependency that was not there.
  // A check naming a cause it has not established misdirects whoever reads
  // it.
  console.error(
    [
      '',
      'clean-tree check FAILED: the suite passed normally and failed with the',
      'generated directories moved aside. The failure output above says which',
      'test and why - read it before assuming a cause.',
      '',
      'The usual cause is ruling R94: a test reading a path that exists in',
      'this checkout but not in a fresh one, which is what CI has. A timeout',
      'or a worker error is NOT that - it means the run differed in timing',
      'rather than in the tree.',
    ].join('\n'),
  );
}

process.exit(status);
