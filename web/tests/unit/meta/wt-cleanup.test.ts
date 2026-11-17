// web/tests/unit/meta/wt-cleanup.test.ts
//
// R1037 (FW-WT-CLEANUP, amended by Web Ruling 21): scripts/wt-cleanup.mjs,
// the script R392 parked, judged in SCRATCH repositories.
//
// ============================================================================
// EVERYTHING HERE IS BUILT IN A TEMP DIRECTORY, NEVER UNDER C:/wt
// ============================================================================
//
// Each fixture is a bare repository standing in for origin, a main checkout,
// and worktrees under a temp root passed as --root. The script runs as a
// child process with its cwd in the scratch repository - the entry point,
// not an imported function (R204) - and every run first asserts that the
// repository it is about to act on lives inside the scratch directory, so a
// wrong cwd fails the test instead of judging the real repository. Every
// fixture passes --no-fetch except the one that proves the fetch.
//
// ============================================================================
// ONE STATE PER WORKTREE, SO EACH REFUSAL CAN BE PLANTED OFF (R180)
// ============================================================================
//
// A refused worktree is otherwise removable: merged, clean, pushed, unlocked
// and old enough. The scratch .gitignore is the REAL one, so the lock file is
// ignored exactly as it is on this machine; without that, the dirty check
// would refuse the locked worktree too and turning the lock check off would
// change nothing visible. The main checkout and the caller sit UNDER the root,
// so it is their identity that excludes them and not the root filter.
//
// ============================================================================
// WHAT WEB RULING 21 ADDED, AND WHAT THIS MACHINE ALLOWS
// ============================================================================
//
// Measured on this machine (Git for Windows 2.49): `git worktree remove`
// FOLLOWS a directory junction and deletes what it points at, and it stops
// midway on a pnpm tree ("Directory not empty") or on a path longer than
// MAX_PATH ("Filename too long") - unregistering the worktree anyway and
// leaving its folder on disk. So the fixtures carry a junction to a SENTINEL
// outside the worktree, and a path deeper than MAX_PATH that git cannot
// delete and the script must finish.
//
// A JUNCTION, NOT A SYMLINK: creating a file or directory symlink here fails
// with EPERM (no symlink privilege), while a junction needs none. A junction
// can only name a directory, so it points at the sentinel's directory. On a
// platform without junctions Node makes the same call a plain symlink.

import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = process.cwd();
const SCRIPT = join(PACKAGE_ROOT, 'scripts', 'wt-cleanup.mjs');
const REAL_GITIGNORE = readFileSync(join(PACKAGE_ROOT, '..', '.gitignore'), 'utf8');

/** The keep marker's entry in the real .gitignore (R1038). */
const KEEP_ENTRY = '/.wt-keep';

/**
 * The script's stated minimum age (R345: a value, set and asserted). A
 * worktree younger than this is refused: a new session's worktree is merged,
 * clean and unlocked in the seconds before its lock is written.
 */
const MIN_AGE_MINUTES = 60;

/** Backdated this far, a fixture worktree is judged on everything but age. */
const OLD = new Date(Date.now() - 3 * 60 * 60 * 1000);

/** Stated, not inherited (R345): vitest's hook default is 10 s. */
const SETUP_TIMEOUT_MS = 240_000;
const RUN_TIMEOUT_MS = 120_000;

const SENTINEL = 'sentinel: this file lives OUTSIDE every worktree\n';

/** A child never inherits a GIT_* variable that could aim it at the real repository. */
const ENV: NodeJS.ProcessEnv = { ...process.env };

for (const key of Object.keys(ENV)) {
  if (key.toUpperCase().startsWith('GIT_')) delete ENV[key];
}

const made: string[] = [];

afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function isUnder(root: string, path: string): boolean {
  const rel = relative(root, path);

  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

const normalise = (path: string): string =>
  path.replace(/\\/gu, '/').replace(/\/+$/u, '').toLowerCase();

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** The real .gitignore without R1038's line: every worktree checked out before it. */
function withoutKeepEntry(source: string): string {
  return source
    .split('\n')
    .filter((line) => line.trim() !== KEEP_ENTRY)
    .join('\n');
}

function tempDir(label: string): string {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), `wt-cleanup-${label}-`)));

  made.push(dir);

  // Launch rule 10: a test builds its repositories in TEMP, never under C:/wt.
  expect(isUnder('C:/wt', dir), `${dir} is under C:/wt`).toBe(false);

  return dir;
}

interface Scratch {
  /** The temp directory: everything below it is this test's. */
  readonly base: string;
  /** Passed as --root. */
  readonly root: string;
  /** The main checkout, UNDER the root. */
  readonly main: string;
  /** A bare repository, the scratch's origin. */
  readonly origin: string;
}

function scratch(label: string, gitignore: string): Scratch {
  const base = tempDir(label);
  const origin = join(base, 'origin.git');
  const root = join(base, 'root');
  const main = join(root, 'main');

  mkdirSync(root);
  git(base, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  git(root, 'init', '--quiet', '--initial-branch=main', main);
  git(main, 'config', 'user.email', 'r1037@example.invalid');
  git(main, 'config', 'user.name', 'R1037');
  git(main, 'config', 'core.autocrlf', 'false');
  // Stated, so a global core.longpaths=true cannot quietly turn the deep
  // fixture into one git deletes on its own.
  git(main, 'config', 'core.longpaths', 'false');
  writeFileSync(join(main, '.gitignore'), gitignore);
  writeFileSync(join(main, 'README.md'), 'scratch\n');
  git(main, 'add', '.gitignore', 'README.md');
  git(main, 'commit', '--quiet', '-m', 'init');
  git(main, 'remote', 'add', 'origin', origin);
  git(main, 'push', '--quiet', '-u', 'origin', 'main');

  return { base, root, main, origin };
}

/** A worktree on a new branch at origin/main: merged, clean and pushed. */
function worktree(s: Scratch, name: string, parent: string = s.root): string {
  const path = join(parent, name);

  git(s.main, 'worktree', 'add', '--quiet', '-b', name, path, 'origin/main');

  return path;
}

/** The same, made old enough that age is not what decides it. */
function oldWorktree(s: Scratch, name: string, parent: string = s.root): string {
  const path = worktree(s, name, parent);

  utimesSync(join(path, '.git'), OLD, OLD);

  return path;
}

function commit(dir: string, file: string): void {
  writeFileSync(join(dir, file), `${file}\n`);
  git(dir, 'add', file);
  git(dir, 'commit', '--quiet', '-m', file);
}

function listed(s: Scratch): Set<string> {
  return new Set(
    git(s.main, 'worktree', 'list', '--porcelain')
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => normalise(line.slice('worktree '.length).trim())),
  );
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function cli(s: Scratch, cwd: string, flags: readonly string[]): Run {
  // The guard that keeps every run on the scratch repository: `git worktree
  // prune` is repository-wide, so a run aimed at the real one would reach
  // past any root.
  const common = resolve(cwd, git(cwd, 'rev-parse', '--git-common-dir').trim());

  expect(isUnder(s.base, common), `${cwd} belongs to ${common}, outside the scratch`).toBe(true);

  const result = spawnSync(process.execPath, [SCRIPT, '--root', s.root, ...flags], {
    cwd,
    encoding: 'utf8',
    env: ENV,
    timeout: RUN_TIMEOUT_MS,
  });

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The labels the table prints, verdicts first. */
const LABELS = [
  'REMOVE',
  'REFUSED (lock)',
  'REFUSED (dirty)',
  'REFUSED (unpushed)',
  'REFUSED (young)',
  'KEPT',
  'SKIPPED (not merged)',
  'NOT A WORKTREE',
  'NEVER A CANDIDATE',
  'FOLDER MISSING',
] as const;

interface Row {
  readonly label: string;
  readonly details: readonly string[];
}

const ROW = new RegExp(
  `^(${LABELS.map((label) => label.replace(/[()]/gu, '\\$&')).join('|')})\\s{2,}` +
    '(\\S+(?: \\S+)?)\\s{2,}(\\S+(?: \\S+)?)\\s{2,}(.+)$',
  'u',
);

/** Each table row, by its normalised path, with the indented lines under it. */
function rows(output: string): Map<string, Row> {
  const found = new Map<string, Row>();
  let current: { label: string; details: string[] } | null = null;

  for (const line of output.split(/\r?\n/u)) {
    const match = ROW.exec(line);

    if (match !== null) {
      current = { label: match[1] ?? '', details: [] };
      found.set(normalise(match[4] ?? ''), current);
      continue;
    }

    if (current !== null && line.startsWith('    ')) {
      current.details.push(line.trim());
      continue;
    }

    current = null;
  }

  return found;
}

function row(output: string, path: string): Row {
  const found = rows(output).get(normalise(path));

  expect(found, `no table row for ${path} in:\n${output}`).toBeDefined();

  return found ?? { label: '', details: [] };
}

/** The paths the confirmation reports GONE. */
function gone(output: string): Set<string> {
  return new Set(
    output
      .split(/\r?\n/u)
      .map((line) => /^GONE\s+(.+)$/u.exec(line)?.[1])
      .filter((path): path is string => path !== undefined)
      .map(normalise),
  );
}

describe('wt-cleanup: a root where nothing is refused (R1036, R1037)', () => {
  let s: Scratch;
  let caller: string;
  let merged: string;
  let linked: string;
  let deep: string;
  let deepLeaf: string;
  let kept: string;
  let unmerged: string;
  let stray: string;
  let probe: string;
  let missing: string;
  let sentinel: string;
  let keptStatus: string;
  let linkedStatus: string;
  let before: Set<string>;
  let dry: Run;
  let afterDry: Set<string>;
  let onDiskAfterDry: string[];
  let apply: Run;
  let afterApply: Set<string>;

  beforeAll(() => {
    s = scratch('clean', withoutKeepEntry(REAL_GITIGNORE));
    caller = oldWorktree(s, 'caller');
    merged = oldWorktree(s, 'merged');

    // pnpm's shape - a junction inside the tree - plus the hazard: a junction
    // out of it, at a directory holding the sentinel.
    linked = oldWorktree(s, 'linked');
    const modules = join(linked, 'node_modules');
    mkdirSync(join(modules, '.pnpm', 'pkg'), { recursive: true });
    writeFileSync(join(modules, '.pnpm', 'pkg', 'index.js'), 'module.exports = 1;\n');
    symlinkSync(join(modules, '.pnpm', 'pkg'), join(modules, 'pkg'), 'junction');
    const outside = join(s.base, 'outside');
    mkdirSync(outside);
    sentinel = join(outside, 'sentinel.txt');
    writeFileSync(sentinel, SENTINEL);
    symlinkSync(outside, join(modules, 'escape'), 'junction');
    linkedStatus = git(linked, 'status', '--porcelain');

    // A path git cannot delete without core.longpaths: it unregisters the
    // worktree and leaves the folder, which the script must then finish.
    deep = oldWorktree(s, 'deep');
    let nested = join(deep, 'node_modules');
    while (nested.length < 300) nested = join(nested, 'd'.repeat(40));
    mkdirSync(nested, { recursive: true });
    deepLeaf = join(nested, 'leaf.txt');
    writeFileSync(deepLeaf, 'deeper than MAX_PATH\n');

    kept = oldWorktree(s, 'kept');
    writeFileSync(join(kept, '.wt-keep'), 'evidence for REPORT-R1037\n');
    keptStatus = git(kept, 'status', '--porcelain');

    unmerged = oldWorktree(s, 'unmerged');
    commit(unmerged, 'feature.txt');
    git(unmerged, 'push', '--quiet', '-u', 'origin', 'unmerged');

    stray = join(s.root, 'stray');
    mkdirSync(stray);
    writeFileSync(join(stray, 'notes.txt'), 'a folder nobody registered\n');

    // A sibling whose name starts with the root's: C:/wt-probe beside C:/wt.
    probe = oldWorktree(s, 'root-probe', s.base);

    missing = oldWorktree(s, 'missing');
    rmSync(missing, { recursive: true, force: true });

    before = listed(s);
    dry = cli(s, caller, ['--no-fetch']);
    afterDry = listed(s);
    // Read now: --apply runs next, in this same hook.
    onDiskAfterDry = [merged, linked, deep, deepLeaf, kept, unmerged, caller, stray, sentinel].filter(
      (path) => existsSync(path),
    );
    apply = cli(s, caller, ['--no-fetch', '--apply']);
    afterApply = listed(s);
  }, SETUP_TIMEOUT_MS);

  it('the fixtures are what they claim', () => {
    expect(linkedStatus, 'the junctions sit in an ignored folder').toBe('');
    expect(deepLeaf.length, 'the deep path is longer than MAX_PATH').toBeGreaterThan(260);
    // The marker is untracked here, as in every worktree checked out before
    // R1038's .gitignore line: the script must still read it as a keep.
    expect(keptStatus.trim()).toBe('?? .wt-keep');
    expect(before.size).toBe(9);
  });

  it('the dry run exits 0 when nothing is refused', () => {
    expect(dry.status, dry.stdout + dry.stderr).toBe(0);
  });

  it('merged, clean, pushed, unlocked and old: REMOVE', () => {
    expect(row(dry.stdout, merged).label).toBe('REMOVE');
    expect(row(dry.stdout, linked).label).toBe('REMOVE');
    expect(row(dry.stdout, deep).label).toBe('REMOVE');
  });

  it('a keep marker: KEPT, with its content as the reason', () => {
    const keptRow = row(dry.stdout, kept);

    expect(keptRow.label).toBe('KEPT');
    expect(keptRow.details.join('\n')).toContain('evidence for REPORT-R1037');
  });

  it('not merged into origin/main: SKIPPED', () => {
    expect(row(dry.stdout, unmerged).label).toBe('SKIPPED (not merged)');
  });

  it('the main checkout and the worktree it runs from are never candidates', () => {
    const mainRow = row(dry.stdout, s.main);
    const callerRow = row(dry.stdout, caller);

    expect(mainRow.label).toBe('NEVER A CANDIDATE');
    expect(mainRow.details.join('\n')).toContain('the main checkout');
    expect(callerRow.label).toBe('NEVER A CANDIDATE');
    expect(callerRow.details.join('\n')).toContain('the worktree this runs from');
  });

  it('a folder under the root that is not a worktree is reported and left alone', () => {
    const strayRow = row(dry.stdout, stray);

    expect(strayRow.label).toBe('NOT A WORKTREE');
    expect(strayRow.details.join('\n')).toContain('not a worktree, left alone');
    expect(readFileSync(join(stray, 'notes.txt'), 'utf8')).toBe('a folder nobody registered\n');
  });

  it('nothing outside the root is judged, not even a sibling sharing its prefix', () => {
    // Presence first (R169's corollary): an empty table has no probe row either.
    expect(rows(dry.stdout).size, dry.stdout).toBeGreaterThanOrEqual(8);
    expect(rows(dry.stdout).has(normalise(probe))).toBe(false);
    expect(rows(apply.stdout).has(normalise(probe))).toBe(false);
    expect(existsSync(join(probe, 'README.md'))).toBe(true);
    expect(afterApply.has(normalise(probe))).toBe(true);
  });

  it('a registered worktree whose folder is gone is reported, and --apply prunes it', () => {
    expect(row(dry.stdout, missing).label).toBe('FOLDER MISSING');
    expect(afterDry.has(normalise(missing))).toBe(true);
    expect(afterApply.has(normalise(missing))).toBe(false);
  });

  it('the dry run removes nothing', () => {
    expect([...afterDry].sort()).toEqual([...before].sort());
    expect(onDiskAfterDry).toEqual([merged, linked, deep, deepLeaf, kept, unmerged, caller, stray, sentinel]);
    expect(dry.stdout).not.toMatch(/^GONE/mu);
    expect(dry.stdout).not.toContain('apply:');
  });

  it('--apply exits 0 and removes exactly the REMOVE rows: off the list AND off the disk', () => {
    expect(apply.status, apply.stdout + apply.stderr).toBe(0);

    for (const path of [merged, linked, deep]) {
      expect(afterApply.has(normalise(path)), `${path} is still registered`).toBe(false);
      expect(existsSync(path), `${path} is still on disk`).toBe(false);
      expect(gone(apply.stdout).has(normalise(path)), `${path} is not confirmed GONE`).toBe(true);
    }

    for (const path of [kept, unmerged, caller, s.main]) {
      expect(afterApply.has(normalise(path)), `${path} was unregistered`).toBe(true);
      expect(existsSync(path), `${path} was deleted`).toBe(true);
    }

    expect(existsSync(stray)).toBe(true);
  });

  it('a junction out of the worktree is removed as a link: the sentinel survives', () => {
    expect(existsSync(linked)).toBe(false);
    expect(readFileSync(sentinel, 'utf8')).toBe(SENTINEL);
  });

  it('git cannot delete past MAX_PATH; the script finishes what git unregistered', () => {
    const details = row(apply.stdout, deep).details.join('\n');

    if (process.platform === 'win32') {
      // The condition the fallback exists for, asserted so this case cannot
      // pass on a run where git deleted everything by itself.
      expect(details).toMatch(/git worktree remove exited [1-9]/u);
      expect(details).toContain('finished the delete');
    }

    expect(existsSync(deep)).toBe(false);
  });
});

describe('wt-cleanup: every refusal (R392, R1036, Web Ruling 21)', () => {
  let s: Scratch;
  let locked: string;
  let gitLocked: string;
  let modified: string;
  let untracked: string;
  let unpushed: string;
  let young: string;
  let merged: string;
  let lateLock: string;
  let lockedStatus: string;
  let before: Set<string>;
  let dry: Run;
  let afterDry: Set<string>;
  let apply: Run;
  let afterApply: Set<string>;

  beforeAll(() => {
    s = scratch('refused', withoutKeepEntry(REAL_GITIGNORE));

    locked = oldWorktree(s, 'locked');
    writeFileSync(join(locked, '.session-lock.json'), '{"session":"TEST-HOLDER"}\n');
    lockedStatus = git(locked, 'status', '--porcelain');

    gitLocked = oldWorktree(s, 'git-locked');
    git(s.main, 'worktree', 'lock', '--reason', 'held by the test', gitLocked);

    modified = oldWorktree(s, 'modified');
    writeFileSync(join(modified, 'README.md'), 'changed\n');

    untracked = oldWorktree(s, 'untracked');
    writeFileSync(join(untracked, 'notes.txt'), 'not added\n');

    unpushed = oldWorktree(s, 'unpushed');
    commit(unpushed, 'local.txt');

    young = worktree(s, 'young');

    merged = oldWorktree(s, 'merged');
    lateLock = oldWorktree(s, 'late-lock');

    before = listed(s);
    dry = cli(s, s.main, ['--no-fetch']);
    afterDry = listed(s);

    // Between the dry run and --apply, a session takes the worktree.
    writeFileSync(join(lateLock, '.session-lock.json'), '{"session":"LATE-HOLDER"}\n');

    apply = cli(s, s.main, ['--no-fetch', '--apply']);
    afterApply = listed(s);
  }, SETUP_TIMEOUT_MS);

  it('the lock fixture is otherwise removable: its lock file is ignored', () => {
    expect(lockedStatus).toBe('');
  });

  it('the dry run exits 1: a refusal is non-zero (R392)', () => {
    expect(dry.status, dry.stdout + dry.stderr).toBe(1);
  });

  it('a .session-lock.json: REFUSED (lock), naming the holder', () => {
    const lockedRow = row(dry.stdout, locked);

    expect(lockedRow.label).toBe('REFUSED (lock)');
    expect(lockedRow.details.join('\n')).toContain('TEST-HOLDER');
  });

  it('a git worktree lock: REFUSED (lock), with its reason', () => {
    const gitRow = row(dry.stdout, gitLocked);

    expect(gitRow.label).toBe('REFUSED (lock)');
    expect(gitRow.details.join('\n')).toContain('held by the test');
  });

  it('a modified tracked file: REFUSED (dirty), listing the path', () => {
    const dirtyRow = row(dry.stdout, modified);

    expect(dirtyRow.label).toBe('REFUSED (dirty)');
    expect(dirtyRow.details).toContain('M README.md');
  });

  it('an untracked file: REFUSED (dirty), listing the path', () => {
    const dirtyRow = row(dry.stdout, untracked);

    expect(dirtyRow.label).toBe('REFUSED (dirty)');
    expect(dirtyRow.details).toContain('?? notes.txt');
  });

  it('a commit in no remote-tracking ref: REFUSED (unpushed)', () => {
    expect(row(dry.stdout, unpushed).label).toBe('REFUSED (unpushed)');
  });

  it(`younger than the stated minimum of ${MIN_AGE_MINUTES} min: REFUSED (young)`, () => {
    const youngRow = row(dry.stdout, young);

    expect(dry.stdout).toMatch(new RegExp(`minimum age\\s+${MIN_AGE_MINUTES} min`, 'u'));
    expect(youngRow.label).toBe('REFUSED (young)');
    expect(youngRow.details.join('\n')).toContain(`${MIN_AGE_MINUTES} min`);
  });

  it('the dry run removes nothing', () => {
    expect([...afterDry].sort()).toEqual([...before].sort());
    expect(row(dry.stdout, merged).label).toBe('REMOVE');
    expect(row(dry.stdout, lateLock).label).toBe('REMOVE');
  });

  it('--apply exits 1, keeps every refused worktree, and still removes the REMOVE row', () => {
    expect(apply.status, apply.stdout + apply.stderr).toBe(1);

    for (const path of [locked, gitLocked, modified, untracked, unpushed, young]) {
      expect(afterApply.has(normalise(path)), `${path} was unregistered`).toBe(true);
      expect(existsSync(path), `${path} was deleted`).toBe(true);
    }

    expect(readFileSync(join(modified, 'README.md'), 'utf8')).toBe('changed\n');
    expect(readFileSync(join(untracked, 'notes.txt'), 'utf8')).toBe('not added\n');
    expect(afterApply.has(normalise(merged))).toBe(false);
    expect(existsSync(merged)).toBe(false);
    expect(gone(apply.stdout).has(normalise(merged))).toBe(true);
  });

  it('--apply recomputes every verdict: a lock written after the dry run is honoured', () => {
    const lateRow = row(apply.stdout, lateLock);

    expect(lateRow.label).toBe('REFUSED (lock)');
    expect(lateRow.details.join('\n')).toContain('LATE-HOLDER');
    expect(afterApply.has(normalise(lateLock))).toBe(true);
    expect(existsSync(join(lateLock, 'README.md'))).toBe(true);
  });
});

describe('wt-cleanup: "merged" is judged against a FETCHED origin/main', () => {
  let s: Scratch;
  let late: string;
  let stale: Run;
  let fetched: Run;

  beforeAll(() => {
    s = scratch('fetch', withoutKeepEntry(REAL_GITIGNORE));
    late = oldWorktree(s, 'late');
    commit(late, 'late.txt');
    git(late, 'push', '--quiet', '-u', 'origin', 'late');

    // Merged on origin by somebody else: only a fetch can see it.
    const elsewhere = join(s.base, 'elsewhere');
    git(s.base, 'clone', '--quiet', s.origin, elsewhere);
    git(elsewhere, 'merge', '--quiet', '--ff-only', 'origin/late');
    git(elsewhere, 'push', '--quiet', 'origin', 'main');

    stale = cli(s, s.main, ['--no-fetch']);
    fetched = cli(s, s.main, []);
  }, SETUP_TIMEOUT_MS);

  it('without the fetch, the merge is invisible: SKIPPED', () => {
    expect(stale.status, stale.stdout + stale.stderr).toBe(0);
    expect(row(stale.stdout, late).label).toBe('SKIPPED (not merged)');
  });

  it('the default run fetches origin first, and then it is REMOVE', () => {
    expect(fetched.status, fetched.stdout + fetched.stderr).toBe(0);
    expect(fetched.stdout).toContain('(fetched');
    expect(row(fetched.stdout, late).label).toBe('REMOVE');
  });
});

describe('wt-cleanup: the .gitignore line and the command line', () => {
  function committed(label: string, gitignore: string): string {
    const dir = tempDir(label);

    git(dir, 'init', '--quiet', '--initial-branch=main');
    git(dir, 'config', 'user.email', 'r1038@example.invalid');
    git(dir, 'config', 'user.name', 'R1038');
    writeFileSync(join(dir, '.gitignore'), gitignore);
    git(dir, 'add', '.gitignore');
    git(dir, 'commit', '--quiet', '-m', 'gitignore');
    writeFileSync(join(dir, '.wt-keep'), 'kept for a reason\n');

    return git(dir, 'status', '--porcelain');
  }

  it('the real .gitignore carries the keep marker exactly once (R1038)', () => {
    const entries = REAL_GITIGNORE.split('\n').filter((line) => line.trim() === KEEP_ENTRY);

    expect(entries).toHaveLength(1);
  });

  it('with the real .gitignore a kept worktree stays clean; without the line it would not', () => {
    expect(committed('ignore-real', REAL_GITIGNORE)).toBe('');
    expect(committed('ignore-old', withoutKeepEntry(REAL_GITIGNORE)).trim()).toBe('?? .wt-keep');
  }, SETUP_TIMEOUT_MS);

  it('an unknown flag is a usage error, and nothing runs', () => {
    // A directory that is no repository: if parsing ever fell through, git
    // would have nothing to act on.
    const result = spawnSync(process.execPath, [SCRIPT, '--force'], {
      cwd: tempDir('usage'),
      encoding: 'utf8',
      env: ENV,
      timeout: RUN_TIMEOUT_MS,
    });

    expect(result.status).toBe(64);
    expect(result.stdout + result.stderr).toContain('usage:');
  });
});
