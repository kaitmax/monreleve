// web/lib/db/scratch-database.mjs
//
// ============================================================================
// THE ONE HOME OF THE SCRATCH-DATABASE PATTERN (R877, R206)
// ============================================================================
//
// Every test:db file starts by EMPTYING the table it owns. A developer's
// web/.env points DATABASE_URL at the shared development database
// `frontalier`, so `pnpm test:db` run from such a checkout emptied the
// developer's data. "Never run test:db against the dev database" existed only
// as a sentence in briefs. vitest.db.config.ts now calls
// assertScratchTestDatabase() when it is loaded - before any test file is
// collected - and the suite refuses any database whose name is not a scratch
// name.
//
// WHAT A SCRATCH NAME IS: the prefix `monreleve_` and at least one more
// character from [a-z0-9_], 63 bytes at most (PostgreSQL truncates longer
// identifiers, so a longer name is not the name the server keeps). It is the
// convention every script that creates a throwaway database already used -
// gate:clone's monreleve_gate_clone_<sha8>, the container harnesses' and the
// restore probe's - so the guard admits them without any of them changing.
// The development database (`frontalier`), the maintenance database and
// production's (`postgres`, docs/deploy.md) are outside it by construction.
//
// WHO USES THIS FILE:
//   vitest.db.config.ts           refuses through assertScratchTestDatabase
//   scripts/gate-clone.mjs        names its scratch database through scratchDatabaseName
//   tests/db/fw14-era-migration   names its probe database the same way
//   tests/unit/meta/scratch-database-census.test.ts asserts every other
//                                 CREATE DATABASE site, and CI's database
//                                 names, against SCRATCH_DATABASE_PATTERN
//
// WHY .mjs: gate-clone.mjs is a plain `node` script and cannot import
// TypeScript. TypeScript reads this through scratch-database.d.mts, which
// tests/unit/meta/declaration-parity.test.ts asserts against these exports.
//
// IT READS NO ENVIRONMENT, and imports only the URL parser node-postgres
// itself uses. Callers pass the URL in; that keeps the check a pure function
// the unit tests can drive with every near miss.

import { URL } from 'node:url';

/** Every scratch database name starts with this. */
export const SCRATCH_DATABASE_PREFIX = 'monreleve_';

/** PostgreSQL keeps identifiers up to NAMEDATALEN - 1 = 63 bytes. */
const MAX_NAME_LENGTH = 63;

/**
 * THE pattern. Derived from the prefix and the length limit, not typed twice.
 * Anchored at both ends: a scratch-looking SUBSTRING admits nothing.
 */
export const SCRATCH_DATABASE_PATTERN = new RegExp(
  `^${SCRATCH_DATABASE_PREFIX}[a-z0-9_]{1,${MAX_NAME_LENGTH - SCRATCH_DATABASE_PREFIX.length}}$`,
  'u',
);

/** Where the pattern lives, named in every refusal so the reader can find it. */
export const SCRATCH_DATABASE_HOME = 'web/lib/db/scratch-database.mjs';

/**
 * Query parameters some PostgreSQL client reads as the database.
 *
 * node-postgres takes the PATH and lets it overwrite `?database=`; its socket
 * form reads `?db=`; libpq-style URIs (psql, pg_dump) read `?dbname=`. A
 * connection string two clients would send to two different databases is
 * refused outright rather than judged the way one of them reads it.
 */
const DATABASE_PARAMETERS = new Set(['database', 'dbname', 'db']);

/** A name a script may create, built from a suffix; throws when it would leave the pattern. */
export function scratchDatabaseName(suffix) {
  const name = `${SCRATCH_DATABASE_PREFIX}${suffix}`;

  if (!SCRATCH_DATABASE_PATTERN.test(name)) {
    throw new Error(
      `${JSON.stringify(name)} is not a scratch database name: it must match ` +
        `${SCRATCH_DATABASE_PATTERN.source} (${SCRATCH_DATABASE_HOME}).`,
    );
  }

  return name;
}

const refuse = (database, reason) => ({ admitted: false, database, reason });

/**
 * Which database a connection string names, and whether test:db may empty it.
 *
 * READ THE WAY THE DRIVER READS IT. node-postgres (which the Prisma adapter
 * and every test:db file use) parses the string with the WHATWG URL parser and
 * takes `decodeURI(pathname without its leading slash)` as the database. This
 * does the same, so dot segments, percent-encoding and a second segment land
 * where they land for the driver. The user, host, password, schema parameter
 * and fragment are never read as the database - a scratch name in any of them
 * admits nothing.
 *
 * Everything this cannot read with certainty is refused: no URL, another
 * protocol, the driver's socket and unix-path forms, an empty path (the
 * driver would fall back to PGDATABASE or the user name), and a
 * database-naming query parameter.
 */
export function judgeTestDatabase(url) {
  if (url === undefined || url === null || url === '') {
    return refuse(null, 'DATABASE_URL is not set');
  }

  if (url.startsWith('/')) {
    return refuse(null, 'DATABASE_URL uses the unix-socket path form, which names its database outside the URL path');
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return refuse(null, 'DATABASE_URL cannot be read as a URL');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return refuse(null, `DATABASE_URL uses ${JSON.stringify(parsed.protocol)}; only postgresql:// and postgres:// name their database in the path`);
  }

  let database;

  try {
    database = decodeURI(parsed.pathname.slice(1));
  } catch {
    return refuse(null, 'the database in DATABASE_URL is not valid percent-encoding');
  }

  if (database === '') {
    return refuse(
      null,
      'DATABASE_URL names no database, so the driver would fall back to PGDATABASE or the user name',
    );
  }

  for (const key of parsed.searchParams.keys()) {
    if (DATABASE_PARAMETERS.has(key.toLowerCase())) {
      return refuse(
        database,
        `DATABASE_URL carries a ${JSON.stringify(key)} parameter, which some clients read as the database instead of the path`,
      );
    }
  }

  if (!SCRATCH_DATABASE_PATTERN.test(database)) {
    return refuse(database, `${JSON.stringify(database)} is not a scratch database name`);
  }

  return { admitted: true, database, reason: null };
}

/**
 * The refusal text, or null when the connection string is admitted.
 *
 * It names the database the guard read (never the URL: it carries a
 * password), the pattern, its home, and how to make a database it admits.
 */
export function testDatabaseRefusal(url) {
  const verdict = judgeTestDatabase(url);

  if (verdict.admitted) {
    return null;
  }

  const pointedAt = verdict.database === null ? '(none)' : JSON.stringify(verdict.database);

  return [
    '',
    'test:db REFUSED (R877): DATABASE_URL does not name a scratch database.',
    '',
    `  pointed at  ${pointedAt}`,
    `  why         ${verdict.reason}`,
    `  requires    ${SCRATCH_DATABASE_PATTERN.source}`,
    `  defined in  ${SCRATCH_DATABASE_HOME}`,
    '',
    'Every test:db file starts by EMPTYING the table it owns, so the suite runs only',
    'on a database made for it. To make one on the local PostgreSQL (docker compose up -d):',
    '',
    '  docker exec frontalier-postgres psql -U frontalier -d postgres -c "CREATE DATABASE monreleve_test_mine"',
    '',
    'then point DATABASE_URL at it - a value set in the shell wins over web/.env - and run',
    '',
    '  pnpm db:deploy',
    '  pnpm test:db',
    '',
    'Drop it when done: ... -c "DROP DATABASE monreleve_test_mine WITH (FORCE)". README.md has the recipe.',
    '',
  ].join('\n');
}

/** Throws an Error carrying the refusal text when the connection string is not admitted. */
export function assertScratchTestDatabase(url) {
  const refusal = testDatabaseRefusal(url);

  if (refusal !== null) {
    throw new Error(refusal);
  }
}
