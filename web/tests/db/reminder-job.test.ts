// web/tests/db/reminder-job.test.ts
//
// AC2: the four reminder cases. FW27 increment 2.
//
// ============================================================================
// THE FOURTH CASE IS THE ONE THAT MATTERS
// ============================================================================
//
// One on an unconfirmed day, none on a confirmed one, none after opt-out -
// those three are what the feature is. The fourth, none twice when the job is
// RETRIED, is what makes it safe to schedule: a scheduler retries, and SPEC
// §13.3 says a tool that nags gets uninstalled.
//
// R243: every test here uses the fake transport. Nothing in this file can
// reach a network.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { runDailyReminders } from '@/lib/reminders/job';
import { FakeTransport } from '@/lib/reminders/transport';
import { toStoredDay } from '@/lib/entries/day';

/** 17:30 Paris on 7 July 2026, which is 15:30 UTC in summer. */
const AT_1730 = new Date('2026-07-07T15:30:00.000Z');
/** 17:29 Paris the same day. */
const AT_1729 = new Date('2026-07-07T15:29:00.000Z');
const TODAY = '2026-07-07';

let userId = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-1000-${String(counter).padStart(12, '0')}`;
}

async function logToday(): Promise<void> {
  await prisma.entry.create({
    data: {
      userId,
      dayDate: toStoredDay(TODAY),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: mutation(),
    },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: {
        email: 'reminder@example.com',
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

describe('AC2: the four cases', () => {
  it('sends ONE on an unconfirmed day', async () => {
    const transport = new FakeTransport();

    const run = await runDailyReminders(AT_1730, transport);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.userId).toBe(userId);
    expect(transport.sent[0]?.day).toBe(TODAY);
    expect(run.sent).toBe(1);
  });

  it('sends NONE on a day that is already logged', async () => {
    await logToday();

    const transport = new FakeTransport();

    const run = await runDailyReminders(AT_1730, transport);

    expect(transport.sent).toHaveLength(0);
    // AND IT SAYS WHY. A run reporting zero sent tells nobody whether the
    // query matched nothing or everybody was already logged (R244).
    expect(run.considered).toBe(1);
    expect(run.skippedDayLogged).toBe(1);
  });

  it('sends NONE after opt-out', async () => {
    await prisma.user.update({ where: { id: userId }, data: { reminderEnabled: false } });

    const transport = new FakeTransport();

    const run = await runDailyReminders(AT_1730, transport);

    expect(transport.sent).toHaveLength(0);
    // NOT EVEN CONSIDERED: opting out removes somebody from the query rather
    // than filtering them later, so there is no path that could send.
    expect(run.considered).toBe(0);
  });

  it('sends NONE TWICE when the job is retried - the case that makes it safe', async () => {
    const transport = new FakeTransport();

    await runDailyReminders(AT_1730, transport);
    const second = await runDailyReminders(AT_1730, transport);

    expect(transport.sent).toHaveLength(1);
    expect(second.sent).toBe(0);
    expect(second.skippedAlreadySent).toBe(1);
  });
});

describe('the guarantee is the unique index, not the caller remembering', () => {
  it('holds when two runs overlap, which a check-then-insert would not', async () => {
    // THE DOOR A "does a row exist?" CHECK LEAVES OPEN. Two concurrent runs
    // both find nothing and both send. The insert is what claims the day, and
    // exactly one of these can win it.
    const transport = new FakeTransport();

    const [a, b] = await Promise.all([
      runDailyReminders(AT_1730, transport),
      runDailyReminders(AT_1730, transport),
    ]);

    expect(transport.sent).toHaveLength(1);
    expect(a.sent + b.sent).toBe(1);
    expect(a.skippedAlreadySent + b.skippedAlreadySent).toBe(1);
  });

  it('refuses a second row for one day at the DATABASE, by constraint', async () => {
    // The guarantee stated where it actually lives. If this ever stops
    // throwing, every test above is resting on application code alone.
    await prisma.reminderSent.create({ data: { userId, sentOn: toStoredDay(TODAY) } });

    await expect(
      prisma.reminderSent.create({ data: { userId, sentOn: toStoredDay(TODAY) } }),
    ).rejects.toThrow();
  });
});

describe('the time of day decides, in Paris', () => {
  it('does not send before the chosen time', async () => {
    const transport = new FakeTransport();

    const run = await runDailyReminders(AT_1729, transport);

    expect(transport.sent).toHaveLength(0);
    expect(run.considered).toBe(0);
  });

  it('sends at the chosen time, so the boundary is not simply refusing', async () => {
    // R196: one minute apart, opposite answers. A job that never sent would
    // pass the test above.
    const transport = new FakeTransport();

    await runDailyReminders(AT_1730, transport);

    expect(transport.sent).toHaveLength(1);
  });

  it('uses the PARIS wall clock, not UTC', async () => {
    // In winter the same wall-clock time is a different instant. A job
    // comparing UTC hours would send an hour early for half the year.
    await prisma.user.update({ where: { id: userId }, data: { reminderTime: '17:30' } });

    const transport = new FakeTransport();

    // 16:30 UTC in January is 17:30 in Paris.
    await runDailyReminders(new Date('2026-01-07T16:30:00.000Z'), transport);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.day).toBe('2026-01-07');
  });
});

describe('a failed delivery does not consume the day', () => {
  it('releases the claim so the next run retries', async () => {
    // Without this a transport failure would silently spend the person's one
    // reminder - worse than either ordering the job could have chosen,
    // because nothing would record that they never received it.
    const transport = new FakeTransport();

    transport.failOnce(userId);

    const first = await runDailyReminders(AT_1730, transport);

    expect(first.failed).toBe(1);
    expect(first.sent).toBe(0);
    expect(transport.sent).toHaveLength(0);

    const second = await runDailyReminders(AT_1730, transport);

    expect(second.sent).toBe(1);
    expect(transport.sent).toHaveLength(1);
  });
});

describe('R244: the run reports what it DID', () => {
  it('returns counts that distinguish an empty match from a full skip', async () => {
    // "Completed" is true of a run whose query was wrong. These four numbers
    // are not.
    const other = await prisma.user.create({
      data: {
        email: 'logged@example.com',
        name: 'Autre',
        canton: 'GE',
        reminderEnabled: true,
        reminderTime: '17:30',
      },
    });

    await prisma.entry.create({
      data: {
        userId: other.id,
        dayDate: toStoredDay(TODAY),
        portion: 'FULL',
        kind: 'CH',
        clientMutationId: mutation(),
      },
    });

    const run = await runDailyReminders(AT_1730, new FakeTransport());

    expect(run).toMatchObject({
      day: TODAY,
      parisTime: '17:30',
      considered: 2,
      sent: 1,
      skippedDayLogged: 1,
      skippedAlreadySent: 0,
      skippedNoDevice: 0,
      failed: 0,
    });
  });
});

describe('nowhere to deliver is neither a send nor a failure', () => {
  it('counts it on its own and leaves the day unclaimed', async () => {
    // Reminders on, no registered device: they turned reminders on, then
    // uninstalled, and their token was pruned on the next send. Counting it as
    // a SEND would put a reminder nobody received into the one number R244
    // exists to make trustworthy; counting it as a FAILURE would retry for
    // ever on something retrying cannot fix.
    const transport = new FakeTransport();

    transport.noDevicesFor(userId);

    const run = await runDailyReminders(AT_1730, transport);

    expect(run).toMatchObject({ considered: 1, sent: 0, failed: 0, skippedNoDevice: 1 });
    expect(transport.sent).toHaveLength(0);
    expect(await prisma.reminderSent.count()).toBe(0);
  });

  it('delivers the same day once a device appears, because the claim was released', async () => {
    const transport = new FakeTransport();

    transport.noDevicesFor(userId);

    await runDailyReminders(AT_1730, transport);

    const withDevice = new FakeTransport();

    expect((await runDailyReminders(AT_1730, withDevice)).sent).toBe(1);
  });
});

describe('the payload carries what the server actually knows', () => {
  it('names the mode, so an auto-mode client can show its own proposal', async () => {
    await prisma.user.update({ where: { id: userId }, data: { loggingMode: 'AUTO_DETECT' } });

    const transport = new FakeTransport();

    await runDailyReminders(AT_1730, transport);

    expect(transport.sent[0]?.mode).toBe('AUTO_DETECT');
  });

  it('names MANUAL for a manual logger', async () => {
    const transport = new FakeTransport();

    await runDailyReminders(AT_1730, transport);

    expect(transport.sent[0]?.mode).toBe('MANUAL');
  });
});
