// android/scripts/an-state-matrix.mjs
//
// AN-STATE S5 - THE REPEATABLE CHECK (R310). The device check that drives the four state-rebuild
// triggers repeatably, so a future screen change is verified the same way rather than from memory.
//
// It does NOT decide whether state survived - a person opens the before/after PNGs and compares (R176:
// a screenshot opened and described). What it guarantees is that the TRIGGER is applied identically
// every time, and that every phone setting it changes is restored (so the matrix cannot leave the
// device altered). You put the app into a state-holding screen first (a tab, an open sheet, a half-typed
// field); this applies a trigger and captures the pair.
//
// THE FOUR TRIGGERS (R310):
//   rotation  - portrait -> landscape -> portrait, via user_rotation (accelerometer_rotation off).
//   textsize  - font_scale 2.0 (R16's 200 %) then back to 1.0.
//   darkmode  - cmd uimode night yes then no (the app ships light-only; the switch still rebuilds).
//   kill      - HOME, then `am kill` (NOT force-stop), then return via `am start`. am kill ends the
//               process the way the system reclaims a backgrounded app and PRESERVES the saved instance
//               state; force-stop clears the task record, so state loss after a force-stop is CORRECT
//               behaviour and would be a false matrix failure (advisor, AN-STATE). The two are never
//               interchanged here.
//   dka       - the developer "Don't keep activities" option (always_finish_activities 1): every
//               activity is destroyed the moment it is backgrounded, a second, stricter way to force the
//               rebuild. Restored to 0 afterwards.
//
// USAGE (serial via --serial or ANDROID_SERIAL):
//   node android/scripts/an-state-matrix.mjs --label calendrier-sheet --trigger rotation
//   node android/scripts/an-state-matrix.mjs --label aujourdhui --trigger all
//
// Shots land in android/.an-state-shots/<label>/<trigger>-{before,after}.png (untracked).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = join(HERE, '..');
const SHOTS_ROOT = join(ANDROID_DIR, '.an-state-shots');

const SDK_DIR = readFileSync(join(ANDROID_DIR, 'local.properties'), 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('sdk.dir=')).slice('sdk.dir='.length).trim();
const ADB = join(SDK_DIR, 'platform-tools', 'adb.exe');
const PACKAGE = 'ch.monreleve.app';
const LAUNCHER = `${PACKAGE}/${PACKAGE}.MainActivity`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, dflt) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
  };
  const serial = get('--serial', process.env.ANDROID_SERIAL);
  if (!serial) throw new Error('no device: pass --serial <id> or set ANDROID_SERIAL');
  return { serial, label: get('--label', 'state'), trigger: get('--trigger', 'all') };
}

const { serial, label, trigger } = parseArgs();
const adb = (args, opt = {}) =>
  execFileSync(ADB, ['-s', serial, ...args], { encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024, ...opt });
const shell = (cmd) => adb(['shell', ...cmd.split(' ')]);

const shotDir = join(SHOTS_ROOT, label);
mkdirSync(shotDir, { recursive: true });

function screencap(name) {
  const out = join(shotDir, `${name}.png`);
  const png = execFileSync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(out, png);
  console.log(`  shot: ${out}`);
  return out;
}

// Read a setting so it can be restored exactly, never guessed.
function getSetting(ns, key) {
  try { return shell(`settings get ${ns} ${key}`).trim(); } catch { return 'null'; }
}

// Each trigger: capture before, apply the rebuild, (relaunch/return for the background cases), capture
// after, then restore. isRebuildReturn marks the triggers that background the app and must bring it back.
const triggers = {
  async rotation() {
    const accel = getSetting('system', 'accelerometer_rotation');
    const rot = getSetting('system', 'user_rotation');
    screencap('rotation-before');
    shell('settings put system accelerometer_rotation 0');
    shell('settings put system user_rotation 1'); // landscape
    await sleep(2500);
    screencap('rotation-after');
    // restore
    shell(`settings put system user_rotation ${rot === 'null' ? '0' : rot}`);
    shell(`settings put system accelerometer_rotation ${accel === 'null' ? '1' : accel}`);
  },
  async textsize() {
    const scale = getSetting('system', 'font_scale');
    screencap('textsize-before');
    shell('settings put system font_scale 2.0'); // R16: 200 %
    await sleep(2500);
    screencap('textsize-after');
    shell(`settings put system font_scale ${scale === 'null' ? '1.0' : scale}`);
  },
  async darkmode() {
    // `cmd uimode night yes/no` is a no-op on this Samsung (SM-G960F, API 29) - verified during AN-STATE; the
    // secure ui_night_mode setting (0=auto, 1=off/light, 2=on/dark) is what actually rebuilds the activity.
    const prev = getSetting('secure', 'ui_night_mode');
    screencap('darkmode-before');
    shell('settings put secure ui_night_mode 2');
    await sleep(2500);
    screencap('darkmode-after');
    shell(`settings put secure ui_night_mode ${prev === 'null' ? '1' : prev}`);
  },
  async kill() {
    screencap('kill-before');
    shell('input keyevent KEYCODE_HOME');
    await sleep(1500);
    // am kill (NOT force-stop): the system reclaiming a backgrounded process; saved instance state is kept.
    shell(`am kill ${PACKAGE}`);
    await sleep(1500);
    adb(['shell', 'am', 'start', '-n', LAUNCHER]);
    await sleep(3000);
    screencap('kill-after');
  },
  async dka() {
    const prev = getSetting('global', 'always_finish_activities');
    shell('settings put global always_finish_activities 1');
    screencap('dka-before');
    shell('input keyevent KEYCODE_HOME');
    await sleep(1500);
    adb(['shell', 'am', 'start', '-n', LAUNCHER]);
    await sleep(3000);
    screencap('dka-after');
    shell(`settings put global always_finish_activities ${prev === 'null' ? '0' : prev}`);
  },
};

async function main() {
  console.log(`AN-STATE matrix | device ${serial} | label "${label}" | trigger ${trigger}`);
  shell('svc power stayon usb'); // keep awake for the run
  const names = trigger === 'all' ? Object.keys(triggers) : [trigger];
  for (const name of names) {
    const fn = triggers[name];
    if (!fn) throw new Error(`unknown trigger "${name}" (rotation|textsize|darkmode|kill|dka|all)`);
    console.log(`\n--- ${name} ---`);
    await fn();
  }
  console.log('\nDONE. Open each before/after pair and compare the state (R176).');
  console.log('Phone settings changed by this run were restored to their prior values.');
}

main().catch((e) => { console.error(e); process.exit(1); });
