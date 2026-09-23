// web/tests/db/push-transport.test.ts
//
// Fan-out and pruning. FW27 increment 3.
//
// ============================================================================
// PRUNING IS THE ONLY DESTRUCTIVE THING THIS TASK DOES
// ============================================================================
//
// Deleting a device row is silent and has no undo: nothing appears on the
// phone, nothing surfaces in the application, and the registration only comes
// back when the client next launches and re-registers. If that never happens -
// because the person has the app installed and simply does not open it, which
// is the exact population reminders exist for - they stop receiving reminders
// and nobody finds out.
//
// So the tests here are weighted towards what must NOT be deleted. The credential
// outage is the worst case and has its own test: one wrong environment
// variable answers 401 for every device in the database, and a rule written as
// "prune unless the send succeeded" would delete all of them in one run.
//
// R243: every send goes to FakePushSender. Nothing in this file can reach a
// network.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { DevicePushTransport } from '@/lib/push/transport';
import { FakePushSender } from '@/lib/push/fake';
import { reminderNotification } from '@/lib/push/message';
import { runDailyReminders } from '@/lib/reminders/job';
import { toStoredDay } from '@/lib/entries/day';

const DAY = '2026-07-07';
/** 17:30 Paris, which is 15:30 UTC in summer. */
const AT_1730 = new Date('2026-07-07T15:30:00.000Z');

let userId = '';

async function addDevice(token: string): Promise<string> {
  return (await prisma.device.create({ data: { userId, fcmToken: token } })).id;
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: {
        email: 'push@example.com',
        name: 'Camille Rey',
        canton: 'GE',
        reminderEnabled: true,
        reminderTime: '17:30',
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('one reminder becomes one push per registered device', () => {
  it('sends to every device and reports how many it reached', async () => {
    await addDevice('token-a');
    await addDevice('token-b');

    const sender = new FakePushSender();

    const delivery = await new DevicePushTransport(sender).send({
      userId,
      day: DAY,
      mode: 'MANUAL',
    });

    expect(delivery).toEqual({ devices: 2 });
    expect(sender.delivered.map((push) => push.token).sort()).toEqual(['token-a', 'token-b']);
  });

  it('hands the sender the French notification, not a payload shape', async () => {
    await addDevice('token-a');

    const sender = new FakePushSender();

    await new DevicePushTransport(sender).send({ userId, day: DAY, mode: 'AUTO_DETECT' });

    // R206: asserted against the module that composes it rather than against a
    // second spelling of the sentence, which would drift the moment the copy
    // is reviewed.
    expect(sender.delivered[0]?.notification).toEqual(
      reminderNotification({ userId, day: DAY, mode: 'AUTO_DETECT' }),
    );
  });
});

describe('nowhere to deliver is not a failure', () => {
  it('reports zero devices, attempts nothing, and does not throw', async () => {
    const sender = new FakePushSender();

    const delivery = await new DevicePushTransport(sender).send({
      userId,
      day: DAY,
      mode: 'MANUAL',
    });

    expect(delivery).toEqual({ devices: 0 });
    expect(sender.attempted).toHaveLength(0);
  });

  it('does not reach another person s devices', async () => {
    // The query is scoped by user; this is what says so. A transport that
    // fanned out over every Device row would pass every test above.
    const other = await prisma.user.create({
      data: { email: 'other@example.com', name: 'Autre', canton: 'VD' },
    });

    await prisma.device.create({ data: { userId: other.id, fcmToken: 'not-theirs' } });

    const sender = new FakePushSender();

    expect(await new DevicePushTransport(sender).send({ userId, day: DAY, mode: 'MANUAL' })).toEqual(
      { devices: 0 },
    );
    expect(sender.attempted).toHaveLength(0);
  });
});

describe('a token is pruned when the service says it is gone, and only then', () => {
  it('prunes on 404 and keeps the device that accepted', async () => {
    await addDevice('token-dead');
    await addDevice('token-live');

    const sender = new FakePushSender();

    sender.answerWith('token-dead', 404);

    const delivery = await new DevicePushTransport(sender).send({
      userId,
      day: DAY,
      mode: 'MANUAL',
    });

    expect(delivery).toEqual({ devices: 1 });

    const remaining = await prisma.device.findMany({ select: { fcmToken: true } });

    expect(remaining.map((row) => row.fcmToken)).toEqual(['token-live']);
  });

  it('prunes on 410 as well, so the rule is not one vendor s status', async () => {
    await addDevice('token-gone');

    const sender = new FakePushSender();

    sender.answerWith('token-gone', 410);

    await new DevicePushTransport(sender).send({ userId, day: DAY, mode: 'MANUAL' });

    expect(await prisma.device.count()).toBe(0);
  });

  it('every token dead: nothing to retry, so it returns zero rather than throwing', async () => {
    await addDevice('token-a');
    await addDevice('token-b');

    const sender = new FakePushSender();

    sender.answerWith('token-a', 404);
    sender.answerWith('token-b', 410);

    const delivery = await new DevicePushTransport(sender).send({
      userId,
      day: DAY,
      mode: 'MANUAL',
    });

    // Not a failure: retrying a token the service says is gone is how a job
    // spins for ever on a person who is no longer there.
    expect(delivery).toEqual({ devices: 0 });
    expect(await prisma.device.count()).toBe(0);
  });
});

describe('a transient failure deletes NOTHING', () => {
  it('keeps every row when the service answers 503, and throws so the job retries', async () => {
    await addDevice('token-a');
    await addDevice('token-b');

    const sender = new FakePushSender();

    sender.answerWith('token-a', 503);
    sender.answerWith('token-b', 503);

    await expect(
      new DevicePushTransport(sender).send({ userId, day: DAY, mode: 'MANUAL' }),
    ).rejects.toThrow();

    expect(await prisma.device.count()).toBe(2);
  });

  it('keeps every row through a CREDENTIAL OUTAGE, which is the worst case', async () => {
    // One wrong environment variable answers 401 for every device this product
    // has. A rule written as "prune unless the send succeeded" would empty the
    // table in a single run, and the only signal would be people mentioning,
    // months later, that the reminders stopped.
    await addDevice('token-a');
    await addDevice('token-b');
    await addDevice('token-c');

    const sender = new FakePushSender();

    for (const token of ['token-a', 'token-b', 'token-c']) sender.answerWith(token, 401);

    await expect(
      new DevicePushTransport(sender).send({ userId, day: DAY, mode: 'MANUAL' }),
    ).rejects.toThrow();

    expect(await prisma.device.count()).toBe(3);
  });

  it('keeps the transient row while pruning the dead one in the same run', async () => {
    // The mixed case, which a rule applied per RUN rather than per TOKEN would
    // get wrong in one direction or the other.
    await addDevice('token-dead');
    await addDevice('token-flaky');

    const sender = new FakePushSender();

    sender.answerWith('token-dead', 404);
    sender.answerWith('token-flaky', 503);

    // Nothing was delivered and one token is merely unreachable, so the job
    // must retry.
    await expect(
      new DevicePushTransport(sender).send({ userId, day: DAY, mode: 'MANUAL' }),
    ).rejects.toThrow();

    const remaining = await prisma.device.findMany({ select: { fcmToken: true } });

    expect(remaining.map((row) => row.fcmToken)).toEqual(['token-flaky']);
  });
});

describe('R204: the job and the transport, through the real path', () => {
  it('produces exactly one push for an unconfirmed day, and none on a retry', async () => {
    await addDevice('token-a');

    const sender = new FakePushSender();
    const transport = new DevicePushTransport(sender);

    const first = await runDailyReminders(AT_1730, transport);
    const second = await runDailyReminders(AT_1730, transport);

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.skippedAlreadySent).toBe(1);
    expect(sender.delivered).toHaveLength(1);
    expect(sender.delivered[0]?.notification.title).toContain('07.07.2026');
  });

  it('counts a person with no device separately, and does not spend their day', async () => {
    // Nobody registered. The job must neither record a reminder that was not
    // received nor report a delivery failure that will never resolve.
    const sender = new FakePushSender();

    const run = await runDailyReminders(AT_1730, new DevicePushTransport(sender));

    expect(run).toMatchObject({ considered: 1, sent: 0, failed: 0, skippedNoDevice: 1 });
    expect(await prisma.reminderSent.count()).toBe(0);
  });

  it('delivers the same day once a device appears, because the claim was released', async () => {
    const sender = new FakePushSender();
    const transport = new DevicePushTransport(sender);

    await runDailyReminders(AT_1730, transport);

    await addDevice('token-late');

    const later = await runDailyReminders(AT_1730, transport);

    expect(later.sent).toBe(1);
    expect(sender.delivered).toHaveLength(1);
  });

  it('sends nothing at all on a day that is already logged', async () => {
    await addDevice('token-a');

    await prisma.entry.create({
      data: {
        userId,
        dayDate: toStoredDay(DAY),
        portion: 'FULL',
        kind: 'HOME',
        clientMutationId: '00000000-0000-4000-2000-000000000001',
      },
    });

    const sender = new FakePushSender();

    const run = await runDailyReminders(AT_1730, new DevicePushTransport(sender));

    expect(run.skippedDayLogged).toBe(1);
    expect(sender.attempted).toHaveLength(0);
  });
});
