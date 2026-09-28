// android/scripts/an5c-ac2.mjs
//
// AC2 - AN5b's OWED WALKTHROUGH, ON THE DEVICE (R176/R177/R184). Drives the signed-in app through the
// flow AN5b could not reach past sign-in: onboarding end to end (the on-device PATCH /api/v1/me verb,
// AN5b's named blind spot), recording a day, the pending line, the sync drain, and the year moving;
// then offline backdated days trigger R286's escalation. Screenshots at each step, default and 200%,
// for a person to OPEN and describe.
//
// It uses the debug session injection (R284) for a deterministic signed-in start, then drives the REAL
// screens with taps and one short numeric type ("100"). It shares container-write's provisioning recipe
// with an5c-signedin.mjs (both dev instruments; the product code shares nothing). pg is loaded from
// web/node_modules by createRequire. The emulator must already be booted.

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

const SHOT_DIR = process.argv[2] ?? join(ANDROID_DIR, '.an5c-ac2-shots');

const PORT = '3000';
const IMAGE = 'monreleve:write';
const NAME = 'monreleve-an5c';
const DB = 'monreleve_an5c';
const ORIGIN = 'https://monreleve.example';
const SECRET = 'an5c-walkthrough-not-a-deployment-secret';
const EMAIL = 'an5c-ac2@example.com';
const PG_PORT = '5436';
const adminUrl = `postgresql://frontalier:frontalier@localhost:${PG_PORT}/postgres`;
const toolUrl = `postgresql://frontalier:frontalier@localhost:${PG_PORT}/${DB}?schema=public`;
const containerUrl = toolUrl.replace('@localhost:', '@host.docker.internal:');

const SDK_DIR = readFileSync(join(ANDROID_DIR, 'local.properties'), 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('sdk.dir=')).slice('sdk.dir='.length).trim();
const ADB = join(SDK_DIR, 'platform-tools', 'adb.exe');
const APK = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const PACKAGE = 'ch.monreleve.app';
const MAIN = `${PACKAGE}/${PACKAGE}.MainActivity`;
const INJECTOR = `${PACKAGE}/${PACKAGE}.debug.SessionInjectionActivity`;
const RECORDER = `${PACKAGE}/${PACKAGE}.dev.DevRecorderActivity`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// maxBuffer 64 MB: `adb logcat -d` dumps the whole ring buffer and overflows execFileSync's 1 MB default.
const run = (file, args, opt = {}) =>
  execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024, ...opt });
const adb = (args, opt = {}) => run(ADB, args, opt);

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

function removeContainer() {
  try { run('docker', ['rm', '-f', NAME], { stdio: 'ignore' }); } catch { /* none */ }
}

async function health() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        const body = await res.json();
        if (typeof body.service !== 'string' || body.service === '') throw new Error('R169: no service field');
        return body;
      }
    } catch (c) { if (c instanceof Error && c.message.startsWith('R169')) throw c; }
    await sleep(1_000);
  }
  throw new Error('container did not become healthy');
}

async function signIn() {
  const raw = randomBytes(32).toString('hex');
  await withClient(toolUrl, async (c) => {
    await c.query('INSERT INTO "VerificationToken" (identifier, token, expires) VALUES ($1,$2,$3)', [
      EMAIL, createHash('sha256').update(raw).digest('hex'), new Date(Date.now() + 900_000),
    ]);
  });
  const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/auth/callback?token=${raw}&email=${encodeURIComponent(EMAIL)}`);
  const body = await res.json();
  if (res.status !== 200 || typeof body.accessToken !== 'string') throw new Error(`sign-in failed: ${res.status}`);
  return body;
}

// --- adb UI helpers (ANR-robust) ---------------------------------------------

async function dumpFocused() {
  for (let i = 0; i < 8; i += 1) {
    let xml = '';
    try {
      adb(['shell', 'uiautomator', 'dump', '/sdcard/an5c-ac2.xml']);
      xml = adb(['shell', 'cat', '/sdcard/an5c-ac2.xml']);
    } catch { /* transient */ }
    // The headless SystemUI ANR ("System UI isn't responding") steals the focused window; tap its
    // "Wait" (BACK does not dismiss it) and re-read. package="android" is the dialog, not our app.
    const wait = xml.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)]\[(\d+),(\d+)]"/);
    if (xml.includes('responding') && wait) {
      adb(['shell', 'input', 'tap', String((+wait[1] + +wait[3]) >> 1), String((+wait[2] + +wait[4]) >> 1)]);
      await sleep(1_200);
      continue;
    }
    if (xml.includes('<hierarchy') && xml.length > 200) return xml;
    await sleep(1_000);
  }
  return '';
}

function boundsCenter(bounds) {
  const m = bounds.match(/\[(\d+),(\d+)]\[(\d+),(\d+)]/);
  return m ? [(+m[1] + +m[3]) >> 1, (+m[2] + +m[4]) >> 1] : null;
}

/** Every <node .../> whose serialised attributes satisfy `pred`. */
function nodes(xml) {
  return [...xml.matchAll(/<node\b[^>]*?\/?>/g)].map((m) => m[0]);
}

function findByText(xml, text) {
  const node = nodes(xml).find((n) => n.includes(`text="${text}"`));
  const b = node?.match(/bounds="([^"]+)"/);
  return b ? boundsCenter(b[1]) : null;
}

async function tapText(text, label) {
  const xml = await dumpFocused();
  const c = findByText(xml, text);
  if (!c) throw new Error(`tapText: "${text}" not found (${label ?? ''})`);
  adb(['shell', 'input', 'tap', String(c[0]), String(c[1])]);
  await sleep(1_200);
}

/** Scroll a verticalScroll form until `text` is ON-screen (not below the fold), then tap it. */
async function scrollToTapText(text, label) {
  for (let i = 0; i < 8; i += 1) {
    const xml = await dumpFocused();
    const node = nodes(xml).find((n) => n.includes(`text="${text}"`));
    const b = node?.match(/bounds="\[(\d+),(\d+)]\[(\d+),(\d+)]"/);
    if (b) {
      const cy = (+b[2] + +b[4]) >> 1;
      // On-screen and above the gesture bar (screen is 2424 tall; the bar is the last ~80 px).
      if (cy > 150 && cy < 2360) {
        adb(['shell', 'input', 'tap', String((+b[1] + +b[3]) >> 1), String(cy)]);
        await sleep(1_500);
        return;
      }
    }
    adb(['shell', 'input', 'swipe', '540', '1800', '540', '700', '300']);
    await sleep(700);
  }
  throw new Error(`scrollToTapText: "${text}" not reachable (${label ?? ''})`);
}

/** Tap the Nth EditText (0-based) - Compose OutlinedTextField renders as android.widget.EditText. */
async function tapEditText(index) {
  const xml = await dumpFocused();
  const edits = nodes(xml).filter((n) => n.includes('class="android.widget.EditText"'));
  const b = edits[index]?.match(/bounds="([^"]+)"/);
  const c = b ? boundsCenter(b[1]) : null;
  if (!c) throw new Error(`tapEditText: no EditText #${index}`);
  adb(['shell', 'input', 'tap', String(c[0]), String(c[1])]);
  await sleep(800);
}

async function screenshot(name) {
  mkdirSync(SHOT_DIR, { recursive: true });
  const out = join(SHOT_DIR, `${name}.png`);
  adb(['shell', 'screencap', '-p', '/sdcard/an5c-shot.png']);
  adb(['pull', '/sdcard/an5c-shot.png', out], { stdio: 'ignore' });
  console.log(`  SHOT ${out}`);
  return out;
}

async function waitDisplayed(suffix, seconds = 60) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (adb(['logcat', '-d']).includes(`Displayed ${PACKAGE}/${suffix}`)) return true;
    await sleep(1_000);
  }
  return false;
}

function injectSessionOnly(session) {
  adb(['shell', 'pm', 'clear', PACKAGE]);
  adb(['logcat', '-c']);
  adb(['shell', 'am', 'start', '-n', INJECTOR,
    '--es', 'accessToken', session.accessToken, '--es', 'refreshToken', session.refreshToken,
    '--es', 'accessExpiresAt', session.accessExpiresAt, '--es', 'refreshExpiresAt', session.refreshExpiresAt]);
}

async function relaunchMain() {
  adb(['shell', 'am', 'force-stop', PACKAGE]);
  adb(['logcat', '-c']);
  adb(['shell', 'am', 'start', '-n', MAIN]);
  await waitDisplayed('.MainActivity');
  await sleep(1_500);
}

const airplane = (on) => {
  try { adb(['shell', 'cmd', 'connectivity', 'airplane-mode', on ? 'enable' : 'disable']); } catch { /* fallback */ }
  adb(['shell', 'svc', 'wifi', on ? 'disable' : 'enable']);
  adb(['shell', 'svc', 'data', on ? 'disable' : 'enable']);
};

async function fontScale(scale) {
  adb(['shell', 'settings', 'put', 'system', 'font_scale', String(scale)]);
}

// --- the drive ---------------------------------------------------------------

async function driveOnboarding() {
  console.log('\n[1] onboarding, on the device (the on-device PATCH verb, AN5b blind spot)');
  await screenshot('01-onboarding-default');
  await tapText('Choisissez un canton', 'canton dropdown');
  await tapText('GE', 'canton GE');
  await tapEditText(0); // the rate field is the first EditText
  adb(['shell', 'input', 'text', '100']);
  await sleep(600);
  // Verify the typed value LANDED before submitting (R180; AN5b's failure was unverified typing).
  const filled = await dumpFocused();
  const rateOk = filled.includes('text="100"');
  console.log(`  rate field shows "100": ${rateOk}`);
  await screenshot('02-onboarding-filled');
  // The number keyboard is up after typing and covers Submit; one BACK dismisses it (not exit - the
  // IME is definitely up). Then scroll the form to bring the below-the-fold Submit on-screen and tap it.
  adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  await sleep(800);
  await scrollToTapText('Enregistrer et commencer', 'submit');
  await sleep(3_000);
  return rateOk;
}

async function verifyPatchLanded() {
  const row = await withClient(toolUrl, async (c) =>
    (await c.query('SELECT canton, "employmentRate" FROM "User" WHERE email = $1', [EMAIL])).rows[0]);
  console.log(`  DB read-back: canton=${row?.canton} employmentRate=${row?.employmentRate}`);
  return row?.canton === 'GE' && row?.employmentRate === 100;
}

async function main() {
console.log('\n=== AN5c AC2: the owed walkthrough, on the device ===');
if (!existsSync(APK)) throw new Error(`no debug APK at ${APK}`);

// A ref'd keep-alive. On Windows, undici's fetch socket and AbortSignal.timeout timer are unref'd, so
// during health()'s poll of a not-yet-ready container the event loop can drain and node exits early
// (only when stdout is a file/pipe that does not itself keep the loop alive). This timer holds it open.
const keepAlive = setInterval(() => {}, 60_000);
let ok = true;
try {
  // provision
  console.log('provisioning container + scratch DB...');
  removeContainer();
  await withClient(adminUrl, async (c) => {
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB}' AND pid <> pg_backend_pid()`);
    await c.query(`DROP DATABASE IF EXISTS ${DB}`);
    await c.query(`CREATE DATABASE ${DB}`);
  });
  console.log('  DB created; migrating...');
  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { cwd: WEB_DIR, stdio: 'ignore', env: { ...process.env, DATABASE_URL: toolUrl } });
  console.log('  migrated; starting container...');
  run('docker', ['run', '-d', '--name', NAME, '--add-host', 'host.docker.internal:host-gateway',
    '-p', `${PORT}:3000`, '-e', `DATABASE_URL=${containerUrl}`, '-e', `AUTH_SECRET=${SECRET}`,
    '-e', `NEXT_PUBLIC_SITE_URL=${ORIGIN}`, IMAGE]);
  console.log('  container started; waiting for health...');
  console.log(`R169: /api/health service = ${(await health()).service}`);
  const session = await signIn();
  console.log(`real session obtained (${session.accessToken.length}-char access token)`);

  adb(['install', '-r', APK]);
  adb(['shell', 'settings', 'put', 'global', 'hide_error_dialogs', '1']);
  await fontScale(1.0);
  airplane(false);

  // Onboarding -> Aujourd'hui (session-only, so onboarding is driven for real).
  injectSessionOnly(session);
  await waitDisplayed('ch.monreleve.app.debug.SessionInjectionActivity', 30);
  await relaunchMain();
  const rateOk = await driveOnboarding();
  const afterOnboarding = await dumpFocused();
  const reachedAujourdhui = afterOnboarding.includes('Bonjour Camille');
  await screenshot('03-aujourdhui-after-onboarding');
  const patchLanded = await verifyPatchLanded();
  console.log(`[PATCH] reached Aujourd'hui=${reachedAujourdhui}  DB has GE/100=${patchLanded}  rateTyped=${rateOk}`);
  if (!reachedAujourdhui || !patchLanded) {
    throw new Error('ONBOARDING PATCH DID NOT LAND - AN5b blind spot firing (finding, stop-and-decide)');
  }

  // Record a day OFFLINE so the pending line is guaranteed long enough to see (advisor).
  console.log('\n[2] airplane mode, then record a day -> pending');
  airplane(true);
  await sleep(2_000);
  await tapText('Domicile', 'record Domicile');
  await sleep(1_500);
  await screenshot('04-recorded-pending');

  // Reconnect -> the enqueued CONNECTED work drains (SPEC 13.2 replay-on-connectivity, live).
  console.log('\n[3] reconnect -> the sync drains, the year moves');
  airplane(false);
  let drained = false;
  for (let i = 0; i < 40; i += 1) {
    await sleep(2_000);
    const xml = await dumpFocused();
    if (!xml.includes('En attente de synchronisation') && xml.includes('Bonjour Camille')) { drained = true; break; }
  }
  console.log(`  pending cleared (drained): ${drained}`);
  await screenshot('05-synced-year');

  // Escalation (R286): an OLD pending day, offline, via the dev recorder (backdating instrument).
  console.log('\n[4] offline backdated day -> R286 escalation');
  airplane(true);
  adb(['logcat', '-c']);
  adb(['shell', 'am', 'start', '-n', RECORDER]);
  await waitDisplayed('ch.monreleve.app.dev.DevRecorderActivity', 30);
  await sleep(1_000);
  // 9 taps of "Jour précédent" backdate nine days (offset 9 -> OVERDUE); then record HOME.
  for (let i = 0; i < 9; i += 1) { await tapText('Jour précédent', 'earlier'); }
  await tapText('Enregistrer Domicile', 'recorder HOME');
  await sleep(1_500);
  await relaunchMain();
  // The escalation is the last element of a scrolling screen: swipe up before the shot.
  adb(['shell', 'input', 'swipe', '540', '1600', '540', '400', '300']);
  await sleep(1_000);
  const esc = await dumpFocused();
  const overdue = esc.includes('saisie tardive');
  console.log(`  escalation visible (saisie tardive): ${overdue}`);
  await screenshot('06-escalation-overdue');

  // 200%: default-size screens re-captured at font_scale 2.0.
  console.log('\n[5] 200 percent');
  await fontScale(2.0);
  await relaunchMain();
  adb(['shell', 'input', 'swipe', '540', '1600', '540', '400', '300']);
  await sleep(1_000);
  await screenshot('07-aujourdhui-escalation-200');
  // onboarding at 200%: re-inject session-only and relaunch.
  injectSessionOnly(session);
  await waitDisplayed('ch.monreleve.app.debug.SessionInjectionActivity', 30);
  await relaunchMain();
  await screenshot('08-onboarding-200');
  await fontScale(1.0);

  console.log(`\nAC2 drive complete. reachedAujourdhui=${reachedAujourdhui} patch=${patchLanded} drained=${drained} overdue=${overdue}`);
  ok = reachedAujourdhui && patchLanded && overdue;
} catch (cause) {
  ok = false;
  console.error(`\nFAILED: ${cause instanceof Error ? cause.message : cause}`);
} finally {
  airplane(false);
  await fontScale(1.0);
  console.log('\n--- cleanup ---');
  removeContainer();
  try { await withClient(adminUrl, async (c) => { await c.query(`DROP DATABASE IF EXISTS ${DB}`); }); } catch { /* best effort */ }
  clearInterval(keepAlive);
}
return ok ? 0 : 1;
}

// process.exitCode (not process.exit): let stdout drain and the loop end naturally, so a file
// redirect on Windows is not truncated mid-write.
main().then((code) => { process.exitCode = code; }).catch((e) => { console.error('FATAL', e); process.exitCode = 1; });
