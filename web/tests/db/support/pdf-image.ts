// web/tests/db/support/pdf-image.ts
//
// Pull the embedded raster image out of a produced PDF, as RGBA. FW-VERIFY (R232).
//
// ============================================================================
// WHY THIS, AND NOT A PDF LIBRARY
// ============================================================================
//
// The QR-decode proof is structural: it reads the QR out of the PRODUCED file,
// not off the page the template emitted. Chromium embeds a data-URI PNG <img> as
// an image XObject - /FlateDecode, raw samples, optionally a PNG predictor. This
// recovers those samples with Node's own zlib, un-predicts them, and returns
// RGBA that jsqr can read. No native canvas, no pdfjs: one dev dependency (jsqr)
// decodes, and this extracts.
//
// It handles the shapes Chromium actually writes for a lossless image - Flate,
// 8 bits per component, DeviceRGB or DeviceGray, PNG predictor or none. A shape
// it does not handle returns null, and the test says so rather than guessing.

import { inflateSync } from 'node:zlib';

export interface PdfImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
}

/** PNG row filters (predictor >= 10): undo them in place, row by row. */
function unpredict(data: Buffer, width: number, colors: number): Buffer {
  const bpp = colors; // 8 bits per component, so bytes-per-pixel === colors
  const stride = width * bpp;
  const out = Buffer.alloc(width * (data.length / (stride + 1)) * bpp);
  const rows = Math.floor(data.length / (stride + 1));
  let prevRow = Buffer.alloc(stride);

  for (let r = 0; r < rows; r += 1) {
    const filter = data[r * (stride + 1)]!;
    const row = data.subarray(r * (stride + 1) + 1, r * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);

    for (let i = 0; i < stride; i += 1) {
      const raw = row[i]!;
      const a = i >= bpp ? cur[i - bpp]! : 0; // left
      const b = prevRow[i]!; // up
      const c = i >= bpp ? prevRow[i - bpp]! : 0; // up-left

      let value: number;
      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + a;
          break;
        case 2:
          value = raw + b;
          break;
        case 3:
          value = raw + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = raw + pr;
          break;
        }
        default:
          value = raw;
      }

      cur[i] = value & 0xff;
    }

    cur.copy(out, r * stride);
    prevRow = cur;
  }

  return out;
}

/** Samples (RGB or Gray, 8bpc) -> RGBA. */
function toRgba(samples: Buffer, width: number, height: number, colors: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let p = 0; p < width * height; p += 1) {
    const r = colors === 1 ? samples[p]! : samples[p * colors]!;
    const g = colors === 1 ? samples[p]! : samples[p * colors + 1]!;
    const b = colors === 1 ? samples[p]! : samples[p * colors + 2]!;

    rgba[p * 4] = r;
    rgba[p * 4 + 1] = g;
    rgba[p * 4 + 2] = b;
    rgba[p * 4 + 3] = 255;
  }

  return rgba;
}

/** The first FlateDecode image XObject in the PDF, as RGBA, or null. */
export function extractFirstImage(bytes: Uint8Array): PdfImage | null {
  const buf = Buffer.from(bytes);
  const raw = buf.toString('latin1');

  for (const match of raw.matchAll(/(\d+)\s+0\s+obj\b/gu)) {
    const from = match.index + match[0].length;
    const endobj = raw.indexOf('endobj', from);

    if (endobj === -1) continue;

    const streamAt = raw.indexOf('stream', from);
    const head = raw.slice(from, streamAt === -1 || streamAt > endobj ? endobj : streamAt);

    if (!/\/Subtype\s*\/Image/u.test(head)) continue;
    if (!/\/Filter\s*\/FlateDecode/u.test(head)) continue; // DCT/other not handled

    const width = Number(/\/Width\s+(\d+)/u.exec(head)?.[1] ?? '0');
    const height = Number(/\/Height\s+(\d+)/u.exec(head)?.[1] ?? '0');
    const bpc = Number(/\/BitsPerComponent\s+(\d+)/u.exec(head)?.[1] ?? '8');
    const colorSpace = /\/ColorSpace\s*\/(\w+)/u.exec(head)?.[1] ?? 'DeviceRGB';
    const predictor = Number(/\/Predictor\s+(\d+)/u.exec(head)?.[1] ?? '1');

    if (width === 0 || height === 0 || bpc !== 8) continue;

    const colors = /Gray/u.test(colorSpace) ? 1 : 3;

    let dataStart = streamAt + 'stream'.length;
    while (buf[dataStart] === 0x0d || buf[dataStart] === 0x0a) dataStart += 1;
    const dataEnd = raw.indexOf('endstream', dataStart);
    const chunk = buf.subarray(dataStart, dataEnd === -1 ? undefined : dataEnd);

    let inflated: Buffer;
    try {
      inflated = inflateSync(chunk);
    } catch {
      continue;
    }

    const samples = predictor >= 10 ? unpredict(inflated, width, colors) : inflated;

    return { width, height, rgba: toRgba(samples, width, height, colors) };
  }

  return null;
}
