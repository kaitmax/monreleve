// web/scripts/container-db-stopped.mjs
//
// ============================================================================
// FW-DB-STOPPED (R945-R948): THE PUBLIC SITE KEEPS SERVING, THE DATABASE STOPPED
// ============================================================================
//
// Plan Checkpoint D item 5: "Deployed to staging; the public site keeps
// serving with the database stopped". No staging exists, so that half is not
// met here. This is the second half, proven against the production IMAGE.
//
// THE SCENARIO IS THE REAL ONE (R945). The database goes away AFTER the
// container has started and served. A database that was never there tests the
// entrypoint's refusal instead, which test:container covers. So this step:
//   1. starts its OWN Postgres, uniquely named, on its own Docker network;
//   2. migrates it, starts the image against it, and reads every answer with
//      the database running - the reference;
//   3. STOPS ITS OWN database container, and reads them all again;
//   4. starts it again, and reads the recovery - without restarting the app.
// container-db-stopped-verdict.mjs decides what the answers mean (pure, and
// unit-tested); this file only collects them.
//
// /verifier/[code] TOO (FW-VERIFIER-OUTAGE, Web Ruling 20). Before the
// reference, the step issues a REAL releve through the export route (the
// image's own Chromium renders it) and reads its code back from the record.
// The last database-touching read before the stop is that code's page, so the
// pool is warm; the FIRST read after the stop is that page again, before any
// other route can touch the pool, so the error the page gets is the production
// shape - and the page's own [verifier] log line records it.
//
// WHERE IT RUNS (R947). Inside test:container:e2e: container-e2e.mjs calls it
// after its own teardown, against the image that harness has just built. No
// harness owned a database's LIFECYCLE before this - all five borrow the
// shared compose server, which other worktrees' scratch databases live in and
// which nothing may stop - so the step brings its own. It is a module rather
// than a package script because a new script in package.json selects EVERY
// suite on the commit that adds it (R414). gate-selection.mjs maps both files
// to test:container:e2e (R247: the file that decides what a suite does selects
// that suite).
//
// ITS OWN NAMES, AND ONLY ITS OWN (R334, R392). The harnesses before it run
// FIXED names and `docker rm -f` them on start, so two runs remove each other's
// containers. Here every name carries a random run id, a name that already
// exists is REFUSED rather than removed, and teardown removes exactly what this
// run created - by name, which no other process can have chosen - with `-v`, so
// the postgres image's anonymous data volume goes too. Anything an earlier,
// killed run left behind is PRINTED, never removed.
//
// PRODUCTION'S SHAPE. The app reaches the database by container name on a
// Docker network, as it does on Coolify's (docs/deploy.md). That also keeps the
// app-to-database path off this machine's host networking, where a refused
// connect can read as a hang.
//
// Standalone, for development and plants: CONTAINER_IMAGE names an image built
// for its origin, then `node scripts/container-db-stopped.mjs`. The gate runs
// it through container-e2e.mjs, never this way.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import {
  composePostgresImage,
  copyLiteral,
  documentedStatus,
  headingsOf,
  judgeDatabaseStopped,
  leaksIn,
  redact,
  sitemapPaths,
} from './container-db-stopped-verdict.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..');

/** Every container and network this step creates carries it, so a leftover can be FOUND. */
const HARNESS_LABEL = 'monreleve.harness=container-db-stopped';

/**
 * The database inside this step's own server. Named by R877's scratch pattern
 * even though nothing else shares that server: one vocabulary for throwaway
 * databases, so no reader has to ask whether this one is real.
 */
const DATABASE = 'monreleve_db_stopped';

const SECRET = 'container-db-stopped-not-a-deployment-secret';
const EMAIL = 'db-stopped@example.com';

/** Every wait is a stated value (R345), never a default somebody inherited. */
const FETCH_TIMEOUT_MS = 30_000;
const POSTGRES_DEADLINE_MS = 60_000;
const START_DEADLINE_MS = 120_000;
const RECOVERY_DEADLINE_MS = 90_000;
const POLL_MS = 1_000;
/** FW-VERIFIER-OUTAGE: one PDF render in the image's own Chromium, cold. */
const EXPORT_TIMEOUT_MS = 120_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * docker, with its failure rebuilt from stderr alone and the secrets redacted.
 *
 * NOT execFileSync's own error: its message is "Command failed: docker run ...
 * -e POSTGRES_PASSWORD=<the value>", the whole command line, and a catch that
 * printed it would put the password in the gate log.
 */
function docker(args, secrets, options = {}) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (cause) {
    const stderr = String(cause?.stderr ?? cause?.message ?? cause).trim();

    throw new Error(`docker ${args[0]} failed: ${redact(stderr, secrets).slice(0, 400)}`);
  }
}

function exists(kind, name) {
  try {
    execFileSync('docker', [kind, 'inspect', name], { stdio: 'ignore', timeout: 60_000 });

    return true;
  } catch {
    return false;
  }
}

/** The app container's identity and lifetime, for "not restarted" (R946). */
function lifetime(name, secrets) {
  const [id, startedAt, restartCount, running] = docker(
    ['inspect', '-f', '{{.Id}}|{{.State.StartedAt}}|{{.RestartCount}}|{{.State.Running}}', name],
    secrets,
  ).split('|');

  return { id, startedAt, restartCount: Number(restartCount), running: running === 'true' };
}

function isRunning(name, secrets) {
  return docker(['inspect', '-f', '{{.State.Running}}', name], secrets) === 'true';
}

/** One request, with a stated timeout. A request nothing answered is status null, with why. */
async function get(url, headers = {}) {
  const started = Date.now();

  try {
    const response = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await response.text();

    return {
      status: response.status,
      body,
      cacheControl: response.headers.get('cache-control') ?? '',
      ms: Date.now() - started,
    };
  } catch (cause) {
    return {
      status: null,
      body: '',
      error: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
      ms: Date.now() - started,
    };
  }
}

function parsed(answer) {
  try {
    return JSON.parse(answer.body);
  } catch {
    return null;
  }
}

/**
 * Wait until Postgres accepts TCP connections INSIDE its container.
 *
 * `-h 127.0.0.1`, NOT THE SOCKET: the image's first boot runs a temporary
 * server for initdb that listens on the socket only, and a socket probe says
 * "ready" to it moments before it stops for the real start.
 */
async function waitForPostgres(name, user, secrets) {
  const deadline = Date.now() + POSTGRES_DEADLINE_MS;

  while (Date.now() < deadline) {
    try {
      docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', user, '-d', DATABASE], secrets, {
        timeout: 15_000,
      });

      return;
    } catch {
      await sleep(POLL_MS);
    }
  }

  throw new Error(`the step's own Postgres did not accept connections within ${POSTGRES_DEADLINE_MS / 1000}s`);
}

/** A protocol-level answer from the host side: a TCP connect is not evidence on this machine. */
async function selectOne(url) {
  const deadline = Date.now() + POSTGRES_DEADLINE_MS;
  let last = '';

  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });

    try {
      await client.connect();
      await client.query('SELECT 1');

      return;
    } catch (cause) {
      last = cause instanceof Error ? cause.message : String(cause);
      await sleep(POLL_MS);
    } finally {
      await client.end().catch(() => {});
    }
  }

  throw new Error(`the step's own Postgres did not answer SELECT 1 from the host: ${last}`);
}

/**
 * R179: the port is free BEFORE starting. Something answering /api/health on it
 * is refused by name, never removed: this step authorises removing only what
 * it created.
 */
async function assertPortFree(base) {
  const answer = await get(`${base}/api/health`);

  if (answer.status !== null) {
    throw new Error(
      `R179: something already answers /api/health on ${base} (status ${answer.status}). ` +
        'This step removes only what it created; free the port or set FRONTALIER_PORT.',
    );
  }
}

/** R169 and R301: the server on the port is this product, and this run's instance. */
async function waitForOurInstance(base, app, service, instance, secrets) {
  const deadline = Date.now() + START_DEADLINE_MS;

  while (Date.now() < deadline) {
    const answer = await get(`${base}/api/health`);
    const body = parsed(answer);

    if (answer.status === 200 && body !== null) {
      if (body.service !== service) {
        throw new Error(`R169: ${base} answered /api/health naming ${JSON.stringify(body.service)}, not ${service}`);
      }

      if (body.instance !== instance) {
        throw new Error(`R301: ${base} is ${JSON.stringify(body.instance)}, not this run's ${instance}`);
      }

      return;
    }

    if (!isRunning(app, secrets)) throw new Error('the app container exited before it answered /api/health');

    await sleep(POLL_MS);
  }

  throw new Error(`the app container did not answer /api/health within ${START_DEADLINE_MS / 1000}s`);
}

/**
 * A signed-in access token, minted the way a real client gets one, BEFORE the
 * stop: a request with no bearer gets 401 without touching the database, so it
 * would prove nothing about the database-backed path. container-write.mjs's
 * sign-in, the same three steps.
 */
async function signIn(base, hostUrl) {
  const raw = randomBytes(32).toString('hex');
  const client = new pg.Client({ connectionString: hostUrl, connectionTimeoutMillis: 5_000 });

  await client.connect();

  try {
    await client.query('INSERT INTO "VerificationToken" (identifier, token, expires) VALUES ($1, $2, $3)', [
      EMAIL,
      createHash('sha256').update(raw).digest('hex'),
      new Date(Date.now() + 900_000),
    ]);
  } finally {
    await client.end();
  }

  const answer = await get(`${base}/api/v1/auth/callback?token=${raw}&email=${encodeURIComponent(EMAIL)}`);
  const body = parsed(answer);

  if (answer.status !== 200 || typeof body?.accessToken !== 'string' || body.accessToken === '') {
    throw new Error(`the sign-in the database-backed route needs answered ${answer.status ?? 'nothing'}`);
  }

  return body.accessToken;
}

/**
 * One query on the step's own database, from the host side.
 *
 * @param {string} hostUrl
 * @param {string} sql
 * @param {unknown[]} [values]
 * @returns {Promise<import('pg').QueryResult<Record<string, unknown>>>}
 */
async function hostQuery(hostUrl, sql, values = []) {
  const client = new pg.Client({ connectionString: hostUrl, connectionTimeoutMillis: 5_000 });

  await client.connect();

  try {
    return await client.query(sql, values);
  } finally {
    await client.end();
  }
}

/**
 * FW-VERIFIER-OUTAGE (Web Ruling 20 item 1): a REAL verification code, issued
 * with the database up through the real export route - the image renders the
 * PDF with its own Chromium and records the issuance - then read back from the
 * record it wrote. The account first gets what a releve needs: a titulaire and
 * a canton, as tests/db/container-pdf.test.ts gives its own. An empty year is
 * a document like any other (R516), so no day is needed.
 *
 * Every failure is named - status, content type and the envelope's `code` -
 * so a refused export is never read as a failure of the page under test.
 */
async function issueReleve(base, hostUrl, token, holderName, year) {
  const named = await hostQuery(hostUrl, 'UPDATE "User" SET name = $1, canton = $2 WHERE email = $3', [
    holderName,
    'GE',
    EMAIL,
  ]);

  if (named.rowCount !== 1) throw new Error(`the account to issue a releve for: ${named.rowCount} row(s), expected 1`);

  const started = Date.now();
  let response;

  try {
    response = await fetch(`${base}/api/v1/export/pdf?year=${year}`, {
      headers: { authorization: `Bearer ${token}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new Error(
      `the export route issued nothing within ${EXPORT_TIMEOUT_MS / 1000}s: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const bytes = Buffer.from(await response.arrayBuffer());

  if (response.status !== 200 || !contentType.startsWith('application/pdf')) {
    let code = null;

    try {
      code = JSON.parse(bytes.toString('utf8'))?.code ?? null;
    } catch {
      // not an envelope
    }

    throw new Error(
      `the export route did not issue a releve: status ${response.status}, content-type ${JSON.stringify(contentType)}, ` +
        `envelope code ${JSON.stringify(code)}`,
    );
  }

  const issued = await hostQuery(
    hostUrl,
    'SELECT r.code FROM "IssuanceRecord" r JOIN "User" u ON u.id = r."userId" WHERE u.email = $1 AND r."supersededAt" IS NULL',
    [EMAIL],
  );
  const code = issued.rows.length === 1 ? String(issued.rows[0].code) : '';

  if (!/^[0-9a-f]{32}$/u.test(code)) {
    throw new Error(`the issued releve's record: ${issued.rows.length} current row(s), code well-formed: false`);
  }

  console.log(`  issued a releve through GET /api/v1/export/pdf: ${bytes.length} bytes in ${Date.now() - started} ms; code ${code.slice(0, 8)}...`);

  return code;
}

/**
 * The app's connections to the step's database, read from the host
 * (pg_stat_activity, the host probe's own excluded). Read at the stop, it says
 * whether the first read afterwards meets a WARM pool - the production shape -
 * or a cold one: node-postgres closes an idle client after about ten seconds.
 */
async function connectionsTo(hostUrl) {
  const result = await hostQuery(
    hostUrl,
    'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [DATABASE],
  );

  return Number(result.rows[0]?.n ?? 0);
}

/** The app container's log so far, per stream: append-only, so a later read's suffix is what came after. */
function appLogs(name) {
  const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });

  return { stdout: logs.stdout ?? '', stderr: logs.stderr ?? '' };
}

/** One reading of everything R946 names, for the routes given. */
async function snapshot(base, paths, databaseRoute, token) {
  const routes = [];

  for (const path of paths) routes.push({ path, answer: await get(`${base}${path}`) });

  return {
    health: await get(`${base}/api/health`),
    ready: await get(`${base}/api/ready`),
    sitemap: await get(`${base}/sitemap.xml`),
    routes,
    databaseRoute: await get(`${base}${databaseRoute}`, { authorization: `Bearer ${token}` }),
  };
}

const show = (answer) => (answer.status === null ? `no answer (${answer.error})` : String(answer.status));

/**
 * Run the step against `image`, serving on `port`. `pgPort` pins the database's
 * host port; unset, Docker picks a free one. Returns the failure, or null.
 */
export async function runDatabaseStoppedPhase({ image, port, pgPort }) {
  const run = randomBytes(4).toString('hex');
  const names = {
    network: `monreleve-dbstop-${run}`,
    database: `monreleve-dbstop-${run}-pg`,
    app: `monreleve-dbstop-${run}-app`,
  };
  const instance = `container-db-stopped-${run}`;
  const user = `u_${randomBytes(4).toString('hex')}`;
  const password = randomBytes(18).toString('hex');
  // Checked BY VALUE in every body the step reads while the database is down.
  const secrets = {
    'the database password': password,
    'the database user': user,
    'the database host': names.database,
  };
  const base = `http://127.0.0.1:${port}`;
  const databaseRoute = `/api/v1/entries?year=${new Date().getUTCFullYear()}`;

  // What this run created, by kind. A name joins BEFORE its create command
  // runs: a `docker run` that fails after creating its container (a port
  // already allocated) still leaves one, and it is still this run's.
  const created = { containers: [], network: null };
  const volumes = [];
  let failure = null;
  let passed = 0;

  console.log(`\n=== the database-stopped step (FW-DB-STOPPED, R945-R947) ===`);
  console.log(`image ${image}   port ${port}   run ${run}`);

  try {
    // ------------------------------------------------------------------------
    // 0. WHAT EARLIER RUNS LEFT: reported, never removed (R334)
    // ------------------------------------------------------------------------
    const leftovers = docker(['ps', '-a', '--filter', `label=${HARNESS_LABEL}`, '--format', '{{.Names}}'], secrets);

    if (leftovers !== '') {
      console.log(`  left by an earlier run, NOT removed (R334): ${leftovers.split(/\r?\n/u).join(', ')}`);
    }

    for (const name of Object.values(names)) {
      if (exists('container', name) || exists('network', name)) {
        throw new Error(`${name} already exists; this step refuses rather than removing what it did not create`);
      }
    }

    await assertPortFree(base);

    // ------------------------------------------------------------------------
    // 1. WHAT THE STEP READS RATHER THAN TYPES (R181)
    // ------------------------------------------------------------------------
    const service = JSON.parse(readFileSync(join(WEB, 'identity.json'), 'utf8')).service;
    const documented = documentedStatus(readFileSync(join(REPO, 'docs', 'api-v1.md'), 'utf8'), 'read_failed', 'GET');
    const postgresImage = composePostgresImage(readFileSync(join(REPO, 'docker-compose.yml'), 'utf8'));
    // FW-VERIFIER-OUTAGE: the two sentences /verifier is judged by, read out of
    // lib/fr (R181) - an .mjs cannot import TypeScript; the unit test pins both.
    const verificationSource = readFileSync(join(WEB, 'lib', 'fr', 'verification.ts'), 'utf8');
    const copy = {
      unavailable: copyLiteral(verificationSource, 'unavailable'),
      unknown: copyLiteral(verificationSource, 'unknown'),
    };
    // The origin the image was BUILT for: the entrypoint refuses any other
    // (R250), and the sitemap's <loc>s are on it.
    const origin = docker(['run', '--rm', '--entrypoint', 'cat', image, '/etc/frontalier-site-origin'], secrets);

    console.log(`  service ${service}, origin ${origin}, database image ${postgresImage}`);
    console.log(`  docs/api-v1.md documents read_failed on GET as ${documented}`);

    // ------------------------------------------------------------------------
    // 2. ITS OWN NETWORK AND ITS OWN POSTGRES (R945)
    // ------------------------------------------------------------------------
    created.network = names.network;
    docker(['network', 'create', '--label', HARNESS_LABEL, '--label', `monreleve.run=${run}`, names.network], secrets);

    created.containers.push(names.database);
    docker(
      [
        'run',
        '-d',
        '--name',
        names.database,
        '--network',
        names.network,
        '--label',
        HARNESS_LABEL,
        '--label',
        `monreleve.run=${run}`,
        '-e',
        `POSTGRES_USER=${user}`,
        '-e',
        `POSTGRES_PASSWORD=${password}`,
        '-e',
        `POSTGRES_DB=${DATABASE}`,
        '-p',
        `127.0.0.1:${pgPort ?? ''}:5432`,
        postgresImage,
      ],
      secrets,
    );

    volumes.push(
      ...docker(['inspect', '-f', '{{range .Mounts}}{{.Name}} {{end}}', names.database], secrets)
        .split(/\s+/u)
        .filter((name) => name !== ''),
    );

    await waitForPostgres(names.database, user, secrets);

    const hostPort = /:(\d+)\s*$/mu.exec(docker(['port', names.database, '5432/tcp'], secrets))?.[1];

    if (hostPort === undefined) throw new Error('docker port did not say where the database listens');

    const hostUrl = `postgresql://${user}:${password}@127.0.0.1:${hostPort}/${DATABASE}?schema=public`;

    await selectOne(hostUrl);
    console.log(`  ${names.database} is up on 127.0.0.1:${hostPort} (and ${names.database}:5432 on ${names.network})`);

    try {
      execFileSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        cwd: WEB,
        encoding: 'utf8',
        timeout: 300_000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DATABASE_URL: hostUrl },
      });
    } catch (cause) {
      throw new Error(`prisma migrate deploy failed: ${redact(String(cause?.stderr ?? cause), secrets).slice(-400)}`);
    }

    console.log(`  migrated ${DATABASE}`);

    // ------------------------------------------------------------------------
    // 3. THE IMAGE AGAINST IT, AND THE REFERENCE (R945: "proves a page served")
    // ------------------------------------------------------------------------
    created.containers.push(names.app);
    docker(
      [
        'run',
        '-d',
        '--name',
        names.app,
        '--network',
        names.network,
        '--label',
        HARNESS_LABEL,
        '--label',
        `monreleve.run=${run}`,
        '-p',
        `127.0.0.1:${port}:3000`,
        '-e',
        `DATABASE_URL=postgresql://${user}:${password}@${names.database}:5432/${DATABASE}?schema=public`,
        '-e',
        `AUTH_SECRET=${SECRET}`,
        '-e',
        `NEXT_PUBLIC_SITE_URL=${origin}`,
        '-e',
        `FRONTALIER_INSTANCE_ID=${instance}`,
        image,
      ],
      secrets,
    );

    await waitForOurInstance(base, names.app, service, instance, secrets);
    console.log(`  ${names.app} answers /api/health as ${instance}`);

    const token = await signIn(base, hostUrl);
    const listed = sitemapPaths((await get(`${base}/sitemap.xml`)).body, origin).paths;
    // FW-VERIFIER-OUTAGE (Web Ruling 20): /verifier/[code] is public, outside
    // the sitemap, and reads the database by design. It is judged with a REAL
    // code, issued here with the database up - where the unknown-code text
    // would be a false statement about a real releve.
    const holderName = `Titulaire ${run}`;
    const issuedCode = await issueReleve(base, hostUrl, token, holderName, new Date().getUTCFullYear());
    const verifierIssued = `/verifier/${issuedCode}`;

    const up = await snapshot(base, listed, databaseRoute, token);
    // A random well-formed code, the database up: the image's own unknown
    // sentence, present, before its absence is read below (presence first).
    const verifierUnknownUp = await get(`${base}/verifier/${randomBytes(16).toString('hex')}`);
    // THE LAST DATABASE-TOUCHING READ BEFORE THE STOP, so the pool is warm when
    // the database goes: node-postgres closes an idle client after ~10 s.
    const verifierIssuedUp = await get(`${base}${verifierIssued}`);
    const connectionsAtStop = await connectionsTo(hostUrl);
    const appBefore = lifetime(names.app, secrets);
    const logsBefore = appLogs(names.app);

    console.log(`  the reference: ${listed.length} route(s) in the sitemap, read with the database running`);
    console.log(`  the app's connections to ${DATABASE} at the stop (pg_stat_activity): ${connectionsAtStop}`);

    // ------------------------------------------------------------------------
    // 4. THE STOP, AND THE MEASUREMENT (R945, R946)
    // ------------------------------------------------------------------------
    docker(['stop', names.database], secrets, { timeout: 60_000 });

    const databaseRunning = isRunning(names.database, secrets);

    console.log(`  stopped ${names.database}; docker says running: ${databaseRunning}`);

    // /verifier FIRST: no other database-touching request may reach the pool
    // before it, so the error it gets is the warm pool's (Web Ruling 20 item 4).
    // A second read follows, printed beside it; then the log the two produced.
    const verifierFirst = await get(`${base}${verifierIssued}`);
    const verifierSecond = await get(`${base}${verifierIssued}`);
    const logsAfter = appLogs(names.app);
    const verifierLog = redact(
      `${logsAfter.stdout.slice(logsBefore.stdout.length)}${logsAfter.stderr.slice(logsBefore.stderr.length)}`,
      secrets,
    )
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== '');

    const down = { databaseRunning, ...(await snapshot(base, listed, databaseRoute, token)) };

    // ------------------------------------------------------------------------
    // 5. THE RECOVERY: the database started again, the app left alone
    // ------------------------------------------------------------------------
    docker(['start', names.database], secrets, { timeout: 60_000 });
    await waitForPostgres(names.database, user, secrets);

    const restarted = Date.now();
    let ready = await get(`${base}/api/ready`);

    while (!(ready.status === 200 && parsed(ready)?.ready === true) && Date.now() - restarted < RECOVERY_DEADLINE_MS) {
      await sleep(POLL_MS);
      ready = await get(`${base}/api/ready`);
    }

    console.log(
      `  started ${names.database} again; once it accepted connections, /api/ready answered ` +
        `${show(ready)} ${Date.now() - restarted} ms later`,
    );

    const recovery = {
      ready,
      health: await get(`${base}/api/health`),
      databaseRoute: await get(`${base}${databaseRoute}`, { authorization: `Bearer ${token}` }),
      appBefore,
      appAfter: lifetime(names.app, secrets),
    };

    // ------------------------------------------------------------------------
    // 6. WHAT WAS READ, THEN THE VERDICT
    // ------------------------------------------------------------------------
    console.log('\n--- every route the sitemap lists: running, then stopped (R946) ---');
    for (const path of listed) {
      const before = up.routes.find((route) => route.path === path)?.answer;
      const after = down.routes.find((route) => route.path === path)?.answer;
      const heading = after === undefined ? [] : headingsOf(after.body);

      console.log(
        `  ${path}  running ${before === undefined ? '-' : show(before)} [${before?.cacheControl ?? ''}]` +
          `  stopped ${after === undefined ? '-' : show(after)}  h1 ${JSON.stringify(heading)}`,
      );
    }

    console.log('\n--- with the database stopped (bodies redacted by value) ---');
    for (const { what, answer } of [
      { what: '/api/health', answer: down.health },
      { what: '/api/ready', answer: down.ready },
      { what: `GET ${databaseRoute}`, answer: down.databaseRoute },
    ]) {
      console.log(`  ${what}: ${show(answer)} in ${answer.ms} ms  body ${JSON.stringify(redact(answer.body, secrets).slice(0, 600))}`);
    }
    console.log('\n--- /verifier/<the issued code> (FW-VERIFIER-OUTAGE, Web Ruling 20) ---');
    for (const { what, answer } of [
      { what: 'running, an unknown code', answer: verifierUnknownUp },
      { what: 'running, the issued code', answer: verifierIssuedUp },
      { what: 'stopped, FIRST read (judged)', answer: verifierFirst },
      { what: 'stopped, second read', answer: verifierSecond },
    ]) {
      console.log(
        `  ${what}: ${show(answer)} in ${answer.ms} ms  [${answer.cacheControl ?? ''}]` +
          `  h1 ${JSON.stringify(headingsOf(answer.body))}` +
          `  leaks ${JSON.stringify(leaksIn(answer.body, secrets, { api: false }))}`,
      );
    }
    console.log(`  the app's log from the stop to the end of the two reads (${verifierLog.length} line(s), redacted):`);
    for (const line of verifierLog.slice(0, 80)) console.log(`    | ${line}`);

    const verdict = judgeDatabaseStopped({
      service,
      instance,
      origin,
      databaseRoute,
      documentedStatus: documented,
      secrets,
      up,
      down,
      recovery,
      verifier: {
        holderName,
        copy,
        connectionsAtStop,
        up: { issued: verifierIssuedUp, unknown: verifierUnknownUp },
        down: { first: verifierFirst, second: verifierSecond, log: verifierLog },
      },
    });

    passed = verdict.passed.length;

    console.log('\n--- the verdict (scripts/container-db-stopped-verdict.mjs) ---');
    for (const refusal of verdict.refusals) console.log(`  REFUSED: ${refusal}`);
    console.log(`Database-stopped checks  ${passed} passed (${passed + verdict.refusals.length})`);

    if (verdict.refusals.length > 0) {
      failure = `${verdict.refusals.length} refused: ${verdict.refusals.join('; ')}`;
    }
  } catch (cause) {
    failure = cause instanceof Error ? cause.message : String(cause);
  } finally {
    // EXACTLY WHAT THIS RUN CREATED, and the proof that it is gone.
    console.log('\n--- the database-stopped step: teardown ---');

    // BOTH STREAMS: the server writes its errors to stderr, and a log that
    // showed only stdout would hide the one line that says why.
    if (failure !== null && created.containers.includes(names.app) && exists('container', names.app)) {
      const logs = spawnSync('docker', ['logs', '--tail', '60', names.app], { encoding: 'utf8', timeout: 60_000 });

      console.log(redact(`${logs.stdout ?? ''}${logs.stderr ?? ''}`, secrets));
    }

    for (const name of [...created.containers].reverse()) {
      if (!exists('container', name)) continue;

      try {
        docker(['rm', '-f', '-v', name], secrets);
        console.log(`  removed container ${name} (and its anonymous volumes)`);
      } catch (cause) {
        console.log(`  could not remove ${name}: ${cause instanceof Error ? cause.message : cause}`);
      }
    }

    if (created.network !== null && exists('network', created.network)) {
      try {
        docker(['network', 'rm', created.network], secrets);
        console.log(`  removed network ${created.network}`);
      } catch (cause) {
        console.log(`  could not remove ${created.network}: ${cause instanceof Error ? cause.message : cause}`);
      }
    }

    // R133: the cleanup is READ BACK, not assumed.
    const left = [
      ...created.containers.filter((name) => exists('container', name)),
      ...(created.network !== null && exists('network', created.network) ? [created.network] : []),
      ...volumes.filter((volume) => exists('volume', volume)),
    ];

    console.log(
      `  read back: ${created.containers.length} container(s), ${created.network === null ? 0 : 1} network, ` +
        `${volumes.length} volume(s) [${volumes.join(', ')}]; left by this run: ${left.length === 0 ? 'nothing' : left.join(', ')}`,
    );

    if (left.length > 0) {
      const said = `teardown left ${left.join(', ')}`;

      failure = failure === null ? said : `${failure}; ${said}`;
    }
  }

  return { failure, passed };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const image = process.env.CONTAINER_IMAGE;

  if (image === undefined || image === '') {
    console.error('CONTAINER_IMAGE must name an image built for its origin (container-e2e.mjs builds one).');
    process.exit(64);
  }

  const result = await runDatabaseStoppedPhase({
    image,
    port: process.env.FRONTALIER_PORT ?? '3130',
    pgPort: process.env.CONTAINER_DB_STOPPED_PG_PORT,
  });

  if (result.failure !== null) {
    console.error(`\nDATABASE-STOPPED STEP FAILED: ${result.failure}\n`);
    process.exit(1);
  }

  console.log('\nDATABASE-STOPPED STEP PASSED - the image kept serving its public site with the database stopped (R946).\n');
}
