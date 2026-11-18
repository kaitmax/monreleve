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
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// ONE HOME FOR THE STRIPPING, not a second copy of the regex (R206). The
// count patterns and the thing that makes them readable belong together.
import { stripAnsi } from './gate-selection.mjs';
import { renderVerdict } from './container-render-verdict.mjs';
// FW-DB-STOPPED (R945-R947): the step run after this harness's own teardown.
import { runDatabaseStoppedPhase } from './container-db-stopped.mjs';

const PORT = process.env.FRONTALIER_PORT ?? '3100';
const IMAGE = process.env.CONTAINER_IMAGE ?? 'monreleve:e2e';
const NAME = 'monreleve-e2e';
const DB = `monreleve_container_e2e`;

// RULING R301: THE SUITE IDENTIFIES THE INSTANCE, NOT JUST THE PRODUCT.
//
// R169 makes the suite refuse a server that does not NAME this product, which
// is what makes reusing the port safe. It cannot tell a SIBLING instance of
// this same product - another session's container on the same port, with a
// different AUTH_SECRET - from the one started here. FW33 hit exactly that: a
// sibling passed R169 and then 503-ed every print token, because the token this
// process minted was signed with a key the sibling did not hold.
//
// So this run mints a value unique to itself, starts the container with it, and
// hands the SAME value to the vitest process below. The container echoes it from
// /api/health; container-auth.test.ts and container-pdf.test.ts refuse any
// server that does not echo it. A sibling cannot, by construction.
const INSTANCE_ID = `container-e2e-${randomBytes(8).toString('hex')}`;

/**
 * THIS LAUNCHER STARTS A SERVING SERVER, AND SAYS SO (R931).
 *
 * The image sets FRONTALIER_RUNTIME=1 by design (R81). The suite reads whether
 * the server under test is serving from /api/health's `runtime`, and
 * e2e/home.spec.ts requires that answer to equal this declaration - so the
 * container run proves the SERVING direction of /api/health and /api/ready,
 * and the host run, which declares nothing, the other. An image that stopped
 * being marked fails here by name instead of quietly switching directions.
 *
 * The name is written here and in home.spec.ts; if they drift, the run fails
 * on the /api/health test with both values in its message.
 */
const SERVING_DECLARATION = 'FRONTALIER_SERVER_IS_SERVING';

// ============================================================================
// FW-PDF-RENDER-GATE (R981): THE VITEST STEP RUNS THE RENDER TESTS TOO
// ============================================================================
//
// export-pdf.test.ts (15 render tests) and verification-qr.test.ts (2) need a
// live server naming this product, and no gate's test:db starts one - so
// until R981 they ran only by hand. This step already serves the image, so
// they run here, through the same vitest call as container-auth/container-pdf.
//
// WHAT THEY PROVE, PRECISELY. They import the export route's handler, so the
// handler and the renderer run in THIS process, with this machine's Chromium,
// and the browser fetches the IMAGE's print route - which reads the scratch
// database and signs nothing it did not verify. The image's own Chromium is
// container-pdf.test.ts's subject, not theirs.
//
// TWO PASSES, BECAUSE A SERVER HOLDS ONE VERIFICATION STATE (R332). The
// verification block prints only when MONRELEVE_VERIFICATION_ORIGIN is set on
// the SERVER, and verification-qr.test.ts reads the same setting in its own
// process to know which state to assert. So the first pass starts the image
// without it, the second restarts the same image with it, and the setting is
// set or removed on BOTH sides explicitly, never inherited.
//
// THE FILE NAMES STAY SINGLE-QUOTED LITERALS: the selector test reads this
// harness's list with a pattern, so a file added here is covered there (R936).
const FIRST_PASS_FILES = Object.freeze([
  'tests/db/container-auth.test.ts',
  'tests/db/container-pdf.test.ts',
  'tests/db/export-pdf.test.ts',
  'tests/db/verification-qr.test.ts',
]);
const SECOND_PASS_FILES = Object.freeze(['tests/db/verification-qr.test.ts']);
const VERIFICATION_ORIGIN_ENV = 'MONRELEVE_VERIFICATION_ORIGIN';

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

/**
 * Start the image on PORT. `extraEnv` carries the one setting the second
 * vitest pass varies (R981); everything else is the same start every time.
 */
function startContainer(siteOrigin, extraEnv = []) {
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
    `NEXT_PUBLIC_SITE_URL=${siteOrigin}`,
    // R301: the per-run marker this container echoes from /api/health, so the
    // live suites can tell it from a sibling of the same product.
    '-e',
    `FRONTALIER_INSTANCE_ID=${INSTANCE_ID}`,
    ...extraEnv.flatMap((setting) => ['-e', setting]),
    IMAGE,
  ]);
}

/** Where each vitest pass writes its JSON report; removed at teardown. */
const reportDir = mkdtempSync(join(tmpdir(), 'container-e2e-vitest-'));

/**
 * One vitest pass against the running container (R981).
 *
 * `verificationOrigin` is what the container was started with, or null when
 * it was started without one; this process gets the same, set or REMOVED,
 * because verification-qr.test.ts decides what to assert from its own copy.
 */
function vitestPass(slug, files, verificationOrigin) {
  const reportFile = join(reportDir, `${slug}.json`);
  const env = {
    ...process.env,
    DATABASE_URL: toolUrl,
    CONTAINER_BASE_URL: `http://127.0.0.1:${PORT}`,
    // export-pdf.test.ts and verification-qr.test.ts find the server through
    // tests/db/support/live-server.ts, which reads FRONTALIER_PORT - not
    // CONTAINER_BASE_URL - and requires /api/health to name this product.
    FRONTALIER_PORT: PORT,
    // R301: the SAME value the container was started with, so the two
    // tests can refuse any server that does not echo it. A sibling that
    // passed R169 (same product) fails here by name.
    FRONTALIER_INSTANCE_ID: INSTANCE_ID,
    // THE SAME SECRET THE CONTAINER HOLDS. container-pdf.test.ts and the
    // export route mint a print token HERE and hand it to the CONTAINER's
    // print route, so the two processes must sign with the same key. The
    // developer .env carries the placeholder, which print-token.ts refuses
    // by value - correctly, and that refusal is what this discovered:
    // mintPrintToken returned null and the comparison could not run.
    AUTH_SECRET: 'container-e2e-not-a-deployment-secret',
  };

  if (verificationOrigin === null) delete env[VERIFICATION_ORIGIN_ENV];
  else env[VERIFICATION_ORIGIN_ENV] = verificationOrigin;

  let output = '';
  let threw = false;

  try {
    output = run(
      'node',
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'vitest.db.config.ts',
        ...files,
        // VERBOSE, SO THE PDF'S PAGE FACTS COME FROM THIS RUN (R936). The
        // default reporter printed no console output for a passing test, so
        // the `[pdf]` line - each render's page count and page sizes - was
        // visible only in a second, separate verbose run (W1's QUESTION 1).
        // The line is REQUIRED below, so a reporter that drops it fails
        // the run rather than going quiet.
        '--reporter=verbose',
        // AND JSON, for the per-test verdict (R981): a count cannot tell
        // fifteen skipped render tests from fifteen that passed.
        '--reporter=json',
        `--outputFile.json=${reportFile}`,
      ],
      { env },
    );
  } catch (cause) {
    output = `${cause.stdout ?? ''}${cause.stderr ?? ''}`;
    threw = true;
  }

  console.log(output);

  let report = null;

  try {
    report = JSON.parse(readFileSync(reportFile, 'utf8'));
  } catch {
    // No report: the verdict below names it.
  }

  return { output, threw, report };
}

let failure = null;

// Whether IMAGE was built by this run, so the database-stopped step below has
// an image to run. Set once, after the build and nowhere else.
let imageBuilt = false;

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
    // A COLD BUILD ON A SLOW LINK EXCEEDED FIFTEEN MINUTES: the supply-chain
    // pass over 1042 lockfile entries plus a full next build. The timeout
    // killed a build that then finished seconds later, and the failure read
    // as "spawnSync docker ETIMEDOUT" - a docker fault rather than an
    // impatient harness.
    timeout: 2_400_000,
  });

  imageBuilt = true;

  console.log(`\n--- starting ${IMAGE} on ${PORT} ---`);
  startContainer(origin);

  const health = await waitForOurProduct();

  console.log(`\n/api/health names: ${health.service} (status ${health.status ?? 'n/a'})`);

  // ==========================================================================
  // ONE DESIGNED DIFFERENCE, DERIVED AND NAMED - NEVER TOLERATED (R133)
  // ==========================================================================
  //
  // The suite as configured describes a TEST server, not a DEPLOYED one, and
  // playwright.config.ts says so in its own comment. One kind of spec cannot
  // pass against the image and MUST NOT:
  //
  //   /dev/** SPECS. R129: "the test build keeps /dev/**, the production
  //   build does not." The workbench, the rail gallery and the parity harness
  //   are driven through /dev routes, and a dev harness in the chunk graph
  //   was costing the calculator 1,6 KiB. An image that could serve them
  //   would be the defect.
  //
  // THERE USED TO BE TWO. The /api/health spec asserting `runtime: false` was
  // excluded here by title, because the image is marked as serving (R81). Its
  // /api/ready sibling carried the same premise from R355 on and was never
  // excluded, so this run stopped at it on every commit and never reached the
  // PDF step below. R931 made both read the role instead - the server reports
  // it, SERVING_DECLARATION above pins it - so both run here, in the serving
  // direction, and nothing is excluded for its premise.
  //
  // THE DEV LIST IS DERIVED, not written down: any spec that mentions a /dev/
  // path is excluded, so a new one is covered the day it is written. It is
  // PRINTED, because an exclusion nobody reads is an exclusion nobody can
  // challenge.
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

  console.log(`\n--- pnpm test:e2e against the container: ${runSpecs.length} spec files ---\n`);

  // ONE QUOTED COMMAND STRING, NOT AN ARGUMENT ARRAY. With `shell: true` node
  // joins an array with spaces and quotes nothing, so a title filter this
  // harness once passed - which contained spaces - arrived as eight separate
  // arguments and Playwright silently ran the whole suite. The symptom was a filter that printed
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
  ].join(' ');

  const suite = spawn(command, {
    stdio: 'inherit',
    shell: true,
    // FRONTALIER_SERVER_IS_OURS: this process started the container on that
    // port, so it is the only one that can honestly tell Playwright the server
    // is ours to reuse. Without it, CI turned reuse off, Playwright tried to
    // start its own server on the port the container already held, and the job
    // died before a spec ran - every time, since the suite was written (F-CI).
    // R169's global setup still refuses anything that does not name this
    // product, so the claim is checked rather than trusted.
    //
    // SERVING_DECLARATION is the same kind of claim (R931): this process
    // started an image marked as serving, and home.spec.ts checks the server
    // agrees before asserting the serving state of /api/ready.
    // DATABASE_URL IS THE CONTAINER'S (W12, FW-WEB-ACCOUNT): the account-area
    // specs seed their person and read the request row through
    // e2e/support/database.ts, and must reach the database the container
    // serves from - as the vitest passes below already do. Inherited, it named
    // the session's own scratch database, so the server never saw the person.
    env: {
      ...process.env,
      DATABASE_URL: toolUrl,
      FRONTALIER_PORT: PORT,
      FRONTALIER_SERVER_IS_OURS: '1',
      [SERVING_DECLARATION]: '1',
    },
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
  //
  // THE COUNT STOPPED BEING ENOUGH AT R981. export-pdf.test.ts has seven
  // handler-only tests that pass with no server, so a non-zero count no longer
  // proves its render tests ran. The per-test verdict below is what does.
  if (failure === null) {
    console.log(
      '\n--- the vitest step, pass 1 (no verification origin): the auth round trip, ' +
        'the PDF, and the render tests (R981) ---\n',
    );

    const passes = [];
    const first = vitestPass('pass-1', FIRST_PASS_FILES, null);
    const authOutput = first.output;

    passes.push({ label: 'pass 1 (no verification origin)', report: first.report });

    if (first.threw) {
      // NAMED, not merely "it failed": the tests that failed, from the run's
      // own report, so the last line of a red run says which (R983).
      const failed = renderVerdict(passes, []).refusals.filter((refusal) => refusal.includes(' FAILED in '));

      failure =
        'the vitest step (pass 1) failed against the container' +
        (failed.length === 0 ? '' : `: ${failed.join('; ')}`);
    }

    // STRIPPED FIRST, AND CI IS WHAT TAUGHT THIS. vitest colourises when it
    // decides it is talking to a terminal, and prints
    // `Tests  \u001B[1m\u001B[32m9 passed\u001B[39m` - which this pattern
    // cannot match, because it wants the digits immediately after the label.
    // On 24 September nine tests passed here, the parse returned null, and the
    // harness reported "no passing tests": R133's guard against a suite that
    // skipped everything, firing on a suite that had passed everything.
    const counted = /Tests {2}(?:\d+ failed \| )?(\d+) passed/u.exec(stripAnsi(authOutput));
    const passed = counted === null ? 0 : Number(counted[1]);

    if (failure === null && passed < 1) {
      failure =
        'the vitest step (pass 1) reported no passing tests. A file that SKIPPED ' +
        'everything exits 0 and reads exactly like one that passed everything ' +
        '(R133), so the count is the signal rather than the exit code.';
    } else if (failure === null) {
      console.log(`vitest step, pass 1: ${passed} passed, over HTTP, against the image.`);
    }

    // THE PDF'S PAGE FACTS, FROM THIS RUN (R936). container-pdf.test.ts
    // prints one `[pdf]` line - bytes, page count and page sizes for the
    // image's render and this machine's - before it asserts that every page
    // is A4. A pass without that line is a pass nobody can read the document
    // from, so its absence fails the run the way a zero count does (R133).
    const pdfLines = stripAnsi(authOutput)
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('[pdf] '));

    console.log('\n--- the PDF, from this run: page count and page size (R936) ---');
    for (const line of pdfLines) console.log(`  ${line}`);

    if (failure === null && pdfLines.length === 0) {
      failure =
        'the PDF step printed no `[pdf]` line, so this run cannot say how many ' +
        'pages the document has or what size they are (R936)';
    }

    // ========================================================================
    // PASS 2: THE SAME IMAGE, RESTARTED WITH A VERIFICATION ORIGIN (R981)
    // ========================================================================
    //
    // Only after pass 1 is green: teardown prints the LAST container's log,
    // so a pass-1 failure must not be followed by a restart that hides it.
    //
    // The origin is the image's own baked origin - https, not local, a bare
    // origin - which is what lib/verification/origin.ts accepts (R332).
    if (failure === null) {
      console.log(
        `\n--- the vitest step, pass 2: ${IMAGE} restarted with ${VERIFICATION_ORIGIN_ENV}=${origin} (R332) ---`,
      );

      removeContainer();
      await assertPortFree();
      startContainer(origin, [`${VERIFICATION_ORIGIN_ENV}=${origin}`]);

      const restarted = await waitForOurProduct();

      console.log(`/api/health names: ${restarted.service} (status ${restarted.status ?? 'n/a'})\n`);

      const second = vitestPass('pass-2', SECOND_PASS_FILES, origin);

      passes.push({ label: 'pass 2 (verification origin set)', report: second.report });

      if (second.threw) failure = 'the vitest step (pass 2, verification origin set) failed against the container';
    }

    // ========================================================================
    // THE VERDICT, PER TEST (R981, R133)
    // ========================================================================
    //
    // Every test of every file the step runs passed in at least one pass, and
    // none failed in any. Printed whether or not the run is already red, so a
    // failing run still says which tests ran and where.
    const verdict = renderVerdict(passes, [...new Set([...FIRST_PASS_FILES, ...SECOND_PASS_FILES])]);

    console.log('\n--- every test the vitest step ran, and the pass it passed in (R981) ---');
    for (const row of verdict.rows) {
      console.log(`  ${row.passedIn.length === 0 ? 'NOT PASSED' : 'passed'}  ${row.file} > ${row.name}  [${row.statuses.join('; ')}]`);
    }
    console.log(`  ${verdict.rows.length} tests; refusals: ${verdict.refusals.length}`);
    for (const refusal of verdict.refusals) console.log(`  REFUSED: ${refusal}`);

    if (failure === null && verdict.refusals.length > 0) {
      failure = `the vitest step's per-test verdict refused ${verdict.refusals.length}: ${verdict.refusals.join('; ')}`;
    }
  }
} catch (cause) {
  failure = cause instanceof Error ? cause.message : String(cause);
} finally {
  // ALWAYS, and in this order: the container first, because the database it
  // holds connections to cannot be dropped while it does.
  console.log('\n--- teardown ---');

  try {
    // SIXTY, NOT FIFTEEN. A failing PDF export logs its refusal code and is
    // then followed by request noise, so fifteen lines showed the startup
    // banner and hid the one line that said WHY - which is a teardown that
    // reports without diagnosing.
    console.log(run('docker', ['logs', '--tail', '60', NAME], { stdio: ['ignore', 'pipe', 'pipe'] }));
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

  rmSync(reportDir, { recursive: true, force: true });
}

// ============================================================================
// FW-DB-STOPPED (R945-R947): THE PUBLIC SITE, WITH THE DATABASE STOPPED
// ============================================================================
//
// Plan Checkpoint D item 5's second half, against the image built above. It
// lives in its own module, scripts/container-db-stopped.mjs, because it needs
// what this harness must never have: a database it OWNS and may stop. The
// compose server above holds other worktrees' scratch databases, and its
// container names here are fixed; the step brings its own Postgres, its own
// network and its own unique names, and removes only what it created.
//
// AFTER THE TEARDOWN, ON THE SAME PORT, and whenever the image exists - even
// when a step above is already red. A first-failure-wins harness would
// otherwise answer "did the public site survive the stop?" only on green runs,
// and a page made to read the database can redden an e2e spec too (its
// metadata leaves <head> once it renders per request), which would hide the
// step that names it. Its refusals join the last line.
if (imageBuilt) {
  const phase = await runDatabaseStoppedPhase({
    image: IMAGE,
    port: PORT,
    pgPort: process.env.CONTAINER_DB_STOPPED_PG_PORT,
  });

  if (phase.failure !== null) {
    const said = `the database-stopped step (R946): ${phase.failure}`;

    failure = failure === null ? said : `${failure}; and ${said}`;
  }
} else {
  console.log('\n--- the database-stopped step (R946) did not run: this run built no image ---');
}

if (failure !== null) {
  console.error(`\nCONTAINER E2E FAILED: ${failure}\n`);
  process.exit(1);
}

console.log('\nCONTAINER E2E PASSED - the deployed artefact served the whole suite (R249).\n');
