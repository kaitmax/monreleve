// web/scripts/require-clean-worktree.mjs
//
// R393: A GATE REFUSES TO START WHEN THE TREE IT WOULD TEST IS NOT THE TREE
// THAT WILL BE COMMITTED.
//
// ============================================================================
// THE DEFECT THIS EXISTS FOR, WHICH SHIPPED WITH EVERY CHECK GREEN
// ============================================================================
//
// KMP-0 commits d808d05 and dfffee9 committed `java.time` imports into
// commonMain - the one thing the platform-free fence (R369) exists to forbid -
// and every check passed while they did it.
//
// Nothing was wrong with the fence. The sequence was:
//
//     git mv <file> shared/...        the file moves, STAGED
//     <edit the file to use kotlinx-datetime>    the edit is UNSTAGED
//     ./gradlew :app:gate             compiles the WORKING TREE: green
//     git commit                      commits the STAGED version: the edit
//                                     is not in it
//
// Gradle compiled what was on disk. Git committed what was in the index. They
// were different, and no single tool was in a position to notice, because
// each was correct about its own input.
//
// ============================================================================
// WHY THE CHECK IS `git diff --quiet` AND NOTHING CLEVERER
// ============================================================================
//
// `git diff` with no arguments is exactly "tracked files whose working-tree
// content differs from the index" - the gap between what a build reads and
// what a commit writes. `--quiet` makes it an exit code: 0 when they agree.
//
// UNTRACKED FILES ARE NOT A FAILURE, deliberately. `.env`, `android/.kotlin/`,
// a scratch note and a session lock are all untracked, all normal, and none of
// them can end up in a commit by accident. Including them would make this
// guard fire constantly and be disabled within a week.
//
// STAGED CHANGES ARE NOT A FAILURE EITHER, and that is the point rather than a
// concession: once a change is staged, the working tree and the index agree,
// so the build reads what the commit will write. `pnpm gate:changed` derives
// its suite selection from `git diff --name-only HEAD`, which sees staged
// changes too, so nothing about the selector changes.
//
// ============================================================================
// IT NAMES THE FILES
// ============================================================================
//
// A refusal that says "the tree is dirty" sends somebody to `git status`,
// which lists untracked files too and buries the one line that matters. This
// prints the paths the guard actually objected to, which is the list to stage.

import { execFileSync, spawnSync } from 'node:child_process';

/** Exit codes, named rather than typed twice. */
const OK = 0;
const REFUSED = 1;

/**
 * The paths whose working-tree content differs from the index.
 *
 * Empty when the tree is clean OR when this is not a git repository at all -
 * a source tarball or an unpacked artefact has no index to disagree with, and
 * refusing there would block a legitimate build for a reason the person
 * cannot act on.
 */
function unstagedPaths() {
  const probe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });

  if (probe.status !== 0) return [];

  return execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

const dirty = unstagedPaths();

if (dirty.length === 0) {
  console.log('[clean-worktree] OK: no unstaged changes to tracked files (R393)');
  process.exit(OK);
}

console.error(
  [
    '',
    'GATE REFUSED TO START (R393): unstaged changes to tracked files.',
    '',
    'This gate compiles and tests the WORKING TREE. A commit writes the',
    'INDEX. While these differ, "the gate passed" is a statement about code',
    'that is not the code being committed - which is how KMP-0 (d808d05,',
    'dfffee9) committed java.time into commonMain with every check green.',
    '',
    `${dirty.length} file(s) differ from the index:`,
    ...dirty.map((path) => `    ${path}`),
    '',
    'Stage them (git add) and run the gate again, or stash what you did not',
    'mean to keep. Untracked files are not the problem and are not listed.',
    '',
  ].join('\n'),
);

process.exit(REFUSED);
