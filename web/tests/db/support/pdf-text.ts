// web/tests/db/support/pdf-text.ts
//
// The text INSIDE a produced PDF, and the fonts it carries. FW25b increment 3.
//
// ============================================================================
// WHY THIS EXISTS RATHER THAN A DOM ASSERTION
// ============================================================================
//
// Reading `document.body.innerText` proves what the TEMPLATE emitted. It says
// nothing about whether Chromium rendered it, paginated it, or wrote it into
// the file - and AC2 asks for assertions on the produced file precisely because
// those are different claims. A page can be perfect and the PDF empty.
//
// ============================================================================
// WHY IT IS THIS MUCH WORK: THE BYTES ARE GLYPH IDS
// ============================================================================
//
// Chromium subsets every font, so a content stream holds GLYPH IDS rather than
// characters: `<57>` is R in one subset and something else in the next. Each
// font carries a `/ToUnicode` CMap mapping its own ids back to codepoints, and
// reading the text means applying the RIGHT font's map to each run.
//
// THE FIRST VERSION MERGED EVERY CMAP INTO ONE TABLE, and measurement is why it
// does not any more: across the demo document's 20 CMaps, 2 of 62 ids carried
// conflicting meanings - `0x17` was both "E" and ",", `0xcf` was both "p" and a
// no-break space, which is why the rate read `100p%`. Two ids is a small
// number and the wrong thing to reason about: this text is what the banned-word
// assertion runs on, so a table that can turn one letter into another can hide
// the word it is looking for. Per-font mapping removes the question.
//
// ============================================================================
// THE POSITIVE CONTROL IS THE POINT (R154, R169)
// ============================================================================
//
// An extractor that silently returns "" makes every absence assertion pass.
// "The banned words are not in this document" is satisfied perfectly by a
// document nobody managed to read. So this throws rather than returning a
// suspiciously empty result, and its callers additionally assert phrases that
// MUST be present before asserting that anything is absent.

import { inflateSync } from 'node:zlib';

interface PdfObject {
  readonly num: number;
  /** The dictionary and body, as text. Binary stream data is excluded. */
  readonly head: string;
  /** The inflated stream, when the object has one. */
  readonly stream: string | null;
}

/** Every `N 0 obj ... endobj` in the file. PDF 1.4 writes them in the clear. */
function parseObjects(bytes: Uint8Array): Map<number, PdfObject> {
  const buf = Buffer.from(bytes);
  const raw = buf.toString('latin1');
  const objects = new Map<number, PdfObject>();

  for (const match of raw.matchAll(/(\d+)\s+0\s+obj\b/gu)) {
    const num = Number(match[1]);
    const from = match.index + match[0].length;
    const end = raw.indexOf('endobj', from);

    if (end === -1) continue;

    const body = raw.slice(from, end);
    const streamAt = body.indexOf('stream');

    if (streamAt === -1) {
      objects.set(num, { num, head: body, stream: null });

      continue;
    }

    // Byte offsets, because the stream payload is binary and `latin1` indexes
    // map one-to-one onto bytes.
    let dataFrom = from + streamAt + 'stream'.length;

    while (buf[dataFrom] === 0x0d || buf[dataFrom] === 0x0a) dataFrom += 1;

    const dataTo = raw.indexOf('endstream', dataFrom);
    const chunk = buf.subarray(dataFrom, dataTo === -1 ? undefined : dataTo);

    let stream: string;

    try {
      stream = inflateSync(chunk).toString('latin1');
    } catch {
      stream = chunk.toString('latin1');
    }

    objects.set(num, { num, head: body.slice(0, streamAt), stream });
  }

  return objects;
}

/** One font's glyph id -> character table, from its ToUnicode CMap. */
function cmapOf(source: string): Map<number, string> {
  const map = new Map<number, string>();

  for (const block of source.split('beginbfchar').slice(1)) {
    const body = block.split('endbfchar')[0] ?? '';

    for (const [, from, to] of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/gu)) {
      map.set(parseInt(from!, 16), String.fromCodePoint(parseInt(to!.slice(0, 4), 16)));
    }
  }

  for (const block of source.split('beginbfrange').slice(1)) {
    const body = block.split('endbfrange')[0] ?? '';

    for (const [, lo, hi, dst] of body.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/gu,
    )) {
      const start = parseInt(lo!, 16);
      const end = parseInt(hi!, 16);
      const base = parseInt(dst!.slice(0, 4), 16);

      for (let id = start; id <= end && id - start < 0x1000; id += 1) {
        map.set(id, String.fromCodePoint(base + (id - start)));
      }
    }
  }

  return map;
}

/**
 * The document's text, as the file actually carries it.
 *
 * Word boundaries are not reconstructed - PDF has no spaces, only positioned
 * runs - so this is a stream of glyphs for SEARCHING, never for reading. Every
 * assertion built on it looks for a substring or counts occurrences.
 */
export function extractPdfText(bytes: Uint8Array): string {
  const objects = parseObjects(bytes);

  // font object number -> its own glyph table.
  const fontMaps = new Map<number, Map<number, string>>();

  for (const object of objects.values()) {
    const toUnicode = /\/ToUnicode\s+(\d+)\s+0\s+R/u.exec(object.head);

    if (toUnicode === null) continue;

    const cmapObject = objects.get(Number(toUnicode[1]));

    if (cmapObject?.stream == null) continue;

    fontMaps.set(object.num, cmapOf(cmapObject.stream));
  }

  if (fontMaps.size === 0) {
    throw new Error(
      'no ToUnicode CMap reachable in the PDF - extraction would return nothing, ' +
        'and every absence assertion built on it would pass vacuously (R154)',
    );
  }

  let text = '';

  for (const object of objects.values()) {
    // A page's content stream is the one that begins text. CMap and metadata
    // streams are full of angle-bracketed hex too, and reading those back as
    // if they were text is how a table of mappings becomes "document content".
    if (object.stream === null || !object.stream.includes('BT')) continue;

    // `/F5 5 0 R` inside this page's resources: the alias the content stream
    // uses, resolved to the font object that owns the glyph table.
    const aliases = new Map<string, number>();

    for (const page of objects.values()) {
      if (!page.head.includes('/Contents') && !page.head.includes('/Font')) continue;

      for (const [, alias, num] of page.head.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/gu)) {
        aliases.set(alias!, Number(num));
      }
    }

    let active: Map<number, string> | null = null;

    // Walk the stream in order: font selections and text runs interleave, and
    // the run's meaning depends on the selection that preceded it.
    for (const token of object.stream.matchAll(/\/(F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>/gu)) {
      const [, alias, hex] = token;

      if (alias !== undefined) {
        const num = aliases.get(alias);

        active = num === undefined ? null : (fontMaps.get(num) ?? null);

        continue;
      }

      if (hex === undefined || active === null) continue;

      for (let i = 0; i + 1 < hex.length; i += 2) {
        text += active.get(parseInt(hex.slice(i, i + 2), 16)) ?? '';
      }
    }
  }

  if (text.length < 500) {
    throw new Error(
      `extracted only ${text.length} characters from a PDF of ${bytes.byteLength} bytes - ` +
        'refusing to report that as the document (R154: a mechanism is proven to deliver)',
    );
  }

  return text;
}

/**
 * Every font the document names, by its PostScript name.
 *
 * `/FontName /AAAAAA+Inter-Bold` - the six-letter prefix marks a SUBSET, which
 * is what embedding produces.
 */
export function fontNames(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString('latin1');
  const names = new Set<string>();

  for (const [, name] of raw.matchAll(/\/(?:BaseFont|FontName)\s*\/([A-Za-z0-9+\-_,]+)/gu)) {
    names.add(name!);
  }

  return [...names].sort();
}

/**
 * Whether every font carries its own glyph programs, rather than naming a font
 * the reader is expected to already have.
 *
 * ============================================================================
 * TYPE 3 IS EMBEDDING, AND THAT IS WHY THIS IS NOT A `/FontFile` CHECK
 * ============================================================================
 *
 * The obvious test is `/FontFile2` - a TrueType program in the file. This
 * document has none, and is nonetheless fully embedded: Chromium wrote
 * `/Subtype /Type3` fonts, where each glyph is a small drawing procedure under
 * `/CharProcs`. Variable fonts (this product ships Inter Variable) commonly
 * rasterise that way.
 *
 * A `/FontFile` check would therefore have FAILED on a correct document, and
 * the tempting fix - delete the assertion - would have removed the only guard
 * against the real defect: a `/BaseFont /Arial` with no program at all, which
 * is a document whose typeface depends on the machine that opens it.
 *
 * So the question is "does every font bring its glyphs", and both answers
 * count.
 */
export function everyFontEmbedded(bytes: Uint8Array): boolean {
  const raw = Buffer.from(bytes).toString('latin1');
  const descriptors = raw.split('/Type /FontDescriptor').length - 1;

  if (descriptors === 0) return false;

  const programs =
    raw.split('/CharProcs').length - 1 + (raw.match(/\/FontFile[23]?\b/gu) ?? []).length;

  return programs >= descriptors;
}
