// web/tests/db/export-pdf.test.ts
//
// GET /api/v1/export/pdf?year=, driven through the ROUTE HANDLER. FW25b inc. 1.
//
// ============================================================================
// THE PRODUCED FILE IS THE SUBJECT, NOT THE TEMPLATE
// ============================================================================
//
// R154's shape on a renderer: asserting that the print route emits the right
// HTML proves the template. It does not prove Chromium was reached, that it
// rendered, that it paginated, or that what came back is a PDF at all. A route
// returning an empty 200 with `content-type: application/pdf` passes every
// template assertion ever written.
//
// So the tests below read the BYTES that came back.
//
// ============================================================================
// WHY HALF OF THEM NEED A RUNNING SERVER, AND SAY SO WHEN THERE IS NONE
// ============================================================================
//
// Every other route in tests/db is proven by importing its handler. This one
// drives a BROWSER, and the browser makes a real request back to the print
// route - so a handler-only test can prove the refusals and nothing else.
//
// R133: when there is no server the suite names the reason, the way gate:clone
// names the steps a clone cannot run. A suite that quietly reports fewer tests
// is how "the renderer works" becomes something nobody actually checked.

import { writeFile } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/export/pdf/route';
import { liveOrigin } from './support/live-server';
import { everyFontEmbedded, extractPdfText, fontNames } from './support/pdf-text';
import { buildDossierFor } from '@/lib/dossier/load';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';
import { MAX_QUEUED } from '@/lib/export/render-queue';

/** Resolved once, at collection time, so the skip is visible in the report. */
const LIVE = await liveOrigin();

// ============================================================================
// THE REASON GOES IN THE SUITE'S NAME, AND THAT IS NOT DECORATION
// ============================================================================
//
// The first version of this logged the reason with `console.warn` and the gate
// printed `378 passed | 3 skipped` and nothing else - vitest captures console
// output from a test module, so the explanation went nowhere.
//
// A skip whose reason is invisible IS the silent omission R133 forbids; it just
// looks diligent in the source. So the reason travels in the one string every
// reporter prints, and `process.stderr` carries it too for the log a machine
// reads later.
const LIVE_SUITE =
  'skip' in LIVE
    ? `AC1: a real render - SKIPPED, ${LIVE.skip}`
    : 'AC1: a real render, against a real server';

if ('skip' in LIVE) {
  process.stderr.write(`\n[export-pdf] R133: the render tests did not run - ${LIVE.skip}\n\n`);
}

/** Handler-only tests never leave the process, so any origin will do. */
const HANDLER_ORIGIN = 'https://monreleve.ch';

let userId = '';
let token = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-b000-${String(counter).padStart(12, '0')}`;
}

/**
 * A GET as the Android client sends one.
 *
 * THE ORIGIN IS THE POINT when a render is expected: the route builds the
 * print URL from the request's own origin, so pointing this at a live server
 * is what makes the browser fetch something real.
 */
function get(query: string, origin: string, bearer = token): Request {
  return new Request(`${origin}/api/v1/export/pdf${query}`, {
    method: 'GET',
    headers: bearer === '' ? {} : { authorization: `Bearer ${bearer}` },
  });
}

async function seed(dayDate: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await prisma.entry.create({
    data: {
      userId,
      dayDate: new Date(`${dayDate}T00:00:00.000Z`),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: mutation(),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  process.env.AUTH_SECRET ??= 'export-pdf-test-secret';
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      // SPEC 12 item 1: a dossier needs a titulaire, and the route refuses
      // without one. Every fixture that expects a document names somebody.
      data: { email: 'pdf@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;
  token = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AC1: the cheap refusals happen before a browser is launched', () => {
  // THE ORDER EARNS ITS KEEP HERE MORE THAN ON ANY OTHER ROUTE. Every refusal
  // in this block costs microseconds; a render costs a browser. Validating the
  // year after launching Chromium would mean one malformed request paid
  // ~300 MB to discover the year was "abc".

  it('refuses an unauthenticated caller', async () => {
    const response = await GET(get('?year=2026', HANDLER_ORIGIN, ''));

    expect(response.status).toBe(401);
  });

  it('refuses a malformed year, by name', async () => {
    const response = await GET(get('?year=abc', HANDLER_ORIGIN));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('invalid_year');
  });

  it('refuses a coordinate in the query string, BEFORE the year is validated', async () => {
    // SPEC 13.1 / D18. The year here is also invalid, so the answer proves the
    // order rather than merely proving both checks exist.
    const response = await GET(get('?lat=46.2&year=abc', HANDLER_ORIGIN));

    expect(((await response.json()) as { code: string }).code).toBe('coordinates_refused');
  });

  it('refuses an unknown parameter and names it', async () => {
    const response = await GET(get('?year=2026&format=pdf', HANDLER_ORIGIN));

    expect(((await response.json()) as { code: string }).code).toBe('unknown_parameter');
  });
});

describe('R205: a renderer that cannot render REFUSES', () => {
  it('answers renderer_unavailable rather than an empty file', async () => {
    // The ordinary deployment failure: the image did not install Chromium, or
    // the pinned build moved. A 200 carrying zero bytes is the answer that
    // reaches an accountant as an attachment that will not open - a symptom
    // about as far from its cause as a symptom gets.
    //
    // This runs without a server BECAUSE the launch fails before any
    // navigation, which is also why it is the one render-path test that is
    // always available.
    const previous = process.env.FRONTALIER_CHROMIUM_PATH;
    process.env.FRONTALIER_CHROMIUM_PATH = '/nonexistent/chromium-that-is-not-here';

    try {
      await seed('2026-03-02');

      const response = await GET(get('?year=2026', HANDLER_ORIGIN));

      expect(response.status).toBe(503);
      expect(((await response.json()) as { code: string }).code).toBe('renderer_unavailable');
    } finally {
      if (previous === undefined) delete process.env.FRONTALIER_CHROMIUM_PATH;
      else process.env.FRONTALIER_CHROMIUM_PATH = previous;
    }
  });

  it('refuses an unset AUTH_SECRET rather than rendering an unsigned URL', async () => {
    // R198: this is a DIFFERENT fact from a missing browser, with a different
    // remedy, so it gets its own code. Without it the operator reads
    // "renderer_unavailable" and goes looking for Chromium.
    const previous = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;

    try {
      const response = await GET(get('?year=2026', HANDLER_ORIGIN));

      expect(response.status).toBe(503);
      expect(((await response.json()) as { code: string }).code).toBe('not_configured');
    } finally {
      if (previous !== undefined) process.env.AUTH_SECRET = previous;
    }
  });
});

describe.skipIf('skip' in LIVE)(LIVE_SUITE, () => {
  const origin = 'origin' in LIVE ? LIVE.origin : '';

  it('returns REAL PDF BYTES, not merely a pdf content-type', async () => {
    await seed('2026-03-02');

    const response = await GET(get('?year=2026', origin));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');

    const bytes = new Uint8Array(await response.arrayBuffer());

    // THE MAGIC NUMBER IS THE WHOLE POINT. `%PDF-` makes this a claim about
    // the file rather than about the header we chose to send ourselves.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    // AND IT IS NOT AN EMPTY DOCUMENT. A near-zero-byte body with a correct
    // header and a correct magic number passes everything above.
    expect(bytes.byteLength).toBeGreaterThan(10_000);

    // THE WALKTHROUGH NEEDS THE PRODUCED FILE, and this test already holds it.
    // R176 asks a person to open the document and read it; writing the bytes
    // out on request is how they get the same file the assertions ran against,
    // rather than one produced by a second path that could differ.
    if (process.env.FRONTALIER_PDF_OUT !== undefined) {
      await writeFile(process.env.FRONTALIER_PDF_OUT, bytes);
    }
  });

  it('names the year in the filename, so three exports are three files', async () => {
    await seed('2026-03-02');

    const response = await GET(get('?year=2026', origin));

    expect(response.headers.get('content-disposition')).toContain('releve-2026.pdf');
  });

  it('never caches, because a proxy treats an authenticated export as static', async () => {
    await seed('2026-03-02');

    const response = await GET(get('?year=2026', origin));

    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});

describe.skipIf('skip' in LIVE)(`AC3 (through the route): ${LIVE_SUITE}`, () => {
  const origin = 'origin' in LIVE ? LIVE.origin : '';

  it('serves TWO concurrent exports, both succeeding', async () => {
    // R204: the queue's own tests prove serialization with a controllable job.
    // This proves the ROUTE is wired to it and that serializing does not turn
    // the second caller's request into a failure - which is the half AC3 asks
    // for and the half a mutex alone gets wrong.
    await seed('2026-03-02');

    const [first, second] = await Promise.all([
      GET(get('?year=2026', origin)),
      GET(get('?year=2026', origin)),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const [a, b] = await Promise.all([first.arrayBuffer(), second.arrayBuffer()]);

    // BOTH ARE REAL FILES. Two 200s carrying nothing would pass the above.
    expect(new TextDecoder().decode(new Uint8Array(a).slice(0, 5))).toBe('%PDF-');
    expect(new TextDecoder().decode(new Uint8Array(b).slice(0, 5))).toBe('%PDF-');
  });

  it('refuses past the bound with renderer_busy and a Retry-After', async () => {
    // One rendering, MAX_QUEUED waiting, and one more than that. The last is
    // turned away by NAME rather than joining an unbounded queue that converts
    // memory pressure into latency and then into an OOM anyway.
    await seed('2026-03-02');

    const responses = await Promise.all(
      Array.from({ length: MAX_QUEUED + 2 }, () => GET(get('?year=2026', origin))),
    );

    const busy = responses.filter((r) => r.status === 503);
    const ok = responses.filter((r) => r.status === 200);

    // PRESENCE BEFORE ABSENCE (R169): some succeeded, so this is not a route
    // that refuses everything.
    expect(ok.length).toBeGreaterThan(0);
    expect(busy.length).toBeGreaterThan(0);

    const body = (await busy[0]!.json()) as { code: string };

    expect(body.code).toBe('renderer_busy');
    expect(busy[0]!.headers.get('retry-after')).toBe('30');
  });
});

describe('SPEC 12 item 1: no titulaire, no document', () => {
  it('refuses BEFORE launching a browser, with its own code', async () => {
    // A document that cannot be attributed to a person is not a relevé. The
    // check is here rather than inside the render because discovering it in
    // Chromium would cost a browser and report `renderer_unavailable`, which
    // sends the operator hunting a missing binary (R198).
    await prisma.user.update({ where: { id: userId }, data: { name: null } });
    await seed('2026-03-02');

    const response = await GET(get('?year=2026', HANDLER_ORIGIN));

    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('titulaire_missing');
  });
});

describe.skipIf('skip' in LIVE)(`AC2 (on the produced file): ${LIVE_SUITE}`, () => {
  const origin = 'origin' in LIVE ? LIVE.origin : '';

  /** The bytes the route returned, and the text inside them. */
  async function produce(): Promise<{ bytes: Uint8Array; text: string }> {
    const response = await GET(get('?year=2026', origin));

    expect(response.status).toBe(200);

    const bytes = new Uint8Array(await response.arrayBuffer());

    // R182: extraction runs AFTER the file exists, on the file, never beside
    // the code that wrote it.
    return { bytes, text: extractPdfText(bytes) };
  }

  beforeEach(async () => {
    await seed('2026-03-02');
    await seed('2026-03-03', { kind: 'ABSENT', absenceReason: 'MALADIE' });
  });

  it('carries the document, PROVEN PRESENT before anything is claimed absent', async () => {
    // R169's corollary, and the reason it leads this block: every assertion
    // below is an absence or a count, and both are satisfied perfectly by a
    // document nobody managed to read.
    const { text } = await produce();

    expect(text).toContain(COPY.title);
    expect(text).toContain(COPY.header.name);
    expect(text).toContain(COPY.annex.heading);
  });

  it('uses NO banned word - asserted on the FILE, not the template', async () => {
    // FW25 asserted this over the rendered HTML, which is a different claim: a
    // word could reach the page and not the file, or reach the file through a
    // path the DOM never showed.
    const { text } = await produce();

    for (const banned of ['certifié', 'attesté', 'conforme', 'validé', 'approuvé']) {
      expect(text.toLowerCase(), `${banned} reached the produced document`).not.toContain(banned);
    }
  });

  it('names the titulaire and the generation date (SPEC 12 item 1)', async () => {
    // Both were absent from the document until the read-through found them.
    // A PDF that cannot be filed against a person is not a relevé.
    const { text } = await produce();

    expect(text).toContain('Camille Rey');
    expect(text).toContain(COPY.header.generatedAt);
    expect(text).toContain(COPY.header.absencesDeclared);
  });

  it('prints the rail, which SPEC line 885 relies on and nothing rendered', async () => {
    // THE RAIL IS VECTOR, so its presence is proven by the TICK LABELS it
    // draws: the social ceiling appears once in the thresholds sentence and
    // once more as the rail's own label. One occurrence means the sentence
    // rendered and the rail did not - which is exactly the state this document
    // shipped in until FW25b.
    const { text } = await produce();
    const social = '49,9';

    expect(text.split(social).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('prints every day the payload carries, including the ones with no entry', async () => {
    // AC2's row count, as a claim about days rather than about a number: the
    // file and the payload must describe the same year. A count alone passes
    // on a document with the right number of wrong rows.
    const { text } = await produce();
    const dossier = await buildDossierFor(userId, 2026);

    const missing = dossier.annex
      .map((row) => {
        const [y, m, d] = row.dayDate.split('-');

        return `${d}.${m}.${y}`;
      })
      .filter((printed) => !text.includes(printed));

    expect(missing).toEqual([]);

    // AND THE GAPS ARE COUNTED, not merely present. The test user logged two
    // days of 2026, so the rest of the year is unlogged and the document must
    // say so once per working day.
    const gaps = dossier.annex.filter((row) => !row.recorded).length;

    expect(gaps).toBeGreaterThan(0);
    expect(text.split(COPY.annex.notRecorded).length - 1).toBe(gaps);
  });

  it('embeds every font, and every one of them is Inter', async () => {
    // NOT A /FontFile CHECK, and the difference matters: Chromium writes
    // Type 3 fonts for a variable family, where each glyph is a drawing
    // procedure under /CharProcs. A /FontFile assertion would fail on this
    // correct document, and deleting it would remove the only guard against
    // the real defect - a font named but not carried, which renders in
    // whatever the opening machine happens to have.
    const { bytes } = await produce();

    const names = fontNames(bytes);

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !/Inter/u.test(name))).toEqual([]);
    expect(everyFontEmbedded(bytes)).toBe(true);
  });

  it('writes French decimals, never a decimal point', async () => {
    // The document printed 151.5 and 102.5 while its percentages used commas -
    // inconsistent with itself about its own separator, in the one artefact
    // SPEC 7.3 says must match the employer's filing. `formatDays` existed the
    // whole time and the page was not using it (R206).
    const { text } = await produce();

    // A digit, a POINT, a digit. Dates use dots too, so the pattern excludes
    // anything that looks like one.
    const decimals = text.match(/\d+\.\d(?!\d\.)/gu) ?? [];
    const suspicious = decimals.filter((hit) => !/^\d{2}\.\d$/u.test(hit));

    expect(suspicious).toEqual([]);
  });
});
