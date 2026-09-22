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

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/export/pdf/route';
import { liveOrigin } from './support/live-server';
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
      data: { email: 'pdf@example.com', canton: 'GE', employmentRate: 100 },
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
