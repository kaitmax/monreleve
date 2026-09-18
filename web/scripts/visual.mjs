// web/scripts/visual.mjs
//
// Screenshot baselines, generated and compared ONLY inside the Playwright
// Linux container. Ruling R37.
//
// WHY. Baselines made against one font stack and compared against another are
// a permanent source of false red, and Playwright's failure mode here is not
// a diff but a MISSING FILE: its default snapshot template carries the
// platform, so a baseline written on this workstation lands at
// rail-inline-compliant-chromium-win32.png and ubuntu CI looks for
// -chromium-linux.png, finds nothing, writes it, and fails. Run again with no
// change and it PASSES, because it now compares that file against itself.
// Measured, twice, before this script existed.
//
// Pinning the container removes the variable rather than tuning a tolerance.
// One baseline set, one font stack, one renderer - which is why
// playwright.config.ts can drop {platform} from the template.
//
//   node scripts/visual.mjs            compare against the committed baselines
//   node scripts/visual.mjs --update   regenerate them
//
// RULING R98: "a baseline is valid only from an isolated build: per-run
// distDir or copied tree; docker ps for orphans before any container run; the
// report states isolation per regeneration."
//
// WHAT PROMPTED IT, stated accurately because the first account was not. Two
// containers of this image ran at once - an orphan left behind when a shell
// was killed (killing a shell does not kill the container it started) and a
// regeneration begun eleven minutes later. The first explanation given was
// that they shared /repo/web/.next. THAT WAS WRONG: the anonymous volumes
// below already give each container its own .next and its own node_modules,
// which is why they are there.
//
// What they genuinely shared was the rest of the writable mount - the
// baselines one container was WRITING while the other READ them, plus
// test-results/ and playwright-report/. That is enough to make a comparison
// meaningless, and it is invisible in the output of either run.
//
// So this script now refuses to start while another container of this image
// is alive, and states its isolation on stdout so a report can quote it rather
// than assert it.
//
// The image tag is pinned to the installed Playwright version: a container
// whose browser differs from the one the tests were written against would
// reintroduce exactly the drift this exists to remove.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCount } from './gate-selection.mjs';

const require = createRequire(import.meta.url);

const { version } = require('@playwright/test/package.json');

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..');

/** R133 floors, shared with pnpm gate:changed. */
const floors = JSON.parse(readFileSync(resolve(WEB, 'scripts', 'suite-floor.json'), 'utf8'));
const IMAGE = `mcr.microsoft.com/playwright:v${version}-noble`;

/** U+000A, named because two escapes in this file collapsed on the way in. */
const NEWLINE = String.fromCharCode(10);

const update = process.argv.includes('--update');

/**
 * R98: refuse to start while another container of this image is alive.
 *
 * Not a warning. A second container is exactly the condition that produces a
 * result nobody can trust and nothing else reports, so the only safe answer is
 * to stop and name the ids.
 */
function refuseIfOrphans() {
  let running = '';

  try {
    running = execFileSync('docker', ['ps', '--quiet', '--filter', `ancestor=${IMAGE}`], {
      encoding: 'utf8',
    }).trim();
  } catch {
    // Docker not answering is the run's problem a moment from now; let the
    // real invocation produce the real error rather than guessing here.
    return;
  }

  if (running === '') return;

  const ids = running.split(NEWLINE).filter(Boolean);

  process.stderr.write(
    [
      '',
      `REFUSING TO RUN: ${ids.length} container(s) of ${IMAGE} are already alive.`,
      `  ${ids.join('  ')}`,
      '',
      'Two containers share this repository mount. One writes baselines while the',
      'other reads them, and neither run says so - the result looks normal and',
      'means nothing (ruling R98).',
      '',
      'Most likely an orphan: killing a shell does not kill the container it',
      'started. Inspect and remove:',
      `  docker ps --filter ancestor=${IMAGE}`,
      `  docker kill ${ids.join(' ')}`,
      '',
    ].join(NEWLINE),
  );

  process.exit(1);
}

refuseIfOrphans();

/**
 * R98's per-run build directory.
 *
 * UNIQUE PER RUN, and mounted as its own anonymous volume below - both halves
 * are required and the first version had only the first. A unique name inside
 * the shared mount is not isolation, it is a differently-named collision: the
 * container wrote its whole build into the repository, which is the opposite
 * of what this constant is for.
 *
 * With the volume, the name buys what R98 asks for: two runs can never agree
 * on a path even by accident, and neither can reach the other's build or the
 * host's.
 */
const DIST_DIR = `.next-visual-${process.pid}-${Date.now().toString(36)}`;

// node_modules is NOT mounted: it holds Windows-native binaries here and
// Linux ones in the container, so the container installs its own. That is the
// slow part and it is not avoidable - sharing them is what would break.
/**
 * Where the container leaves a copy of what Playwright printed.
 *
 * R133: A HARNESS ASSERTS A POSITIVE SIGNAL, NEVER INFERS FROM ABSENCE.
 * This script judged the run by whether execFileSync threw - an exit code
 * and nothing else - which cannot tell 69 baselines passing from 49 passing
 * because twenty stopped being collected. Playwright refuses a run that
 * matches no tests at all, so the empty case was covered; the SHRUNK case
 * was not, and that is the one that arrives quietly.
 *
 * tee rather than capturing on the host, because stdio is 'inherit' and
 * that is worth keeping: a two-minute container run with no output until
 * the end is a run people stop trusting. set -o pipefail keeps the exit
 * code Playwright's rather than tee's.
 *
 * test-results/ is git-ignored and inside the bind mount, so the file
 * written in the container is readable here and committed nowhere.
 */
const RUN_LOG = 'test-results/visual-run.txt';

const inContainer = [
  'set -o pipefail',
  'corepack enable',
  'cd /repo/web',
  'pnpm install --frozen-lockfile',
  'mkdir -p test-results',
  // tee to /tmp and copy back AFTERWARDS, which the first version did not do.
  // Playwright cleans its outputDir - test-results/ - when it starts, so a
  // tee opened there before the run writes into a deleted inode and the host
  // finds nothing. The check then fired on a run that had plainly printed
  // "69 passed". It failed CLOSED, which is the right direction, but it was
  // still wrong.
  //
  // Semicolons rather than && for the tail: the copy has to happen whether
  // the suite passed or failed, and exit $code puts Playwright's status back
  // where the && chain expects it.
  `pnpm exec playwright test --project=visual${update ? ' --update-snapshots' : ''} 2>&1 | tee /tmp/visual-run.txt; code=$?; mkdir -p test-results; cp /tmp/visual-run.txt ${RUN_LOG}; exit $code`,
].join(' && ');

/**
 * RULING R184: A REGENERATION PRINTS WHAT IT PHOTOGRAPHED, not only what it
 * produced.
 *
 * "Which baselines changed" is a claim about OUTPUT. "What was photographed"
 * is a claim about INPUT, and they are not the same claim.
 *
 * PARK-15 EXISTS BECAUSE ONLY THE SECOND WOULD HAVE CAUGHT IT. FW20b
 * regenerated the baselines while the next increment was already editing the
 * working tree: /application had been moved to live, the shell CTA had not
 * yet been taught to ask whether the application exists, and the container
 * built THAT. Sixty-nine images were rewritten to show a header rendering
 * "Suivre mes jours" - the exact defect the next increment removed.
 *
 * R135's three requirements all held and none of them saw it: the list was
 * accurate, the reason was true of the sentence that changed, and the image
 * that was cropped and read was /sources, which was correct. CONFIRMING ONE
 * IMAGE DOES NOT CONFIRM A RUN. The assumption R135 does not state is that
 * the tree being photographed is the tree you mean to photograph.
 *
 * DIRTY IS NOT AN ERROR HERE, and the script does not refuse it. Every
 * increment in this repository runs on a dirty tree by construction - the
 * question is whether it CHANGED DURING the run, not whether it differs from
 * HEAD. What this buys is a line a report can quote, so the baselines and the
 * commit can be shown to be the same tree instead of assumed to be.
 */
function photographed() {
  const git = (args) => {
    try {
      return execFileSync('git', args, { cwd: WEB, encoding: 'utf8' }).trim();
    } catch {
      // A repository this script can run outside of is not a reason to fail
      // the run; it is a reason to say so.
      return '';
    }
  };

  const commit = git(['rev-parse', '--short', 'HEAD']) || 'unknown';
  const dirty = git(['status', '--porcelain'])
    .split(NEWLINE)
    .map((line) => line.trim())
    .filter((line) => line !== '').length;

  return dirty === 0
    ? `photographed: ${commit}, clean tree`
    : `photographed: ${commit} plus ${dirty} uncommitted path(s) - the baselines below are of THAT tree, not of ${commit}`;
}

process.stdout.write(
  [
    `visual baselines in ${IMAGE}${update ? ' (regenerating)' : ''}`,
    // R98 requires the report to state the isolation per regeneration. Printing
    // it means the report can QUOTE this line instead of asserting something
    // about a run nobody can inspect afterwards.
    `isolation: sole container of ${IMAGE} (checked); distDir ${DIST_DIR}; node_modules and .next on anonymous volumes`,
    // R184, and it is the INPUT half of the same idea.
    photographed(),
    '',
  ].join(NEWLINE),
);

/**
 * THE FILES NEXT OWNS, AS THEY STAND BEFORE THE CONTAINER TOUCHES THEM.
 *
 * R98's per-run distDir has a side effect the ruling did not anticipate. On
 * every build Next rewrites the two typescript files it considers its own to
 * point at that directory, because they sit on the bind mount and Next treats
 * keeping them current as a courtesy. The distDir is deleted when the run
 * ends; the edits are not.
 *
 * THE TWO FAIL DIFFERENTLY, and the second is much worse:
 *
 *   tsconfig.json   APPENDS a glob to `include`. Eight had accumulated by
 *                   FW11, each pointing at nothing. Dead globs are harmless
 *                   in themselves; the cost was a list that could only grow,
 *                   in a file that goes into every commit, and a `git status`
 *                   never clean after a visual run - the noise that hides a
 *                   real change.
 *
 *   next-env.d.ts   REPLACES the reference to ./.next/types/routes.d.ts. Not
 *                   an addition - the live path is GONE, so the generated
 *                   route types resolve to a directory that no longer exists.
 *
 * AND `tsc --noEmit` EXITS 0 EITHER WAY, measured with the dead reference
 * actually committed. A missing /// <reference path> target is not an error,
 * so the whole gate stayed green. This restore is the only thing standing
 * between a visual run and a repository that has quietly stopped
 * typechecking its own route types.
 *
 * ONLY tsconfig.json WAS COVERED AT FIRST, and next-env.d.ts was committed
 * with a dead reference one commit later. A guard written for one instance
 * of a class catches one instance of a class - hence a list rather than a
 * constant. The other half is tests/unit/meta/distdir-leaks.test.ts, which
 * is what would SEE this break: a crash between snapshot and restore, or a
 * future Next that writes to a third file, leaves no other symptom.
 */
const OWNED_BY_NEXT = ['tsconfig.json', 'next-env.d.ts'];
const snapshots = OWNED_BY_NEXT.map((file) => {
  const path = resolve(WEB, file);

  return { file, path, before: readFileSync(path, 'utf8') };
});

try {
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      // Playwright's own recommendation: Chromium needs a larger /dev/shm
      // than Docker's 64 MB default or it crashes on bigger pages.
      '--ipc=host',
      '-v',
      `${REPO}:/repo`,
      // Anonymous volumes shadowing the mounted tree. Without them pnpm sees
      // the HOST's node_modules - Windows-native binaries - decides it must
      // purge the directory, and (with no TTY) aborts:
      //
      //   ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
      //
      // Setting CI=true alone would "fix" that by letting it go ahead and
      // DELETE the host's install, which is worse than the error. Shadowing
      // gives the container its own empty directory and leaves the host's
      // alone. .next is shadowed for the same reason: the webServer builds
      // inside the container and would otherwise overwrite the host's build.
      '-v',
      '/repo/web/node_modules',
      '-v',
      '/repo/web/.next',
      // AND THE PER-RUN DIST DIR, which is the whole point of it.
      //
      // The first version of R98's distDir was a DEFECT: .next is shadowed by
      // the anonymous volume above, but .next-visual-<pid>-<t> is not, so the
      // container built straight into the shared host mount. A 40 MB build
      // tree appeared in web/, eslint linted it, and 6 568 errors arrived from
      // generated Next type files. Ignored by git, so nothing was committed -
      // but the directory that existed to improve isolation had bypassed the
      // isolation that was already there.
      //
      // Naming it here restores that: the build lives in a volume, not in the
      // repository, and the unique name is what R98 asks for.
      '-v',
      `/repo/web/${DIST_DIR}`,
      '-e',
      'CI=true',
      '-e',
      `NEXT_DIST_DIR=${DIST_DIR}`,
      '-w',
      '/repo/web',
      IMAGE,
      'bash',
      '-lc',
      inContainer,
    ],
    { stdio: 'inherit' },
  );
} catch {
  // execFileSync already streamed the failure; adding a stack would bury it.
  process.exitCode = 1;
} finally {
  // The snapshots go back BEFORE anything else in here, because the mount
  // point check below can set a failure exit code and return, and a run that
  // failed is exactly the run whose leftovers nobody goes looking for.
  //
  // Reported rather than restored in silence: if Next stops doing this, or
  // starts doing it somewhere new, the absence or presence of this line is the
  // only cheap way to notice.
  for (const snapshot of snapshots) {
    if (readFileSync(snapshot.path, 'utf8') !== snapshot.before) {
      writeFileSync(snapshot.path, snapshot.before);
      process.stdout.write(
        `${snapshot.file} restored: next had pointed it at ${DIST_DIR}.${NEWLINE}`,
      );
    }
  }

  // THE MOUNT POINT, AND WHAT ITS CONTENTS MEAN.
  //
  // Docker materialises the anonymous volume's mount point inside the bind
  // mount, so an EMPTY directory of this name appears on the host even though
  // the build itself went to the volume. Empty is correct and is removed here;
  // one per run would otherwise accumulate in web/.
  //
  // NON-EMPTY IS A FAILURE, and a loud one. It would mean the volume did not
  // take and the container wrote its build into the repository - which is
  // precisely the condition R98 exists to prevent, and it is invisible in the
  // Playwright output. It happened once, when this distDir was added without
  // its volume: eslint then reported 6 568 errors from generated files. So it
  // is reported rather than silently cleaned.
  // READ ONCE, HERE, so the R208 block below can ask what the RUNNER said
  // rather than what the working tree looks like. An absent log is an empty
  // string: the container copies it out at the end, so a run that died during
  // install leaves none - which is exactly the case R208 exists for, and an
  // empty string yields zero written snapshots rather than a false list.
  const logPath = resolve(WEB, RUN_LOG);
  const printedForUpdate = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const runFailed = process.exitCode === 1;

  // R133. Only when the run itself succeeded: a failed run has already
  // said why, and a second complaint about its count would bury that.
  if (!runFailed) {
    const printed = printedForUpdate;
    const counted = readCount('test:visual', printed, floors.visual);

    if (counted.failure !== undefined) {
      process.stderr.write(
        ['', `VISUAL SUITE: ${counted.failure}`, ''].join(NEWLINE),
      );
      process.exitCode = 1;
    } else {
      process.stdout.write(`visual suite: ${counted.ran} passed${NEWLINE}`);
    }
  }

  // R135: A REGENERATED BASELINE REQUIRES A STATED REASON, and the report
  // has to LIST the files. In FW13 that list was reconstructed afterwards
  // from git status, which is both a chore and a place to be wrong - and the
  // point of the ruling is that blind regeneration is what laundered a 22 px
  // button into the visual record. Printing it here means the report quotes a
  // list rather than assembling one.
  //
  // ========================================================================
  // R208: THE COUNT COMES FROM THE RUNNER, NEVER FROM `git status`
  // ========================================================================
  //
  // IT USED TO COME FROM git status, AND THAT MADE THIS LINE A LIAR. FW22
  // ran a regeneration that died with ENOMEM during `pnpm install`, exit code
  // 1, having taken NO SCREENSHOT AT ALL - and this block still printed
  //
  //   R135: 2 baseline(s) regenerated - list these in the report with a
  //   reason: ...
  //
  // naming two files a PREVIOUS run had written, AFTER the failure line. The
  // sentence exists to be pasted into a report as evidence, so it reported a
  // regeneration that did not happen, in the one place designed to be quoted.
  //
  // `git status` answers "does this differ from HEAD", which is true of a
  // previous run's output, a hand edit, or a half-finished attempt. It cannot
  // answer "did THIS run write this", which is the only question R135 asks.
  //
  // Playwright answers it directly: it prints a line per snapshot it writes.
  // That is the positive signal (R133) - specific enough that only an actual
  // write produces it.
  if (update) {
    // Playwright's own wording, both cases: an existing snapshot that changed
    // and a snapshot that did not exist yet.
    const WROTE = /^(.*\.png) (?:is re-generated, writing actual|does not exist.*writing actual)/u;

    const wrote = printedForUpdate
      .split(NEWLINE)
      .map((line) => WROTE.exec(line.trim()))
      .filter((match) => match !== null)
      .map((match) => (match[1] ?? '').replace(/^\/repo\/web\//u, ''))
      .sort();

    // The second signal, kept but DEMOTED to a cross-check. Where the two
    // disagree, something outside this run touched a baseline and that is
    // worth knowing - it is the PARK-15 shape, a tree changing underneath a
    // regeneration.
    const differs = execFileSync(
      'git',
      ['status', '--porcelain', '--', 'tests/visual/baselines'],
      { cwd: WEB, encoding: 'utf8' },
    )
      .split(NEWLINE)
      .map((line) => line.trim())
      .filter((line) => line !== '');

    if (runFailed) {
      // NO CLAIM IS MADE AT ALL. A failed run cannot have regenerated
      // anything, and printing a list here is what produced R208.
      process.stderr.write(
        [
          '',
          'R208: THE RUN FAILED, so no regeneration is claimed.',
          '',
          `  ${differs.length} baseline(s) differ from HEAD, and this run did NOT`,
          '  write them - they are a previous run, a hand edit, or a partial',
          '  attempt. Check them before trusting the working tree:',
          ...differs.map((line) => `    ${line}`),
          '',
        ].join(NEWLINE),
      );
      process.exitCode = 1;
    } else if (wrote.length === 0) {
      // R208: ZERO IS LOUD. A regeneration that regenerated nothing is either
      // a run that did not do what was asked, or a command that should not
      // have been run. Both deserve a stop rather than a shrug - "no baseline
      // changed" reads as success and is how a failed run passes for a clean
      // one.
      process.stderr.write(
        [
          '',
          'R208: REGENERATION WROTE NOTHING.',
          '',
          '  --update-snapshots ran and Playwright reported no snapshot',
          '  written. Either the pages are identical to their baselines - in',
          '  which case this command was not the one you wanted - or the run',
          '  did not reach the comparison.',
          differs.length === 0
            ? '  git agrees: no baseline differs from HEAD.'
            : `  AND YET ${differs.length} baseline(s) differ from HEAD, which this run did not write:`,
          ...differs.map((line) => `    ${line}`),
          '',
        ].join(NEWLINE),
      );
      process.exitCode = 1;
    } else {
      process.stdout.write(
        [
          '',
          `R135: ${wrote.length} baseline(s) regenerated BY THIS RUN - list these in the report with a reason:`,
          ...wrote.map((file) => `  ${file}`),
          '',
        ].join(NEWLINE),
      );

      // R207's cross-check, stated rather than assumed equal.
      if (differs.length !== wrote.length) {
        process.stdout.write(
          [
            `  NOTE: ${differs.length} baseline(s) differ from HEAD but this run wrote ${wrote.length}.`,
            '  The difference was not made by this run. Investigate before',
            '  regenerating again (PARK-15: a tree that changed underneath a',
            '  regeneration certifies whatever it happened to photograph).',
            '',
          ].join(NEWLINE),
        );
      }
    }
  }

  const host = resolve(WEB, DIST_DIR);

  if (existsSync(host)) {
    const contents = readdirSync(host);

    if (contents.length === 0) {
      rmSync(host, { recursive: true, force: true });
    } else {
      process.stderr.write(
        [
          '',
          `ISOLATION FAILED: ${DIST_DIR} on the HOST holds ${contents.length} entr(y|ies).`,
          'The container built into the repository instead of its volume, so this',
          'run tells you nothing about the baselines (ruling R98).',
          '',
        ].join(NEWLINE),
      );
      process.exitCode = 1;
    }
  }
}
