// android/scripts/an-fix-crossaccount.mjs  (TRACKED, AN-FIX F4 / R303 - the repeatable reproduction)
//
// ONE ACCOUNT QUEUE MUST NOT DRAIN INTO, OR BE SHOWN UNDER, ANOTHER (the R295 gap: an expired session is not a
// sign-out). A records days offline (blockable proxy), A is revoked server-side, B signs in on the same device,
// the queue drains. Postgres entriesByUser() shows which account owns A's offline days; CROSS_ACCOUNT_LEAK is
// true when any of A's days landed under B. This is the AN-AUDIT reproduction, promoted to a committed,
// repeatable script for AN-FIX: run it against the UNFIXED build to see CROSS_ACCOUNT_LEAK=true (the audit
// captured that on-device at 943841a/d2485ce), and against the FIXED build (R303) to see it FALSE, B's screen
// holding none of A's days, and A's set-aside days syncing under A on return.
// USAGE: node android/scripts/an-fix-crossaccount.mjs

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = join(HERE, '..');
const REPO_ROOT = join(ANDROID_DIR, '..');
const WEB_DIR = join(REPO_ROOT, 'web');
const pg = createRequire(join(WEB_DIR, 'package.json'))('pg');
const SHOTS = join(ANDROID_DIR, '.an-audit-shots');

const PORT = process.env.FRONTALIER_PORT ?? '3000';
// D18: the app hits 10.0.2.2:PORT, which maps to the host's PORT where a LOGGING PROXY listens and forwards to
// the container on CONTAINER_PORT. The script's own calls (signIn/patch/me) go DIRECT to CONTAINER_PORT, so the
// proxy capture is APP TRAFFIC ONLY.
const CONTAINER_PORT = process.env.CONTAINER_PORT ?? '3001';
const IMAGE = process.env.CONTAINER_IMAGE ?? 'monreleve:write';
const NAME = 'monreleve-anaudit';
const DB = 'monreleve_anaudit';
const ORIGIN = 'https://monreleve.example';
const SECRET = 'an-audit-walkthrough-not-a-deployment-secret';
const PG_PORT = process.env.CONTAINER_WRITE_PG_PORT ?? '5436';
const adminUrl = `postgresql://frontalier:frontalier@localhost:${PG_PORT}/postgres`;
const toolUrl = `postgresql://frontalier:frontalier@localhost:${PG_PORT}/${DB}?schema=public`;
const containerUrl = toolUrl.replace('@localhost:', '@host.docker.internal:');

const SDK_DIR = readFileSync(join(ANDROID_DIR, 'local.properties'), 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('sdk.dir=')).slice('sdk.dir='.length).trim();
const ADB = join(SDK_DIR, 'platform-tools', 'adb.exe');
const APK = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const PROBE_APK = join(ANDROID_DIR, 'probe', 'build', 'outputs', 'apk', 'debug', 'probe-debug.apk');
const PROBE_PKG = 'ch.monreleve.probe';
const PROBE_MAIN = `${PROBE_PKG}/${PROBE_PKG}.ProbeActivity`;
const PACKAGE = 'ch.monreleve.app';
const MAIN = `${PACKAGE}/${PACKAGE}.MainActivity`;
const INJECTOR = `${PACKAGE}/${PACKAGE}.debug.SessionInjectionActivity`;
const SEEDER = `${PACKAGE}/${PACKAGE}.debug.DebugSeederActivity`;
const RECORDER = `${PACKAGE}/${PACKAGE}.dev.DevRecorderActivity`;
const DETECTION_REPLAY = `${PACKAGE}/${PACKAGE}.dev.DetectionReplayActivity`;
const GALLERY = `${PACKAGE}/${PACKAGE}.dev.GalleryActivity`;
const SIGNIN_PROBE = `${PACKAGE}/${PACKAGE}.dev.SignInProbeActivity`;
const CALLBACK = `${PACKAGE}/${PACKAGE}.CallbackActivity`;
const SETTINGS = { canton: 'GE', employmentRate: 100, denominatorKind: 'SIMPLIFIED240', granularity: 'DAY' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The container answers /api/health before its DB-backed routes reliably accept a connection; a single fetch
// then throws undici "fetch failed" on the warmup race. Retry the transport-level failure a few times.
async function fetchRetry(url, opts, tries = 6) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try { return await fetch(url, opts); } catch (e) { last = e; await sleep(1_500); }
  }
  throw last;
}
const run = (file, args, o = {}) => execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024, ...o });
const adb = (args, o = {}) => run(ADB, args, o);
async function withClient(url, fn) { const c = new pg.Client({ connectionString: url }); await c.connect(); try { return await fn(c); } finally { await c.end(); } }
function removeContainer() { try { run('docker', ['rm', '-f', NAME], { stdio: 'ignore' }); } catch { /* none */ } }
function startContainer() { run('docker', ['run', '-d', '--name', NAME, '--add-host', 'host.docker.internal:host-gateway', '-p', `${CONTAINER_PORT}:3000`, '-e', `DATABASE_URL=${containerUrl}`, '-e', `AUTH_SECRET=${SECRET}`, '-e', `NEXT_PUBLIC_SITE_URL=${ORIGIN}`, IMAGE]); }

async function assertPortFree() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2_000) }); throw new Error(`R179: already answering /api/health on ${PORT}: ${(await r.text()).slice(0, 120)}`); }
  catch (c) { if (c instanceof Error && c.message.startsWith('R179:')) throw c; }
}
async function waitForOurProduct() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2_000) }); if (r.ok) { const b = await r.json(); if (!b.service) throw new Error(`R169: no service field on ${PORT}`); return b; } }
    catch (c) { if (c instanceof Error && c.message.startsWith('R169:')) throw c; }
    await sleep(1_000);
  }
  throw new Error(`no /api/health on ${PORT} within 120s`);
}
async function signIn(email) {
  const raw = randomBytes(32).toString('hex');
  await withClient(toolUrl, (c) => c.query('INSERT INTO "VerificationToken" (identifier, token, expires) VALUES ($1, $2, $3)', [email, createHash('sha256').update(raw).digest('hex'), new Date(Date.now() + 900_000)]));
  const r = await fetchRetry(`http://127.0.0.1:${CONTAINER_PORT}/api/v1/auth/callback?token=${raw}&email=${encodeURIComponent(email)}`);
  const b = await r.json();
  if (r.status !== 200 || typeof b.accessToken !== 'string') throw new Error(`sign-in failed for ${email}: ${r.status}`);
  return b;
}
async function patchSettings(token) {
  const r = await fetchRetry(`http://127.0.0.1:${CONTAINER_PORT}/api/v1/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ canton: 'GE', employmentRate: 100, denominatorKind: 'SIMPLIFIED240', exactTotalWorkDays: null, granularity: 'DAY', activityStartDate: null }) });
  if (r.status !== 200) throw new Error(`PATCH /me failed: ${r.status} ${(await r.text()).slice(0, 160)}`);
}
async function meRaw(token, tag) {
  const r = await fetchRetry(`http://127.0.0.1:${CONTAINER_PORT}/api/v1/me`, { headers: { authorization: `Bearer ${token}` } });
  const b = await r.json();
  console.log(`  [${tag}] GET /me -> ${r.status}; canton=${JSON.stringify(b.canton)} keys=${JSON.stringify(Object.keys(b))}`);
  return { status: r.status, body: b };
}
const tokenExtras = (s) => ['--es', 'accessToken', s.accessToken, '--es', 'refreshToken', s.refreshToken, '--es', 'accessExpiresAt', s.accessExpiresAt, '--es', 'refreshExpiresAt', s.refreshExpiresAt];
const settingsExtras = () => ['--es', 'canton', SETTINGS.canton, '--es', 'employmentRate', String(SETTINGS.employmentRate), '--es', 'denominatorKind', SETTINGS.denominatorKind, '--es', 'granularity', SETTINGS.granularity];

async function uiDump() {
  for (let a = 0; a < 8; a += 1) {
    let xml = '';
    try { adb(['shell', 'uiautomator', 'dump', '/sdcard/an-audit-ui.xml']); xml = adb(['shell', 'cat', '/sdcard/an-audit-ui.xml']); } catch { /* retry */ }
    if (xml.includes(`package="${PACKAGE}"`)) return xml;
    const wait = xml.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)]\[(\d+),(\d+)]"/);
    if (wait) adb(['shell', 'input', 'tap', String((+wait[1] + +wait[3]) >> 1), String((+wait[2] + +wait[4]) >> 1)]);
    else if (xml.includes('responding') || xml.includes('Close app')) adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
    await sleep(1_500);
  }
  return adb(['shell', 'cat', '/sdcard/an-audit-ui.xml']);
}
const centreOf = (b) => ({ x: (+b[1] + +b[3]) >> 1, y: (+b[2] + +b[4]) >> 1 });
function findByText(xml, t) { const m = xml.match(new RegExp(`text="${t}"[^>]*bounds="\\[(\\d+),(\\d+)]\\[(\\d+),(\\d+)]"`)); return m ? centreOf(m) : null; }
async function tap(point, label) { if (!point) { console.log(`  ! could not find ${label}`); return false; } adb(['shell', 'input', 'tap', String(point.x), String(point.y)]); console.log(`  tapped ${label} at ${point.x},${point.y}`); await sleep(1_200); return true; }
async function tapText(t, label = t) { return tap(findByText(await uiDump(), t), label); }
async function shot(name) { mkdirSync(SHOTS, { recursive: true }); const out = join(SHOTS, `${name}.png`); adb(['shell', 'screencap', '-p', '/sdcard/an-audit.png']); adb(['pull', '/sdcard/an-audit.png', out], { stdio: 'ignore' }); console.log(`  shot ${name}`); return out; }
async function waitDisplayed(suffix, seconds) { const d = Date.now() + seconds * 1000; while (Date.now() < d) { try { if (adb(['logcat', '-d']).includes(`Displayed ${PACKAGE}/${suffix}`)) return true; } catch { /* retry */ } await sleep(1_000); } return false; }
async function waitForShell(seconds = 45) {
  const deadline = Date.now() + seconds * 1000; let relaunches = 0;
  while (Date.now() < deadline) {
    const xml = await uiDump();
    if (findByText(xml, 'Param.tres') || findByText(xml, 'Relev.') || xml.includes('Bonjour') || xml.includes('Aujourd')) return true;
    if (!xml.includes(`package="${PACKAGE}"`) && relaunches < 4) { relaunches += 1; console.log(`  shell not up; re-launching (${relaunches})`); adb(['shell', 'am', 'start', '-n', MAIN]); }
    await sleep(2_000);
  }
  console.log('  ! waitForShell timed out'); return false;
}
async function relaunch() { adb(['shell', 'am', 'force-stop', PACKAGE]); await sleep(800); adb(['logcat', '-c']); adb(['shell', 'am', 'start', '-n', MAIN]); await waitDisplayed('.MainActivity', 60); await sleep(3_000); }
async function scrollDown() { adb(['shell', 'input', 'swipe', '540', '1500', '540', '500', '300']); await sleep(700); }
async function openParametres() {
  for (let i = 0; i < 6; i += 1) { const p = findByText(await uiDump(), 'Param.tres'); if (p) { await tap(p, 'Paramètres tab'); await sleep(1500); return true; } await waitForShell(15); }
  console.log('  ! could not open Paramètres'); return false;
}
async function readPref(f) { try { return adb(['exec-out', 'run-as', PACKAGE, 'cat', `shared_prefs/${f}.xml`]).replace(/\s+/g, ' ').trim(); } catch { return '(absent)'; } }
async function sweepPrefs(tag) {
  for (const f of ['monreleve.auth', 'monreleve.settings', 'monreleve.dossier', 'monreleve.pending']) {
    console.log(`  [${tag}] ${f}.xml: ${(await readPref(f)).slice(0, 200)}`);
  }
}
function screenState(xml) {
  return {
    resolving: xml.includes('ProgressBar') || xml.includes('Loading'),
    onboarding: xml.includes('Commencer') || xml.includes('Canton de travail') || xml.includes('Situation'),
    shell: !!findByText(xml, 'Param.tres') || !!findByText(xml, 'Relev.') || xml.includes('Aujourd'),
  };
}

// --- D18 logging proxy: the app hits 10.0.2.2:PORT (this proxy), which forwards to the container on
// CONTAINER_PORT and records every request line and body. Script calls go direct to CONTAINER_PORT, so this
// captures APP TRAFFIC ONLY. ---
const captured = [];
let proxyServer;
let proxyBlocked = false; // when true, the app's requests are reset -> a network error -> rows stay PENDING (offline)
function startProxy() {
  proxyServer = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      captured.push({ method: req.method, url: req.url, body, blocked: proxyBlocked });
      if (proxyBlocked) { req.socket.destroy(); return; } // simulate offline for this app request
      const fwd = httpRequest(
        { hostname: '127.0.0.1', port: Number(CONTAINER_PORT), path: req.url, method: req.method, headers: req.headers },
        (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res); },
      );
      fwd.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
      fwd.end(body);
    });
  });
  return new Promise((resolve) => proxyServer.listen(Number(PORT), resolve));
}
function stopProxy() { try { proxyServer?.close(); } catch { /* ignore */ } }

// D18 coordinate scan: a coordinate-shaped KEY, or a pair of Geneva-plausible decimals (lat 43-47, lng 5-8).
// The engine's rates (39,16 / 4,16) and the tally's integer minutes/fixCount are legal and out of these ranges.
const COORD_KEY = /\b(lat|lng|lon|latitude|longitude|geo|coord|accuracy|bearing|altitude|heading|speed)\b/i;
function scanCoordinates(reqs) {
  const hits = [];
  for (const r of reqs) {
    const hay = `${r.url} ${r.body}`;
    if (COORD_KEY.test(hay)) hits.push({ where: `${r.method} ${r.url}`, why: 'coordinate-shaped KEY', sample: hay.slice(0, 160) });
    const nums = (r.body.match(/-?\d+\.\d{3,}/g) || []).map(Number);
    const lat = nums.find((n) => n >= 43 && n <= 47);
    const lng = nums.find((n) => n >= 5 && n <= 8);
    if (lat !== undefined && lng !== undefined) {
      hits.push({ where: `${r.method} ${r.url}`, why: `coordinate-shaped VALUES lat~${lat} lng~${lng}`, sample: r.body.slice(0, 160) });
    }
  }
  return hits;
}
const appLog = () => { try { return adb(['logcat', '-d']); } catch { return ''; } };
function scanLogsForSecrets(log, needles) {
  const hits = [];
  for (const [label, value] of needles) {
    if (value && value.length > 6 && log.includes(value)) hits.push(`${label} (${value.slice(0, 8)}...) FOUND in logcat`);
  }
  return hits;
}
// adb shell re-parses its argument on the DEVICE's /system/bin/sh, so &, (, ), %, ? in a URI are interpreted
// there unless single-quoted, and a huge arg overflows the Windows command line. Both broke the first run
// (R252 - the harness failed, not the app). We send ONE single-quoted shell string and keep args device-sized.
function shell(cmd) {
  try { adb(['shell', cmd]); return 'started'; } catch (e) { return `send-error: ${String(e).slice(0, 70)}`; }
}
function fireIntent(component, evil) {
  return shell(`am start -n ${component} --es evil '${evil}' --es token 'not-a-token' --ez admin true`);
}
function fireCallback(uri) {
  if (uri === '') return shell(`am start -a android.intent.action.VIEW ${PACKAGE}`);
  return shell(`am start -a android.intent.action.VIEW -d '${uri}' ${PACKAGE}`);
}
// AndroidRuntime emits a "Process: <pkg>, PID: N" line ONLY inside a FATAL crash dump, so its presence for our
// package is a crash. GMS/launcher/SystemUI ANRs name their own processes and are filtered out by the package.
function appFatals(log) {
  return log.split(/\r?\n/).filter((l) => /Process: ch\.monreleve\.app[,\s]/.test(l)).slice(0, 10);
}
async function authPref() { return readPref('monreleve.auth'); }

// Cross-account DB helpers (increment 5). Tenancy is server-assigned from the token; Entry carries a userId.
async function userIdOf(email) {
  return withClient(toolUrl, async (c) => {
    const r = await c.query('SELECT id FROM "User" WHERE email = $1', [email]);
    return r.rows[0]?.id ?? null;
  });
}
async function entriesByUser() {
  return withClient(toolUrl, async (c) => {
    const r = await c.query('SELECT u.email, to_char(e."dayDate", \'YYYY-MM-DD\') AS d FROM "Entry" e JOIN "User" u ON u.id = e."userId" ORDER BY u.email, d');
    return r.rows.map((x) => `${x.email}:${x.d}`);
  });
}
async function revokeAllSessions(email) {
  return withClient(toolUrl, async (c) => {
    const u = await c.query('SELECT id FROM "User" WHERE email = $1', [email]);
    const id = u.rows[0]?.id;
    if (!id) return 'no user';
    let n = 0;
    for (const t of ['SessionToken', 'Session']) {
      try { const r = await c.query(`DELETE FROM "${t}" WHERE "userId" = $1`, [id]); n += r.rowCount ?? 0; } catch { /* table may not exist */ }
    }
    return `revoked ${n} session rows for ${email}`;
  });
}

const RESULT = {};
try {
  console.log('\n=== AN-AUDIT increment 5: one account queue must not drain into another (expired session, R295 gap) ===');
  if (!existsSync(APK)) throw new Error(`no debug APK at ${APK}`);
  removeContainer(); await sleep(800); await assertPortFree();
  console.log(`--- scratch database ${DB} ---`);
  await withClient(adminUrl, async (c) => { await c.query(`DROP DATABASE IF EXISTS ${DB}`); await c.query(`CREATE DATABASE ${DB}`); });
  run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: WEB_DIR, stdio: 'ignore', env: { ...process.env, DATABASE_URL: toolUrl } });
  console.log(`--- container on ${CONTAINER_PORT}, blockable proxy on ${PORT} ---`);
  startContainer(); await startProxy();
  const health = await waitForOurProduct(); console.log(`R169: /api/health via proxy names this product: ${health.service}`);
  adb(['install', '-r', APK]); adb(['shell', 'settings', 'put', 'global', 'hide_error_dialogs', '1']);

  const A = 'anaudit-acct-a@example.com', B = 'anaudit-acct-b@example.com';
  const aSession = await signIn(A); await patchSettings(aSession.accessToken);
  const bSession = await signIn(B); await patchSettings(bSession.accessToken);
  RESULT.userA = await userIdOf(A); RESULT.userB = await userIdOf(B);
  RESULT.entriesBefore = await entriesByUser();
  console.log(`  entries before: ${JSON.stringify(RESULT.entriesBefore)}`);

  // 1) Account A records days OFFLINE (proxy blocked) -> PENDING, never reaching A's server record.
  console.log('\n--- A records two past days OFFLINE (proxy blocked) ---');
  adb(['shell', 'pm', 'clear', PACKAGE]);
  adb(['shell', 'am', 'start', '-n', INJECTOR, ...tokenExtras(aSession), ...settingsExtras()]);
  await waitDisplayed('.debug.SessionInjectionActivity', 20); adb(['shell', 'am', 'force-stop', PACKAGE]); await sleep(1000);
  await relaunch(); await waitForShell(45);
  proxyBlocked = true;
  adb(['shell', 'am', 'start', '-n', RECORDER]); await sleep(2500);
  await tapText('Jour pr.c.dent', 'earlier'); await sleep(700); await tapText('Jour pr.c.dent', 'earlier'); await sleep(700);
  await tapText('Enregistrer Suisse', 'A day -2'); await sleep(1500);
  await tapText('Jour pr.c.dent', 'earlier'); await sleep(700);
  await tapText('Enregistrer Suisse', 'A day -3'); await sleep(1500);
  adb(['shell', 'am', 'force-stop', PACKAGE]); await sleep(800);
  RESULT.entriesAfterAOffline = await entriesByUser();
  console.log(`  after A offline (A should have 0 on the server): ${JSON.stringify(RESULT.entriesAfterAOffline)}`);

  // 2) Revoke A server-side (the realistic trigger), then B signs in on the SAME device. StartupDecider maps a
  //    gone session to SIGN_IN and clears NO record; the callback stores B tokens and clears NO record - so
  //    injecting B tokens reproduces exactly the post-expiry device state (B token + A PENDING rows).
  console.log('\n--- revoke A server-side, B signs in on the same device (record kept) ---');
  console.log('  ' + await revokeAllSessions(A));
  adb(['shell', 'am', 'start', '-n', INJECTOR, ...tokenExtras(bSession), ...settingsExtras()]);
  await waitDisplayed('.debug.SessionInjectionActivity', 20); adb(['shell', 'am', 'force-stop', PACKAGE]); await sleep(1000);

  // 3) Online again; B is signed in; A PENDING rows are still local. Record a B day -> triggers the drain.
  console.log('\n--- back online; B records today; the queue drains ---');
  proxyBlocked = false; captured.length = 0;
  await relaunch(); await waitForShell(45);
  adb(['shell', 'am', 'start', '-n', RECORDER]); await sleep(2500);
  await tapText('Enregistrer Domicile', 'B day today (triggers drain)'); await sleep(10000);
  await tapText('Synchroniser', 'force sync'); await sleep(8000);
  adb(['shell', 'am', 'force-stop', PACKAGE]); await sleep(1500);

  RESULT.entriesAfterBDrain = await entriesByUser();
  RESULT.postPaths = [...new Set(captured.filter((r) => r.method === 'POST').map((r) => r.url.split('?')[0]))];
  RESULT.aDaysUnderA = RESULT.entriesAfterBDrain.filter((e) => e.startsWith(A + ':')).length;
  RESULT.bOwnedDays = RESULT.entriesAfterBDrain.filter((e) => e.startsWith(B + ':')).length;
  // B recorded ONE day of its own; anything beyond 1 under B is A's queue that drained across the account.
  RESULT.CROSS_ACCOUNT_LEAK = RESULT.bOwnedDays > 1;
  console.log(`  entries after drain: ${JSON.stringify(RESULT.entriesAfterBDrain)}`);
  console.log(`  POST paths during drain: ${JSON.stringify(RESULT.postPaths)}`);
  console.log(`  B owns ${RESULT.bOwnedDays} day(s) (its own is 1); A owns ${RESULT.aDaysUnderA}`);
  console.log(`  >>> CROSS-ACCOUNT LEAK (A days reached B): ${RESULT.CROSS_ACCOUNT_LEAK}`);
  await shot('x-after-drain');

  console.log(`\n=== done. RESULT ${JSON.stringify(RESULT, null, 1)} ===`);
} catch (cause) {
  console.error(`\nWALKTHROUGH ERROR: ${cause instanceof Error ? cause.stack : cause}`);
} finally {
  console.log('\n--- teardown ---');
  stopProxy();
  removeContainer();
  try { await withClient(adminUrl, (c) => c.query(`DROP DATABASE IF EXISTS ${DB}`)); } catch { /* best effort */ }
  console.log('proxy stopped, container removed, scratch DB dropped');
}
