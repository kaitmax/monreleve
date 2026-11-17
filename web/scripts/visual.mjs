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
//   pnpm test:visual -- <spec...> [--grep <pattern>]
//                                      run ONLY what was named (R960)
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
//
// ============================================================================
// R960-R962: ONE SPEC WHEN ONE IS ASKED FOR, AND ONE INSTALL PER LOCKFILE
// ============================================================================
//
// THE PARKED TASK (C9, Queue Ruling 16): the container command was fixed and
// --update was the only argument, so proving one page cost the whole suite -
// and the install into an anonymous volume took 10.5 of that run's ~25
// minutes, on every run.
//
// THE FILTER (R960). `pnpm test:visual -- <spec>` or `-- --grep <pattern>`
// runs only what was named.
//
//   IT TRAVELS AS AN ARGV ARRAY, NEVER THROUGH A SHELL STRING. The container
//   runs ONE constant script, CONTAINER_SCRIPT, which hands its positional
//   parameters to Playwright as "$@"; the filter rides after the script in
//   docker's own argv. Nothing a person types is pasted into bash, so a
//   pattern with a space, a quote or a semicolon is one argument to
//   Playwright and never a second command.
//
//   ONLY A FILTER PASSES. A spec, and --grep/-g with a pattern. Everything
//   else Playwright would accept is refused before Docker is called, because
//   each changes what a passing run MEANS rather than which tests run:
//   --ignore-snapshots compares nothing, --update-snapshots writes baselines
//   outside --update's R135/R208 report, --retries moves R345's retries
//   (the operator's call, R964), --reporter breaks the count R133 reads.
//
//   A FILTERED RUN IS NOT A GATE RESULT, and it says so twice: in its banner
//   and beside its count. The floor (R133) is a claim about the FULL suite,
//   so a filtered run is held to "at least one passed" and no more.
//
// THE CACHE (R961). node_modules now lives in a NAMED volume whose name is
// the lockfile's hash: a changed lockfile gets a new volume and a cold
// install, an unchanged one reuses the install. See nodeModulesCache().
//
// THE GATES (R962). gate:changed runs `pnpm test:visual` with nothing after
// it, and gate:clone runs no visual step at all. A test reads both, so a
// filter cannot leak into either: tests/unit/meta/visual-filter-gates.test.ts.
//
// IMPORTING THIS FILE RUNS NOTHING. The run is main(), started only when this
// file is the script node was given (isMain), so the pure half below can be
// asserted in unit tests - tests/unit/meta/visual-filter.test.ts and
// visual-regeneration.test.ts - and declaration-parity can read its exports
// without starting a container.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCount, stripAnsi } from './gate-selection.mjs';

const require = createRequire(import.meta.url);

const { version } = require('@playwright/test/package.json');

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..');

/** R133 floors, shared with pnpm gate:changed. */
const floors = JSON.parse(readFileSync(resolve(WEB, 'scripts', 'suite-floor.json'), 'utf8'));
const IMAGE = `mcr.microsoft.com/playwright:v${version}-noble`;

/** U+000A, named because two escapes in this file collapsed on the way in. */
const NEWLINE = String.fromCharCode(10);

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

/**
 * The filter options R960 passes through. A spec - any argument that is not
 * an option - is the other form.
 */
const GREP = Object.freeze(['--grep', '-g']);

/**
 * @param {string} why
 * @returns {{ok: false, why: string}}
 */
const refused = (why) => ({ ok: false, why });

/**
 * What a person typed after `node scripts/visual.mjs`, read (R960).
 *
 * `--update` is this script's own flag, wherever it sits. `--` is a
 * separator and never a filter: pnpm 11 passes it through verbatim - measured
 * on 11.17.0, `pnpm <script> -- e2e/a.visual.spec.ts` gave the script
 * ["--","e2e/a.visual.spec.ts"].
 *
 * EVERYTHING ELSE MUST BE A FILTER, and an empty one is refused too: '' or a
 * blank pattern would match every spec and run the full suite while reading
 * as a filtered run, so no floor would be applied to it.
 *
 * @param {readonly string[]} argv
 * @returns {{ok: true, update: boolean, filter: string[]} | {ok: false, why: string}}
 */
export function visualArguments(argv) {
  let update = false;
  const filter = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';

    if (token === '--update') {
      update = true;
      continue;
    }

    if (token === '--') continue;

    if (GREP.includes(token)) {
      const pattern = argv[index + 1];

      if (pattern === undefined || pattern.trim() === '' || pattern.startsWith('-')) {
        return refused(`${token} needs a pattern after it, and ${JSON.stringify(pattern ?? '')} is not one.`);
      }

      filter.push(token, pattern);
      index += 1;
      continue;
    }

    if (token.startsWith('--grep=')) {
      if (token.slice('--grep='.length).trim() === '') {
        return refused('--grep= needs a pattern; an empty one matches every spec.');
      }

      filter.push(token);
      continue;
    }

    if (token.startsWith('-')) {
      return refused(
        `${token} is not a filter. This script passes a FILTER through and nothing else (R960): ` +
          'a spec, --grep <pattern> or -g <pattern>, and --update for its own regeneration.',
      );
    }

    if (token.trim() === '') {
      return refused('an empty filter matches every spec, so it would run the full suite as a filtered run.');
    }

    filter.push(token);
  }

  return { ok: true, update, filter };
}

/**
 * THE ONE SCRIPT THE CONTAINER RUNS, and it is a constant (R960).
 *
 * Playwright's arguments - --update-snapshots and the filter - arrive as the
 * script's positional parameters and are handed on as "$@". The script never
 * varies with what was typed, which is what "never through a shell string"
 * means: there is no string here for a pattern to be pasted into.
 */
export const CONTAINER_SCRIPT = [
  'set -o pipefail',
  'corepack enable',
  'cd /repo/web',
  // R961: node_modules is a NAMED volume reused across runs of one lockfile.
  // The install still runs every time and is the check: on a reused volume
  // pnpm verifies it against the lockfile and prints "Already up to date"; on
  // a new one it is the full cold install it always was.
  'pnpm install --frozen-lockfile',
  // AND THE PRISMA CLIENT IS GENERATED EVERY RUN, because an install that is
  // already up to date runs NO lifecycle script - measured on pnpm 11.17.0:
  // the second `pnpm install` printed "Already up to date" and no postinstall.
  // The client is written INTO node_modules, so a reused volume would
  // otherwise keep the client of whichever schema installed it, and two
  // worktrees on one lockfile share one volume. So the project's own
  // postinstall runs on every run: the client always matches THIS tree's
  // schema (twice on a cold run, which costs a second).
  'pnpm run postinstall',
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
  `pnpm exec playwright test --project=visual "$@" 2>&1 | tee /tmp/visual-run.txt; code=$?; mkdir -p test-results; cp /tmp/visual-run.txt ${RUN_LOG}; exit $code`,
].join(' && ');

/**
 * The docker argv for one run (R960, R961).
 *
 * @param {{repo: string, volume: string, distDir: string, image: string, update: boolean, filter: readonly string[]}} run
 * @returns {string[]}
 */
export function dockerRunArguments({ repo, volume, distDir, image, update, filter }) {
  return [
    'run',
    '--rm',
    // Playwright's own recommendation: Chromium needs a larger /dev/shm
    // than Docker's 64 MB default or it crashes on bigger pages.
    '--ipc=host',
    '-v',
    `${repo}:/repo`,
    // node_modules is SHADOWED, as it always was. Without a volume here pnpm
    // sees the HOST's node_modules - Windows-native binaries - decides it
    // must purge the directory, and (with no TTY) aborts:
    //
    //   ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
    //
    // Setting CI=true alone would "fix" that by letting it go ahead and
    // DELETE the host's install, which is worse than the error. Shadowing
    // gives the container its own directory and leaves the host's alone.
    //
    // R961: THE SHADOW IS NOW A NAMED VOLUME, one per lockfile, so the
    // container's Linux install is paid once per lockfile rather than once
    // per run. It holds dependencies only; the BUILD stays per run below.
    '-v',
    `${volume}:/repo/web/node_modules`,
    // .next is shadowed for the same reason: the webServer builds inside the
    // container and would otherwise overwrite the host's build. Anonymous,
    // so it is the run's own and goes with it (--rm).
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
    `/repo/web/${distDir}`,
    // The SAME two variables whatever was typed: nothing travels by
    // environment, so a filter cannot arrive from a shell (R962).
    '-e',
    'CI=true',
    '-e',
    `NEXT_DIST_DIR=${distDir}`,
    '-w',
    '/repo/web',
    image,
    'bash',
    '-lc',
    CONTAINER_SCRIPT,
    // bash -c's first argument after the script is $0, the script's name.
    // What follows is "$@", and it is exactly what Playwright receives.
    'visual',
    ...(update ? ['--update-snapshots'] : []),
    ...filter,
  ];
}

/**
 * The node_modules cache for one lockfile (R961).
 *
 * NAMED FROM THE LOCKFILE'S HASH, so a changed lockfile gets a fresh volume
 * and a cold install, and an unchanged one reuses the install - in any
 * worktree, since the name depends on the lockfile and nothing else. The
 * CONTENT is hashed: line endings are normalised first, so two checkouts of
 * one lockfile share one install whatever autocrlf did to them.
 *
 * LABELLED WITH THE PRODUCT, so the volume says whose it is, and with the full
 * hash and the image, so a reused volume is checked rather than trusted
 * (volumeVerdict). Sixteen hex characters name it; all sixty-four are checked.
 *
 * REMOVED BY NAME, never by sweep: `docker volume rm <volume>`. This script
 * removes nothing - an old lockfile's volume may be another worktree's live
 * cache, and R334 forbids deleting what this run did not create.
 *
 * @param {string} lockfile the text of pnpm-lock.yaml
 * @param {string} image the Playwright image the install is for
 */
export function nodeModulesCache(lockfile, image) {
  const lockfileSha256 = createHash('sha256').update(lockfile.replace(/\r\n/gu, '\n')).digest('hex');

  return {
    volume: `monreleve-visual-node-modules-${lockfileSha256.slice(0, 16)}`,
    lockfileSha256,
    labels: Object.freeze({
      'ch.monreleve.product': 'monreleve',
      'ch.monreleve.cache': 'visual-node-modules',
      'ch.monreleve.lockfile-sha256': lockfileSha256,
      'ch.monreleve.image': image,
    }),
  };
}

/**
 * `docker volume create` for the cache, with every label, by its exact name.
 *
 * @param {{volume: string, labels: Readonly<Record<string, string>>}} cache
 * @returns {string[]}
 */
export function volumeCreateArguments(cache) {
  return [
    'volume',
    'create',
    ...Object.entries(cache.labels).flatMap(([key, value]) => ['--label', `${key}=${value}`]),
    cache.volume,
  ];
}

/**
 * What to do with the volume of that name, given its labels - or null when
 * no such volume exists (R961).
 *
 * ONLY OUR OWN VOLUME FOR THIS LOCKFILE AND IMAGE IS REUSED. Anything else of
 * that name - another project's, a hand-made one, ours for another image - is
 * refused, and neither used nor touched.
 *
 * @param {Readonly<Record<string, string>> | null} existing
 * @param {{volume: string, labels: Readonly<Record<string, string>>}} cache
 * @returns {{action: 'create'} | {action: 'reuse'} | {action: 'refuse', why: string}}
 */
export function volumeVerdict(existing, cache) {
  if (existing === null) return { action: 'create' };

  const differing = Object.entries(cache.labels)
    .filter(([key, value]) => existing[key] !== value)
    .map(([key]) => key);

  if (differing.length === 0) return { action: 'reuse' };

  return {
    action: 'refuse',
    why:
      `a volume named ${cache.volume} exists and is not this script's node_modules cache for ` +
      `this lockfile and image: its ${differing.join(', ')} label(s) differ. It is neither used ` +
      `nor touched. If it is yours to discard: docker volume rm ${cache.volume}`,
  };
}

/**
 * The two lines Playwright 1.63 prints for a snapshot it writes, read in its
 * own source (lib/matchers/expect.js) - one per KIND, because R1020 asks the
 * list to say which is which:
 *
 *   A snapshot doesn't exist at <path>, writing actual.    handleMissing
 *   <path> is re-generated, writing actual.                toHaveScreenshot
 *
 * R1020: THE FIRST WAS NOT RECOGNISED. The pattern for a new file expected
 * the path FIRST ("<path> does not exist ... writing actual"), a wording 1.63
 * does not print, so every new baseline went uncounted: W11's regeneration of
 * new files only exited 1 with "WROTE NOTHING" although both files were
 * written (W11's DEFECT 1, REPORT-FW-DELAI-RAPPEL.txt). The patterns are now
 * the printed lines, proven by tests/unit/meta/visual-regeneration.test.ts
 * against lines copied from that run's own log.
 */
const WRITTEN = Object.freeze([
  { kind: 'new', pattern: /^A snapshot doesn't exist at (.+\.png), writing actual\.$/u },
  { kind: 're-generated', pattern: /^(.+\.png) is re-generated, writing actual\.$/u },
]);

/**
 * Every baseline the RUNNER says it wrote, from what it printed (R208, R1020).
 *
 * ONCE EACH, sorted by file: a file is one file however many times its line
 * was printed, and `--update-snapshots=all` prints the re-generated line
 * twice for one write.
 *
 * @param {string} printed
 * @returns {{file: string, kind: 'new' | 're-generated'}[]}
 */
export function baselinesWritten(printed) {
  const written = new Map();

  for (const raw of printed.split(NEWLINE)) {
    const line = stripAnsi(raw).trim();

    for (const { kind, pattern } of WRITTEN) {
      const match = pattern.exec(line);

      if (match !== null) {
        const file = (match[1] ?? '').replace(/^\/repo\/web\//u, '');

        written.set(file, { file, kind });
        break;
      }
    }
  }

  return [...written.values()].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * What a regeneration says about itself, and its exit code (R135, R208).
 *
 * R135: A REGENERATED BASELINE REQUIRES A STATED REASON, and the report
 * has to LIST the files. In FW13 that list was reconstructed afterwards
 * from git status, which is both a chore and a place to be wrong - and the
 * point of the ruling is that blind regeneration is what laundered a 22 px
 * button into the visual record. Printing it here means the report quotes a
 * list rather than assembling one.
 *
 * ========================================================================
 * R208: THE COUNT COMES FROM THE RUNNER, NEVER FROM `git status`
 * ========================================================================
 *
 * IT USED TO COME FROM git status, AND THAT MADE THIS LINE A LIAR. FW22
 * ran a regeneration that died with ENOMEM during `pnpm install`, exit code
 * 1, having taken NO SCREENSHOT AT ALL - and this block still printed
 *
 *   R135: 2 baseline(s) regenerated - list these in the report with a
 *   reason: ...
 *
 * naming two files a PREVIOUS run had written, AFTER the failure line. The
 * sentence exists to be pasted into a report as evidence, so it reported a
 * regeneration that did not happen, in the one place designed to be quoted.
 *
 * `git status` answers "does this differ from HEAD", which is true of a
 * previous run's output, a hand edit, or a half-finished attempt. It cannot
 * answer "did THIS run write this", which is the only question R135 asks.
 *
 * Playwright answers it directly: it prints a line per snapshot it writes.
 * That is the positive signal (R133) - specific enough that only an actual
 * write produces it.
 *
 * `differs` - git's view - is kept but DEMOTED to a cross-check. Where the
 * two disagree, something outside this run touched a baseline and that is
 * worth knowing - it is the PARK-15 shape, a tree changing underneath a
 * regeneration.
 *
 * @param {{printed: string, runFailed: boolean, differs: readonly string[]}} run
 * @returns {{exitCode: 0 | 1, stream: 'stdout' | 'stderr', lines: string[]}}
 */
export function regenerationReport({ printed, runFailed, differs }) {
  if (runFailed) {
    // NO CLAIM IS MADE AT ALL. A failed run cannot have regenerated
    // anything, and printing a list here is what produced R208.
    return {
      exitCode: 1,
      stream: 'stderr',
      lines: [
        '',
        'R208: THE RUN FAILED, so no regeneration is claimed.',
        '',
        `  ${differs.length} baseline(s) differ from HEAD, and this run did NOT`,
        '  write them - they are a previous run, a hand edit, or a partial',
        '  attempt. Check them before trusting the working tree:',
        ...differs.map((line) => `    ${line}`),
        '',
      ],
    };
  }

  const written = baselinesWritten(printed);

  if (written.length === 0) {
    // R208: ZERO IS LOUD. A regeneration that regenerated nothing is either
    // a run that did not do what was asked, or a command that should not
    // have been run. Both deserve a stop rather than a shrug - "no baseline
    // changed" reads as success and is how a failed run passes for a clean
    // one.
    return {
      exitCode: 1,
      stream: 'stderr',
      lines: [
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
      ],
    };
  }

  const created = written.filter((entry) => entry.kind === 'new').length;
  const lines = [
    '',
    `R135: ${written.length} baseline(s) written BY THIS RUN (${created} new, ${written.length - created} re-generated) - list these in the report with a reason:`,
    ...written.map(({ file, kind }) => `  ${kind.padEnd(12)}  ${file}`),
    '',
  ];

  // R207's cross-check, stated rather than assumed equal.
  if (differs.length !== written.length) {
    lines.push(
      `  NOTE: ${differs.length} baseline(s) differ from HEAD but this run wrote ${written.length}.`,
      '  The difference was not made by this run. Investigate before',
      '  regenerating again (PARK-15: a tree that changed underneath a',
      '  regeneration certifies whatever it happened to photograph).',
      '',
    );
  }

  return { exitCode: 0, stream: 'stdout', lines };
}

/**
 * R98: refuse to start while another container of this image is alive.
 *
 * Not a warning. A second container is exactly the condition that produces a
 * result nobody can trust and nothing else reports, so the only safe answer is
 * to stop and name the ids.
 *
 * It also keeps the cache to one user at a time: a second container would
 * share the named node_modules volume as well as the mount (R961).
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

/**
 * The labels of the volume of that name, or null when there is none (R961).
 *
 * Asked by EXACT NAME: this script never lists volumes, so it cannot see -
 * let alone touch - a volume that is not the one it is about to use.
 *
 * @param {string} volume
 * @returns {Record<string, string> | null}
 */
function existingVolumeLabels(volume) {
  try {
    const printed = execFileSync('docker', ['volume', 'inspect', '--format', '{{json .Labels}}', volume], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // A volume with no labels prints `null`, which is not ours either.
    return JSON.parse(printed.trim()) ?? {};
  } catch (error) {
    const said = String(error?.stderr ?? error);

    if (/no such volume/iu.test(said)) return null;

    process.stderr.write(['', `docker volume inspect ${volume} failed:`, `  ${said.trim()}`, ''].join(NEWLINE));
    process.exit(1);
  }
}

/**
 * Reuse the cache, or create it - or refuse (R961).
 *
 * @param {ReturnType<typeof nodeModulesCache>} cache
 * @returns {string} the state, as the isolation line states it
 */
function prepareCache(cache) {
  const verdict = volumeVerdict(existingVolumeLabels(cache.volume), cache);

  if (verdict.action === 'refuse') {
    process.stderr.write(['', `REFUSING TO RUN: ${verdict.why}`, ''].join(NEWLINE));
    process.exit(1);
  }

  if (verdict.action === 'create') {
    execFileSync('docker', volumeCreateArguments(cache), { stdio: ['ignore', 'ignore', 'inherit'] });

    return 'CREATED now, so this run installs into it cold';
  }

  return 'REUSED: the install made for this lockfile';
}

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

function main() {
  // R960: read and judged BEFORE anything touches Docker, so a refused
  // argument costs nothing and leaves nothing behind.
  const parsed = visualArguments(process.argv.slice(2));

  // `in` rather than `!parsed.ok`: tsconfig.scripts.json checks this file
  // without strictNullChecks, where a boolean discriminant does not narrow.
  if ('why' in parsed) {
    process.stderr.write(['', `REFUSING TO RUN: ${parsed.why}`, ''].join(NEWLINE));
    process.exit(2);
  }

  const { update, filter } = parsed;
  const filtered = filter.length > 0;

  refuseIfOrphans();

  // R961: the cache for THIS lockfile, made or reused before the run starts.
  const cache = nodeModulesCache(readFileSync(resolve(WEB, 'pnpm-lock.yaml'), 'utf8'), IMAGE);
  const cacheState = prepareCache(cache);

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

  process.stdout.write(
    [
      `visual baselines in ${IMAGE}${update ? ' (regenerating)' : ''}`,
      // R960: said before anything runs, so no log of a filtered run can be
      // read as the full suite's.
      filtered
        ? `filter (R960): ${JSON.stringify(filter)} - ONLY what was named: not the full suite, and no gate result`
        : 'filter: none - the full suite',
      // R98 requires the report to state the isolation per regeneration. Printing
      // it means the report can QUOTE this line instead of asserting something
      // about a run nobody can inspect afterwards.
      `isolation: sole container of ${IMAGE} (checked); distDir ${DIST_DIR}; .next and the distDir on anonymous volumes; node_modules on named volume ${cache.volume} (R961: ${cacheState})`,
      // R184, and it is the INPUT half of the same idea.
      photographed(),
      '',
    ].join(NEWLINE),
  );

  const snapshots = OWNED_BY_NEXT.map((file) => {
    const path = resolve(WEB, file);

    return { file, path, before: readFileSync(path, 'utf8') };
  });

  try {
    execFileSync(
      'docker',
      dockerRunArguments({ repo: REPO, volume: cache.volume, distDir: DIST_DIR, image: IMAGE, update, filter }),
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
      // R960: THE FLOOR IS THE FULL SUITE'S. A filtered run is held to a
      // positive count - at least one passed - and to nothing it was never
      // asked to run.
      const counted = readCount('test:visual', printed, filtered ? undefined : floors.visual);

      if (counted.failure !== undefined) {
        process.stderr.write(
          ['', `VISUAL SUITE: ${counted.failure}`, ''].join(NEWLINE),
        );
        process.exitCode = 1;
      } else if (filtered) {
        process.stdout.write(
          `visual suite: ${counted.ran} passed, FILTERED (R960) to ${JSON.stringify(filter)} - not the full suite, so no floor applies and this is no gate result${NEWLINE}`,
        );
      } else {
        process.stdout.write(`visual suite: ${counted.ran} passed${NEWLINE}`);
      }
    }

    // R135 and R208: see regenerationReport, which says what was written and
    // judges a regeneration that wrote nothing.
    if (update) {
      const differs = execFileSync(
        'git',
        ['status', '--porcelain', '--', 'tests/visual/baselines'],
        { cwd: WEB, encoding: 'utf8' },
      )
        .split(NEWLINE)
        .map((line) => line.trim())
        .filter((line) => line !== '');

      const report = regenerationReport({ printed: printedForUpdate, runFailed, differs });

      (report.stream === 'stderr' ? process.stderr : process.stdout).write(report.lines.join(NEWLINE));

      if (report.exitCode !== 0) process.exitCode = 1;
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
}

/** Whether node was given THIS file to run, rather than something importing it. */
function isMain() {
  if (!process.argv[1]) return false;

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) main();
