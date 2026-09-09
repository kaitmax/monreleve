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

const require = createRequire(import.meta.url);
const { version } = require('@playwright/test/package.json');

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..');
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
const inContainer = [
  'corepack enable',
  'cd /repo/web',
  'pnpm install --frozen-lockfile',
  `pnpm exec playwright test --project=visual${update ? ' --update-snapshots' : ''}`,
].join(' && ');

process.stdout.write(
  [
    `visual baselines in ${IMAGE}${update ? ' (regenerating)' : ''}`,
    // R98 requires the report to state the isolation per regeneration. Printing
    // it means the report can QUOTE this line instead of asserting something
    // about a run nobody can inspect afterwards.
    `isolation: sole container of ${IMAGE} (checked); distDir ${DIST_DIR}; node_modules and .next on anonymous volumes`,
    '',
  ].join(NEWLINE),
);

/**
 * tsconfig.json AS IT STANDS BEFORE THE CONTAINER TOUCHES IT.
 *
 * R98's per-run distDir has a side effect the ruling did not anticipate. On
 * every build Next APPENDS that directory's generated route types to the
 * `include` array of the repo's real tsconfig.json - the file is on the bind
 * mount, and Next treats keeping it current as a courtesy.
 *
 * The directory is deleted when the run ends. The entry is not. Eight had
 * accumulated by FW11, each pointing at nothing, and the list could only grow:
 * one per visual run, forever, in a file that goes into every commit. It also
 * left `git status` dirty after every run, which is the noise that hides a
 * real change.
 *
 * So the file is snapshotted here and restored in the finally below. The other
 * half of this is tests/unit/meta/tsconfig-accretion.test.ts, which is what
 * would SEE the restore breaking - a crash between these two points, or a
 * future Next that writes somewhere else, would otherwise resume accreting
 * with no symptom beyond a diff nobody reads.
 */
const TSCONFIG = resolve(WEB, 'tsconfig.json');
const tsconfigBefore = readFileSync(TSCONFIG, 'utf8');

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
  // The snapshot goes back BEFORE anything else in here, because the mount
  // point check below can set a failure exit code and return, and a run that
  // failed is exactly the run whose leftovers nobody goes looking for.
  //
  // Reported rather than restored in silence: if Next stops doing this, or
  // starts doing it somewhere new, the absence or presence of this line is the
  // only cheap way to notice.
  if (readFileSync(TSCONFIG, 'utf8') !== tsconfigBefore) {
    writeFileSync(TSCONFIG, tsconfigBefore);
    process.stdout.write(
      `tsconfig.json restored: next had added ${DIST_DIR} to its include.${NEWLINE}`,
    );
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
