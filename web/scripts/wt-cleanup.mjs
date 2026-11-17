// web/scripts/wt-cleanup.mjs
//
// R1036-R1040 (FW-WT-CLEANUP, amended by Web Ruling 21): A MERGED BRANCH'S
// WORKTREE IS REMOVED BY A SCRIPT THAT REFUSES WHAT R392 FORBIDS.
//
// Run from web/ of your OWN worktree:
//   node scripts/wt-cleanup.mjs            the dry run: every worktree under C:/wt, its verdict and size
//   node scripts/wt-cleanup.mjs --apply    removes the REMOVE rows, each verdict recomputed as it acts
//   --root <dir> replaces C:/wt and --no-fetch skips the fetch; both exist for the tests.
//
// ============================================================================
// WHAT IT JUDGES, AND THE ONE VERDICT EACH WORKTREE GETS
// ============================================================================
//
// It reads `git worktree list` of the repository it runs in, after fetching
// origin, and judges only worktrees under the root. The main checkout, the
// worktree it runs from and anything outside the root are never candidates;
// a folder under the root that is not a registered worktree is reported and
// left alone. "Merged" means HEAD is an ancestor of origin/main. The checks
// run in this order, and the first that applies is the verdict:
//
//   REFUSED (lock)       a .session-lock.json, whoever wrote it, or a git worktree lock
//   REFUSED (dirty)      `git status --porcelain` is not empty; the paths are listed
//   REFUSED (unpushed)   HEAD is in no remote-tracking ref
//   KEPT                 a .wt-keep, whose content is the reason
//   SKIPPED (not merged)
//   REFUSED (young)      created less than MIN_AGE_MINUTES ago
//   REMOVE               merged, clean, pushed, unlocked, not kept, old enough
//
// Refusals come before "merged" on purpose: a HEAD inside origin/main is in a
// remote-tracking ref by definition, so checked after it, "unpushed" could
// never fire. A refusal is the exit code turning non-zero with the reason
// printed (R392's parked clause); the other rows are still processed.
//
// ============================================================================
// WHY --apply DOES MORE THAN `git worktree remove` (WEB RULING 21, MEASURED)
// ============================================================================
//
// Git for Windows 2.49, on this machine:
//   - `git worktree remove` FOLLOWS a directory junction and deletes what it
//     points at. A junction to a folder outside the worktree: that folder's
//     file was deleted, exit 0.
//   - On a pnpm tree it stops midway ("Directory not empty"; on a path longer
//     than MAX_PATH, "Filename too long"), and unregisters the worktree
//     anyway. The orchestrator removed 11 merged worktrees that way and git
//     freed 3.5 GB; every folder stayed on disk with ~2 840 junctions.
//
// So for a REMOVE row --apply: (1) recomputes the verdict at that moment,
// never reusing a dry run's; (2) removes every link inside the worktree AS A
// LINK, so git never meets one to follow; (3) checks git status is still
// empty and calls `git worktree remove`, never --force; (4) if git has just
// unregistered the path and its folder is still there, finishes the delete
// itself, never following a link. "Gone" means absent from `git worktree
// list` AND from the disk. It never deletes a branch or a remote ref: R392
// keeps that for after the owning session's report is on main.
//
// ============================================================================
// SIZES: WHAT REMOVING A FOLDER ACTUALLY FREES
// ============================================================================
//
// node_modules files are hard links into the one shared pnpm store (nlink
// 34-35 measured), so a worktree's APPARENT ~940 MiB frees ~48 MiB. Each row
// prints both; FREES counts only files with no other hard link, and the total
// --apply promises is that column.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const DEFAULT_ROOT = 'C:/wt';
const LOCK_FILE = '.session-lock.json';
const KEEP_FILE = '.wt-keep';
const MAIN_REF = 'origin/main';

/**
 * R345: A STATED VALUE. A worktree younger than this is refused.
 *
 * A new session's worktree is merged, clean and unlocked in the seconds
 * between `git worktree add` and its lock being written. Measured on
 * 2026-11-17 as the .git file's mtime against the lock's creation, for six
 * live sessions: 3, 4, 14, 14 and 30 s, plus one lock re-created on a resume.
 * Sixty minutes is over a hundred times the widest first-lock gap. A refusal
 * only makes a merged folder wait for the next run; too short a value deletes
 * a session's worktree while it is being set up.
 */
const MIN_AGE_MINUTES = 60;

const EXIT_REFUSED = 1;
const EXIT_FAILED = 2;
const EXIT_USAGE = 64;

const USAGE = 'usage: node scripts/wt-cleanup.mjs [--apply] [--root <dir>] [--no-fetch]';

/** At most this many dirty paths are printed per row; the count is always stated. */
const DIRTY_SHOWN = 20;

/** A failure that leaves no verdict: printed as NO RESULT, exit 2. */
class NoResult extends Error {}

function parseArgs(argv) {
  const options = { apply: false, fetch: true, root: DEFAULT_ROOT, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--apply') options.apply = true;
    else if (arg === '--no-fetch') options.fetch = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--root' && argv[index + 1] !== undefined) {
      options.root = argv[index + 1];
      index += 1;
    } else return null;
  }

  return options;
}

function git(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.error) throw new NoResult(`git ${args[0]} could not start: ${result.error.message}`);

  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr.trim() };
}

const firstLine = (text) => text.split('\n')[0] ?? '';

/** The real path where it exists: a temp path, a short name or a case variant compare equal. */
function canonical(path) {
  const absolute = resolve(path);

  try {
    return realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

/** path.relative is case-insensitive on win32, and compares whole segments. */
const samePath = (a, b) => relative(a, b) === '';

function isUnder(root, path) {
  const rel = relative(root, path);

  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

const display = (path) => path.split(sep).join('/');

/** `git worktree list --porcelain -z`: the first record is the main checkout. */
function worktrees(cwd) {
  const result = git(['worktree', 'list', '--porcelain', '-z'], cwd);

  if (result.status !== 0) {
    throw new NoResult(`git worktree list exited ${result.status}: ${result.stderr}`);
  }

  const records = [];
  let current = null;

  for (const field of result.stdout.split('\0')) {
    if (field === '') {
      if (current !== null) records.push(current);
      current = null;
      continue;
    }

    const space = field.indexOf(' ');
    const key = space === -1 ? field : field.slice(0, space);
    const value = space === -1 ? '' : field.slice(space + 1);

    if (key === 'worktree') {
      if (current !== null) records.push(current);
      current = { path: value, head: '', locked: null };
    } else if (current !== null && key === 'HEAD') current.head = value;
    else if (current !== null && key === 'locked') current.locked = value === '' ? 'no reason given' : value;
  }

  if (current !== null) records.push(current);

  return records;
}

function lockHolder(path) {
  const file = join(path, LOCK_FILE);

  if (!existsSync(file)) return null;

  try {
    const lock = JSON.parse(readFileSync(file, 'utf8'));
    const who = lock.session ?? lock.task ?? 'a holder that gives no name';
    const since = lock.createdUtc ?? lock.createdAt;

    return `${LOCK_FILE}: ${who}${since === undefined ? '' : `, created ${since}`}`;
  } catch {
    return `${LOCK_FILE} is present (not readable as JSON)`;
  }
}

/**
 * What `git status --porcelain` lists, minus an untracked keep marker.
 *
 * --no-optional-locks: a status in another session's worktree must not take
 * its index lock. --untracked-files is STATED, so a config hiding untracked
 * files cannot make a worktree read clean (R345's shape).
 *
 * THE KEEP MARKER IS EXEMPT because every worktree checked out before R1038's
 * .gitignore line shows it as untracked, and it would read REFUSED (dirty).
 */
function dirtyPaths(path) {
  const result = git(
    [
      '-C',
      path,
      '--no-optional-locks',
      'status',
      '--porcelain',
      '--untracked-files=normal',
      '--ignore-submodules=none',
    ],
    path,
  );

  if (result.status !== 0) return [`git status exited ${result.status}: ${firstLine(result.stderr)}`];

  return result.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '' && line !== `?? ${KEEP_FILE}`);
}

function keepReason(path) {
  const file = join(path, KEEP_FILE);

  if (!existsSync(file)) return null;

  try {
    const text = readFileSync(file, 'utf8').trim().replace(/\s+/gu, ' ').slice(0, 300);

    return text === '' ? '(the marker gives no reason)' : text;
  } catch (error) {
    return `(the marker cannot be read: ${error.code})`;
  }
}

/** Minutes since `git worktree add` wrote the .git file, or null without one. */
function ageMinutes(path) {
  try {
    return (Date.now() - statSync(join(path, '.git')).mtimeMs) / 60000;
  } catch {
    return null;
  }
}

/** Every check, in the order the header states; the first that applies decides. */
function classify(record, context) {
  const path = record.path;
  const holder = lockHolder(path);

  if (holder !== null) return { verdict: 'REFUSED (lock)', reason: [holder] };

  if (record.locked !== null) {
    return { verdict: 'REFUSED (lock)', reason: [`git worktree lock: ${record.locked}`] };
  }

  const dirty = dirtyPaths(path);

  if (dirty.length > 0) {
    const shown = dirty.slice(0, DIRTY_SHOWN).map((line) => `  ${line}`);
    const more = dirty.length > DIRTY_SHOWN ? [`  ... and ${dirty.length - DIRTY_SHOWN} more`] : [];

    return {
      verdict: 'REFUSED (dirty)',
      reason: [`${dirty.length} path(s) in git status --porcelain:`, ...shown, ...more],
    };
  }

  const head = record.head;
  const remote = git(
    ['for-each-ref', '--contains', head, '--count=1', '--format=%(refname)', 'refs/remotes/'],
    context.cwd,
  );

  if (remote.status !== 0 || remote.stdout.trim() === '') {
    return {
      verdict: 'REFUSED (unpushed)',
      reason: [`HEAD ${head.slice(0, 12)} is in no remote-tracking ref`],
    };
  }

  const keep = keepReason(path);

  if (keep !== null) return { verdict: 'KEPT', reason: [`${KEEP_FILE}: ${keep}`] };

  const merge = git(['merge-base', '--is-ancestor', head, context.mainSha], context.cwd);

  if (merge.status !== 0) {
    const why = merge.status === 1 ? `is not in ${MAIN_REF}` : `could not be compared: ${firstLine(merge.stderr)}`;

    return { verdict: 'SKIPPED (not merged)', reason: [`HEAD ${head.slice(0, 12)} ${why}`] };
  }

  const age = ageMinutes(path);

  if (age === null) {
    return { verdict: 'REFUSED (young)', reason: ['no .git file to date it, so it is not shown to be old enough'] };
  }

  if (age < MIN_AGE_MINUTES) {
    return {
      verdict: 'REFUSED (young)',
      reason: [
        `created ${Math.floor(age)} min ago (its .git file), under the stated minimum of ` +
          `${MIN_AGE_MINUTES} min: a new session writes its lock seconds after the worktree`,
      ],
    };
  }

  return {
    verdict: 'REMOVE',
    reason: [`merged into ${MAIN_REF}; clean; pushed; no lock; no ${KEEP_FILE}; ${Math.floor(age)} min old`],
  };
}

/** Bytes under a folder, never through a link: all of them, and those with no other hard link. */
function measure(dir) {
  let apparent = 0;
  let exclusive = 0;
  let unreadable = 0;
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      unreadable += 1;
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const path = join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }

      try {
        const stats = lstatSync(path);

        if (!stats.isFile()) continue;
        apparent += stats.size;
        if (stats.nlink <= 1) exclusive += stats.size;
      } catch {
        unreadable += 1;
      }
    }
  }

  return { apparent, exclusive, unreadable };
}

function bytes(count) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = count;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

function printRow(label, sizes, path, lines) {
  const frees = sizes === null ? '-' : bytes(sizes.exclusive);
  const apparent = sizes === null ? '-' : bytes(sizes.apparent);

  console.log(`${label.padEnd(20)}  ${frees.padStart(10)}  ${apparent.padStart(10)}  ${display(path)}`);
  for (const line of lines) console.log(`    ${line}`);

  if (sizes !== null && sizes.unreadable > 0) {
    console.log(`    ${sizes.unreadable} entr(ies) could not be read: both sizes are a floor`);
  }
}

/** Every link inside a tree, removed as a link: never followed, its target never touched. */
function removeLinks(dir) {
  let removed = 0;
  const failed = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      failed.push(`${display(current)}: ${error.code}`);
      continue;
    }

    for (const entry of entries) {
      const path = join(current, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          unlinkSync(path);
          removed += 1;
        } catch (error) {
          failed.push(`${display(path)}: ${error.code}`);
        }
      } else if (entry.isDirectory()) stack.push(path);
    }
  }

  return { removed, failed };
}

/** The rest of a folder git has just unregistered, deleted without following a link. */
function deleteTree(dir, failed) {
  let entries = [];

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    failed.push(`${display(dir)}: ${error.code}`);
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      deleteTree(path, failed);
      continue;
    }

    try {
      // A link is unlinked as a link; Node's unlink removes a junction itself.
      unlinkSync(path);
    } catch (error) {
      failed.push(`${display(path)}: ${error.code}`);
    }
  }

  try {
    rmdirSync(dir);
  } catch (error) {
    failed.push(`${display(dir)}: ${error.code}`);
  }
}

const registered = (cwd, path) => worktrees(cwd).some((record) => samePath(canonical(record.path), path));

/** One REMOVE row, acted on. Returns whether it ended without a failure, and what to print. */
function removeOne(path, context) {
  const links = removeLinks(path);

  if (links.failed.length > 0) {
    return {
      ok: false,
      line: `apply: FAILED - ${links.failed.length} link(s) could not be removed (${links.failed[0]}); git was not called`,
    };
  }

  const dirty = dirtyPaths(path);

  if (dirty.length > 0) {
    return {
      ok: false,
      line: `apply: FAILED - git status is not empty after removing ${links.removed} link(s) (${dirty[0].trim()}); git was not called`,
    };
  }

  const removal = git(['worktree', 'remove', path], context.cwd);
  const said =
    `${links.removed} link(s) removed as links first; git worktree remove exited ${removal.status}` +
    (removal.status === 0 ? '' : ` (${firstLine(removal.stderr)})`);

  if (registered(context.cwd, path)) {
    return { ok: false, line: `apply: FAILED - ${said}; still registered, so nothing else was deleted` };
  }

  if (!existsSync(path)) return { ok: true, line: `apply: ${said}` };

  const failed = [];

  deleteTree(path, failed);

  const finished = `${said}; git unregistered it, so the script finished the delete without following a link`;

  return failed.length === 0
    ? { ok: true, line: `apply: ${finished}` }
    : { ok: false, line: `apply: FAILED - ${finished}, and ${failed.length} entr(ies) remain (${failed[0]})` };
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options === null) {
    console.error(USAGE);
    return EXIT_USAGE;
  }

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const cwd = process.cwd();
  const top = git(['rev-parse', '--show-toplevel'], cwd);

  if (top.status !== 0) throw new NoResult(`not inside a git worktree: ${top.stderr}`);

  const here = canonical(top.stdout.trim());
  const root = canonical(options.root);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new NoResult(`the root ${options.root} is not a directory`);
  }

  if (options.fetch) {
    const fetch = git(['fetch', '--quiet', 'origin'], cwd);

    if (fetch.status !== 0) throw new NoResult(`git fetch origin exited ${fetch.status}: ${fetch.stderr}`);
  }

  const resolved = git(['rev-parse', '--verify', '--quiet', `${MAIN_REF}^{commit}`], cwd);

  if (resolved.status !== 0) throw new NoResult(`${MAIN_REF} does not name a commit`);

  const context = { cwd, mainSha: resolved.stdout.trim() };
  const records = worktrees(cwd);
  const mainPath = canonical(records[0]?.path ?? '');

  console.log(
    options.apply
      ? 'wt-cleanup (R392, R1036): APPLY - each verdict is recomputed at the moment it acts'
      : 'wt-cleanup (R392, R1036): DRY RUN - nothing is removed; --apply removes the REMOVE rows',
  );
  console.log(`  repository   ${display(mainPath)}`);
  console.log(`  root         ${display(root)}`);
  console.log(
    `  ${MAIN_REF.padEnd(11)}  ${context.mainSha.slice(0, 12)} ${options.fetch ? '(fetched just now)' : '(not fetched: --no-fetch)'}`,
  );
  console.log(`  minimum age  ${MIN_AGE_MINUTES} min (R345: stated; a younger worktree is refused)`);
  console.log('');
  console.log(`${'VERDICT'.padEnd(20)}  ${'FREES'.padStart(10)}  ${'APPARENT'.padStart(10)}  PATH`);

  const candidates = [];
  const missing = [];
  const never = [];

  for (const record of records) {
    const path = canonical(record.path);

    if (!isUnder(root, path)) continue;

    if (record === records[0]) never.push({ path, why: 'the main checkout' });
    else if (samePath(path, here)) never.push({ path, why: 'the worktree this runs from' });
    else if (!existsSync(path)) missing.push(path);
    else candidates.push(path);
  }

  const known = records.map((record) => canonical(record.path));
  const strays = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => join(root, entry.name))
    .filter((path) => !known.some((other) => samePath(other, path)));

  const byPath = (a, b) => display(a).toLowerCase().localeCompare(display(b).toLowerCase());
  const tally = new Map();
  const count = (label) => tally.set(label, (tally.get(label) ?? 0) + 1);
  const attempted = [];
  const failures = new Set();
  let removeExclusive = 0;
  let removeApparent = 0;

  for (const path of candidates.sort(byPath)) {
    process.stderr.write(`wt-cleanup: measuring ${display(path)}\n`);
    const sizes = measure(path);

    // Read again at the moment of judging: never the dry run's verdict, and
    // never the list as it stood when this run started.
    const record = worktrees(cwd).find((other) => samePath(canonical(other.path), path));

    if (record === undefined) {
      printRow('FOLDER MISSING', null, path, ['unregistered while this run was reading it; not touched']);
      continue;
    }

    const judged = classify(record, context);

    printRow(judged.verdict, sizes, path, judged.reason);
    count(judged.verdict);

    if (judged.verdict !== 'REMOVE') continue;

    removeExclusive += sizes.exclusive;
    removeApparent += sizes.apparent;

    if (!options.apply) continue;

    attempted.push({ path, sizes });
    const outcome = removeOne(path, context);

    console.log(`    ${outcome.line}`);
    if (!outcome.ok) failures.add(path);
  }

  for (const path of missing.sort(byPath)) {
    printRow('FOLDER MISSING', null, path, [
      'registered, but its folder is gone: `git worktree prune` (run by --apply) clears the registration',
    ]);
  }

  for (const path of strays.sort(byPath)) {
    process.stderr.write(`wt-cleanup: measuring ${display(path)}\n`);
    printRow('NOT A WORKTREE', measure(path), path, ['not a worktree, left alone']);
  }

  for (const { path, why } of never.sort((a, b) => byPath(a.path, b.path))) {
    printRow('NEVER A CANDIDATE', null, path, [why]);
  }

  console.log('');

  if (options.apply) {
    const prune = git(['worktree', 'prune'], cwd);

    console.log(`git worktree prune exited ${prune.status}${prune.status === 0 ? '' : `: ${prune.stderr}`}`);
    if (prune.status !== 0) failures.add('git worktree prune');

    console.log('');
    console.log('CONFIRMATION (gone = absent from `git worktree list` AND from the disk)');

    let freed = 0;

    for (const { path, sizes } of attempted) {
      const listed = registered(cwd, path);
      const onDisk = existsSync(path);

      if (!listed && !onDisk) {
        freed += sizes.exclusive;
        console.log(`GONE      ${display(path)}`);
        continue;
      }

      failures.add(path);
      console.log(
        `NOT GONE  ${display(path)}: ${
          listed
            ? 'still registered'
            : 'unregistered, but its folder is still on disk; a later run reads it as NOT A WORKTREE'
        }`,
      );
    }

    console.log('');
    console.log(`TOTAL   freed ${bytes(freed)}: the FREES of the worktrees confirmed GONE`);
  } else {
    console.log(
      `TOTAL   --apply would free ${bytes(removeExclusive)}: the FREES of ${tally.get('REMOVE') ?? 0} REMOVE ` +
        'row(s), files with no other hard link.',
    );
    console.log(
      `        Their APPARENT size is ${bytes(removeApparent)}; the rest is hard-linked elsewhere ` +
        '(the pnpm store, other worktrees) and stays on disk.',
    );
  }

  const refused = [...tally].filter(([label]) => label.startsWith('REFUSED')).reduce((sum, [, n]) => sum + n, 0);
  const code = failures.size > 0 ? EXIT_FAILED : refused > 0 ? EXIT_REFUSED : 0;
  const summary = [...tally].map(([label, n]) => `${n} ${label}`).join(', ') || 'no candidates';

  console.log(
    `RESULT  ${summary}${failures.size > 0 ? `; ${failures.size} FAILED` : ''} -> exit ${code}` +
      (code === EXIT_REFUSED ? ' (R392: a refusal is non-zero and names its reason)' : ''),
  );

  return code;
}

try {
  process.exitCode = main();
} catch (error) {
  if (!(error instanceof NoResult)) throw error;
  console.error(`wt-cleanup: NO RESULT - ${error.message}`);
  process.exitCode = EXIT_FAILED;
}
