// web/tests/support/pdf-pages.ts
//
// Every page's size, read from the bytes of a produced PDF. FW-PDF-A4 (R935).
//
// ============================================================================
// CONFIGURED IS NOT DELIVERED (R154)
// ============================================================================
//
// lib/export/pdf.ts passes `format: 'A4'` to Chromium. That is a request. What
// the dossier IS is whatever box each page carries in the file, and nothing
// asserted that until this reader: `A4` appeared in the PDF tests only in
// comments.
//
// ============================================================================
// WHAT IT READS, AND WHAT IT REFUSES BY NAME
// ============================================================================
//
// It follows the file the way a viewer does: `startxref` -> the classic
// cross-reference table -> the trailer's /Root -> the catalog's /Pages -> the
// page tree, walked in order, so "page 3" means the third page a reader sees.
// The box is the page's /MediaBox, or the one it inherits from a /Pages
// ancestor (ISO 32000-1 7.7.3.4).
//
// Measured on 2026-11-16, Chromium writes PDF 1.4 with a classic table, no
// object streams, a nested page tree (a root /Pages whose kids are another
// /Pages node and a page), and a direct /MediaBox on every page. Anything
// else is REFUSED rather than guessed at, because each alternative changes
// what "the page size" means or hides the page from a plain scan:
//
//   /ObjStm, /XRef streams  objects compressed out of sight (PDF 1.5+); a
//                           page box inside one is invisible to this reader
//   /Prev                   an incremental update, whose later section can
//                           replace a page
//   /CropBox, /Rotate,      the visible region, its orientation and its unit
//   /UserUnit               all differ from the media box's numbers
//
// A refusal fails the test with the shape named. Meeting one is a finding
// about the renderer, and the person who reads it decides; a reader that
// guessed would hand them a pass instead.
//
// NO PDF LIBRARY (Ask-first: no new dependency). pageCount() in
// tests/db/container-pdf.test.ts already reads the bytes this way.

/** The inch, by definition (1959). */
const MM_PER_INCH = 25.4;

/** PDF default user space: 1/72 inch (ISO 32000-1 8.3.2.3). */
const PT_PER_INCH = 72;

/** ISO 216 A4, portrait. The dossier is printed portrait (lib/export/pdf.ts). */
export const A4_MM = Object.freeze({ width: 210, height: 297 });

/**
 * How far a page may be from A4 on each side and still be A4, in millimetres.
 *
 * MEASURED, THEN STATED (R345). This machine's Chromium writes the dossier at
 * 595.92 x 842.88 pt: 0.23 mm wider and 0.35 mm taller than ISO A4. Two
 * sourced parts make that up:
 *   - Playwright asks for A4 as 8.27 x 11.7 in - its own paper table, rounded
 *     to 0.01 in (+0.06 / +0.18 mm);
 *   - Chromium then writes 0.48 pt more than it was asked on each side
 *     (595.44 -> 595.92, 842.40 -> 842.88).
 * One millimetre is about three times the larger deviation, so a renderer
 * update that moves a rounding step does not fail; and it is under a fifth of
 * the nearest other paper's distance (US Letter is 5.9 mm wider), which
 * tests/unit/export/pdf-pages.test.ts asserts for Letter, Legal, A5, A3 and B5.
 */
export const A4_TOLERANCE_MM = 1;

export const ptFromMm = (mm: number): number => (mm * PT_PER_INCH) / MM_PER_INCH;
export const mmFromPt = (pt: number): number => (pt * MM_PER_INCH) / PT_PER_INCH;

export interface PageBox {
  /** 1-based, in page-tree order: the page number a reader sees. */
  readonly page: number;
  /** The page object's number, so the page can be found in the file. */
  readonly object: number;
  readonly widthPt: number;
  readonly heightPt: number;
}

/** The file has a shape this reader does not interpret, named. */
export class PdfPagesError extends Error {
  constructor(message: string) {
    super(`R935: ${message}`);
    this.name = 'PdfPagesError';
  }
}

/**
 * A dictionary's TOP-LEVEL text: nested dictionaries are dropped, arrays kept.
 *
 * A page's /Resources holds dictionaries of its own, and the catalog's
 * /ViewerPreferences has a /Type of its own. Reading keys out of the nested
 * text would take another dictionary's /Type for the page's.
 */
function topLevel(dict: string): string {
  const open = dict.indexOf('<<');

  if (open === -1) throw new PdfPagesError(`expected a dictionary, found ${JSON.stringify(dict.slice(0, 60))}`);

  let depth = 0;
  let out = '';
  let i = open;

  while (i < dict.length) {
    const two = dict.slice(i, i + 2);

    if (two === '<<') {
      depth += 1;
      i += 2;
      continue;
    }

    if (two === '>>') {
      depth -= 1;
      i += 2;
      if (depth === 0) return out;
      continue;
    }

    const char = dict[i]!;

    // A literal string can hold any of the delimiters above.
    if (char === '(') {
      let parens = 0;

      while (i < dict.length) {
        const c = dict[i]!;

        if (c === '\\') i += 1;
        else if (c === '(') parens += 1;
        else if (c === ')') parens -= 1;

        i += 1;
        if (parens === 0) break;
      }

      continue;
    }

    // A hex string: `<` not followed by another `<`.
    if (char === '<') {
      const close = dict.indexOf('>', i);

      i = close === -1 ? dict.length : close + 1;
      continue;
    }

    if (depth === 1) out += char;
    i += 1;
  }

  throw new PdfPagesError('a dictionary is not closed');
}

/** One top-level key's value text, up to the next name - for messages only. */
function entry(top: string, key: string): string {
  return new RegExp(`/${key}(?![A-Za-z0-9])\\s*([^/]*)`, 'u').exec(top)?.[1]?.trim() ?? '';
}

/** A /Name value, such as /Type's. */
function nameOf(top: string, key: string): string | null {
  const match = new RegExp(`/${key}\\s*/([A-Za-z0-9]+)`, 'u').exec(top);

  return match === null ? null : match[1]!;
}

function has(top: string, key: string): boolean {
  return new RegExp(`/${key}(?![A-Za-z0-9])`, 'u').test(top);
}

/** `N G R` -> N. */
function reference(top: string, key: string): number | null {
  const match = new RegExp(`/${key}\\s+(\\d+)\\s+(\\d+)\\s+R`, 'u').exec(top);

  return match === null ? null : Number(match[1]);
}

/** A direct array of indirect references, such as /Kids. */
function references(top: string, key: string): number[] {
  const match = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`, 'u').exec(top);

  if (match === null) throw new PdfPagesError(`no direct /${key} array`);

  return [...match[1]!.matchAll(/(\d+)\s+(\d+)\s+R/gu)].map((m) => Number(m[1]));
}

/** A direct rectangle, such as /MediaBox, as [llx, lly, urx, ury]. */
function rectangle(top: string, key: string, where: string): number[] | null {
  if (!has(top, key)) return null;

  const match = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`, 'u').exec(top);

  if (match === null) throw new PdfPagesError(`${where}'s /${key} is not a direct array`);

  const numbers = match[1]!.trim().split(/\s+/u).map(Number);

  if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) {
    throw new PdfPagesError(`${where}'s /${key} is not four numbers: [${match[1]}]`);
  }

  return numbers;
}

/** The classic cross-reference table: object number -> byte offset. */
function crossReference(raw: string): { offsets: Map<number, number>; trailer: string } {
  const at = raw.lastIndexOf('startxref');
  const offset = Number(/startxref\s+(\d+)/u.exec(raw.slice(at))?.[1] ?? Number.NaN);

  if (at === -1 || !Number.isInteger(offset)) throw new PdfPagesError('no startxref offset');

  if (!raw.startsWith('xref', offset)) {
    throw new PdfPagesError(
      'startxref does not point at a classic xref table - a cross-reference stream (PDF 1.5+), ' +
        'which can index page objects inside compressed object streams this reader does not decode',
    );
  }

  const trailerAt = raw.indexOf('trailer', offset);

  if (trailerAt === -1) throw new PdfPagesError('no trailer after the xref table');

  const tokens = raw.slice(offset + 'xref'.length, trailerAt).trim().split(/\s+/u);
  const offsets = new Map<number, number>();
  let i = 0;

  while (i < tokens.length) {
    const start = Number(tokens[i]);
    const count = Number(tokens[i + 1]);

    if (!Number.isInteger(start) || !Number.isInteger(count)) {
      throw new PdfPagesError(`a malformed xref subsection header at token ${i}`);
    }

    i += 2;

    for (let k = 0; k < count; k += 1, i += 3) {
      if (tokens[i + 2] === 'n') offsets.set(start + k, Number(tokens[i]));
    }
  }

  return { offsets, trailer: topLevel(raw.slice(trailerAt, at)) };
}

/**
 * Every page's effective box, in page order.
 *
 * Throws PdfPagesError, naming the shape, on anything it does not interpret -
 * and on a document of no pages, where "every page is A4" would be true of
 * nothing (R169's corollary).
 */
export function pageBoxes(bytes: Uint8Array): PageBox[] {
  const raw = Buffer.from(bytes).toString('latin1');

  // Before anything is parsed: an object stream anywhere means objects this
  // reader cannot see, and a page box could be one of them.
  if (/\/Type\s*\/ObjStm\b/u.test(raw)) {
    throw new PdfPagesError('the file holds /ObjStm compressed object streams, which this reader does not decode');
  }

  const { offsets, trailer } = crossReference(raw);

  if (has(trailer, 'Prev')) {
    throw new PdfPagesError('the trailer has /Prev: an incremental update, whose later section can replace a page');
  }

  if (has(trailer, 'XRefStm')) {
    throw new PdfPagesError('the trailer has /XRefStm: a hybrid file indexing objects in a cross-reference stream');
  }

  const read = (num: number): string => {
    const at = offsets.get(num);

    if (at === undefined) throw new PdfPagesError(`object ${num} is not in the xref table`);

    const header = new RegExp(`^${num}\\s+\\d+\\s+obj\\b`, 'u').exec(raw.slice(at, at + 32));

    if (header === null) throw new PdfPagesError(`the xref offset of object ${num} does not point at it`);

    const end = raw.indexOf('endobj', at);
    const body = raw.slice(at + header[0].length, end === -1 ? undefined : end);
    const stream = body.indexOf('stream');

    return topLevel(stream === -1 ? body : body.slice(0, stream));
  };

  const root = reference(trailer, 'Root');

  if (root === null) throw new PdfPagesError('the trailer names no /Root');

  const pagesRoot = reference(read(root), 'Pages');

  if (pagesRoot === null) throw new PdfPagesError('the catalog names no /Pages');

  const rootNode = read(pagesRoot);
  // A DIRECT integer: `/Count 12 0 R` must not read as 1 or 12.
  const count = Number(/\/Count\s+(\d+)(?![\d.])(?!\s+\d+\s+R)/u.exec(rootNode)?.[1] ?? Number.NaN);

  if (!Number.isInteger(count)) throw new PdfPagesError('the root /Pages has no direct /Count');

  const boxes: PageBox[] = [];
  const visited = new Set<number>();

  const walk = (num: number, inherited: number[] | null): void => {
    if (visited.has(num)) throw new PdfPagesError(`object ${num} appears twice in the page tree`);

    visited.add(num);

    const node = read(num);
    const type = nameOf(node, 'Type');
    const where = type === 'Page' ? `page ${boxes.length + 1} (object ${num})` : `/Pages object ${num}`;

    for (const key of ['CropBox', 'Rotate', 'UserUnit']) {
      if (has(node, key)) {
        throw new PdfPagesError(`${where} has /${key} ${entry(node, key)}, which changes what its size means`);
      }
    }

    const box = rectangle(node, 'MediaBox', where) ?? inherited;

    if (type === 'Pages') {
      for (const kid of references(node, 'Kids')) walk(kid, box);

      return;
    }

    if (type !== 'Page') throw new PdfPagesError(`object ${num} in the page tree is /Type ${String(type)}`);

    if (box === null) throw new PdfPagesError(`${where} has no /MediaBox, own or inherited`);

    const [llx, lly, urx, ury] = box as [number, number, number, number];

    boxes.push({
      page: boxes.length + 1,
      object: num,
      widthPt: Math.abs(urx - llx),
      heightPt: Math.abs(ury - lly),
    });
  };

  walk(pagesRoot, null);

  if (boxes.length === 0) {
    throw new PdfPagesError('the page tree holds no pages, and every page of nothing is A4');
  }

  if (boxes.length !== count) {
    throw new PdfPagesError(`the page tree holds ${boxes.length} pages but its root /Count says ${count}`);
  }

  return boxes;
}

/** Whether a page is A4 portrait, within A4_TOLERANCE_MM on each side. */
export function isA4(box: PageBox): boolean {
  return (
    Math.abs(mmFromPt(box.widthPt) - A4_MM.width) <= A4_TOLERANCE_MM &&
    Math.abs(mmFromPt(box.heightPt) - A4_MM.height) <= A4_TOLERANCE_MM
  );
}

/** One sentence per page that is not A4, naming the page and its size. */
export function a4Violations(boxes: readonly PageBox[]): string[] {
  return boxes
    .filter((box) => !isA4(box))
    .map(
      (box) =>
        `page ${box.page} (object ${box.object}) is ${box.widthPt.toFixed(2)} x ${box.heightPt.toFixed(2)} pt ` +
        `= ${mmFromPt(box.widthPt).toFixed(1)} x ${mmFromPt(box.heightPt).toFixed(1)} mm; ` +
        `A4 is ${A4_MM.width} x ${A4_MM.height} mm portrait, +/- ${A4_TOLERANCE_MM} mm per side`,
    );
}

/** The distinct sizes in a document, for a one-line print: `595.92x842.88pt x10`. */
export function describeSizes(boxes: readonly PageBox[]): string {
  const tally = new Map<string, number>();

  for (const box of boxes) {
    const key = `${box.widthPt.toFixed(2)}x${box.heightPt.toFixed(2)}pt`;

    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  return [...tally].map(([size, n]) => `${size} x${n}`).join(', ');
}
