// web/tests/unit/meta/mint-readback-guard.test.ts
//
// ============================================================================
// R966-R967: THE TWO TRACKED "NOT COMMITTED" SCRIPTS - ONE GUARDED, ONE REMOVED
// ============================================================================
//
// 65c0af6 (FW-SHELL-BURGER, 2026-10-12) committed web/scripts/_mint-readback.mjs
// and web/scripts/_wt-setup.mjs together with other work "found uncommitted in
// the tree". Each was headed as a throwaway that was never to be committed, and
// each wrote to whatever DATABASE_URL named, outside test:db's guard (C6's
// NOTICED, Queue Ruling 9).
//
//   _mint-readback.mjs is KEPT AND GUARDED. A later, unrelated session ran it
//   (FW-DOSSIER-EMPTY, 2026-10-25), so its purpose is not shown to be spent.
//   It now refuses unless DATABASE_URL names a database test:db's guard would
//   admit, judged by the pattern's one home (lib/db/scratch-database.mjs).
//
//   _wt-setup.mjs is REMOVED. Nothing ran it after the device walkthrough
//   that wrote it (2026-10-11, PARKAN-43, closed), and nothing depends on the
//   accounts it made. The census at the bottom proves no reference is left
//   dangling.
//
// BOTH DIRECTIONS (R196). A guard that refuses everything passes every refusal
// test, so the admitted direction is asserted by a line the script prints ONLY
// when the guard admits. And an UNGUARDED script pointed at an unreachable
// host also exits non-zero - on the connection failure - so the exit code
// cannot tell a refusal from a crash: a refusal is asserted by its text, the
// database it names, and the absence of any driver error.
//
// NEVER A REAL SERVER. Every URL here, refused or admitted, is on a host under
// `.invalid` (RFC 6761), which never resolves, and PGHOST points there too, so
// a run with no DATABASE_URL cannot fall back to a local server either. If the
// guard ever regresses, the worst this file can do is fail to resolve a name.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  SCRATCH_DATABASE_HOME,
  SCRATCH_DATABASE_PATTERN,
  SCRATCH_DATABASE_PREFIX,
} from '../../../lib/db/scratch-database.mjs';

const WEB = join(import.meta.dirname, '..', '..', '..');
const REPO = join(WEB, '..');
const SCRIPT = join(WEB, 'scripts', '_mint-readback.mjs');
const REMOVED = join(WEB, 'scripts', '_wt-setup.mjs');

const UNREACHABLE = 'db.invalid';
const PASSWORD = 'a-password-that-must-not-print';

/** A connection string naming `database`, on a host that never resolves. */
const naming = (database: string): string =>
  `postgresql://frontalier:${PASSWORD}@${UNREACHABLE}:5436/${database}?schema=public`;

/** The line the script prints only when the guard admits, naming the database. */
const ADMITTED = /_mint-readback: DATABASE_URL names "([^"]+)", a scratch database/u;

/**
 * What a driver, or Prisma above it, says when it tried to reach a server. The
 * unguarded script pointed at db.invalid printed DriverAdapterError,
 * DatabaseNotReachable and P1001 (measured on this file's RED run).
 */
const DRIVER_ERROR =
  /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|getaddrinfo|DriverAdapterError|DatabaseNotReachable|P1001|PrismaClient\w*Error/u;

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** The guard admitted and the run was stopped there: what follows is a connection attempt. */
  readonly stoppedAfterAdmit: boolean;
  readonly timedOut: boolean;
}

/**
 * Run the script with DATABASE_URL set to `url` (or unset), in a process that
 * cannot reach any server. No web/.env is read: plain `node` loads none, and
 * the script reads the variable once, before anything else.
 */
function runScript(url: string | undefined): Promise<Run> {
  const env: NodeJS.ProcessEnv = { ...process.env, PGHOST: UNREACHABLE, PGPORT: '5436', PGDATABASE: 'frontalier' };

  delete env.DATABASE_URL;
  if (url !== undefined) env.DATABASE_URL = url;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], { cwd: WEB, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let stoppedAfterAdmit = false;
    let timedOut = false;

    // A bound, so a regression that hangs on a connection fails here rather
    // than at vitest's timeout with nothing captured.
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 60_000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');

      // Past the verdict there is nothing under test here: the next step is a
      // connection to a host that never resolves.
      if (!stoppedAfterAdmit && ADMITTED.test(stderr)) {
        stoppedAfterAdmit = true;
        child.kill();
      }
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, stoppedAfterAdmit, timedOut });
    });
  });
}

/** A refusal, read from what the script printed rather than from its exit code. */
function expectRefused(run: Run, database: string | null): void {
  const everything = `${run.stdout}${run.stderr}`;

  expect(run.timedOut, everything).toBe(false);
  expect(run.stderr, everything).toMatch(/_mint-readback REFUSED \(R966\)/u);
  expect(run.stderr).toContain(`pointed at  ${database === null ? '(none)' : JSON.stringify(database)}`);
  // The pattern and its home come from the home, not from a copy (R206).
  expect(run.stderr).toContain(SCRATCH_DATABASE_PATTERN.source);
  expect(run.stderr).toContain(SCRATCH_DATABASE_HOME);
  // It stopped BEFORE connecting: no driver ever ran, and nothing was minted.
  expect(everything).not.toMatch(DRIVER_ERROR);
  expect(everything).not.toMatch(ADMITTED);
  expect(run.stdout).toBe('');
  expect(run.status, everything).toBe(1);
  // Never the URL, never its password.
  expect(everything).not.toContain(PASSWORD);
  expect(everything).not.toContain('postgresql://');
}

describe('R966: _mint-readback.mjs refuses a database that is not a scratch one', () => {
  it.each([
    ['the shared development database', naming('frontalier'), 'frontalier'],
    ['the maintenance database', naming('postgres'), 'postgres'],
    ['a test-looking name outside the pattern', naming('frontalier_test'), 'frontalier_test'],
    ['a scratch path with a dbname parameter naming the dev database', `${naming('monreleve_x')}&dbname=frontalier`, 'monreleve_x'],
  ])('%s', async (_why, url, database) => {
    expectRefused(await runScript(url), database);
  }, 90_000);

  it('DATABASE_URL unset (the driver would otherwise fall back to PGHOST or localhost)', async () => {
    const run = await runScript(undefined);

    expectRefused(run, null);
    expect(run.stderr).toMatch(/not set/u);
  }, 90_000);
});

describe('R966: and gets past the guard for a scratch one (so the refusals are not a guard that refuses everything)', () => {
  it.each([
    ['a session scratch database', 'monreleve_fw_wt_setup_guard'],
    ['the shape gate:clone uses', 'monreleve_gate_clone_4a65f426'],
  ])('%s (%s)', async (_who, database) => {
    const run = await runScript(naming(database));
    const everything = `${run.stdout}${run.stderr}`;

    expect(run.timedOut, everything).toBe(false);
    expect(run.stoppedAfterAdmit, everything).toBe(true);
    expect(ADMITTED.exec(run.stderr)?.[1]).toBe(database);
    expect(everything).not.toMatch(/REFUSED/u);
    expect(everything).not.toContain(PASSWORD);
  }, 90_000);
});

describe('R966: the guard is read from its one home (R206), before the client is loaded', () => {
  const source = readFileSync(SCRIPT, 'utf8');

  it('imports the judge from lib/db/scratch-database.mjs and carries no copy of the pattern', () => {
    expect(source).toMatch(/from '\.\.\/lib\/db\/scratch-database\.mjs'/u);
    expect(source).toMatch(/\bjudgeTestDatabase\(/u);
    expect(source).not.toContain(SCRATCH_DATABASE_PREFIX);
    expect(source).not.toContain(SCRATCH_DATABASE_PATTERN.source);
  });

  it('loads Prisma only after the verdict, so a refused run never loads a client at all', () => {
    // No static import of a client or adapter: those would load before the
    // verdict is reached. The dynamic ones come after the refusal's exit.
    expect(source).not.toMatch(/^import[^;]*from '@prisma\//mu);

    const exit = source.indexOf('process.exit(1)');
    const firstPrisma = source.search(/await import\('@prisma\//u);

    expect(exit).toBeGreaterThan(0);
    expect(firstPrisma).toBeGreaterThan(exit);
  });

  it('reads DATABASE_URL once: the value judged is the value the client connects with', () => {
    expect(source.match(/process\.env\.DATABASE_URL/gu)?.length).toBe(1);
  });
});

// ============================================================================
// R967: _wt-setup.mjs IS GONE, AND NOTHING LIVE STILL NAMES IT
// ============================================================================
//
// THE SURFACES: every tracked file (`git ls-files`), because a reference that
// could dangle is one something runs or follows - a package.json script, an
// import or spawn, a CI step, a Dockerfile line, a doc or the register telling
// a reader to run it. R246/R251's censuses cannot answer this: they enumerate
// the package ROOT's entry points and configs, and web/scripts/ is outside
// them.
//
// EXCLUDED BY NAME, WITH THE REASON:
//   REPORT-*.txt   session reports: each records what one session found or
//                  ran, on its date; history, never an instruction.
//   relay/**       session prompts, consumed once by their session, and the
//                  runs' records - including this parked task's own record.
//   this file      it has to name what it asserts is gone.
//
// ABSENCE NEEDS PRESENCE FIRST (R169's corollary). The same scanner, over the
// same surfaces, must FIND the kept script's name - its own path line - before
// "no file names _wt-setup" means anything; a scanner that reads nothing finds
// nothing for both.

const THIS_FILE = 'web/tests/unit/meta/mint-readback-guard.test.ts';

const isHistory = (path: string): boolean => /^REPORT-[^/]+\.txt$/u.test(path) || path.startsWith('relay/');

/** Contents nothing could follow as text. */
const BINARY = /\.(?:png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|jar|keystore|jks|zip|gz|pmtiles|apk|aab|so|bin)$/iu;

function liveSurfaces(): string[] {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return tracked
    .split('\0')
    .filter((path) => path !== '' && path !== THIS_FILE && !isHistory(path) && !BINARY.test(path));
}

/** Every live surface whose text contains `needle`. */
function filesNaming(needle: string, surfaces: readonly string[]): string[] {
  return surfaces.filter((path) => {
    let text: Buffer;

    try {
      text = readFileSync(join(REPO, path));
    } catch (error) {
      // A tracked path deleted in the working tree cannot be run or read.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }

    return !text.includes(0) && text.toString('utf8').includes(needle);
  });
}

describe('R967: _wt-setup.mjs is removed and no live reference is left dangling', () => {
  const surfaces = liveSurfaces();

  it('walked the repository, so nothing below passes vacuously', () => {
    expect(surfaces.length).toBeGreaterThan(1000);
    expect(surfaces).toContain('web/package.json');
    expect(surfaces).toContain('web/scripts/_mint-readback.mjs');
  });

  it('the same scanner FINDS the kept script by name (presence, before absence means anything)', () => {
    expect(filesNaming('_mint-readback', surfaces)).toContain('web/scripts/_mint-readback.mjs');
  });

  it('the file is gone', () => {
    expect(existsSync(REMOVED)).toBe(false);
  });

  it('no live surface names it', () => {
    expect(filesNaming('_wt-setup', surfaces)).toEqual([]);
  });
});
