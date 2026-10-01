// android/scripts/an14a-wire.mjs
//
// AN14a increment 4 - R307, the RUNTIME half (the owed emulator drive). Presence in the dex is not use
// (R133); checkMinifiedWireContract proves the tokens SURVIVE minification, this proves the MINIFIED
// serialiser USES them. It installs the MINIFIED audit variant (release config + R8 + a debug signature,
// so it installs), launches dev.WireDumpActivity - which runs the real EntriesWire.entriesRequestBody over
// a fixture exercising every enum value - reads the JSON back from logcat, and asserts every /v1 field key
// and enum value the doc names appears in what the minified build actually emitted.
//
// R206: the expected field list is DERIVED from docs/api-v1.md at run time (the same markers the gate task
// uses), never retyped. The plant is faithful (R180): rename a key in EntriesWire.kt, run this, and the
// emitted JSON carries the wrong key, which the diff below catches.
//
// It needs ONLY a booted emulator - no server, no container (the fixture is local). The emulator RAM budget
// defers the drive; run it once ~4 GB is free:
//   node android/scripts/an14a-wire.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = join(HERE, '..');
const REPO_ROOT = join(ANDROID_DIR, '..');
const API_DOC = join(REPO_ROOT, 'docs', 'api-v1.md');

const SDK_DIR = readFileSync(join(ANDROID_DIR, 'local.properties'), 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('sdk.dir=')).slice('sdk.dir='.length).trim();
const ADB = join(SDK_DIR, 'platform-tools', 'adb.exe');
const GRADLEW = join(ANDROID_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const AUDIT_APK = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'audit', 'app-audit.apk');
const PACKAGE = 'ch.monreleve.app';
const WIRE_DUMP = `${PACKAGE}/${PACKAGE}.dev.WireDumpActivity`;
const TAG = 'AN14A_WIRE_DUMP';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (file, args, opt = {}) =>
  execFileSync(file, args, { encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024, ...opt });
const adb = (args, opt = {}) => run(ADB, args, opt);

// Derive the /v1 field list from docs/api-v1.md - the SAME derivation as checkMinifiedWireContract (R206).
function contractTokens() {
  const doc = readFileSync(API_DOC, 'utf8');
  const region = (tag) => {
    const m = doc.match(new RegExp(`<!-- ${tag} -->([\\s\\S]*?)<!-- /${tag} -->`));
    if (!m) throw new Error(`the <!-- ${tag} --> region is not in docs/api-v1.md (R206)`);
    return m[1];
  };
  const write = region('fields:write');
  const read = region('fields:read');
  const keysOf = (region) =>
    [...region.matchAll(/^\|\s*`([a-z][A-Za-z]+)`/gm)].map((m) => m[1]);
  // WireDumpActivity serialises a REQUEST (entriesRequestBody), so the payload carries only the
  // fields:write keys. The response-only keys (id, firstRecordedAt, lastModifiedAt) are server-ASSIGNED
  // and never sent in a request - the client decodes them (parseEntriesResponse), which the static dex
  // check (checkMinifiedWireContract) proves survive R8 and the AC1 end-to-end drive exercises when the
  // synced row is read back. So the runtime request check asserts write keys + enum values; read-only
  // keys are reported for the record, not required in the request.
  const writeKeys = new Set(keysOf(write));
  const readOnlyKeys = new Set(keysOf(read).filter((k) => !writeKeys.has(k)));
  // Enum values from the write region only (read adds the trail words CREATED/MODIFIED).
  const enums = new Set([...write.matchAll(/`([A-Z][A-Z_]+)`/g)].map((m) => m[1]));
  return { writeKeys, readOnlyKeys, enums };
}

// Every key and every string value anywhere in the emitted JSON.
function keysAndValues(node, keys = new Set(), values = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((n) => keysAndValues(n, keys, values));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      keys.add(k);
      keysAndValues(v, keys, values);
    }
  } else if (typeof node === 'string') {
    values.add(node);
  }
  return { keys, values };
}

async function main() {
  // Refuse a run with no device, rather than silently passing (R169 shape).
  const devices = adb(['devices']).split(/\r?\n/).filter((l) => /\tdevice$/.test(l));
  if (devices.length === 0) throw new Error('no booted device - run scripts/emulator.sh first');

  console.log('--- building + installing the MINIFIED audit variant ---');
  // gradlew is a .bat on Windows; execFileSync cannot spawn a .bat without a shell (EINVAL), so run it
  // through the shell there. Skippable when the audit APK is already current (e.g. a device re-drive):
  // SKIP_BUILD=1 reuses the APK on disk and avoids the gradle daemon's RAM on a constrained host.
  if (!process.env.SKIP_BUILD) {
    run(GRADLEW, [':app:assembleAudit'], { cwd: ANDROID_DIR, stdio: 'inherit', shell: process.platform === 'win32' });
  }
  adb(['install', '-r', AUDIT_APK]);

  adb(['logcat', '-c']);
  adb(['shell', 'am', 'start', '-n', WIRE_DUMP]);

  let line = '';
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !line) {
    await sleep(1_000);
    const dump = adb(['logcat', '-d', '-s', TAG]);
    const m = dump.match(/BEGIN (\{[\s\S]*?\}) END/);
    if (m) line = m[1];
  }
  if (!line) throw new Error(`no ${TAG} line in logcat - WireDumpActivity did not emit`);

  const payload = JSON.parse(line);
  const emitted = keysAndValues(payload);
  const { writeKeys, readOnlyKeys, enums: expectedEnums } = contractTokens();

  const missingKeys = [...writeKeys].filter((k) => !emitted.keys.has(k));
  const missingEnums = [...expectedEnums].filter((v) => !emitted.values.has(v));

  console.log('\nEMITTED by the minified serialiser:');
  console.log(JSON.stringify(payload, null, 2));
  console.log(`\nkeys emitted: ${[...emitted.keys].sort().join(', ')}`);
  console.log(`enum values emitted: ${[...emitted.values].filter((v) => /^[A-Z][A-Z_]+$/.test(v)).sort().join(', ')}`);
  console.log(`response-only keys (not in a request; static-dex + AC1-decode checked): ${[...readOnlyKeys].sort().join(', ')}`);

  if (missingKeys.length || missingEnums.length) {
    console.error(`\nR307 RUNTIME FAILED - the minified build did not emit contract tokens:`);
    if (missingKeys.length) console.error(`  missing keys:  ${missingKeys.join(', ')}`);
    if (missingEnums.length) console.error(`  missing enums: ${missingEnums.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\nR307 RUNTIME OK: the minified serialiser emitted all ${writeKeys.size} request field keys and ` +
    `${expectedEnums.size} enum values the doc names (keys + enum values match docs/api-v1.md).`,
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
