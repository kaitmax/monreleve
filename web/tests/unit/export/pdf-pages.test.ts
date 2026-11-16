// web/tests/unit/export/pdf-pages.test.ts
//
// The page-size reader, proven on PDFs whose every byte this file controls.
// FW-PDF-A4 (R935).
//
// ============================================================================
// WHY A UNIT TEST, WHEN THE CLAIM IS ABOUT A RENDERED FILE
// ============================================================================
//
// The claim - "the dossier is A4" - is asserted on the bytes the product
// renders, in tests/db/container-pdf.test.ts, for the image's Chromium and
// for this machine's. That suite needs Docker and a database, so it runs only
// when its paths change (R936).
//
// The READER that suite trusts runs here, in `pnpm test`, in every gate and in
// gate:clone. Each refusal below is a shape the reader does not interpret; a
// reader that met one of them silently would read a size that is not the page's
// - or read nothing, and "every page is A4" holds perfectly over no pages
// (R169's corollary).

import { describe, expect, it } from 'vitest';
import {
  A4_MM,
  A4_TOLERANCE_MM,
  PdfPagesError,
  a4Violations,
  isA4,
  mmFromPt,
  pageBoxes,
  ptFromMm,
} from '@/tests/support/pdf-pages';

/**
 * A complete PDF 1.4 file with a correct cross-reference table.
 *
 * Offsets are computed, never typed, so a fixture cannot pass by carrying a
 * table that points at the wrong bytes.
 */
function pdf(objects: Readonly<Record<number, string>>, root: number, trailerExtra = ''): Uint8Array {
  let body = '%PDF-1.4\n';
  const offsets = new Map<number, number>();
  const numbers = Object.keys(objects)
    .map(Number)
    .sort((a, b) => a - b);

  for (const num of numbers) {
    offsets.set(num, body.length);
    body += `${num} 0 obj\n${objects[num]}\nendobj\n`;
  }

  const xrefAt = body.length;
  const size = Math.max(...numbers) + 1;

  body += `xref\n0 ${size}\n0000000000 65535 f \n`;

  for (let num = 1; num < size; num += 1) {
    const offset = offsets.get(num);

    body +=
      offset === undefined
        ? '0000000000 65535 f \n'
        : `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  body += `trailer\n<</Size ${size} /Root ${root} 0 R${trailerExtra}>>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(body, 'latin1'));
}

/**
 * The box Chromium wrote on every page of the dossier, measured on
 * 2026-11-16 from this machine's render (.pdf-evidence/measure-here-dev.pdf).
 * A measured figure, and the value IS the assertion (R171): the shape the
 * renderer actually produces reads as A4.
 */
const CHROMIUM_A4 = '[0 0 595.91998 842.88]';

/** US Letter, 8.5 x 11 in. */
const LETTER = '[0 0 612 792]';

/** One page object with a box, in the shape Chromium writes it. */
function page(parent: number, box: string | null, extra = ''): string {
  const media = box === null ? '' : ` /MediaBox ${box}`;

  return `<</Type /Page /Resources <</ProcSet [/PDF /Text]>>${media} /Contents 99 0 R /Parent ${parent} 0 R${extra}>>`;
}

/**
 * Chromium's page tree, as measured: a root /Pages whose kids are an
 * intermediate /Pages node AND a page, so the page order is only right if the
 * tree is walked in order.
 */
function chromiumShaped(boxes: readonly [string, string, string]): Uint8Array {
  return pdf(
    {
      1: '<</Type /Catalog /Pages 2 0 R /ViewerPreferences <</Type /ViewerPreferences /DisplayDocTitle true>>>>',
      2: '<</Type /Pages /Count 3 /Kids [3 0 R 6 0 R]>>',
      3: '<</Type /Pages /Count 2 /Kids [4 0 R 5 0 R] /Parent 2 0 R>>',
      4: page(3, boxes[0]),
      5: page(3, boxes[1]),
      6: page(2, boxes[2]),
    },
    1,
  );
}

describe('R935: the expected size and the tolerance are stated values, asserted (R345)', () => {
  it('expects ISO 216 A4, 210 x 297 mm, portrait', () => {
    expect(A4_MM).toEqual({ width: 210, height: 297 });
  });

  it('allows 1 mm per side, and not a value nobody chose', () => {
    // WHY 1 mm. Measured on this machine's Chromium: the dossier's pages are
    // 595.92 x 842.88 pt, 0.23 mm wider and 0.35 mm taller than ISO A4. The
    // deviation has two sourced parts: Playwright asks for A4 as 8.27 x 11.7
    // in (its own table, rounded to 0.01 in: +0.06 / +0.18 mm), and Chromium
    // writes 0.48 pt more than it was asked on each side (595.44 -> 595.92,
    // 842.40 -> 842.88). 1 mm is about three times the larger measured part,
    // so a renderer update that moves a rounding step does not fail - and,
    // asserted below, it is far too small to admit any other paper size.
    expect(A4_TOLERANCE_MM).toBe(1);
  });

  it('derives points from millimetres, never types them', () => {
    // 72 points to the inch (PDF user space), 25,4 mm to the inch.
    expect(ptFromMm(25.4)).toBeCloseTo(72, 10);
    expect(mmFromPt(72)).toBeCloseTo(25.4, 10);
  });

  it.each([
    ['US Letter', 8.5, 11],
    ['US Legal', 8.5, 14],
    ['A5', 148 / 25.4, 210 / 25.4],
    ['A3', 297 / 25.4, 420 / 25.4],
    ['B5', 176 / 25.4, 250 / 25.4],
  ])('cannot admit %s, so the check tells A4 from its neighbours', (_name, wIn, hIn) => {
    expect(isA4({ page: 1, object: 1, widthPt: wIn * 72, heightPt: hIn * 72 })).toBe(false);
  });

  it("admits Playwright's own A4 request, 8.27 x 11.7 in", () => {
    expect(isA4({ page: 1, object: 1, widthPt: 8.27 * 72, heightPt: 11.7 * 72 })).toBe(true);
  });

  it('refuses A4 turned sideways: the dossier is a portrait document', () => {
    expect(isA4({ page: 1, object: 1, widthPt: 842.88, heightPt: 595.92 })).toBe(false);
  });
});

describe("R935: every page's box, in document order", () => {
  it("reads Chromium's measured shape as three A4 pages, in tree order", () => {
    const boxes = pageBoxes(chromiumShaped([CHROMIUM_A4, CHROMIUM_A4, CHROMIUM_A4]));

    // PRESENCE FIRST (R169): three pages, not "no violation among none".
    expect(boxes.map((box) => [box.page, box.object])).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
    expect(boxes.every((box) => box.widthPt === 595.91998 && box.heightPt === 842.88)).toBe(true);
    expect(a4Violations(boxes)).toEqual([]);
  });

  it('names a non-first page that is not A4, with its size', () => {
    // A check that read only the first page's box would pass this file.
    const violations = a4Violations(pageBoxes(chromiumShaped([CHROMIUM_A4, LETTER, CHROMIUM_A4])));

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('page 2 ');
    expect(violations[0]).toContain('612.00 x 792.00 pt');
    expect(violations[0]).toContain('215.9 x 279.4 mm');
  });

  it('reads a box a page inherits from its /Pages node (ISO 32000-1 7.7.3.4)', () => {
    const boxes = pageBoxes(
      pdf(
        {
          1: '<</Type /Catalog /Pages 2 0 R>>',
          2: `<</Type /Pages /Count 2 /Kids [3 0 R 4 0 R] /MediaBox ${LETTER}>>`,
          3: page(2, null),
          4: page(2, CHROMIUM_A4),
        },
        1,
      ),
    );

    // The first page inherits Letter; the second's own box overrides it.
    expect(a4Violations(boxes)).toHaveLength(1);
    expect(a4Violations(boxes)[0]).toContain('page 1 ');
  });
});

describe('R935: a shape this reader does not interpret is refused BY NAME', () => {
  // Each of these would otherwise yield a size that is not the page's, or no
  // pages at all. A refusal is a test failure a person reads; a guess is a
  // pass nobody does.

  function refusal(bytes: Uint8Array): string {
    try {
      pageBoxes(bytes);
    } catch (error) {
      if (error instanceof PdfPagesError) return error.message;
      throw error;
    }

    return '(no refusal)';
  }

  it('refuses compressed object streams, where a page box could hide', () => {
    const bytes = pdf(
      {
        1: '<</Type /Catalog /Pages 2 0 R>>',
        2: '<</Type /Pages /Count 1 /Kids [3 0 R]>>',
        3: page(2, CHROMIUM_A4),
        4: '<</Type /ObjStm /N 0 /First 0 /Length 0>>',
      },
      1,
    );

    expect(refusal(bytes)).toContain('/ObjStm');
  });

  it('refuses a cross-reference stream, which can index objects inside one', () => {
    const classic = Buffer.from(chromiumShaped([CHROMIUM_A4, CHROMIUM_A4, CHROMIUM_A4])).toString(
      'latin1',
    );
    const xrefAt = classic.indexOf('xref\n');
    // startxref now points at an object instead of a table.
    const bytes = new Uint8Array(
      Buffer.from(
        `${classic.slice(0, xrefAt)}7 0 obj\n<</Type /XRef /Size 8 /Root 1 0 R>>\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`,
        'latin1',
      ),
    );

    expect(refusal(bytes)).toContain('cross-reference stream');
  });

  it('refuses an incremental update, whose later section could replace a page', () => {
    const bytes = pdf(
      {
        1: '<</Type /Catalog /Pages 2 0 R>>',
        2: '<</Type /Pages /Count 1 /Kids [3 0 R]>>',
        3: page(2, CHROMIUM_A4),
      },
      1,
      ' /Prev 9',
    );

    expect(refusal(bytes)).toContain('/Prev');
  });

  it.each([
    ['/CropBox', ` /CropBox ${LETTER}`],
    ['/Rotate', ' /Rotate 90'],
    ['/UserUnit', ' /UserUnit 2'],
  ])('refuses %s, which changes what the page size means', (name, extra) => {
    const bytes = pdf(
      {
        1: '<</Type /Catalog /Pages 2 0 R>>',
        2: '<</Type /Pages /Count 1 /Kids [3 0 R]>>',
        3: page(2, CHROMIUM_A4, extra),
      },
      1,
    );

    expect(refusal(bytes)).toContain(name);
  });

  it('refuses a page with no box anywhere in its ancestry', () => {
    const bytes = pdf(
      {
        1: '<</Type /Catalog /Pages 2 0 R>>',
        2: '<</Type /Pages /Count 1 /Kids [3 0 R]>>',
        3: page(2, null),
      },
      1,
    );

    expect(refusal(bytes)).toContain('page 1');
  });

  it('refuses a tree whose pages do not add up to its root /Count', () => {
    const bytes = pdf(
      {
        1: '<</Type /Catalog /Pages 2 0 R>>',
        2: '<</Type /Pages /Count 2 /Kids [3 0 R]>>',
        3: page(2, CHROMIUM_A4),
      },
      1,
    );

    expect(refusal(bytes)).toContain('/Count');
  });

  it('refuses a document of no pages, where "every page is A4" is vacuous', () => {
    const bytes = pdf(
      {
        1: '<</Type /Catalog /Pages 2 0 R>>',
        2: '<</Type /Pages /Count 0 /Kids []>>',
      },
      1,
    );

    expect(refusal(bytes)).toContain('no pages');
  });
});
