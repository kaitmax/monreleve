// android/scripts/apk-diff.mjs
//
// AN-APK-DIFF R865/R866/R868. Compares two release APKs entry by entry and byte by byte, and says where
// every byte of the size difference went. Built because the release APK stayed 1 989 388 B across IOS-2d,
// IOS-2e and IOS-2e-FIX while its classes.dex and baseline profile changed underneath: AN APK'S BYTE COUNT
// IS NOT A CONTENT CHECK. With AGP 8.10's 16 KiB alignment of uncompressed native libraries, everything
// stored before the first lib/ entry is absorbed by that entry's local-extra padding, so the total moves only
// in whole 16 KiB pages. Run this before a release, against the previous release's APK.
//
// Usage:
//   node android/scripts/apk-diff.mjs <before.apk> <after.apk> [--all]
//     --all   print every entry, not only the ones that moved
//
// What it prints, all from the two files and nothing else:
//   ARCHIVE   size, entry count, central directory offset/size, EOCD, the gap before the central directory,
//             and the signing state (an APK Signing Block before the central directory; v1 signature files)
//   ENTRIES   per entry: name, method (0 stored, 8 deflated), stored and uncompressed size, CRC, local-header
//             offset, local and central extra-field lengths - for the entries that moved, then a count of
//             the identical ones
//   LEDGER    the size delta decomposed into header, padding (local extra) and data terms per entry, plus
//             the central directory, the EOCD and any gaps; the terms are summed and the sum is checked
//             against the measured delta. Then the SLACK: each padded entry's padding on both sides
//   DEX       for each classes*.dex that moved: header checksum, every map_list section's count and byte
//             size, R8's marker string (its pg-map-id is the first 7 hex digits of the mapping's SHA-256),
//             and - when both are the same length - every differing byte range named by its section
//   PROFILE   assets/dexopt/baseline.prof (ART profile 010) and .profm (metadata 002), decoded: dex count,
//             classes, hot methods, startup/post-startup flags, the embedded dex checksum against the dex
//             entry's zip CRC (ART keys a profile on it), and numMethodIds mod 8, which decides whether the
//             post-startup half of the flag bitmap is byte-aligned with the startup half. When it is, deflate
//             finds the halves' bytes repeated: in IOS-2e that alone took the stored profile from 4 663 to
//             3 727 B with almost the same content (measured in REPORT-AN-APK-DIFF.txt R865/R867)
//
// What it does NOT do: name classes or methods. R8 obfuscates them; that needs each side's mapping.txt and
// lives in REPORT-AN-APK-DIFF.txt's R867, done once by hand. Read-only; no dependency beyond Node's own
// modules (zlib's crc32 needs Node 22.2 or later). Covered by apk-diff.test.mjs (node --test), which builds
// its archives byte by byte; no gate runs that test.

import { readFileSync } from 'node:fs';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const SIG_BLOCK_MAGIC = 'APK Sig Block 42';

/** Every entry of a zip, from its central directory and its local headers. */
export function parseApk(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const commentLen = buf.readUInt16LE(eocd + 20);
  const entries = [];
  let off = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error(`central directory entry ${i}: bad signature at ${off}`);
    const flags = buf.readUInt16LE(off + 8);
    const n = buf.readUInt16LE(off + 28), ce = buf.readUInt16LE(off + 30), cc = buf.readUInt16LE(off + 32);
    const e = {
      name: buf.toString('utf8', off + 46, off + 46 + n),
      method: buf.readUInt16LE(off + 10), flags,
      crc: buf.readUInt32LE(off + 16), csize: buf.readUInt32LE(off + 20), usize: buf.readUInt32LE(off + 24),
      ce, lho: buf.readUInt32LE(off + 42),
    };
    if (buf.readUInt32LE(e.lho) !== 0x04034b50) throw new Error(`${e.name}: bad local header at ${e.lho}`);
    e.ln = buf.readUInt16LE(e.lho + 26);
    e.le = buf.readUInt16LE(e.lho + 28);
    e.dataStart = e.lho + 30 + e.ln + e.le;
    e.dd = flags & 8 ? 16 : 0;
    e.end = e.dataStart + e.csize + e.dd;
    entries.push(e);
    off += 46 + n + ce + cc;
  }
  const byOffset = [...entries].sort((x, y) => x.lho - y.lho);
  let cursor = 0;
  for (const e of byOffset) { e.gapBefore = e.lho - cursor; cursor = e.end; }
  const tailGap = cdOffset - cursor;
  return {
    buf, size: buf.length, count, cdOffset, cdSize, eocdSize: 22 + commentLen, entries, byOffset, tailGap,
    signed: {
      blockMagic: cdOffset >= 16 && buf.toString('latin1', cdOffset - 16, cdOffset) === SIG_BLOCK_MAGIC,
      v1Files: entries.map((e) => e.name).filter((x) => /^META-INF\/(MANIFEST\.MF|[^/]+\.(SF|RSA|DSA|EC))$/i.test(x)),
    },
  };
}

/** The bytes of one entry, inflated when it is deflated. */
export function entryData(apk, e) {
  const raw = apk.buf.subarray(e.dataStart, e.dataStart + e.csize);
  return e.method === 8 ? inflateRawSync(raw) : raw;
}

/** The entries that moved in any recorded field, and how many did not. */
export function compare(a, b) {
  const bm = new Map(b.entries.map((e) => [e.name, e]));
  const am = new Map(a.entries.map((e) => [e.name, e]));
  const fields = ['method', 'crc', 'csize', 'usize', 'lho', 'le', 'ce', 'flags'];
  const changed = [];
  let identical = 0;
  for (const x of a.entries) {
    const y = bm.get(x.name);
    if (!y) continue;
    const moved = fields.filter((f) => x[f] !== y[f]);
    if (moved.length) changed.push({ name: x.name, a: x, b: y, moved });
    else identical++;
  }
  return {
    changed, identical,
    added: b.entries.filter((e) => !am.has(e.name)).map((e) => e.name),
    removed: a.entries.filter((e) => !bm.has(e.name)).map((e) => e.name),
  };
}

/** The size delta, term by term. Every byte of an archive is a header, a padding, data, a gap, the CD or the EOCD. */
export function ledger(a, b) {
  const names = [...new Set([...a.entries.map((e) => e.name), ...b.entries.map((e) => e.name)])];
  const am = new Map(a.entries.map((e) => [e.name, e])), bm = new Map(b.entries.map((e) => [e.name, e]));
  const terms = names.map((name) => {
    const x = am.get(name), y = bm.get(name);
    const h = (e) => (e ? 30 + e.ln + e.dd : 0), p = (e) => (e ? e.le : 0), d = (e) => (e ? e.csize : 0);
    return { name, headerDelta: h(y) - h(x), extraDelta: p(y) - p(x), dataDelta: d(y) - d(x), extraBefore: p(x), extraAfter: p(y) };
  });
  const gaps = (z) => z.entries.reduce((s, e) => s + e.gapBefore, 0) + z.tailGap;
  const L = {
    terms: terms.filter((t) => t.headerDelta || t.extraDelta || t.dataDelta),
    cdDelta: b.cdSize - a.cdSize, eocdDelta: b.eocdSize - a.eocdSize, gapDelta: gaps(b) - gaps(a),
    totalDelta: b.size - a.size,
  };
  L.sum = L.terms.reduce((s, t) => s + t.headerDelta + t.extraDelta + t.dataDelta, 0) + L.cdDelta + L.eocdDelta + L.gapDelta;
  // THE SLACK: an entry carrying padding absorbs changes before it, up to its padding (growth) or up to its
  // alignment minus its padding (shrinkage), before the archive moves by a whole alignment unit.
  L.slack = terms.filter((t) => t.extraBefore || t.extraAfter).map((t) => {
    const y = bm.get(t.name);
    return { name: t.name, beforePadding: t.extraBefore, afterPadding: t.extraAfter, dataStartAfter: y ? y.dataStart : null };
  });
  return L;
}

const MAP_TYPES = {
  0x0000: 'header_item', 0x0001: 'string_id_item', 0x0002: 'type_id_item', 0x0003: 'proto_id_item',
  0x0004: 'field_id_item', 0x0005: 'method_id_item', 0x0006: 'class_def_item', 0x0007: 'call_site_id_item',
  0x0008: 'method_handle_item', 0x1000: 'map_list', 0x1001: 'type_list', 0x1002: 'annotation_set_ref_list',
  0x1003: 'annotation_set_item', 0x2000: 'class_data_item', 0x2001: 'code_item', 0x2002: 'string_data_item',
  0x2003: 'debug_info_item', 0x2004: 'annotation_item', 0x2005: 'encoded_array_item',
  0x2006: 'annotations_directory_item', 0xf000: 'hiddenapi_class_data_item',
};

/** A dex header, its map_list as sections with byte extents, and R8's marker. */
export function dexInfo(dex) {
  const u = (o) => dex.readUInt32LE(o);
  const mapOff = u(52);
  const sections = [];
  for (let i = 0, n = u(mapOff); i < n; i++) {
    const o = mapOff + 4 + i * 12;
    const t = dex.readUInt16LE(o);
    sections.push({ type: MAP_TYPES[t] ?? `0x${t.toString(16)}`, count: u(o + 4), offset: u(o + 8) });
  }
  sections.sort((x, y) => x.offset - y.offset);
  sections.forEach((s, i) => { s.bytes = (i + 1 < sections.length ? sections[i + 1].offset : dex.length) - s.offset; });
  const text = dex.toString('latin1');
  const at = text.indexOf('~~R8{');
  const marker = at < 0 ? null : text.slice(at + 4, text.indexOf('}', at) + 1);
  return { checksum: u(8), methodIds: u(88), typeIds: u(64), classDefs: u(96), sections, marker };
}

/** Same-length dexes: every differing byte range, named by the section it falls in. */
export function dexByteDiff(x, y, info) {
  const ranges = [];
  let start = -1;
  for (let i = 0; i <= x.length; i++) {
    const d = i < x.length && x[i] !== y[i];
    if (d && start < 0) start = i;
    if (!d && start >= 0) { ranges.push([start, i]); start = -1; }
  }
  const section = (o) => info.sections.find((s) => o >= s.offset && o < s.offset + s.bytes)?.type ?? '?';
  return ranges.map(([s, e]) => ({ start: s, end: e, section: section(s), before: x.subarray(s, e), after: y.subarray(s, e) }));
}

/** baseline.prof (pro\0 010\0) and baseline.profm (prm\0 002\0). */
export function decodeProfile(buf) {
  const magic = buf.toString('latin1', 0, 4), version = buf.toString('latin1', 4, 8);
  if (magic === 'prm\0' && version === '002\0') {
    const usize = buf.readUInt32LE(10), csize = buf.readUInt32LE(14);
    const body = inflateSync(buf.subarray(18, 18 + csize));
    return { kind: 'profm', dexCount: buf.readUInt16LE(8), usize, csize, body, typeIds: body.readUInt32LE(4 + body.readUInt16LE(2)) };
  }
  if (magic !== 'pro\0' || version !== '010\0') return { kind: 'unknown', magic, version };
  const dexCount = buf.readUInt8(8), usize = buf.readUInt32LE(9), csize = buf.readUInt32LE(13);
  const body = inflateSync(buf.subarray(17, 17 + csize));
  let o = 0;
  const lines = [];
  for (let i = 0; i < dexCount; i++) {
    const keyLen = body.readUInt16LE(o);
    lines.push({
      classes: body.readUInt16LE(o + 2), hotRegion: body.readUInt32LE(o + 4), checksum: body.readUInt32LE(o + 8),
      methodIds: body.readUInt32LE(o + 12), key: body.toString('utf8', o + 16, o + 16 + keyLen),
    });
    o += 16 + keyLen;
  }
  for (const L of lines) {
    let hot = 0;
    for (const end = o + L.hotRegion; o < end; hot++) {
      if (body.readUInt16LE(o + 2) !== 0) throw new Error('inline caches are not decoded');
      o += 4;
    }
    L.hotMethods = hot;
    o += L.classes * 2;
    L.bitmapBytes = Math.ceil((L.methodIds * 2) / 8);
    const bm = body.subarray(o, o + L.bitmapBytes);
    o += L.bitmapBytes;
    const bit = (k) => (bm[k >> 3] >> (k & 7)) & 1;
    let startup = 0, post = 0;
    for (let k = 0; k < L.methodIds; k++) { startup += bit(k); post += bit(L.methodIds + k); }
    Object.assign(L, { startup, post });
  }
  if (o !== body.length) throw new Error(`profile body: decoded ${o} of ${body.length} bytes`);
  return { kind: 'prof', dexCount, usize, csize, body, lines };
}

function hex(n) { return n.toString(16).padStart(8, '0'); }

export function report(pathA, pathB, all = false) {
  const a = parseApk(readFileSync(pathA)), b = parseApk(readFileSync(pathB));
  const out = [];
  const say = (s = '') => out.push(s);
  say(`ARCHIVE      ${pathA}  ->  ${pathB}`);
  for (const [k, z] of [['before', a], ['after ', b]]) {
    say(`  ${k} size ${z.size}  entries ${z.count}  CD @${z.cdOffset} ${z.cdSize} B  EOCD ${z.eocdSize} B  gap before CD ${z.tailGap}  ` +
      `signing block ${z.signed.blockMagic ? 'PRESENT' : 'absent'}  v1 files ${z.signed.v1Files.length ? z.signed.v1Files.join(',') : 'none'}`);
  }
  const c = compare(a, b);
  say(`ENTRIES      moved ${c.changed.length}, identical ${c.identical}, added ${c.added.length}, removed ${c.removed.length}`);
  const row = (e) => `m${e.method} ${e.csize}/${e.usize} crc ${hex(e.crc)} @${e.lho} le ${e.le} ce ${e.ce}`;
  for (const x of c.changed) say(`  ${x.name}\n      ${row(x.a)}\n   -> ${row(x.b)}   [${x.moved.join(',')}]`);
  for (const n of c.added) say(`  + ${n}`);
  for (const n of c.removed) say(`  - ${n}`);
  if (all) for (const e of b.byOffset) say(`  = ${e.name}  ${row(e)}`);
  const L = ledger(a, b);
  say(`LEDGER       measured delta ${L.totalDelta} B; sum of terms ${L.sum} B ${L.sum === L.totalDelta ? '(EQUAL)' : '(DIFFERENT - the ledger is wrong)'}`);
  for (const t of L.terms) say(`  ${t.name}: header ${t.headerDelta >= 0 ? '+' : ''}${t.headerDelta}, padding ${t.extraDelta >= 0 ? '+' : ''}${t.extraDelta}, data ${t.dataDelta >= 0 ? '+' : ''}${t.dataDelta}`);
  say(`  central directory ${L.cdDelta}, EOCD ${L.eocdDelta}, gaps ${L.gapDelta}`);
  for (const s of L.slack) say(`  padded: ${s.name}  padding ${s.beforePadding} -> ${s.afterPadding}  (data at ${s.dataStartAfter})`);
  for (const x of c.changed.filter((y) => /^classes\d*\.dex$/.test(y.name))) {
    const da = entryData(a, x.a), db = entryData(b, x.b);
    const ia = dexInfo(da), ib = dexInfo(db);
    say(`DEX          ${x.name}: checksum ${hex(ia.checksum)} -> ${hex(ib.checksum)}; method ids ${ia.methodIds} -> ${ib.methodIds}; type ids ${ia.typeIds} -> ${ib.typeIds}; class defs ${ia.classDefs} -> ${ib.classDefs}`);
    say(`  R8 marker before ${ia.marker}`);
    say(`  R8 marker after  ${ib.marker}`);
    for (const s of ib.sections) {
      const p = ia.sections.find((q) => q.type === s.type);
      if (!p || p.count !== s.count || p.bytes !== s.bytes) say(`  section ${s.type}: ${p ? `${p.count} / ${p.bytes} B` : 'absent'} -> ${s.count} / ${s.bytes} B`);
    }
    if (da.length === db.length) {
      const r = dexByteDiff(da, db, ia);
      say(`  same length: ${r.length} differing byte ranges, ${r.reduce((s, q) => s + q.end - q.start, 0)} bytes`);
      for (const q of r.slice(0, 20)) say(`    ${q.start}..${q.end} ${q.section}: ${q.before.toString('hex')} -> ${q.after.toString('hex')}${q.section === 'string_data_item' ? `  ("${q.before.toString('latin1')}" -> "${q.after.toString('latin1')}")` : ''}`);
    }
  }
  const dexCrc = (z) => z.entries.find((e) => e.name === 'classes.dex')?.crc;
  for (const x of c.changed.filter((y) => /^assets\/dexopt\/baseline\.profm?$/.test(y.name))) {
    const pa = decodeProfile(entryData(a, x.a)), pb = decodeProfile(entryData(b, x.b));
    let diffBytes = 0;
    if (pa.body && pb.body && pa.body.length === pb.body.length) for (let i = 0; i < pa.body.length; i++) diffBytes += pa.body[i] !== pb.body[i] ? 1 : 0;
    say(`PROFILE      ${x.name} (${pb.kind}): body ${pa.usize} -> ${pb.usize} B, deflated ${pa.csize} -> ${pb.csize} B${pa.body && pb.body && pa.body.length === pb.body.length ? `; ${diffBytes} body bytes differ` : ''}`);
    if (pb.kind === 'profm') say(`  type ids recorded ${pa.typeIds} -> ${pb.typeIds}`);
    if (pb.kind === 'prof') {
      pb.lines.forEach((l, i) => {
        const p = pa.lines[i];
        say(`  ${l.key}: classes ${p.classes} -> ${l.classes}; hot ${p.hotMethods} -> ${l.hotMethods}; startup ${p.startup} -> ${l.startup}; post-startup ${p.post} -> ${l.post}`);
        say(`  ${l.key}: method ids ${p.methodIds} (mod 8 = ${p.methodIds % 8}) -> ${l.methodIds} (mod 8 = ${l.methodIds % 8}); bitmap ${p.bitmapBytes} -> ${l.bitmapBytes} B`);
        say(`  ${l.key}: embedded dex checksum ${hex(p.checksum)} -> ${hex(l.checksum)}; the dex entry's zip CRC ${hex(dexCrc(a))} -> ${hex(dexCrc(b))} ${l.checksum === dexCrc(b) && p.checksum === dexCrc(a) ? '(EQUAL on both sides)' : '(NOT EQUAL)'}`);
      });
    }
  }
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  if (args.length !== 2) {
    console.error('usage: node android/scripts/apk-diff.mjs <before.apk> <after.apk> [--all]');
    process.exit(2);
  }
  console.log(report(args[0], args[1], process.argv.includes('--all')));
}
