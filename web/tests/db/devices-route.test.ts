// web/tests/db/devices-route.test.ts
//
// POST /api/v1/devices, through the route handler. FW27 increment 3.
//
// ============================================================================
// THE ENTRY POINT IS THE UNIT UNDER TEST (R204)
// ============================================================================
//
// Importing the handler and handing it a Request proves the product; importing
// a `registerDevice` function would prove a function and reproduce FW22's
// blind spot one layer down, where a sign-in email addressed a route nobody
// had written.
//
// ============================================================================
// THE HANDOVER CASE IS THE ONE WITH A CONSEQUENCE
// ============================================================================
//
// A registration token belongs to an app install, not to a person. One phone,
// two accounts - sold, lent, or simply a second person signing in - produces
// the same token arriving under a different id. If the row kept its first
// owner, the FIRST person's reminders would keep arriving on a phone that is
// now somebody else's. That is the test below that matters.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { POST } from '@/app/api/v1/devices/route';

const ORIGIN = 'https://monreleve.ch';
const TOKEN = 'fcm-token-from-a-real-looking-install';

let userId = '';
let otherId = '';
let bearer = '';
let sessionId = '';

function post(payload: unknown, token = bearer): Request {
  return new Request(`${ORIGIN}/api/v1/devices`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
    },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'phone@example.com', name: 'Camille Rey', canton: 'GE' },
    })
  ).id;

  otherId = (
    await prisma.user.create({
      data: { email: 'second@example.com', name: 'Dominique Roux', canton: 'VD' },
    })
  ).id;

  const pair = await issueTokenPair(userId);

  bearer = pair.accessToken;
  sessionId = pair.sessionId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('who may register', () => {
  it('refuses an unauthenticated caller', async () => {
    expect((await POST(post({ fcmToken: TOKEN }, ''))).status).toBe(401);
    expect(await prisma.device.count()).toBe(0);
  });

  it('registers for the BEARER, not for anything in the body', async () => {
    // lib/auth/bearer.ts reads one header and nothing else; this asserts the
    // route did not add a second way to say who it is for.
    const response = await POST(post({ fcmToken: TOKEN, userId: otherId }));

    // The planted key is refused outright, which is the strict schema doing
    // its job - and the row that would have been written does not exist.
    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ code: 'invalid_body' });
    expect(await prisma.device.count()).toBe(0);
  });
});

describe('what a registration stores', () => {
  it('writes one row, with the token, the platform and the version', async () => {
    const response = await POST(post({ fcmToken: TOKEN, appVersion: '1.4.2' }));

    expect(response.status).toBe(200);

    const row = await prisma.device.findUniqueOrThrow({ where: { fcmToken: TOKEN } });

    expect(row.userId).toBe(userId);
    expect(row.platform).toBe('android');
    expect(row.appVersion).toBe('1.4.2');
  });

  it('never echoes the token back', async () => {
    const payload = await body(await POST(post({ fcmToken: TOKEN })));

    expect(JSON.stringify(payload)).not.toContain(TOKEN);
    expect(payload.id).toEqual(expect.any(String));
  });

  it('links the calling SESSION to the device (D21)', async () => {
    // The nullable column closed. Without this the link would exist as a
    // schema comment describing something nothing does.
    await POST(post({ fcmToken: TOKEN }));

    const device = await prisma.device.findUniqueOrThrow({ where: { fcmToken: TOKEN } });
    const session = await prisma.deviceSession.findUniqueOrThrow({ where: { id: sessionId } });

    expect(session.deviceId).toBe(device.id);
  });

  it('is idempotent: re-registering the same token keeps ONE row', async () => {
    // A client re-registers on every launch. A second row would mean two
    // pushes for one phone, which is the nagging SPEC 13.3 forbids arriving
    // through the back door.
    await POST(post({ fcmToken: TOKEN, appVersion: '1.4.2' }));
    await POST(post({ fcmToken: TOKEN, appVersion: '1.5.0' }));

    expect(await prisma.device.count()).toBe(1);

    const row = await prisma.device.findUniqueOrThrow({ where: { fcmToken: TOKEN } });

    expect(row.appVersion).toBe('1.5.0');
  });

  it('moves the token to whoever is signed in now', async () => {
    // THE HANDOVER. Without this the previous owner keeps receiving reminders
    // on a phone they no longer hold.
    await POST(post({ fcmToken: TOKEN }));

    const second = await issueTokenPair(otherId);

    await POST(post({ fcmToken: TOKEN }, second.accessToken));

    expect(await prisma.device.count()).toBe(1);

    const row = await prisma.device.findUniqueOrThrow({ where: { fcmToken: TOKEN } });

    expect(row.userId).toBe(otherId);
  });
});

describe('what a registration refuses', () => {
  it('refuses a body that is not JSON', async () => {
    const response = await POST(post('not json at all'));

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ code: 'malformed_body' });
  });

  it('refuses a missing token rather than storing an empty one', async () => {
    expect((await POST(post({ appVersion: '1.0.0' }))).status).toBe(400);
    expect(await prisma.device.count()).toBe(0);
  });

  it('refuses an unknown field instead of silently dropping it', async () => {
    // A client that misspells a field and receives 200 has been told its
    // change was saved.
    const response = await POST(post({ fcmToken: TOKEN, deviceModel: 'Pixel 8' }));

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ code: 'invalid_body' });
  });

  it('refuses a coordinate BY NAME, and stores nothing (SPEC 13.1 / D18)', async () => {
    const response = await POST(post({ fcmToken: TOKEN, latitude: 46.2 }));

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ code: 'coordinates_refused' });
    expect(await prisma.device.count()).toBe(0);
  });

  it('never repeats the coordinate VALUE in the refusal', async () => {
    // A coordinate this product refuses to store must not survive in the
    // error message about refusing to store it.
    const response = await POST(post({ fcmToken: TOKEN, longitude: 6.1432 }));

    expect(JSON.stringify(await body(response))).not.toContain('6.1432');
  });

  it('ACCEPTS a plain registration, so the refusals are not refusing everything', async () => {
    // R196's other direction, on a route rather than a constraint.
    expect((await POST(post({ fcmToken: TOKEN }))).status).toBe(200);
  });
});

describe('erasure reaches devices', () => {
  it('deletes the row with the account (D11)', async () => {
    await POST(post({ fcmToken: TOKEN }));

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.device.count()).toBe(0);
  });
});
