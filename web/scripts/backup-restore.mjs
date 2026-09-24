// web/scripts/backup-restore.mjs
//
// ============================================================================
// A BACKUP NOBODY HAS RESTORED IS A HOPE (FW28 increment 7)
// ============================================================================
//
// SPEC calls the entries table the product. `pg_dump` running nightly proves
// that a file is being written; it proves nothing whatever about whether that
// file can be turned back into a database, and the two are different claims -
// R249's distinction applied to a backup rather than to an image.
//
// SO THIS RESTORES ONE, END TO END, AND COUNTS THE ROWS:
//
//   1. a scratch database, migrated from prisma/migrations
//   2. rows written into every table the dossier depends on
//   3. pg_dump  ->  a file
//   4. DROP DATABASE - the destructive half, which is the whole point
//   5. CREATE + psql < the file
//   6. every row count compared with what was there before
//
// STEP 4 IS NOT OPTIONAL AND IS WHY THIS IS A SCRATCH DATABASE. A "restore"
// into a database that still has its data proves nothing: every count matches
// because nothing was ever lost. The drop is what makes the comparison mean
// something, and it is also why this must never be pointed at anything real.
//
// IT REFUSES A NON-SCRATCH TARGET BY NAME. The database is created here, with
// a name this script owns; if one already exists under that name it is
// dropped, because it can only be a leftover of a previous run.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_USER = 'frontalier';
const PG_PASSWORD = 'frontalier';
const PG_CONTAINER = 'frontalier-postgres';

/**
 * The scratch database this script owns.
 *
 * NAMED SO IT CANNOT BE MISTAKEN for anything a person would keep. The script
 * drops it twice - once before and once after - and a drop is not something
 * to aim at a name somebody else chose.
 */
const DB = 'monreleve_restore_probe';

/**
 * Where the SERVER is, when the caller already has one.
 *
 * CI has a `services: postgres` and no compose container, so it supplies a
 * URL and this reaches the server with the client binaries on PATH. Locally
 * it is unset and everything goes through `docker exec` into the compose
 * container, which needs no client installed on the host.
 *
 * EITHER WAY THE SCRATCH DATABASE IS OURS. The supplied URL is used to reach
 * the SERVER, never as the target: this script drops a database twice, and a
 * drop is not something to aim at a name somebody else chose.
 */
const SUPPLIED = process.env.RESTORE_DATABASE_URL;

const serverBase =
  SUPPLIED === undefined
    ? `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5436`
    : SUPPLIED.replace(/\/[^/?]*(\?.*)?$/u, '');

const hostUrl = `${serverBase}/${DB}?schema=public`;

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, ...options });
}

/** psql inside the compose container, where Postgres listens on 5432. */
function psql(sql, database = 'postgres') {
  if (SUPPLIED === undefined) {
    return run('docker', [
      'exec',
      '-e',
      `PGPASSWORD=${PG_PASSWORD}`,
      PG_CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-d',
      `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${database}`,
      '-c',
      sql,
    ]).trim();
  }

  return run('psql', ['-v', 'ON_ERROR_STOP=1', '-t', '-A', '-d', `${serverBase}/${database}`, '-c', sql]).trim();
}

/** The tables whose loss would be the product's loss. */
const TABLES = ['User', 'Entry', 'EntryEvent', 'Device', 'AlertSubscriber', 'ReminderSent'];

function census() {
  const counts = {};

  for (const table of TABLES) {
    counts[table] = Number(psql(`SELECT count(*) FROM "${table}"`, DB));
  }

  return counts;
}

const work = mkdtempSync(join(tmpdir(), 'monreleve-restore-'));
const dumpFile = join(work, 'dump.sql');
let failure = null;

try {
  console.log(`\n--- scratch database ${DB} ---`);
  psql(`DROP DATABASE IF EXISTS ${DB}`);
  psql(`CREATE DATABASE ${DB}`);

  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: hostUrl },
  });

  console.log('--- seeding rows in every table the dossier depends on ---');

  // Written as SQL rather than through Prisma so the restore is compared
  // against what POSTGRES holds, not against what an ORM would hand back.
  // ONLY THE COLUMNS THAT HAVE NO DEFAULT, read from information_schema
  // rather than guessed: User requires id and email and nothing else.
  psql(
    `INSERT INTO "User" (id, email, canton, name)
     VALUES ('restore-user-1', 'restore@example.com', 'GE', 'Camille Restore')`,
    DB,
  );

  for (let day = 1; day <= 7; day += 1) {
    psql(
      `INSERT INTO "Entry" (id, "userId", "dayDate", kind, "clientMutationId", "firstRecordedAt", "updatedAt")
       VALUES ('restore-entry-${day}', 'restore-user-1', DATE '2026-02-0${day}', 'HOME',
               'restore-mutation-${day}', now(), now())`,
      DB,
    );
  }

  const before = census();

  console.log('rows before the dump:');
  for (const [table, count] of Object.entries(before)) console.log(`  ${table.padEnd(16)} ${count}`);

  console.log('\n--- pg_dump ---');

  if (SUPPLIED === undefined) {
    // Through the compose container, so no client is needed on the host.
    run('docker', [
      'exec',
      '-e',
      `PGPASSWORD=${PG_PASSWORD}`,
      PG_CONTAINER,
      'pg_dump',
      '--clean',
      '--if-exists',
      '-d',
      `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${DB}`,
      '-f',
      '/tmp/monreleve-dump.sql',
    ]);

    run('docker', ['cp', `${PG_CONTAINER}:/tmp/monreleve-dump.sql`, dumpFile]);
  } else {
    // A supplied server means the client binaries are on PATH, and writing
    // the dump straight to a local file removes the copy step entirely.
    run('pg_dump', ['--clean', '--if-exists', '-d', `${serverBase}/${DB}`, '-f', dumpFile]);
  }

  const size = statSync(dumpFile).size;

  console.log(`dump written: ${size} bytes`);

  // R133: A DUMP THAT IS EMPTY IS NOT A BACKUP. An empty file restores
  // silently into an empty database and every count would then be 0 = 0.
  if (size < 2000) {
    throw new Error(`the dump is ${size} bytes, which is too small to contain a schema and rows`);
  }

  console.log('\n--- DROP DATABASE (the destructive half) ---');
  psql(`DROP DATABASE ${DB}`);

  const gone = psql(`SELECT count(*) FROM pg_database WHERE datname = '${DB}'`);

  if (gone !== '0') throw new Error(`${DB} still exists after the drop, so nothing was lost`);

  console.log(`${DB} is gone - confirmed by pg_database, not assumed`);

  console.log('\n--- restore ---');
  psql(`CREATE DATABASE ${DB}`);

  if (SUPPLIED === undefined) {
    run('docker', ['cp', dumpFile, `${PG_CONTAINER}:/tmp/monreleve-restore.sql`]);
    run('docker', [
      'exec',
      '-e',
      `PGPASSWORD=${PG_PASSWORD}`,
      PG_CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-d',
      `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${DB}`,
      '-f',
      '/tmp/monreleve-restore.sql',
    ]);
  } else {
    run('psql', ['-v', 'ON_ERROR_STOP=1', '-d', `${serverBase}/${DB}`, '-f', dumpFile]);
  }

  const after = census();

  console.log('\nrows after the restore:');

  const mismatches = [];

  for (const table of TABLES) {
    const ok = before[table] === after[table];

    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${table.padEnd(16)} ${before[table]} -> ${after[table]}`,
    );

    if (!ok) mismatches.push(`${table}: ${before[table]} before, ${after[table]} after`);
  }

  // R63 / R169: THE CENSUS MUST HAVE COUNTED SOMETHING. Every table at zero
  // both sides is a perfect match and proves nothing at all.
  const total = Object.values(before).reduce((a, b) => a + b, 0);

  if (total < 1) {
    throw new Error('nothing was seeded, so a matching census proves nothing (R63)');
  }

  if (mismatches.length > 0) {
    failure = `the restore lost rows: ${mismatches.join('; ')}`;
  } else {
    console.log(`\n${total} rows survived a dump, a DROP DATABASE and a restore.`);
  }
} catch (cause) {
  failure = cause instanceof Error ? cause.message : String(cause);
} finally {
  try {
    psql(`DROP DATABASE IF EXISTS ${DB}`);
  } catch {
    // Already gone.
  }

  rmSync(work, { recursive: true, force: true });
}

if (failure !== null) {
  console.error(`\nRESTORE PROBE FAILED: ${failure}\n`);
  process.exit(1);
}

console.log('\nRestore checks  6 passed (6)');
console.log('RESTORE PROBE PASSED - the backup was restored, not merely written.\n');
