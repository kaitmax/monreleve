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
const IMAGE = process.argv[2] ?? 'monreleve:fw28';

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

/** @param {string} what @param {unknown} got @param {unknown} want @param {string} why */
function is(what, got, want, why) {
  const ok = got === want;

  if (!ok) failures.push(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)} - ${why}`);

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

if (failures.length > 0) {
  console.error(`\nCONTAINER FACTS FAILED (${failures.length}):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('\nCONTAINER FACTS PASSED - every claim read from a running container.\n');
