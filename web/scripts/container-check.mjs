// web/scripts/container-facts.mjs
//
// ============================================================================
// RULING R249: A DEPLOYMENT IS A CLAIM ABOUT A MACHINE, NOT A FILE
// ============================================================================
//
// `docker build` exiting 0 says a sequence of commands succeeded. It does not
// say the server binds an address a proxy can reach, that the timezone the
// document's day boundaries depend on is the one that resolves, that Chromium
// starts, or that the browser is the version this repository pinned.
//
// So every fact below is read OUT OF A RUNNING CONTAINER. The image is started,
// asked, and stopped. Nothing here inspects the Dockerfile, because the
// Dockerfile is the claim and not the evidence - and the two have already
// disagreed once in this task: `pnpm-workspace.yaml` was not copied, the
// instruction to copy it looked complete, and only running the build found it.
//
// R133: A POSITIVE SIGNAL, NEVER AN ABSENCE. The probe emits a MARKER, and a
// payload without it is a failure rather than a pass. A `docker run` that dies
// before node starts prints nothing on stdout, and "no output" must not read
// as "no problems" - that is the exact shape that let FW13's mutation harness
// report four surviving mutants after running zero tests.

import { execFileSync } from 'node:child_process';

const MARKER = 'frontalier-container-facts';

const ARGS = process.argv.slice(2);
const SHOULD_BUILD = ARGS.includes('--build');
const IMAGE = ARGS.find((arg) => !arg.startsWith('--')) ?? 'monreleve:fw28';

/**
 * RULING R251: A FILE THAT DETERMINES WHAT RUNS, OR WHETHER IT RUNS, BELONGS
 * TO A SUITE - and for the container that suite is this one.
 *
 * `--build` makes the suite self-contained: it is the gate's job to test the
 * image THIS COMMIT describes, not whatever image happens to be on the
 * machine. Docker's layer cache makes a no-op rebuild cheap, and a rebuild
 * that is NOT a no-op is precisely the case the suite was selected for.
 *
 * Without it the suite would measure a stale artefact and pass, which is
 * R184's distinction: what was photographed, not only what was produced.
 */
if (SHOULD_BUILD) {
  console.log(`\nbuilding ${IMAGE} (R251: the suite tests the image this commit describes)`);

  try {
    execFileSync('docker', ['build', '-t', IMAGE, '.'], {
      stdio: ['ignore', 'ignore', 'inherit'],
      timeout: 900_000,
    });
  } catch (cause) {
    console.error(`\ndocker build failed: ${cause instanceof Error ? cause.message : cause}`);
    process.exit(1);
  }
}

/**
 * Read inside the container, printed as one JSON line.
 *
 * Passed with execFileSync's argument array rather than through a shell, so
 * nothing here is subject to quoting. Three scripted edits were corrupted by
 * shell quoting earlier in this project; the lesson generalises to any code
 * that travels as a string.
 */
const PROBE = `
const { execSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync } = require('node:fs');

const read = (p) => { try { return readFileSync(p, 'utf8').trim(); } catch { return null; } };
const run = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return null; } };
const dir = (p) => { try { return readdirSync(p); } catch { return null; } };

process.stdout.write(JSON.stringify({
  marker: '${MARKER}',
  uid: process.getuid(),
  user: run('id -un'),
  env: {
    HOSTNAME: process.env.HOSTNAME ?? null,
    TZ: process.env.TZ ?? null,
    FRONTALIER_RUNTIME: process.env.FRONTALIER_RUNTIME ?? null,
    FRONTALIER_CHROMIUM_PATH: process.env.FRONTALIER_CHROMIUM_PATH ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
  },
  resolvedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  pinnedChromium: read('/etc/frontalier-chromium-version'),
  chromiumVersion: run((process.env.FRONTALIER_CHROMIUM_PATH || 'chromium') + ' --version'),
  serverJs: existsSync('/app/server.js'),
  staticDir: existsSync('/app/.next/static'),
  fonts: dir('/app/public/fonts'),
  migrations: (dir('/app/prisma/migrations') || []).filter((n) => n !== 'migration_lock.toml').length,
  playwrightTestPresent: existsSync('/app/node_modules/@playwright/test'),
}));
`;

function probe() {
  let raw;

  try {
    raw = execFileSync(
      'docker',
      ['run', '--rm', '--entrypoint', 'node', IMAGE, '-e', PROBE],
      { encoding: 'utf8', timeout: 180_000 },
    );
  } catch (cause) {
    throw new Error(`could not run ${IMAGE}: ${cause instanceof Error ? cause.message : cause}`);
  }

  const line = raw.trim().split('\n').at(-1) ?? '';
  let parsed;

  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(
      `the probe produced no JSON. A container that dies before node starts ` +
        `prints nothing, and silence must not read as success (R133). Got: ` +
        JSON.stringify(raw.slice(0, 400)),
    );
  }

  if (parsed.marker !== MARKER) {
    throw new Error(
      `the payload does not carry this probe's marker. Something answered, but ` +
        `not the thing that was asked (R169's shape, one layer down).`,
    );
  }

  return parsed;
}

const facts = probe();
const failures = [];

/**
 * How many claims this suite actually made.
 *
 * R133: gate-selection.mjs reads a count back from every suite it runs,
 * because a suite that reports nothing must not read as a pass. Declared
 * here rather than beside phase 2 so that BOTH phases feed one number -
 * a count that covered half the suite would be the same defect one level in.
 */
let checks = 0;

/** @param {string} what @param {unknown} got @param {unknown} want @param {string} why */
function is(what, got, want, why) {
  const ok = got === want;

  if (!ok) failures.push(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)} - ${why}`);

  checks += 1;

  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what.padEnd(26)} ${String(got)}`);
}

console.log(`\ncontainer facts, read from a RUNNING ${IMAGE} (R249):\n`);

is(
  'HOSTNAME',
  facts.env.HOSTNAME,
  '0.0.0.0',
  'Next binds 127.0.0.1 by default, which a proxy in another container cannot reach: a 502 from a server that is running perfectly',
);
is('TZ', facts.env.TZ, 'Europe/Paris', "SPEC's day boundaries are Paris days");
is(
  'timezone resolves',
  facts.resolvedTimeZone,
  'Europe/Paris',
  'TZ set without tzdata installed leaves Intl on UTC, which moves every entry made after midnight CEST to the wrong DAY',
);
is(
  'FRONTALIER_RUNTIME',
  facts.env.FRONTALIER_RUNTIME,
  '1',
  'R81: the marker that distinguishes serving from building, which NODE_ENV cannot',
);
is('NODE_ENV', facts.env.NODE_ENV, 'production', 'the runner serves a production build');
is(
  'runs unprivileged',
  facts.uid !== 0,
  true,
  'root in a container is the worse half of the sandbox trade',
);
is('server.js present', facts.serverJs, true, 'standalone output is what the image serves');
is(
  '.next/static present',
  facts.staticDir,
  true,
  'static is NOT traced by standalone; an image without it serves every route with no CSS, and Lighthouse SCORES HIGHER for it (R177)',
);
is(
  'fonts present',
  Array.isArray(facts.fonts) && facts.fonts.length > 0,
  true,
  'Inter reaches the renderer as woff2 over HTTP from this same server',
);
is(
  '@playwright/test absent',
  facts.playwrightTestPresent,
  false,
  'lib/export/pdf.ts requires playwright-core and a system Chromium; the test runner is dev-only and must not ship',
);

// THE PIN, BOTH HALVES. The recorded file proves the build verified something;
// the live `--version` proves the binary that will actually render agrees with
// it. Either alone is satisfiable by a stale file or an unverified binary.
const pinned = facts.pinnedChromium;
const live = facts.chromiumVersion;

console.log('');
console.log(`  pinned at build : ${pinned}`);
console.log(`  live --version  : ${live}`);

if (pinned === null || live === null) {
  failures.push('chromium: the pin file or the binary could not be read');
} else {
  // `Chromium 153.0.8010.52 built on Debian ...` against `153.0.8010.52-1~deb12u1`.
  const upstream = pinned.split('-')[0];

  if (!live.includes(upstream)) {
    failures.push(
      `chromium: the binary reports ${JSON.stringify(live)} but the image pins ` +
        `${JSON.stringify(pinned)}. An unpinned browser is a renderer that ` +
        `changes without a commit.`,
    );
  } else {
    console.log(`  ok    the binary is the pinned build (${upstream})`);
  }
}

console.log(`\n  migrations in image: ${facts.migrations}`);

if (facts.migrations < 1) {
  failures.push('no migrations in the image - the deployed version cannot create its own schema');
}

// ============================================================================
// PHASE 2: THE REFUSAL MATRIX (R250), AGAINST RUNNING CONTAINERS (R249)
// ============================================================================
//
// scripts/entrypoint.mjs decides whether this container serves at all, which
// makes it a runtime component by any reading - so R251 puts it in a suite
// rather than leaving it to the base chain.
//
// KEPT NARROW ON PURPOSE. Four runs: three refusals and one start. A suite
// that takes minutes is a suite people route around, and the things worth
// asserting here are exactly the two the ruling names - the refusal matrix
// and the image's structural facts. Anything that needs a database, a
// browser or a rendered page belongs to test:e2e or to the increments that
// own those claims.

const PLACEHOLDER_AUTH = 'change-me-local-only-not-for-deployment';
const PLACEHOLDER_FCM_PROJECT = 'your-firebase-project-id';

/** A secret that is real enough not to be the placeholder. */
const REAL_SECRET = 'suite-generated-not-a-deployment-secret';

/** Everything supplied, as the base for one-field edits. */
const COMPLETE = {
  DATABASE_URL: 'postgresql://u:p@db.invalid:5432/x',
  AUTH_SECRET: REAL_SECRET,
  NEXT_PUBLIC_SITE_URL: 'https://monreleve.ch',
  RESEND_API_KEY: 'suite-not-a-real-key',
  FCM_PROJECT_ID: 'suite-project',
  FCM_CLIENT_EMAIL: 'suite@example.iam.gserviceaccount.com',
  FCM_PRIVATE_KEY: 'suite-not-a-real-key',
  ANDROID_PACKAGE_NAME: 'ch.monreleve.app',
  ANDROID_SHA256_CERT_FINGERPRINTS: 'AA:BB:CC',
};

function envArgs(env) {
  return Object.entries(env).flatMap(([name, value]) => ['-e', `${name}=${value}`]);
}

/** Run the entrypoint to completion; it exits by itself when it refuses. */
function runRefusal(env) {
  try {
    const stdout = execFileSync('docker', ['run', '--rm', ...envArgs(env), IMAGE], {
      encoding: 'utf8',
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return { code: 0, output: stdout };
  } catch (cause) {
    // A non-zero exit lands here, which for a refusal is the expected path.
    return {
      code: typeof cause.status === 'number' ? cause.status : 1,
      output: `${cause.stdout ?? ''}${cause.stderr ?? ''}`,
    };
  }
}

/** @param {string} what @param {object} env @param {string[]} mustSay */
function refuses(what, env, mustSay) {
  const { code, output } = runRefusal(env);
  const said = mustSay.filter((phrase) => output.includes(phrase));
  const ok = code === 1 && said.length === mustSay.length;

  if (!ok) {
    failures.push(
      `${what}: exit ${code} (want 1), said ${said.length}/${mustSay.length} of ` +
        `${JSON.stringify(mustSay)}`,
    );
  }

  checks += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what.padEnd(40)} exit ${code}`);
}

console.log('\nrefusal matrix, each against a running container (R250):\n');

refuses(
  'AUTH_SECRET = the placeholder',
  { ...COMPLETE, AUTH_SECRET: PLACEHOLDER_AUTH },
  ['AUTH_SECRET', 'PLACEHOLDER', 'WILL NOT START'],
);

refuses(
  'DATABASE_URL absent (required)',
  Object.fromEntries(Object.entries(COMPLETE).filter(([name]) => name !== 'DATABASE_URL')),
  ['DATABASE_URL', 'ABSENT'],
);

// A DEGRADABLE variable set to its placeholder STILL refuses, and this is the
// case that distinguishes R250 from "refuse what you cannot run without".
refuses(
  'FCM_PROJECT_ID = the placeholder (degradable)',
  { ...COMPLETE, FCM_PROJECT_ID: PLACEHOLDER_FCM_PROJECT },
  ['FCM_PROJECT_ID', 'PLACEHOLDER'],
);

// A DEGRADABLE variable ABSENT must NOT refuse - R83's half of the design.
// Proven in the positive run below rather than by a fourth refusal, because
// the claim is "it starts", and only starting proves that.

// ============================================================================
// THE POSITIVE DIRECTION (R196), WHICH IS THE HALF THAT MATTERS
// ============================================================================
//
// A contract that refuses EVERYTHING passes all three assertions above
// perfectly. So: a complete environment - minus one degradable variable, to
// prove absence there is not a refusal - must reach the point of starting the
// server. Detached, watched for the entrypoint's own marker, then removed.
const NAME = 'monreleve-container-check';
const startEnv = Object.fromEntries(
  Object.entries(COMPLETE).filter(([name]) => name !== 'RESEND_API_KEY'),
);

try {
  execFileSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
} catch {
  // Nothing to remove is the ordinary case.
}

let started = false;
let startLog = '';

try {
  execFileSync('docker', ['run', '-d', '--name', NAME, ...envArgs(startEnv), IMAGE], {
    stdio: ['ignore', 'ignore', 'inherit'],
    timeout: 120_000,
  });

  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    startLog = execFileSync('docker', ['logs', NAME], {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (startLog.includes('[entrypoint] starting the server.')) {
      started = true;
      break;
    }

    if (startLog.includes('refusing to start')) break;
  }
} catch (cause) {
  startLog = `${cause instanceof Error ? cause.message : cause}`;
} finally {
  // R179: THE HARNESS KILLS WHAT IT SPAWNED, whatever happened above.
  try {
    execFileSync('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
  } catch {
    // Already gone.
  }
}

checks += 1;
console.log(`  ${started ? 'ok  ' : 'FAIL'}  ${'a complete environment STARTS'.padEnd(40)}`);

if (!started) {
  failures.push(
    'a complete environment did not reach "[entrypoint] starting the server." - a ' +
      'contract that refuses everything passes every negative case. Log tail: ' +
      JSON.stringify(startLog.slice(-400)),
  );
}

// RESEND_API_KEY was omitted above, so the degradable-absent path is proven
// by the same run rather than asserted separately.
if (started && !startLog.includes('RESEND_API_KEY')) {
  failures.push(
    'an absent degradable variable was not REPORTED at startup. R244: the skip ' +
      'is named, never left as an absence.',
  );
}

checks += 1;
console.log(
  `  ${startLog.includes('RESEND_API_KEY') ? 'ok  ' : 'FAIL'}  ` +
    `${'and names the degraded feature'.padEnd(40)}`,
);

// R133: PRINT A COUNT. A suite that reports nothing must not read as a pass,
// and gate-selection.mjs reads this line back.
if (failures.length > 0) {
  console.error(`\nCONTAINER CHECK FAILED (${failures.length}):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\nContainer checks  ${checks} passed (${checks})`);
console.log('every claim read from a running container (R249).\n');

