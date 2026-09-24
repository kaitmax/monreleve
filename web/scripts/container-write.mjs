// web/scripts/container-write.mjs
//
// THE PRODUCTION WRITE. FW31, and R256 is why it exists.
//
// ============================================================================
// WHAT THIS ASSERTS THAT NOTHING ELSE DID
// ============================================================================
//
// FW30 found that POST /api/v1/entries returns 500 and writes zero rows on a
// production build, and that it had been so since 13 September. Recording a
// day is the entire purpose of this product.
//
// It survived three weeks of green because NOTHING ANYWHERE EXERCISED A
// PRODUCTION WRITE. Five layers, each individually reasonable:
//
//   - unit and db tests run with NODE_ENV=test, where the client memoises
//   - `pnpm dev` is NODE_ENV=development, likewise
//   - R176's walkthrough runs against `pnpm dev`
//   - gate:clone SKIPS the container suites and says so
//   - CI's container job has never passed
//
// and `scripts/container-e2e.mjs` never POSTs an entry, while no e2e spec
// touches /api/v1 BY DESIGN - D14 removed the signed-in web area, so the write
// path's only intended caller is an Android client that does not exist yet.
//
// The intersection of five reasonable boundaries was a hole the size of the
// main use case. This suite is the assertion that lives in the middle of it.
//
// ============================================================================
// IT RUNS IN gate:clone, NOT IN CI (R256)
// ============================================================================
//
// CI's container job has never passed - it dies on a port collision before a
// single spec executes - so a CI-only test is a test that does not exist. The
// claim this makes has to be made by the verifier that actually runs.
//
// ============================================================================
// IT USES `pg` DIRECTLY RATHER THAN `docker exec psql`
// ============================================================================
//
// container-e2e.mjs reaches the database through `docker exec
// frontalier-postgres psql`, which works locally and cannot work in CI, where
// `services: postgres` has no container of that name - so it carries a
// CONTAINER_E2E_DATABASE_URL escape hatch for the caller to supply one.
//
// `pg` is already a production dependency. Using it removes the fork: the same
// code creates the scratch database, counts connections and reads the row back
// on either machine.

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

const ARGS = process.argv.slice(2);

/**
 * Build unless told not to, by flag OR by environment.
 *
 * THE ENVIRONMENT FORM EXISTS BECAUSE CI STEPS MUST BE BARE. R106/R111/R112
 * map each `- run:` line to exactly one package script, and the mapping is by
 * the command's text - `pnpm test:container:write --no-build` matches no
 * target and fails all three guards. So the switch moves to where a workflow
 * can set it without changing the command.
 */
const SHOULD_BUILD = !ARGS.includes('--no-build') && process.env.CONTAINER_WRITE_NO_BUILD !== '1';

const PORT = process.env.FRONTALIER_PORT ?? '3120';
const IMAGE = process.env.CONTAINER_IMAGE ?? 'monreleve:write';
const NAME = 'monreleve-write';
const DB = 'monreleve_container_write';

// The origin the image is BUILT for. The entrypoint refuses a mismatch (R250),
// so this has to be the value passed to both the build and the run.
const ORIGIN = 'https://monreleve.example';
const SECRET = 'container-write-not-a-deployment-secret';
const EMAIL = 'fw31-write@example.com';

const PG_USER = 'frontalier';
const PG_PASSWORD = 'frontalier';
const PG_PORT = process.env.CONTAINER_WRITE_PG_PORT ?? '5436';

const SUPPLIED = process.env.CONTAINER_WRITE_DATABASE_URL;

/**
 * The maintenance connection: same server, `postgres` database, no query
 * string.
 *
 * PARSED RATHER THAN PATTERNED. A regex over the URL turned
 * `/frontalier?schema=public` into `/postgres?schema=public`, and `schema` is
 * a Prisma parameter rather than a libpq one - `pg` hands it to the server,
 * which rejects it. The URL parser knows where the path ends.
 */
function toAdminUrl(url) {
  const parsed = new URL(url);

  parsed.pathname = '/postgres';
  parsed.search = '';

  return parsed.toString();
}

const adminUrl =
  SUPPLIED === undefined
    ? `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/postgres`
    : toAdminUrl(SUPPLIED);

const toolUrl =
  SUPPLIED ?? `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${DB}?schema=public`;

// Inside the container, localhost is the container. The host is reachable at
// host.docker.internal, which the run below adds explicitly.
const containerUrl = toolUrl.replace('@localhost:', '@host.docker.internal:');

let checks = 0;
const failures = [];

function ok(what, detail = '') {
  checks += 1;
  console.log(`  PASS  ${what}${detail === '' ? '' : `  ${detail}`}`);
}

function bad(what, detail) {
  failures.push(`${what}: ${detail}`);
  console.log(`  FAIL  ${what}  ${detail}`);
}

function is(what, got, want) {
  if (got === want) ok(what, `${JSON.stringify(got)}`);
  else bad(what, `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
}

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 2_400_000, ...options });
}

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });

  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * How many client backends the server is holding.
 *
 * R233: this reports whether it OBSERVED ITS SUBJECT. A sampler that cannot
 * reach the server returns null, and null is never read as "no connections".
 */
async function connections() {
  try {
    return await withClient(adminUrl, async (client) => {
      const result = await client.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE backend_type = 'client backend'",
      );

      return result.rows[0].n;
    });
  } catch {
    return null;
  }
}

function removeContainer() {
  try {
    run('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
  } catch {
    // Nothing to remove.
  }
}

/**
 * R179: assert the port is free BEFORE starting, and name the rule that
 * refused. Both halves - without the precondition this inherits an orphan from
 * a previous crashed run.
 */
async function assertPortFree() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    const body = await response.text();

    throw new Error(
      `R179: something is already listening on ${PORT} and answering /api/health. ` +
        `Free the port or set FRONTALIER_PORT. Got: ${body.slice(0, 160)}`,
    );
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('R179:')) throw cause;
    // Nothing answered, which is what we want.
  }
}

/**
 * R169: the suite asserts what it is pointed at, FIRST. A health check that
 * only proves something is listening proves nothing about what - FW20 ran 91
 * tests to completion against another product's container on port 3000.
 */
async function waitForOurProduct() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.ok) {
        const body = await response.json();

        if (typeof body.service !== 'string' || body.service === '') {
          throw new Error(
            `R169: ${PORT} answered /api/health with 200 and no \`service\` field. ` +
              'That is a foreign application, or a port collision.',
          );
        }

        return body;
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('R169:')) throw cause;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`the container did not answer /api/health on ${PORT} within 120s`);
}

/** A signed-in access token, obtained the way a real client obtains one. */
async function signIn() {
  const raw = randomBytes(32).toString('hex');

  await withClient(toolUrl, async (client) => {
    await client.query(
      'INSERT INTO "VerificationToken" (identifier, token, expires) VALUES ($1, $2, $3)',
      [EMAIL, createHash('sha256').update(raw).digest('hex'), new Date(Date.now() + 900_000)],
    );
  });

  const response = await fetch(
    `http://127.0.0.1:${PORT}/api/v1/auth/callback?token=${raw}&email=${encodeURIComponent(EMAIL)}`,
  );
  const body = await response.text();

  is('sign-in returns 200', response.status, 200);

  let parsed = {};

  try {
    parsed = JSON.parse(body);
  } catch {
    bad('sign-in returns JSON', body.slice(0, 160));
  }

  if (typeof parsed.accessToken === 'string' && parsed.accessToken !== '') {
    ok('sign-in yields an access token', `${parsed.accessToken.length} chars`);
  } else {
    bad('sign-in yields an access token', JSON.stringify(body.slice(0, 160)));
  }

  return parsed.accessToken ?? '';
}

console.log('\n=== the production write (FW31, R256) ===');
console.log(`image ${IMAGE}   port ${PORT}   database ${DB}`);

try {
  await assertPortFree();
  removeContainer();

  console.log(`\n--- scratch database ${DB} ---`);

  if (SUPPLIED === undefined) {
    await withClient(adminUrl, async (client) => {
      await client.query(`DROP DATABASE IF EXISTS ${DB}`);
      await client.query(`CREATE DATABASE ${DB}`);
    });
    console.log(`created ${DB}`);
  } else {
    console.log('using the database supplied in CONTAINER_WRITE_DATABASE_URL');
  }

  console.log('--- prisma migrate deploy ---');
  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: toolUrl },
  });

  if (SHOULD_BUILD) {
    console.log(`\n--- building ${IMAGE} for ${ORIGIN} ---`);

    const started = Date.now();

    run('docker', ['build', '--build-arg', `NEXT_PUBLIC_SITE_URL=${ORIGIN}`, '-t', IMAGE, '.'], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });

    console.log(`built in ${Math.round((Date.now() - started) / 1000)}s`);
  } else {
    console.log(`\n--- reusing ${IMAGE} (--no-build) ---`);
  }

  console.log(`\n--- starting ${IMAGE} on ${PORT} ---`);
  run('docker', [
    'run',
    '-d',
    '--name',
    NAME,
    '--add-host',
    'host.docker.internal:host-gateway',
    '-p',
    `${PORT}:3000`,
    '-e',
    `DATABASE_URL=${containerUrl}`,
    '-e',
    `AUTH_SECRET=${SECRET}`,
    '-e',
    `NEXT_PUBLIC_SITE_URL=${ORIGIN}`,
    IMAGE,
  ]);

  const health = await waitForOurProduct();

  ok('R169: /api/health names this product', health.service);

  // ==========================================================================
  // AC1 - THE WRITE
  // ==========================================================================
  console.log('\n--- AC1: a production build accepts a write ---');

  const before = await connections();

  const token = await signIn();

  // A TITULAIRE, SO THE DOSSIER CAN RENDER. A user created by a first sign-in
  // has no name and no canton, and lib/dossier/service.ts raises
  // MissingTitulaireError without one - so the dossier route answers 500 and
  // the pool measurement below would be of a FAILING path. Setting it here
  // makes AC3 measure the route a real client actually drives.
  await withClient(toolUrl, async (client) => {
    await client.query('UPDATE "User" SET name = $1, canton = $2 WHERE email = $3', [
      'Fixture Titulaire',
      'GE',
      EMAIL,
    ]);
  });

  const mutation = `fw31-write-${randomBytes(6).toString('hex')}`;
  const dayDate = '2026-04-07';

  const response = await fetch(`http://127.0.0.1:${PORT}/api/v1/entries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      entries: [{ dayDate, kind: 'HOME', clientMutationId: mutation }],
    }),
  });
  const payload = (await response.text()).slice(0, 220);

  is('POST /api/v1/entries returns 200', response.status, 200);

  if (response.status !== 200) {
    console.log(`        body: ${payload.replace(/\s+/g, ' ')}`);
  }

  // THE ROW, READ BACK FROM THE DATABASE RATHER THAN FROM THE RESPONSE.
  // A 200 that wrote nothing is the defect this suite exists to catch, so the
  // assertion is on the table and not on the payload.
  const rows = await withClient(toolUrl, async (client) => {
    const result = await client.query('SELECT kind FROM "Entry" WHERE "clientMutationId" = $1', [
      mutation,
    ]);

    return result.rows;
  });

  is('the row is in the database', rows.length, 1);

  if (rows.length === 1) is('the row holds what was sent', rows[0].kind, 'HOME');

  // The append-only trail must have recorded it too.
  const events = await withClient(toolUrl, async (client) => {
    const result = await client.query(
      'SELECT count(*)::int AS n FROM "EntryEvent" WHERE "dayDate" = $1',
      [dayDate],
    );

    return result.rows[0].n;
  });

  is('an EntryEvent was recorded', events, 1);

  // ==========================================================================
  // AC3 - THE POOL
  // ==========================================================================
  console.log('\n--- AC3: the pool, before and after ---');

  const authed = [];

  for (let i = 0; i < 30; i += 1) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/dossier?year=2026`, {
      headers: { authorization: `Bearer ${token}` },
    });

    authed.push(res.status);
    await res.text();
  }

  const afterAuthed = await connections();

  const garbage = [];

  for (let i = 0; i < 30; i += 1) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/dossier?year=2026`, {
      headers: { authorization: `Bearer not-a-real-token-${i}` },
    });

    garbage.push(res.status);
    await res.text();
  }

  const afterGarbage = await connections();

  // THE MEASUREMENT IS ONLY WORTH ANYTHING IF THE REQUESTS SUCCEEDED. A route
  // answering 500 may touch the database less than one that works, so a pool
  // that did not grow across sixty failures would prove nothing.
  const allAuthedOk = authed.every((status) => status === 200);

  if (allAuthedOk) ok('AC3: the sampled requests actually succeeded', '30x 200');
  else bad('AC3: the sampled requests actually succeeded', `statuses ${[...new Set(authed)].join(', ')}`);

  const observed = before !== null && afterAuthed !== null && afterGarbage !== null;

  console.log(`  sampler observed its subject (R233): ${observed}`);
  console.log(`  connections before                 : ${before ?? 'NOT OBSERVED'}`);
  console.log(`  after 30 authenticated requests    : ${afterAuthed ?? 'NOT OBSERVED'}`);
  console.log(`  after 30 garbage-bearer requests   : ${afterGarbage ?? 'NOT OBSERVED'}`);
  console.log(`  authenticated statuses             : ${[...new Set(authed)].join(', ')}`);
  console.log(`  garbage statuses                   : ${[...new Set(garbage)].join(', ')}`);

  if (!observed) {
    bad('AC3: the pool sampler reached the server', 'at least one sample was not observed');
  } else {
    ok('AC3: the pool sampler reached the server', `${before} -> ${afterAuthed} -> ${afterGarbage}`);

    // THE BOUND. Sixty requests through a memoised client add at most a
    // handful of pooled connections; the defect added about four PER REQUEST
    // and exhausted a 100-connection server at roughly twenty-five.
    const growth = afterGarbage - before;

    if (growth <= 20) ok('AC3: the pool did not grow per request', `+${growth} over 60 requests`);
    else bad('AC3: the pool did not grow per request', `+${growth} over 60 requests`);
  }
} catch (cause) {
  bad('the suite ran to completion', cause instanceof Error ? cause.message : String(cause));
} finally {
  console.log('\n--- cleanup ---');
  removeContainer();

  if (SUPPLIED === undefined) {
    try {
      await withClient(adminUrl, async (client) => {
        await client.query(`DROP DATABASE IF EXISTS ${DB}`);
      });
      console.log(`dropped ${DB}`);
    } catch (cause) {
      console.log(`could not drop ${DB}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }
}

console.log(`\nProduction write checks  ${checks} passed (${checks})`);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
