// android/scripts/an5c-signedin.mjs
//
// THE DETERMINISTIC PATH PAST SIGN-IN (R284), and AN5b's owed walkthrough (AC1/AC2).
//
// AN5b's on-device drive stopped at sign-in because `adb shell input text` was unreliable - it
// concatenated two inputs, then truncated an email. This obtains a REAL server-issued session the way
// AN5b's AC2 run did (plant a hashed VerificationToken in a scratch database, exchange it at
// /api/v1/auth/callback for the token pair) and hands it to the app through the DEBUG-ONLY
// SessionInjectionActivity as intent extras. No typing, so the path is deterministic. Every screen
// downstream still talks to the real production container.
//
// The container runs on host port 3000 so the emulator's debug base URL 10.0.2.2:3000 reaches it.
// R169/R179: the port is asserted free and /api/health must NAME this product (a `service` field)
// before anything is driven.
//
// USAGE (the emulator must already be booted - android/scripts/emulator.sh launch && wait-boot):
//   node android/scripts/an5c-signedin.mjs [--runs N] [--no-settings] [--keep] [--shot DIR]
//     --runs N       AC1: N consecutive inject->relaunch->verify cycles (default 3), each pm-cleared,
//                    each asserting a signed-in Aujourd'hui with no retry.
//     --no-settings  inject the session only (drive onboarding on the device); default seeds settings
//                    so the app lands on Aujourd'hui directly.
//     --keep         leave the container + scratch DB running for follow-up driving (AC2).
//     --shot DIR     screenshot each verified Aujourd'hui into DIR.
//
// It reuses container-write.mjs's proven recipe (pg directly, R169/R179) but keeps the container
// alive and drives adb. pg lives in web/node_modules, so it is loaded from there by createRequire.

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = join(HERE, '..');
const REPO_ROOT = join(ANDROID_DIR, '..');
const WEB_DIR = join(REPO_ROOT, 'web');
const pg = createRequire(join(WEB_DIR, 'package.json'))('pg');

const ARGS = process.argv.slice(2);
function argValue(flag) {
  const i = ARGS.indexOf(flag);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : undefined;
}
const RUNS = Number(argValue('--runs') ?? '3');
const SEED_SETTINGS = !ARGS.includes('--no-settings');
const KEEP = ARGS.includes('--keep');
const SHOT_DIR = argValue('--shot');

const PORT = process.env.FRONTALIER_PORT ?? '3000';
const IMAGE = process.env.CONTAINER_IMAGE ?? 'monreleve:write';
const NAME = 'monreleve-an5c';
const DB = 'monreleve_an5c';
const ORIGIN = 'https://monreleve.example';
const SECRET = 'an5c-walkthrough-not-a-deployment-secret';
const EMAIL = 'an5c@example.com';

const PG_USER = 'frontalier';
const PG_PASSWORD = 'frontalier';
const PG_PORT = process.env.CONTAINER_WRITE_PG_PORT ?? '5436';
const adminUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/postgres`;
const toolUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${DB}?schema=public`;
const containerUrl = toolUrl.replace('@localhost:', '@host.docker.internal:');

const SDK_DIR = readFileSync(join(ANDROID_DIR, 'local.properties'), 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('sdk.dir='))
  .slice('sdk.dir='.length)
  .trim();
const ADB = join(SDK_DIR, 'platform-tools', 'adb.exe');
const APK = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const PACKAGE = 'ch.monreleve.app';
const MAIN = `${PACKAGE}/${PACKAGE}.MainActivity`;
const INJECTOR = `${PACKAGE}/${PACKAGE}.debug.SessionInjectionActivity`;
const AUJOURDHUI_MARKER = 'Bonjour Camille';
const SETTINGS = { canton: 'GE', employmentRate: 100, denominatorKind: 'SIMPLIFIED240', granularity: 'DAY' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, ...options });
}
function adb(args, options = {}) {
  return run(ADB, args, options);
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

function removeContainer() {
  try {
    run('docker', ['rm', '-f', NAME], { stdio: 'ignore' });
  } catch {
    // nothing to remove
  }
}

async function assertPortFree() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2_000) });
    const body = await response.text();
    throw new Error(`R179: something already answers /api/health on ${PORT}. Free it. Got: ${body.slice(0, 160)}`);
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('R179:')) throw cause;
  }
}

async function waitForOurProduct() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        const body = await response.json();
        if (typeof body.service !== 'string' || body.service === '') {
          throw new Error(`R169: ${PORT} answered /api/health with no service field - a foreign app or a collision.`);
        }
        return body;
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('R169:')) throw cause;
    }
    await sleep(1_000);
  }
  throw new Error(`the container did not answer /api/health on ${PORT} within 120s`);
}

/** A real session, obtained the way a client obtains one: plant a hashed token, exchange the callback. */
async function signIn() {
  const raw = randomBytes(32).toString('hex');
  await withClient(toolUrl, async (client) => {
    await client.query('INSERT INTO "VerificationToken" (identifier, token, expires) VALUES ($1, $2, $3)', [
      EMAIL,
      createHash('sha256').update(raw).digest('hex'),
      new Date(Date.now() + 900_000),
    ]);
  });
  const response = await fetch(
    `http://127.0.0.1:${PORT}/api/v1/auth/callback?token=${raw}&email=${encodeURIComponent(EMAIL)}`,
  );
  const body = await response.json();
  if (response.status !== 200 || typeof body.accessToken !== 'string') {
    throw new Error(`sign-in failed: ${response.status} ${JSON.stringify(body).slice(0, 160)}`);
  }
  return body;
}

async function setTitulaireAndSettings(token) {
  await withClient(toolUrl, async (client) => {
    await client.query('UPDATE "User" SET name = $1, canton = $2 WHERE email = $3', ['Camille', 'GE', EMAIL]);
  });
  const response = await fetch(`http://127.0.0.1:${PORT}/api/v1/me`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      canton: SETTINGS.canton,
      employmentRate: SETTINGS.employmentRate,
      denominatorKind: SETTINGS.denominatorKind,
      exactTotalWorkDays: null,
      granularity: SETTINGS.granularity,
      activityStartDate: null,
    }),
  });
  if (response.status !== 200) {
    throw new Error(`PATCH /api/v1/me failed: ${response.status} ${(await response.text()).slice(0, 160)}`);
  }
}

function injectExtras(session) {
  const extras = [
    '--es', 'accessToken', session.accessToken,
    '--es', 'refreshToken', session.refreshToken,
    '--es', 'accessExpiresAt', session.accessExpiresAt,
    '--es', 'refreshExpiresAt', session.refreshExpiresAt,
  ];
  if (SEED_SETTINGS) {
    extras.push(
      '--es', 'canton', SETTINGS.canton,
      '--es', 'employmentRate', String(SETTINGS.employmentRate),
      '--es', 'denominatorKind', SETTINGS.denominatorKind,
      '--es', 'granularity', SETTINGS.granularity,
    );
  }
  return extras;
}

async function waitForDisplayed(activitySuffix, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (adb(['logcat', '-d']).includes(`Displayed ${PACKAGE}/${activitySuffix}`)) return true;
    await sleep(1_000);
  }
  return false;
}

// Reading the UI, not retrying the FLOW (AC1's "no retry" is about the sign-in path). A headless
// emulator throws a "System UI isn't responding" ANR whose dialog steals the focused window, so
// uiautomator would dump the DIALOG instead of the app. When the dump is that dialog (or any non-app
// window), BACK dismisses it - which on an ANR dialog is "Wait", keeping the app running - and the
// read is retried. Re-reading the SAME already-reached screen is a robust read, not a second attempt
// at reaching it. The read returns only once the app's OWN window is what uiautomator captured.
async function uiDump() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let xml = '';
    try {
      adb(['shell', 'uiautomator', 'dump', '/sdcard/an5c-ui.xml']);
      xml = adb(['shell', 'cat', '/sdcard/an5c-ui.xml']);
    } catch {
      // transient bridge error - re-read
    }
    if (xml.includes(`package="${PACKAGE}"`)) return xml;
    // Only DISMISS a system dialog (the ANR); never act when the app might simply be mid-render. The
    // headless SystemUI ANR is modal and BACK does NOT dismiss it - tapping its "Wait" button (which
    // keeps the app running) does. The button's bounds are parsed from the dump so the tap is
    // resolution-independent.
    const wait = xml.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)]\[(\d+),(\d+)]"/);
    if (wait) {
      const cx = Math.floor((Number(wait[1]) + Number(wait[3])) / 2);
      const cy = Math.floor((Number(wait[2]) + Number(wait[4])) / 2);
      adb(['shell', 'input', 'tap', String(cx), String(cy)]);
    } else if (xml.includes('responding') || xml.includes('Close app')) {
      adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    }
    await sleep(1_500);
  }
  return '';
}

async function screenshot(out) {
  mkdirSync(dirname(out), { recursive: true });
  adb(['shell', 'screencap', '-p', '/sdcard/an5c.png']);
  adb(['pull', '/sdcard/an5c.png', out], { stdio: 'ignore' });
  return out;
}

/** One inject->relaunch->verify cycle. Returns true iff a signed-in Aujourd'hui was reached. */
async function oneRun(session, index) {
  adb(['shell', 'pm', 'clear', PACKAGE]);
  adb(['logcat', '-c']);
  adb(['shell', 'am', 'start', '-n', INJECTOR, ...injectExtras(session)]);
  await waitForDisplayed('ch.monreleve.app.debug.SessionInjectionActivity', 30);
  adb(['shell', 'am', 'force-stop', PACKAGE]);
  adb(['logcat', '-c']);
  adb(['shell', 'am', 'start', '-n', MAIN]);
  if (!(await waitForDisplayed('.MainActivity', 60))) {
    console.log(`  run ${index}: MainActivity never reported Displayed`);
    return false;
  }
  await sleep(1_500);
  const dump = await uiDump();
  const reached = dump.includes(AUJOURDHUI_MARKER);
  console.log(`  run ${index}: ${reached ? 'REACHED' : 'MISSED'} a signed-in Aujourd'hui (marker "${AUJOURDHUI_MARKER}")`);
  if (SHOT_DIR) console.log(`  run ${index}: screenshot ${await screenshot(join(SHOT_DIR, `an5c-ac1-run${index}.png`))}`);
  return reached;
}

console.log('\n=== AN5c: the deterministic path past sign-in (R284) ===');
console.log(`image ${IMAGE}  port ${PORT}  db ${DB}  runs ${RUNS}  seedSettings ${SEED_SETTINGS}`);
if (!existsSync(APK)) throw new Error(`debug APK not found at ${APK} - run ./gradlew assembleDebug first`);
if (!existsSync(ADB)) throw new Error(`adb not found at ${ADB}`);

let passed = true;
try {
  await assertPortFree();
  removeContainer();

  console.log(`\n--- scratch database ${DB} ---`);
  await withClient(adminUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${DB}`);
    await client.query(`CREATE DATABASE ${DB}`);
  });
  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: WEB_DIR,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: toolUrl },
  });
  console.log(`created and migrated ${DB}`);

  console.log(`\n--- starting ${IMAGE} on ${PORT} ---`);
  run('docker', [
    'run', '-d', '--name', NAME,
    '--add-host', 'host.docker.internal:host-gateway',
    '-p', `${PORT}:3000`,
    '-e', `DATABASE_URL=${containerUrl}`,
    '-e', `AUTH_SECRET=${SECRET}`,
    '-e', `NEXT_PUBLIC_SITE_URL=${ORIGIN}`,
    IMAGE,
  ]);
  const health = await waitForOurProduct();
  console.log(`R169: /api/health names this product: ${health.service}`);

  console.log('\n--- obtaining a real session, setting the titulaire and settings ---');
  const session = await signIn();
  console.log(`sign-in yielded a ${session.accessToken.length}-char access token and a refresh token`);
  await setTitulaireAndSettings(session.accessToken);
  console.log('titulaire set (Camille / GE); settings PATCHed to /api/v1/me (server agrees with the device)');

  console.log('\n--- installing the debug APK ---');
  adb(['install', '-r', APK]);
  // Suppress the headless emulator's ANR/crash dialogs ("System UI isn't responding") so a transient
  // SystemUI window never steals focus from the app under test - an environment fix, not an app one.
  adb(['shell', 'settings', 'put', 'global', 'hide_error_dialogs', '1']);

  console.log(`\n--- AC1: ${RUNS} consecutive runs to a signed-in Aujourd'hui, no retry ---`);
  const results = [];
  for (let i = 1; i <= RUNS; i += 1) {
    results.push(await oneRun(session, i));
  }
  passed = results.every((r) => r);
  console.log(`\nAC1: ${results.filter(Boolean).length}/${RUNS} reached a signed-in Aujourd'hui. ${passed ? 'PASS' : 'FAIL'}`);
} catch (cause) {
  passed = false;
  console.error(`\nFAILED: ${cause instanceof Error ? cause.message : cause}`);
} finally {
  if (KEEP) {
    console.log(`\n--- container ${NAME} left running on ${PORT} (--keep) ---`);
  } else {
    console.log('\n--- cleanup ---');
    removeContainer();
    try {
      await withClient(adminUrl, async (client) => {
        await client.query(`DROP DATABASE IF EXISTS ${DB}`);
      });
    } catch {
      // best effort
    }
  }
}

process.exit(passed ? 0 : 1);
