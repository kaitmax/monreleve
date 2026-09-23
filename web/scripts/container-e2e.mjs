// web/scripts/container-e2e.mjs
//
// ============================================================================
// RULING R249: THE E2E SUITE RUNS AGAINST THE IMAGE, NOT AGAINST next start
// ============================================================================
//
// `pnpm test:e2e` normally builds the app and runs `next start`. That proves
// the source is correct. It cannot prove the DEPLOYED ARTEFACT is, and the two
// differ in every way FW28 has already found: standalone output rather than
// node_modules, an apt Chromium rather than a downloaded one, a Linux
// filesystem, TZ=Europe/Paris in the process rather than whatever the
// developer's machine has, and an entrypoint that decides whether any of it
// runs.
//
// So the container is started and the SAME 284 specs are pointed at it.
//
// ============================================================================
// WHY THIS NEEDS ALMOST NO NEW TEST CODE
// ============================================================================
//
// R170 put the port behind FRONTALIER_PORT, read by one module that both the
// webServer and the specs use. R169 made the suite refuse to run unless
// /api/health NAMES this product. Together those mean: occupy the port with
// the container, and Playwright reuses it instead of building - while the
// health check establishes that what answers is ours rather than a neighbour.
//
// Neither rule was written for this. Both were written after a suite ran 91
// tests against somebody else's container, and they are exactly what makes
// pointing the suite somewhere else safe.
//
// ============================================================================
// THE DATABASE IS SCRATCH, CREATED AND MIGRATED HERE
// ============================================================================
//
// gate:clone's argument, one artefact over: a suite that runs against the
// development database proves the schema on THIS machine works. The scratch
// database is created, migrated from prisma/migrations, used, and dropped, so
// what is proven is that the migrations in the image produce a schema the
// image can serve.

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const PORT = process.env.FRONTALIER_PORT ?? '3100';
const IMAGE = process.env.CONTAINER_IMAGE ?? 'monreleve:e2e';
const NAME = 'monreleve-e2e';
const DB = `monreleve_container_e2e`;

/**
 * The one spec whose premise the image contradicts by design.
 *
 * Matched by TITLE rather than by file, because the rest of home.spec.ts is
 * exactly the kind of thing that should run against a deployed artefact.
 */
const NON_SERVING_TITLE = '/api/health reports ok when the process is not marked as serving';

// The local compose database. Credentials are the ones docker-compose.yml
// publishes and are not secret.
const PG_HOST_FOR_TOOLS = 'localhost';
const PG_PORT = '5436';
const PG_USER = 'frontalier';
const PG_PASSWORD = 'frontalier';

/** Inside a container, the host is reachable under this name. */
const PG_HOST_FOR_CONTAINER = 'host.docker.internal';

/**
 * A database the caller already has, used as given.
 *
 * CI sets it from its `services: postgres`; locally it is unset and a scratch
 * database is created inside the compose container instead.
 */
const SUPPLIED_DATABASE_URL = process.env.CONTAINER_E2E_DATABASE_URL;

const toolUrl =
  SUPPLIED_DATABASE_URL ??
  `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST_FOR_TOOLS}:${PG_PORT}/${DB}?schema=public`;

// The container reaches the host under a different name, so a SUPPLIED url has
// its host rewritten unless it already names something a container can resolve.
const containerUrl =
  SUPPLIED_DATABASE_URL === undefined
    ? `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST_FOR_CONTAINER}:${PG_PORT}/${DB}?schema=public`
    : SUPPLIED_DATABASE_URL.replace('@localhost:', `@${PG_HOST_FOR_CONTAINER}:`).replace(
        '@127.0.0.1:',
        `@${PG_HOST_FOR_CONTAINER}:`,
      );

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, ...options });
}

/**
 * Run SQL through the compose container, so no local psql is required.
 *
 * THE PORT INSIDE IS 5432, NOT 5436, and getting that wrong is the first
 * thing this script did. 5436 is the HOST-published port - chosen because two
 * other projects on this machine already hold 5434 and 5435 - and inside the
 * container Postgres listens on the ordinary one. Rewriting the host without
 * the port produced "connection refused" against the container's own
 * loopback, which reads exactly like a database that is not running.
 */
function psql(sql, database = 'postgres') {
  const insideUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${database}`;

  return run('docker', [
    'exec',
    '-e',
    `PGPASSWORD=${PG_PASSWORD}`,
    'frontalier-postgres',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-d',
    insideUrl,
    '-c',
    sql,
  ]);
}

function removeContainer() {
  try {
    run('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
  } catch {
    // Not running is the ordinary case.
  }
}

/**
 * R179: ASSERT THE PORT IS FREE BEFORE STARTING, AND KILL THE TREE ON THE WAY
 * OUT. Both halves, because either alone leaves the trap - and a stale server
 * must fail loudly AS a stale server rather than being silently reused, which
 * is precisely what reuseExistingServer would otherwise do here.
 */
async function assertPortFree() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = await response.text();

    throw new Error(
      `R179: something is already listening on ${PORT} and answering /api/health. ` +
        `This harness only authorises killing a tree it spawned, and that is not one. ` +
        `Free the port or set FRONTALIER_PORT. Got: ${body.slice(0, 200)}`,
    );
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('R179:')) throw cause;
    // Anything else means nothing answered, which is what we want.
  }
}

/** R169's question, asked before the suite is allowed to care about anything. */
async function waitForOurProduct() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const body = await response.json();

        if (body.service === undefined) {
          throw new Error(
            `R169: ${PORT} answered /api/health with 200 and no \`service\` field. ` +
              'Something is listening; it is not this product.',
          );
        }

        return body;
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('R169:')) throw cause;
      // Still starting.
    }
  }

  throw new Error(`the container did not answer /api/health on ${PORT} within 120s`);
}

let failure = null;

try {
  await assertPortFree();
  removeContainer();

  // ==========================================================================
  // THE DATABASE IS SUPPLIED, OR CREATED - BECAUSE CI HAS NO COMPOSE STACK
  // ==========================================================================
  //
  // Locally there is a compose container called frontalier-postgres and this
  // creates a scratch database inside it. CI has a `services: postgres` with
  // no such container NAME, so `docker exec frontalier-postgres` cannot work
  // there.
  //
  // Rather than declare the suite local-only - which R251 calls an exemption
  // where a mechanism belongs - the caller may hand over a database and this
  // uses it as given. CI does; a developer does not have to.
  if (SUPPLIED_DATABASE_URL === undefined) {
    console.log(`\n--- scratch database ${DB} ---`);
    psql(`DROP DATABASE IF EXISTS ${DB}`);
    psql(`CREATE DATABASE ${DB}`);
  } else {
    console.log('\n--- using the database supplied in CONTAINER_E2E_DATABASE_URL ---');
  }

  console.log('--- pnpm prisma migrate deploy (into the scratch database) ---');
  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: toolUrl },
  });

  // ==========================================================================
  // THE IMAGE IS BUILT HERE, FOR THIS ORIGIN
  // ==========================================================================
  //
  // NEXT_PUBLIC_SITE_URL is a BUILD input for every static route, because
  // their <head> - canonical included - is rendered during `next build`. An
  // image built without it failed 41 of these 284 specs while the same source
  // under `next start` passed all of them.
  //
  // So the suite cannot borrow whatever image is lying around: it builds one
  // whose baked origin is the address the suite will actually visit. The
  // entrypoint refuses a mismatch, so getting this wrong is loud rather than
  // subtly wrong in the canonicals.
  // THE ORIGIN IS THE ONE THE SUITE ASSERTS, NOT THE ADDRESS IT DIALS. The
  // canonical tests compare against TEST_ORIGIN - https://monreleve.example,
  // reserved by RFC 2606 so it can never resolve and can never be mistaken
  // for the real domain. Building with `http://localhost:3100` made 19 of
  // them fail with "Expected https://monreleve.example, Received
  // http://localhost:3100", which is the suite being right.
  //
  // WHY IT IS WRITTEN HERE RATHER THAN IMPORTED. TEST_ORIGIN is computed in
  // lib/content/identity.ts as `https://${asciiName(APP_NAME)}.example`, and
  // that module imports through the `@/` alias, which a plain node process
  // cannot resolve. A `catch` falling back to a copy would be worse than the
  // copy: it would hide the drift it was added to prevent.
  //
  // THE ENFORCEMENT IS THE SUITE ITSELF, which is a mechanism rather than two
  // constants a test compares (R206). If this value ever stops matching
  // TEST_ORIGIN, the 19 canonical specs fail immediately with "Expected
  // <theirs>, Received <this one>" - which is exactly how it was found.
  const origin = 'https://monreleve.example';

  console.log(`\n--- building ${IMAGE} for origin ${origin} ---`);
  run('docker', ['build', '--build-arg', `NEXT_PUBLIC_SITE_URL=${origin}`, '-t', IMAGE, '.'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    timeout: 900_000,
  });

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
    'AUTH_SECRET=container-e2e-not-a-deployment-secret',
    '-e',
    `NEXT_PUBLIC_SITE_URL=${origin}`,
    IMAGE,
  ]);

  const health = await waitForOurProduct();

  console.log(`\n/api/health names: ${health.service} (status ${health.status ?? 'n/a'})`);

  // ==========================================================================
  // TWO DESIGNED DIFFERENCES, DERIVED AND NAMED - NEVER TOLERATED (R133)
  // ==========================================================================
  //
  // The suite as configured describes a TEST server, not a DEPLOYED one, and
  // playwright.config.ts says so in its own comment. Two specs cannot pass
  // against the image and MUST NOT:
  //
  //   /dev/** SPECS. R129: "the test build keeps /dev/**, the production
  //   build does not." The workbench, the rail gallery and the parity harness
  //   are driven through /dev routes, and a dev harness in the chunk graph
  //   was costing the calculator 1,6 KiB. An image that could serve them
  //   would be the defect.
  //
  //   THE NON-SERVING HEALTH SPEC. It asserts `runtime: false` - the state of
  //   a process NOT marked as serving. The image sets FRONTALIER_RUNTIME=1 by
  //   design (R81), so its premise is false here. The marked case has an
  //   owner already: playwright.runtime.config.ts.
  //
  // THE DEV LIST IS DERIVED, not written down: any spec that mentions a /dev/
  // path is excluded, so a new one is covered the day it is written. Both
  // lists are PRINTED, because an exclusion nobody reads is an exclusion
  // nobody can challenge.
  const specs = readdirSync('e2e')
    .filter((name) => name.endsWith('.spec.ts'))
    .filter((name) => !name.endsWith('.visual.spec.ts') && !name.endsWith('.runtime.spec.ts'));

  const devSpecs = specs.filter((name) => /['"`]\/dev\//u.test(readFileSync(`e2e/${name}`, 'utf8')));
  const runSpecs = specs.filter((name) => !devSpecs.includes(name));

  if (runSpecs.length === 0) {
    throw new Error('every spec was excluded - a run of nothing passes perfectly (R63)');
  }

  console.log(`\n--- excluded, with the reason (R133) ---`);
  for (const name of devSpecs) console.log(`  e2e/${name}  reaches /dev/**, which R129 keeps OUT of the production build`);
  console.log(`  "${NON_SERVING_TITLE}"`);
  console.log('      asserts runtime:false; the image is marked as serving (R81),');
  console.log('      and playwright.runtime.config.ts owns the marked case');

  console.log(`\n--- pnpm test:e2e against the container: ${runSpecs.length} spec files ---\n`);

  // ONE QUOTED COMMAND STRING, NOT AN ARGUMENT ARRAY. With `shell: true` node
  // joins an array with spaces and quotes nothing, so the excluded TITLE -
  // which contains spaces - arrived as eight separate arguments and Playwright
  // silently ran the whole suite. The symptom was a filter that printed
  // correctly and did nothing: 284 tests, the same 10 failures, and an
  // exclusion list that read as if it had been applied.
  //
  // It is the shell-quoting defect this session has now met four times, and
  // the count below is what catches it: if the filter is ignored again, the
  // number of spec files run will not match.
  // THE SUITE'S DEFINITION COMES FROM package.json, and the filters are
  // appended to it. `pnpm test:e2e -- <args>` does not forward here - it ran
  // all 284 twice while printing an exclusion list - so rather than guess at
  // pnpm's argument handling, the one definition of what test:e2e IS gets
  // read from where it lives (R206) and extended.
  const testE2e = JSON.parse(readFileSync('package.json', 'utf8')).scripts['test:e2e'];

  if (typeof testE2e !== 'string' || !testE2e.includes('playwright')) {
    throw new Error(`package.json scripts["test:e2e"] is not a playwright command: ${testE2e}`);
  }

  const command = [
    'pnpm',
    'exec',
    testE2e,
    ...runSpecs.map((name) => JSON.stringify(`e2e/${name}`)),
    '--grep-invert',
    JSON.stringify(NON_SERVING_TITLE),
  ].join(' ');

  const suite = spawn(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FRONTALIER_PORT: PORT },
  });

  const code = await new Promise((resolve) => suite.on('exit', resolve));

  if (code !== 0) failure = `pnpm test:e2e exited ${code} against the container`;

  // ==========================================================================
  // THE AUTH ROUND TRIP, OVER HTTP, AGAINST THE SAME CONTAINER
  // ==========================================================================
  //
  // Playwright drives a browser; this drives the API. The flow has no page -
  // it is a device client's - so a spec would be the wrong shape for it, and
  // tests/db/container-auth.test.ts is a vitest file pointed at the container
  // by CONTAINER_BASE_URL.
  //
  // R133: THE COUNT IS READ BACK. That file is `describe.skipIf(BASE ===
  // undefined)`, so it skips silently under `pnpm test:db` where there is no
  // container - and a suite that skipped everything exits 0 and looks exactly
  // like a suite that passed everything. Asserting a non-zero pass count is
  // what makes the skip safe, which is R169's presence-before-absence
  // corollary applied to a test file rather than to a server.
  if (failure === null) {
    console.log('\n--- the auth round trip, over HTTP, against the container ---\n');

    let authOutput = '';

    try {
      authOutput = run(
        'node',
        [
          'node_modules/vitest/vitest.mjs',
          'run',
          '--config',
          'vitest.db.config.ts',
          'tests/db/container-auth.test.ts',
        ],
        {
          env: {
            ...process.env,
            DATABASE_URL: toolUrl,
            CONTAINER_BASE_URL: `http://127.0.0.1:${PORT}`,
          },
        },
      );
      console.log(authOutput);
    } catch (cause) {
      authOutput = `${cause.stdout ?? ''}${cause.stderr ?? ''}`;
      console.log(authOutput);
      failure = 'the auth round trip failed against the container';
    }

    const counted = /Tests {2}(?:\d+ failed \| )?(\d+) passed/u.exec(authOutput);
    const passed = counted === null ? 0 : Number(counted[1]);

    if (failure === null && passed < 1) {
      failure =
        'the auth round trip reported no passing tests. A file that SKIPPED ' +
        'everything exits 0 and reads exactly like one that passed everything ' +
        '(R133), so the count is the signal rather than the exit code.';
    } else if (failure === null) {
      console.log(`auth round trip: ${passed} passed, over HTTP, against the image.`);
    }
  }
} catch (cause) {
  failure = cause instanceof Error ? cause.message : String(cause);
} finally {
  // ALWAYS, and in this order: the container first, because the database it
  // holds connections to cannot be dropped while it does.
  console.log('\n--- teardown ---');

  try {
    console.log(run('docker', ['logs', '--tail', '15', NAME], { stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    // No container, no logs.
  }

  removeContainer();

  if (SUPPLIED_DATABASE_URL === undefined) {
    try {
      psql(`DROP DATABASE IF EXISTS ${DB}`);
      console.log(`scratch database ${DB} dropped`);
    } catch (cause) {
      console.error(`could not drop ${DB}: ${cause instanceof Error ? cause.message : cause}`);
    }
  } else {
    console.log('the supplied database is left alone - this script did not create it');
  }
}

if (failure !== null) {
  console.error(`\nCONTAINER E2E FAILED: ${failure}\n`);
  process.exit(1);
}

console.log('\nCONTAINER E2E PASSED - the deployed artefact served the whole suite (R249).\n');
