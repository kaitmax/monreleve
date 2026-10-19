// android/scripts/uidrive.mjs
// Small uiautomator helper for driving the physical phone. Written for AN-AUTO-2, kept untracked
// for several tasks, and COMMITTED by KMP-2: it is what made R374 and R385 - the two device checks
// owed since KMP-0 and KMP-1 - runnable at all, and the next device task should not rewrite it.
//
// THE SERIAL IS HARD-CODED WITH AN OVERRIDE. SERIAL defaults to this project's S9
// (232bcd8c300c7ece) and is overridden by ANDROID_SERIAL. The default is a convenience on a
// machine with one phone and several emulators; the override is what makes it portable. A script
// that silently drove whichever device adb happened to list first would be the R169 defect on a
// phone - acting on a target nobody named.
//
// It calls adb.exe directly rather than through a shell, which is what avoids MSYS mangling a
// device path like /data/app/... into C:/Program Files/Git/data/app/...
//
//   node uidrive.mjs dump                 -> print visible text + content-desc
//   node uidrive.mjs tap "<text>"         -> tap the centre of the node whose text (or content-desc) matches
//   node uidrive.mjs tapdesc "<desc>"     -> tap by content-desc
//   node uidrive.mjs has "<text>"         -> exit 0 if present, 1 if not (prints PRESENT/ABSENT)
//   node uidrive.mjs shot <name>          -> screencap to android/.an-auto-shots/<name>.png
//   node uidrive.mjs wake                 -> wake + dismiss keyguard
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = join(HERE, '..');
const SHOTS = join(ANDROID_DIR, '.an-auto-shots');
const SDK_DIR = readFileSync(join(ANDROID_DIR, 'local.properties'), 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('sdk.dir=')).slice('sdk.dir='.length).trim();
const ADB = join(SDK_DIR, 'platform-tools', 'adb.exe');
const SERIAL = process.env.ANDROID_SERIAL ?? '232bcd8c300c7ece';
const adb = (...a) => execFileSync(ADB, ['-s', SERIAL, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const adbBuf = (...a) => execFileSync(ADB, ['-s', SERIAL, ...a], { maxBuffer: 256 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function wake() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  adb('shell', 'wm', 'dismiss-keyguard');
}
async function dumpXml() {
  for (let i = 0; i < 6; i += 1) {
    try { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); const xml = adb('shell', 'cat', '/sdcard/ui.xml'); if (xml.includes('<node')) return xml; } catch { /* retry */ }
    await sleep(1200);
  }
  return '';
}
function nodes(xml) {
  // uiautomator emits one <node .../> per element; split on '<node' and parse attrs.
  return xml.split('<node').map((chunk) => {
    const text = (chunk.match(/\stext="([^"]*)"/) || [])[1] ?? '';
    const desc = (chunk.match(/\scontent-desc="([^"]*)"/) || [])[1] ?? '';
    const b = chunk.match(/\sbounds="\[(\d+),(\d+)]\[(\d+),(\d+)]"/);
    const bounds = b ? { x: (Number(b[1]) + Number(b[3])) >> 1, y: (Number(b[2]) + Number(b[4])) >> 1 } : null;
    return { text, desc, bounds };
  });
}
function decode(s) { return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"); }

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'wake') { wake(); console.log('woke + dismissed keyguard'); process.exit(0); }
if (cmd === 'shot') {
  mkdirSync(SHOTS, { recursive: true });
  const out = join(SHOTS, `${arg}.png`);
  const png = adbBuf('exec-out', 'screencap', '-p');
  (await import('node:fs')).writeFileSync(out, png);
  console.log(out);
  process.exit(0);
}

wake();
await sleep(600);
const xml = await dumpXml();
if (!xml) { console.error('NO UI DUMP'); process.exit(2); }
const ns = nodes(xml);

if (cmd === 'dump') {
  for (const n of ns) {
    const t = decode(n.text), d = decode(n.desc);
    if ((t || d) && n.bounds) console.log(`${JSON.stringify(t || d)} @ ${n.bounds.x},${n.bounds.y}`);
  }
  process.exit(0);
}
const needle = (arg || '').toLowerCase();
const match = ns.find((n) => n.bounds && (decode(n.text).toLowerCase().includes(needle) || (cmd === 'tapdesc' && decode(n.desc).toLowerCase().includes(needle))));
if (cmd === 'has') { console.log(match ? 'PRESENT' : 'ABSENT'); process.exit(match ? 0 : 1); }
if (cmd === 'tap' || cmd === 'tapdesc') {
  if (!match) { console.error(`NOT FOUND: ${arg}`); process.exit(3); }
  adb('shell', 'input', 'tap', String(match.bounds.x), String(match.bounds.y));
  console.log(`tapped ${JSON.stringify(arg)} at ${match.bounds.x},${match.bounds.y}`);
  process.exit(0);
}
console.error('usage: dump|tap <text>|tapdesc <desc>|has <text>|shot <name>|wake');
process.exit(9);
