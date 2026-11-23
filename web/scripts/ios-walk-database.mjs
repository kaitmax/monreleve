// web/scripts/ios-walk-database.mjs
//
// ============================================================================
// THE iOS WALK'S THROWAWAY DATABASE, MADE BY THE PACKAGE (R1395, iOS Ruling 18)
// ============================================================================
//
// .github/workflows/ios-walk.yml runs on a macOS runner with no docker, so it
// has no `services: postgres` block: it starts its own PostgreSQL for the run.
// Its database step used to build a connection string in the YAML and create
// the database with an inline `node -e`. R879 refused that string (no service
// in the same workflow creates it), and the inline CREATE was invisible to
// R877, whose walk reads the package's code, not a workflow's YAML. The walk
// was merged RED over exactly that and reverted.
//
// So the step is this script, in gate:clone's own shape (R206):
//   - the ADMINISTRATIVE URL is built here from host, port, user and password,
//     environment variables the step sets - the password born and masked on
//     the runner (R1341), never written into the YAML or printed;
//   - the name comes from scratchDatabaseName(), imported from the pattern's
//     one home, so R877's resolver resolves this site FROM THE HOME and test:db
//     would admit the database by construction;
//   - the statements go through gate-clone-parts' administer(), on the server's
//     `postgres` database and nowhere else (R957);
//   - the scratch URL is written to the private file the later steps read,
//     never printed.
//
// tests/unit/meta/scratch-database-census.test.ts (R1396) asserts every
// workflow that makes a database without a postgres service CALLS a script
// like this one, on a line that is not a comment.
//
// ENVIRONMENT, every one required (a missing one is refused by name, never
// defaulted - `ios_walk_undefined` would pass the pattern, and an invalid URL's
// error would print its input, password included):
//   WALK_PG_HOST         the runner-local server's address (127.0.0.1)
//   WALK_PG_PORT         its port
//   WALK_PG_USER         the superuser initdb created
//   WALK_DB_PASSWORD     that user's password (masked on the runner)
//   GITHUB_RUN_ID        names the database: monreleve_ios_walk_<run id>
//   WALK_DATABASE_URL_FILE  where the scratch URL is written (mode 0600)

import { writeFileSync } from 'node:fs';
import { URL } from 'node:url';

import { administer, adminTarget, scratchDatabaseUrl } from './gate-clone-parts.mjs';
import { scratchDatabaseName } from '../lib/db/scratch-database.mjs';

const REQUIRED = ['WALK_PG_HOST', 'WALK_PG_PORT', 'WALK_PG_USER', 'WALK_DB_PASSWORD', 'GITHUB_RUN_ID', 'WALK_DATABASE_URL_FILE'];

const missing = REQUIRED.filter((name) => (process.env[name] ?? '') === '');

if (missing.length > 0) {
  console.error(`ios-walk-database REFUSED: ${missing.join(', ')} not set (the values are never printed).`);
  process.exit(1);
}

const { WALK_PG_HOST, WALK_PG_PORT, WALK_PG_USER, WALK_DB_PASSWORD, GITHUB_RUN_ID, WALK_DATABASE_URL_FILE } = process.env;

if (!/^\d+$/u.test(GITHUB_RUN_ID) || !/^\d+$/u.test(WALK_PG_PORT)) {
  console.error('ios-walk-database REFUSED: GITHUB_RUN_ID and WALK_PG_PORT must be decimal numbers.');
  process.exit(1);
}

// Built from its parts with the URL setters, which percent-encode the
// credentials; `?schema=public` is kept so db:deploy and `pnpm dev` are handed
// the same scratch URL the inline step handed them (scratchDatabaseUrl keeps
// the query; administer() drops it with the database).
let base;

try {
  base = new URL(`postgresql://${WALK_PG_HOST}:${WALK_PG_PORT}/postgres`);
} catch {
  console.error('ios-walk-database REFUSED: WALK_PG_HOST and WALK_PG_PORT do not form a URL.');
  process.exit(1);
}

base.username = WALK_PG_USER;
base.password = WALK_DB_PASSWORD;
base.searchParams.set('schema', 'public');

const server = base.toString();
const scratchDatabase = scratchDatabaseName(`ios_walk_${GITHUB_RUN_ID}`);

await administer(server, [
  `DROP DATABASE IF EXISTS "${scratchDatabase}" WITH (FORCE)`,
  `CREATE DATABASE "${scratchDatabase}"`,
]);

writeFileSync(WALK_DATABASE_URL_FILE, scratchDatabaseUrl(server, scratchDatabase), { mode: 0o600 });

console.log(`scratch database created: ${scratchDatabase}`);
console.log(`  admin     ${adminTarget(server)} (R957: the server's postgres database, credentials masked)`);
