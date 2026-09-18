// web/tests/db/entries-route.test.ts
//
// POST /api/v1/entries, driven through the ROUTE HANDLER.
//
// R204: THE ENTRY POINT IS THE UNIT UNDER TEST, NOT THE MODULE. tests/db/
// entries-write.test.ts proves writeEntries ignores a planted userId; that
// proves the FUNCTION. A client does not call the function - it sends a
// request, and between the two sit the bearer guard, the coordinate scan, the
// schema and the order they run in. A plant proven only at the function proves
// the function.
//
// FW22 measured what that gap costs: the sign-in email addressed a callback
// route that did not exist for three increments, and every module test passed
// throughout.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { MAX_BATCH_BODY_BYTES } from '@/lib/entries/schema';
import { POST } from '@/app/api/v1/entries/route';

const ORIGIN = 'https://monreleve.ch';

let userId = '';
let otherId = '';
let token = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function day(index = 0): string {
  const date = new Date('2026-04-07T00:00:00.000Z');

  date.setUTCDate(date.getUTCDate() + index);

  return date.toISOString().slice(0, 10);
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { clientMutationId: mutation(), dayDate: day(), kind: 'CH', ...overrides };
}

/** A request as the Android client sends one. */
function post(body: unknown, bearer = token, url = `${ORIGIN}/api/v1/entries`): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer === '' ? {} : { authorization: `Bearer ${bearer}` }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: 'route@example.com' } })).id;
  otherId = (await prisma.user.create({ data: { email: 'autre-route@example.com' } })).id;
  token = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the happy path', () => {
  it('accepts a batch and reports what it did', async () => {
    const response = await POST(post({ entries: [item(), item({ dayDate: day(1) })] }));

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ status: 'ok', written: 2, duplicates: 0 });
    expect(await prisma.entry.count({ where: { userId } })).toBe(2);
  });

  it('acknowledges a replay rather than refusing it (AC3)', async () => {
    const batch = { entries: [item()] };

    expect((await POST(post(batch))).status).toBe(200);

    const replay = await POST(post(batch));

    expect(replay.status).toBe(200);
    expect(await json(replay)).toMatchObject({ written: 0, duplicates: 1 });
    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(1);
  });

  it('sets no cookie (AC3)', async () => {
    const response = await POST(post({ entries: [item()] }));

    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('authentication comes first', () => {
  it('refuses with no token, and does not read the body', async () => {
    // The body is deliberately something that would ALSO be refused later - a
    // coordinate. If the route answered `coordinates_refused` here, it would
    // have parsed an unauthenticated caller's payload.
    const response = await POST(post({ entries: [item({ latitude: 46.2 })] }, ''));

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ code: 'missing_token' });
  });

  it('refuses a revoked session by its own code (R198)', async () => {
    const pair = await issueTokenPair(userId);

    await prisma.deviceSession.updateMany({
      where: { id: pair.sessionId },
      data: { revokedAt: new Date(), revokedReason: 'SIGNED_OUT' },
    });

    const response = await POST(post({ entries: [item()] }, pair.accessToken));

    expect(await json(response)).toMatchObject({ code: 'revoked_session' });
  });
});

describe('AC2: a coordinate is refused at the boundary, with a 400', () => {
  // THE FOUR FORMS, each driven through the HTTP handler rather than the
  // scanner. R180: every plant is verified to be IN THE REQUEST BODY before
  // its result is read - a plant that never reached the server would produce a
  // passing test and be recorded as proof that the server refuses it.
  it.each([
    ['at the top level of an item', { latitude: 46.2 }],
    ['in a nested object', { fix: { longitude: 6.1 } }],
    ['inside an array', { samples: [{ accuracy: 12 }] }],
    ['in a key whose name contains one', { lastKnownLatitude: 46.2 }],
  ])('refuses one %s', async (_label, planted) => {
    const body = { entries: [item(planted)] };

    // VERIFY THE PLANT LANDED, in the bytes that will be sent.
    const request = post(body);
    const sent = await request.clone().text();

    expect(sent).toContain(Object.keys(planted)[0] ?? '');

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'coordinates_refused' });
    expect(await prisma.entry.count()).toBe(0);
  });

  it('refuses one in the envelope rather than an item', async () => {
    const body = { entries: [item()], origin: { lat: 46.2 } };
    const request = post(body);

    expect(await request.clone().text()).toContain('lat');

    expect((await POST(request)).status).toBe(400);
  });

  it('says nothing about the VALUE in its answer', async () => {
    // The refusal names keys so a client author can find them. It must not
    // echo the coordinate itself - a value this product refuses to store must
    // not survive in the error about refusing to store it.
    const response = await POST(post({ entries: [item({ latitude: 46.20731 })] }));
    const body = JSON.stringify(await json(response));

    expect(body).not.toContain('46.20731');
    expect(body).not.toContain('46.2');
  });

  it('accepts a legitimate batch, so the refusal is not blanket', async () => {
    const response = await POST(
      post({
        entries: [
          item({
            note: 'journee en Suisse',
            provenance: 'DETECTED_CORRECTED',
            detectedKind: 'CH',
            clientClaimedAt: '2026-04-07T18:03:00.000Z',
          }),
        ],
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe('TENANCY at the HTTP boundary: identity is the token and nothing else', () => {
  it('ignores a userId planted in the BODY', async () => {
    const body = { entries: [{ ...item(), userId: otherId }] };
    const request = post(body);

    // R180: the plant is in the bytes being sent, and names a REAL other user.
    const sent = await request.clone().text();

    expect(sent).toContain(otherId);
    expect(otherId).not.toBe(userId);

    const response = await POST(request);

    // IT IS REFUSED, not silently ignored - `userId` is an unknown key and the
    // schema rejects rather than strips. Either outcome proves the rows do not
    // land on the victim; refusing also tells the client author.
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_payload' });
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('ignores a userId planted in the QUERY STRING', async () => {
    const url = new URL(`${ORIGIN}/api/v1/entries`);

    url.searchParams.set('userId', otherId);

    const request = post({ entries: [item()] }, token, url.toString());

    // R180: verify the plant is in the URL the handler will see.
    expect(new URL(request.url).searchParams.get('userId')).toBe(otherId);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // THE ROWS ARE THE CALLER'S. A query parameter is not identity, and the
    // route never reads one.
    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('ignores a userId planted in a HEADER', async () => {
    const request = new Request(`${ORIGIN}/api/v1/entries`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-user-id': otherId,
      },
      body: JSON.stringify({ entries: [item()] }),
    });

    expect(request.headers.get('x-user-id')).toBe(otherId);

    expect((await POST(request)).status).toBe(200);
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('writes nothing at all when the ONLY identity offered is planted', async () => {
    // THE NON-VACUITY HALF. The three above would pass against a route that
    // ignored everything including the token. Remove the token, leave the
    // plants, and nothing may be written for anyone.
    const url = new URL(`${ORIGIN}/api/v1/entries`);

    url.searchParams.set('userId', otherId);

    const response = await POST(post({ entries: [item()] }, '', url.toString()));

    expect(response.status).toBe(401);
    expect(await prisma.entry.count()).toBe(0);
  });
});

describe('the body is bounded before it is parsed', () => {
  it('refuses an oversized body with its own code', async () => {
    const huge = `{"entries":[{"note":"${'x'.repeat(MAX_BATCH_BODY_BYTES + 1000)}"}]}`;

    expect(Buffer.byteLength(huge, 'utf8')).toBeGreaterThan(MAX_BATCH_BODY_BYTES);

    const response = await POST(post(huge));

    expect(response.status).toBe(413);
    expect(await json(response)).toMatchObject({ code: 'payload_too_large' });
  });

  it('refuses a body that is not JSON', async () => {
    const response = await POST(post('not json at all'));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'malformed_body' });
  });
});

describe('R198: each rule that fires has its own code', () => {
  it('names the schema issues so a client author can act', async () => {
    const response = await POST(post({ entries: [item({ kind: 'ABSENT' })] }));
    const body = await json(response);

    expect(body).toMatchObject({ code: 'invalid_payload' });
    expect(JSON.stringify(body.issues)).toContain('absenceReason');
  });

  it('gives an intra-batch duplicate its own answer, not a 500', async () => {
    const response = await POST(
      post({ entries: [item({ dayDate: day() }), item({ dayDate: day() })] }),
    );

    // The schema catches it - see lib/entries/schema.ts for why the database
    // cannot: the write path upserts on exactly that key.
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_payload' });
  });

  it('keeps every code distinct across the whole route', async () => {
    const codes = new Set<string>();

    codes.add(String((await json(await POST(post({ entries: [item()] }, '')))).code));
    codes.add(String((await json(await POST(post('nope')))).code));
    codes.add(String((await json(await POST(post({ entries: [item({ lat: 1 })] })))).code));
    codes.add(String((await json(await POST(post({ entries: [] })))).code));

    expect(codes.size).toBe(4);
    for (const code of codes) expect(code).toMatch(/^[a-z][a-z_]*[a-z]$/);
  });
});
