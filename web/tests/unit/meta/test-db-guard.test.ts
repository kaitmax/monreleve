// web/tests/unit/meta/test-db-guard.test.ts
//
// ============================================================================
// R877 / R878: test:db REFUSES A DATABASE THAT IS NOT A SCRATCH ONE
// ============================================================================
//
// Every test:db file starts by EMPTYING the table it owns. The developer's
// web/.env points DATABASE_URL at the shared development database
// `frontalier`, so `pnpm test:db` run from a checkout that still holds that
// file emptied the developer's data. The rule "never run test:db against the
// dev database" existed only as a sentence in briefs; this file is the
// evidence that it is now a refusal.
//
// TWO HALVES, BOTH DIRECTIONS (R196's shape).
//
//   THE NAME CHECK. Which database a connection string names is read the way
//   node-postgres reads it - the URL path, decoded - and nothing else in the
//   URL may stand in for it. The near misses are the user, the host, the
//   schema parameter, a fragment, a database-naming query parameter, an empty
//   path (the driver then falls back to PGDATABASE or the user name), and
//   names that merely look scratch-like. Each is asserted REFUSED; the names
//   the gate's own scratch databases use are asserted ADMITTED, because a
//   check that refuses everything passes every refusal test perfectly.
//
//   THE WIRING (R204: the entry point is the unit under test). The check is
//   only worth something if the suite actually runs it, and before any test
//   file loads. So the real config is driven by a real vitest process: once
//   with a refused name, which must exit non-zero, print the refusal and load
//   no test file; once with an admitted name, which must get past the guard.
//   Neither run can reach a database: the host is under `.invalid` (RFC 6761),
//   which never resolves.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  SCRATCH_DATABASE_HOME,
  SCRATCH_DATABASE_PATTERN,
  SCRATCH_DATABASE_PREFIX,
  assertScratchTestDatabase,
  judgeTestDatabase,
  scratchDatabaseName,
  testDatabaseRefusal,
} from '../../../lib/db/scratch-database.mjs';

const WEB = join(import.meta.dirname, '..', '..', '..');

/** A local connection string naming `database` in the path, the shape web/.env uses. */
const local = (database: string, query = '?schema=public'): string =>
  `postgresql://frontalier:frontalier@localhost:5436/${database}${query}`;

describe('R877: the pattern', () => {
  it('is anchored on the whole name, so a scratch-looking substring is not enough', () => {
    expect(SCRATCH_DATABASE_PATTERN.source.startsWith('^')).toBe(true);
    expect(SCRATCH_DATABASE_PATTERN.source.endsWith('$')).toBe(true);
  });

  it('starts every admitted name with the prefix, and does not admit the prefix alone', () => {
    expect(SCRATCH_DATABASE_PATTERN.test(`${SCRATCH_DATABASE_PREFIX}x`)).toBe(true);
    expect(SCRATCH_DATABASE_PATTERN.test(SCRATCH_DATABASE_PREFIX)).toBe(false);
    expect(SCRATCH_DATABASE_PATTERN.test(`x${SCRATCH_DATABASE_PREFIX}x`)).toBe(false);
  });

  it('never admits the development database, the maintenance database or production\'s', () => {
    // `frontalier` is the shared dev database (web/.env.example, docker-compose.yml);
    // `postgres` is the maintenance database, and docs/deploy.md records it as
    // the name production's DATABASE_URL resolves to.
    for (const name of ['frontalier', 'postgres', 'template1']) {
      expect(SCRATCH_DATABASE_PATTERN.test(name), name).toBe(false);
    }
  });
});

describe('R878: names the guard ADMITS', () => {
  // The shapes the gate's own scratch databases use. The census in
  // scratch-database-census.test.ts derives the real list from the scripts;
  // these are the shapes, as inputs.
  it.each([
    ['gate:clone', 'monreleve_gate_clone_4a65f426'],
    ['the container e2e harness', 'monreleve_container_e2e'],
    ['the scheduler probe', 'monreleve_scheduler_probe'],
    ['the production write', 'monreleve_container_write'],
    ['the restore probe', 'monreleve_restore_probe'],
    ['a developer\'s own', 'monreleve_test_mine'],
  ])('%s (%s)', (_who, name) => {
    const verdict = judgeTestDatabase(local(name));

    expect(verdict).toEqual({ admitted: true, database: name, reason: null });
    expect(testDatabaseRefusal(local(name))).toBeNull();
    expect(() => assertScratchTestDatabase(local(name))).not.toThrow();
  });

  it('postgres:// as well as postgresql://, and with no query string', () => {
    expect(judgeTestDatabase('postgres://u:p@localhost:5436/monreleve_x').admitted).toBe(true);
    expect(judgeTestDatabase('postgresql://u:p@localhost:5436/monreleve_x').admitted).toBe(true);
  });

  it('a percent-encoded name the driver decodes to an admitted one, read as that name', () => {
    // node-postgres decodes the path with decodeURI, and `_` is not reserved,
    // so %5F reaches the server as `_`. The guard judges what the server sees.
    expect(judgeTestDatabase(local('monreleve%5Fx'))).toEqual({
      admitted: true,
      database: 'monreleve_x',
      reason: null,
    });
  });
});

describe('R878: near misses the guard REFUSES', () => {
  it.each([
    ['the shared development database', local('frontalier'), 'frontalier'],
    ['a test-looking name outside the pattern', local('frontalier_test'), 'frontalier_test'],
    ['the prefix word alone', local('monreleve'), 'monreleve'],
    ['the prefix with nothing after it', local('monreleve_'), 'monreleve_'],
    ['the maintenance database', local('postgres'), 'postgres'],
    ['upper case (a different database to PostgreSQL)', local('MONRELEVE_X'), 'MONRELEVE_X'],
    ['a hyphen', local('monreleve-x'), 'monreleve-x'],
    ['a trailing space', local('monreleve_x%20'), 'monreleve_x '],
    ['a statement smuggled into the name', local('monreleve_x;drop'), 'monreleve_x;drop'],
    ['a percent-encoded dev name', local('%66rontalier'), 'frontalier'],
    // decodeURI, as the driver uses, leaves a reserved character encoded.
    ['an encoded slash after a scratch name', local('monreleve_x%2Ffoo'), 'monreleve_x%2Ffoo'],
    ['a second path segment', local('monreleve_x/frontalier'), 'monreleve_x/frontalier'],
    ['a dot segment back to the dev database', local('monreleve_x/../frontalier'), 'frontalier'],
    ['longer than PostgreSQL keeps (63 bytes)', local(`monreleve_${'x'.repeat(54)}`), `monreleve_${'x'.repeat(54)}`],
  ])('%s', (_why, url, database) => {
    const verdict = judgeTestDatabase(url);

    expect(verdict.admitted).toBe(false);
    expect(verdict.database).toBe(database);
  });

  it.each([
    ['in the USER position', 'postgresql://monreleve_x:pw@localhost:5436/frontalier?schema=public'],
    ['in the HOST position', 'postgresql://u:pw@monreleve_x:5436/frontalier?schema=public'],
    ['in the SCHEMA parameter', 'postgresql://u:pw@localhost:5436/frontalier?schema=monreleve_x'],
    ['in the FRAGMENT', 'postgresql://u:pw@localhost:5436/frontalier#monreleve_x'],
    ['in the PASSWORD', 'postgresql://u:monreleve_x@localhost:5436/frontalier'],
  ])('a scratch name %s, with the dev database in the path', (_where, url) => {
    const verdict = judgeTestDatabase(url);

    expect(verdict.admitted).toBe(false);
    expect(verdict.database).toBe('frontalier');
  });

  it.each([
    ['database', local('monreleve_x', '?database=frontalier')],
    ['database (path dev, parameter scratch)', local('frontalier', '?database=monreleve_x')],
    ['dbname', local('monreleve_x', '?dbname=frontalier')],
    ['DBNAME, any case', local('monreleve_x', '?DBNAME=frontalier')],
    ['db', local('monreleve_x', '?db=frontalier')],
  ])('a database-naming query parameter: %s', (_param, url) => {
    // node-postgres lets the path win over ?database=; libpq-style clients read
    // ?dbname= as the database. A string two clients can read two ways is
    // refused rather than judged by one of them.
    const verdict = judgeTestDatabase(url);

    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toMatch(/parameter/u);
  });

  it.each([
    ['no path at all (the driver would use the user name, here a scratch-looking one)', 'postgresql://monreleve_x:pw@localhost:5436'],
    ['a bare slash', 'postgresql://monreleve_x:pw@localhost:5436/'],
    ['a bare slash and a schema', 'postgresql://u:pw@localhost:5436/?schema=monreleve_x'],
  ])('names no database: %s', (_why, url) => {
    const verdict = judgeTestDatabase(url);

    expect(verdict.admitted).toBe(false);
    expect(verdict.database).toBeNull();
  });

  it.each([
    ['unset', undefined],
    ['null', null],
    ['empty', ''],
    ['not a URL', 'not a url'],
    ['another protocol', 'mysql://u:p@localhost/monreleve_x'],
    ['node-postgres\'s socket form', 'socket:/var/run/postgresql?db=monreleve_x'],
    ['node-postgres\'s unix-path form', '/var/run/postgresql monreleve_x'],
  ])('cannot be judged: %s', (_why, url) => {
    const verdict = judgeTestDatabase(url);

    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toEqual(expect.any(String));
  });
});

describe('R877: the refusal message', () => {
  const PASSWORD = 'a-password-that-must-not-print';
  const URL_WITH_SECRET = `postgresql://frontalier:${PASSWORD}@localhost:5436/frontalier?schema=public`;

  it('names the database, the pattern, its home, and how to make a scratch database', () => {
    const message = testDatabaseRefusal(URL_WITH_SECRET);

    expect(message).not.toBeNull();
    expect(message).toContain('"frontalier"');
    expect(message).toContain(SCRATCH_DATABASE_PATTERN.source);
    expect(message).toContain(SCRATCH_DATABASE_HOME);
    expect(message).toMatch(/CREATE DATABASE monreleve_/u);
    expect(message).toMatch(/db:deploy/u);
  });

  it('never prints the URL or its password', () => {
    const message = testDatabaseRefusal(URL_WITH_SECRET) ?? '';

    expect(message).not.toContain(PASSWORD);
    expect(message).not.toContain('postgresql://');
  });

  it('says the variable is unset, rather than naming a database, when it is', () => {
    expect(testDatabaseRefusal(undefined)).toMatch(/not set/u);
  });

  it('is what assertScratchTestDatabase throws', () => {
    expect(() => assertScratchTestDatabase(URL_WITH_SECRET)).toThrow(
      testDatabaseRefusal(URL_WITH_SECRET) ?? 'unreachable',
    );
  });
});

describe('R877: scratchDatabaseName, the way a script takes its name from the home', () => {
  it('builds an admitted name from a suffix', () => {
    const name = scratchDatabaseName('gate_clone_4a65f426');

    expect(name.startsWith(SCRATCH_DATABASE_PREFIX)).toBe(true);
    expect(SCRATCH_DATABASE_PATTERN.test(name)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['a hyphen', 'gate-clone'],
    ['upper case', 'Gate'],
    ['too long', 'x'.repeat(54)],
  ])('refuses a suffix that would leave the pattern: %s', (_why, suffix) => {
    expect(() => scratchDatabaseName(suffix)).toThrow(/scratch/u);
  });
});

// ============================================================================
// THE WIRING: the real config, in a real vitest process
// ============================================================================

/**
 * Run vitest on the database config with DATABASE_URL set to `url`, and no
 * web/.env: `node --env-file-if-exists=.env` is what `pnpm test:db` adds, and
 * leaving it out means the URL given here is the only one the process sees.
 */
function runDatabaseConfig(url: string, extra: readonly string[] = []) {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url };

  const result = spawnSync(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.db.config.ts', ...extra],
    { cwd: WEB, env, encoding: 'utf8', timeout: 90_000 },
  );

  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

describe('R877: the refusal happens before any test file runs (the real config)', () => {
  it(
    'a refused name: non-zero exit, the refusal printed, no test file loaded',
    () => {
      const { status, output } = runDatabaseConfig(
        'postgresql://frontalier:frontalier@db.invalid:5436/frontalier?schema=public',
      );

      expect(status, output).not.toBe(0);
      expect(status, 'the spawn timed out: the guard did not stop the run').not.toBeNull();
      expect(output).toMatch(/test:db REFUSED/u);
      expect(output).toContain('"frontalier"');
      // No test file was collected, let alone run.
      expect(output).not.toMatch(/Test Files/u);
      expect(output).not.toMatch(/tests[\\/]db[\\/][\w-]+\.test\.ts/u);
    },
    120_000,
  );

  it(
    'an admitted name gets past the guard (so the refusal above is not a guard that refuses everything)',
    () => {
      // A filter that matches no file, so nothing reaches for the unresolvable
      // host: what is being shown is only that the config loaded and vitest
      // went on to look for tests.
      const { status, output } = runDatabaseConfig(
        'postgresql://frontalier:frontalier@db.invalid:5436/monreleve_guard_probe?schema=public',
        ['tests/db/__no_such_file__', '--passWithNoTests'],
      );

      expect(output).not.toMatch(/REFUSED/u);
      expect(output).toMatch(/No test files found/u);
      expect(status, output).toBe(0);
    },
    120_000,
  );
});
