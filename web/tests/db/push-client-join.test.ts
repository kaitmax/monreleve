// web/tests/db/push-client-join.test.ts
//
// AN-FCM-CLIENT (R1151, R1152, R204). The Android push client and the server,
// joined through the REAL entry points with the one fixture both sides read.
//
// ============================================================================
// WHY THIS CROSSES THREE ENTRY POINTS, NOT ONE
// ============================================================================
//
// Registration alone proves a part. A token can be registered, accepted and
// stored, and still never receive anything: the reminder job selects people
// by `reminderEnabled`, and before AN-FCM-CLIENT nothing in the app wrote it.
// So the join is the whole path a reminder takes - the token the app's fake
// produced, posted to POST /api/v1/devices; the opt-in the app writes, sent to
// PATCH /api/v1/me; then the job at the fixture's 17:31 handing a
// FakePushSender exactly that token with exactly the data the app reads.
//
// The other direction is asserted too (R196's shape): registered and NOT
// opted in, the same run reaches nobody. A join that only ever delivered would
// pass on a job that ignored the opt-in.
//
// The Android half is android/app/src/test/kotlin/ch/monreleve/app/push/
// PushClientFixtureTest.kt: the app's real builders must produce these bodies
// and its real reader must read this data. Neither side types the other's
// strings (R181, R206).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as registerDevice } from '@/app/api/v1/devices/route';
import { PATCH as patchMe } from '@/app/api/v1/me/route';
import { issueTokenPair } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db/client';
import { FakePushSender } from '@/lib/push/fake';
import { DevicePushTransport } from '@/lib/push/transport';
import { runDailyReminders } from '@/lib/reminders/job';

interface PushClientCases {
  readonly registration: {
    readonly fakeToken: string;
    readonly appVersion: string;
    readonly body: Record<string, unknown>;
  };
  readonly optIn: { readonly body: Record<string, unknown> };
  readonly reminder: {
    readonly now: string;
    readonly day: string;
    readonly mode: string;
    readonly data: Record<string, string>;
  };
}

const CASES = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'fixtures', 'push-client-cases.json'), 'utf8'),
) as PushClientCases;

const ORIGIN = 'https://monreleve.ch';

let userId = '';
let bearer = '';

function request(method: 'POST' | 'PATCH', path: string, payload: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    body: JSON.stringify(payload),
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'push-join@example.invalid', name: 'Camille Rey', canton: 'GE' },
    })
  ).id;

  bearer = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the fixture is the app side, unchanged', () => {
  it('registers the token the fake produced, in the body the app builds', () => {
    // A guard on the fixture itself: the body carries the fake token, so the
    // web half cannot drift to a different token than the one it asserts.
    expect(CASES.registration.body.fcmToken).toBe(CASES.registration.fakeToken);
    expect(CASES.registration.body.appVersion).toBe(CASES.registration.appVersion);
  });

  it('carries no `platform`, because the route refuses the key it documents (NOTICED)', async () => {
    // docs/api-v1.md section 10 lists `platform` as optional, default android.
    // The coordinate refusal (lib/entries/no-coordinates.ts) matches its banned
    // keys as SUBSTRINGS, and `platform` contains `lat` - so a body naming it
    // is refused as a coordinate before the schema ever reads it. The app
    // therefore omits it and takes the default. This test pins the server as
    // it is so the day it changes, somebody reads why the app omits the key;
    // it is not a statement that the refusal is right.
    expect(CASES.registration.body).not.toHaveProperty('platform');

    const refused = await registerDevice(
      request('POST', '/api/v1/devices', { ...CASES.registration.body, platform: 'android' }),
    );

    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ code: 'coordinates_refused' });
    expect(await prisma.device.count()).toBe(0);
  });
});

describe('registration, opt-in and the daily job, through the real entry points', () => {
  it('delivers the reminder to the registered token, with the data the app reads', async () => {
    const registered = await registerDevice(
      request('POST', '/api/v1/devices', CASES.registration.body),
    );

    expect(registered.status).toBe(200);
    expect(JSON.stringify(await registered.json())).not.toContain(CASES.registration.fakeToken);

    const optedIn = await patchMe(request('PATCH', '/api/v1/me', CASES.optIn.body));

    expect(optedIn.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).reminderEnabled).toBe(
      true,
    );

    const sender = new FakePushSender();
    const run = await runDailyReminders(new Date(CASES.reminder.now), new DevicePushTransport(sender));

    expect(run.sent).toBe(1);
    expect(sender.delivered).toHaveLength(1);
    expect(sender.delivered[0]?.token).toBe(CASES.registration.fakeToken);
    expect(sender.delivered[0]?.notification.data).toEqual(CASES.reminder.data);
  });

  it('reaches nobody when the token is registered but the opt-in was never written', async () => {
    // THE FINDING THIS TASK CLOSES: registered and accepted is not enough. The
    // job selects `reminderEnabled: true`, which only the app's opt-in writes.
    const registered = await registerDevice(
      request('POST', '/api/v1/devices', CASES.registration.body),
    );

    expect(registered.status).toBe(200);

    const sender = new FakePushSender();
    const run = await runDailyReminders(new Date(CASES.reminder.now), new DevicePushTransport(sender));

    expect(run.sent).toBe(0);
    expect(sender.attempted).toHaveLength(0);
  });
});
