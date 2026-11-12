// android/scripts/apk-diff.test.mjs
//
// AN-APK-DIFF R868. Pins apk-diff.mjs against archives BUILT HERE, byte by byte, so every expected number
// below is computed from how the test wrote the bytes, never read back out of the code under test (R197).
// Run: node --test android/scripts/apk-diff.test.mjs
//
// THE CASE THAT MATTERS is the one that produced the script: two archives of IDENTICAL total size whose
// contents moved. An entry before a 16 KiB-aligned stored entry grows, the aligned entry's local extra
// field shrinks by the same number of bytes, and the size of the file cannot see it. The ledger must say
// where every byte went, and its terms must sum to the size delta - zero here, and not zero in the control.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';

import { parseApk, ledger, compare } from './apk-diff.mjs';

const PAGE = 16384;

/** A minimal zip writer: stored or deflated entries, local-extra padding so a stored entry's data is aligned. */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const data = e.deflate ? deflateRawSync(e.data) : e.data;
    let extra = 0;
    if (e.align) {
      const start = offset + 30 + name.length;
      extra = (e.align - (start % e.align)) % e.align;
    }
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(e.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(crc32(e.data), 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(extra, 28);
    locals.push(lh, name, Buffer.alloc(extra), data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(e.deflate ? 8 : 0, 10);
    ch.writeUInt32LE(crc32(e.data), 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + extra + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

// Incompressible bytes, so a stored size is the byte count the test chose.
const bytes = (n, seed) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 131 + seed * 17 + ((i * i) >> 3)) & 0xff));

const apk = (dexBytes) => zip([
  { name: 'classes.dex', data: bytes(dexBytes, 1) },
  { name: 'lib/arm64-v8a/libx.so', data: bytes(5000, 2), align: PAGE },
  { name: 'resources.arsc', data: bytes(777, 3), align: 4 },
]);

test('the parser reads every entry, its offset and its local extra field', () => {
  const a = parseApk(apk(3000));
  assert.equal(a.entries.length, 3);
  const so = a.entries.find((e) => e.name === 'lib/arm64-v8a/libx.so');
  // The writer put the .so's data on the first 16 KiB boundary after classes.dex: 30 + 11 + 3000 bytes in.
  assert.equal(so.dataStart % PAGE, 0);
  assert.equal(so.lho, 30 + 'classes.dex'.length + 3000);
  assert.equal(so.le, PAGE - (so.lho + 30 + 'lib/arm64-v8a/libx.so'.length));
  assert.equal(a.tailGap, 0);
  assert.equal(a.signed.blockMagic, false);
  assert.deepEqual(a.signed.v1Files, []);
});

test('a dex that grows before a page-aligned entry leaves the size unchanged, and the ledger says why', () => {
  const before = apk(3000), after = apk(3400);
  assert.equal(before.length, after.length, 'precondition: the writer produced equal sizes');
  const L = ledger(parseApk(before), parseApk(after));
  assert.equal(L.totalDelta, 0);
  const dex = L.terms.find((t) => t.name === 'classes.dex');
  const so = L.terms.find((t) => t.name === 'lib/arm64-v8a/libx.so');
  assert.equal(dex.dataDelta, 400);
  assert.equal(so.extraDelta, -400);
  assert.equal(L.terms.reduce((s, t) => s + t.headerDelta + t.extraDelta + t.dataDelta, 0) + L.cdDelta + L.eocdDelta + L.gapDelta, 0);
  // The slack before the boundary is a number the writer fixed: the .so's padding on the "after" side.
  assert.equal(L.slack.find((s) => s.name === 'lib/arm64-v8a/libx.so').afterPadding, so.extraAfter);
});

test('the control: growth past the boundary moves the size by one page, and the ledger still sums', () => {
  const a = parseApk(apk(3000));
  const pad = a.entries.find((e) => e.name === 'lib/arm64-v8a/libx.so').le;
  const before = apk(3000), after = apk(3000 + pad + 1);
  const L = ledger(parseApk(before), parseApk(after));
  assert.equal(after.length - before.length, PAGE);
  assert.equal(L.totalDelta, PAGE);
  assert.equal(L.terms.reduce((s, t) => s + t.headerDelta + t.extraDelta + t.dataDelta, 0) + L.cdDelta + L.eocdDelta + L.gapDelta, PAGE);
});

test('compare names every entry whose CRC, size, offset or extra length moved, and counts the rest', () => {
  const r = compare(parseApk(apk(3000)), parseApk(apk(3400)));
  assert.deepEqual(r.changed.map((c) => c.name).sort(), ['classes.dex', 'lib/arm64-v8a/libx.so']);
  assert.equal(r.identical, 1);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.removed, []);
});
