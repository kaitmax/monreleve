// web/tests/db/rappel-delai-job.test.ts
//
// FW-DELAI-RAPPEL, R916: ONE REMINDER, FOURTEEN DAYS BEFORE, THEN THE ROW IS
// GONE - and every half of that sentence asserted POSITIVELY (R154): the
// message is in the outbox AND the table is read afterwards and found empty.
// A pass that deleted nothing and sent nothing would satisfy neither.
//
// THE CLOCK IS PLACED (R171): every "today" is derived from a deadline the
// test chooses, so the file means the same thing on every day it runs.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as DELETE } from '@/app/api/rappel-delai/suppression/route';
import { prisma } from '@/lib/db/client';
import { siteOrigin } from '@/lib/content/site';
import { clearOutbox, readOutbox, sendMail, type Message } from '@/lib/alerts/mailer';
import { hashToken } from '@/lib/alerts/token';
import { AUTH_EMAIL_FROM } from '@/lib/fr/emails';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { parisDayOf, toStoredDay } from '@/lib/entries/day';
import { runDeadlineReminders } from '@/lib/rappel/job';
import { LANDING_STATES, landingFor } from '@/lib/rappel/landing';
import { DELETE_PATH } from '@/lib/rappel/mail';
import { purgeUnconfirmedReminders } from '@/lib/rappel/purge';
import { reminderDay, shiftDays } from '@/lib/rappel/window';

const EMAIL = 'rappel@monreleve.test';

/** A date well ahead of the real clock, so nothing here is "in the past" by accident. */
const DEADLINE = shiftDays(parisDayOf(new Date()), 120) ?? '';
const DUE = reminderDay(DEADLINE) ?? '';

/** Noon in Paris on an ISO day (11:00Z or 10:00Z - noon either side of a clock change is the same day). */
const noonOn = (day: string): Date => new Date(`${day}T11:00:00Z`);

let seq = 0;

/** A row in a state the routes can produce. */
async function row(confirmed: boolean, deadline = DEADLINE, email = EMAIL): Promise<void> {
  seq += 1;
  await prisma.deadlineReminder.create({
    data: {
      email,
      deadline: toStoredDay(deadline),
      confirmationTokenHash: confirmed ? null : hashToken(`confirm:${seq}`),
      confirmationExpiresAt: confirmed ? null : new Date(Date.now() + 60_000),
      confirmedAt: confirmed ? new Date() : null,
      deleteTokenHash: hashToken(`delete:${seq}`),
    },
  });
}

/** A sender that refuses everything, and one that delivers and then reports failure. */
const refusing = async (): Promise<boolean> => false;
const delivered: Message[] = [];
const deliveredButFailed = async (message: Message): Promise<boolean> => {
  delivered.push(message);

  return false;
};

beforeEach(async () => {
  await prisma.deadlineReminder.deleteMany();
  clearOutbox();
  delivered.length = 0;
});

afterEach(() => {
  clearOutbox();
});

afterAll(async () => {
  await prisma.deadlineReminder.deleteMany();
  await prisma.$disconnect();
});

describe('R916: on the due day, ONE reminder goes out and the row is GONE', () => {
  it('sends the reminder, and the table read afterwards is empty', async () => {
    await row(true);

    const run = await runDeadlineReminders(noonOn(DUE));

    expect(run).toMatchObject({ today: DUE, due: 1, sent: 1, failed: 0, lapsed: 0 });

    const messages = readOutbox();

    expect(messages).toHaveLength(1);
    expect(messages[0]?.to).toBe(EMAIL);
    expect(messages[0]?.from).toBe(AUTH_EMAIL_FROM);
    expect(messages[0]?.subject).toBe(RAPPEL_COPY.reminder.subject(DEADLINE));

    // THE POSITIVE TEST OF DELETION: read the table, find nothing.
    expect(await prisma.deadlineReminder.count()).toBe(0);
    expect(await prisma.deadlineReminder.findUnique({ where: { email: EMAIL } })).toBeNull();
  });

  it('sends nothing the day before the due day, and keeps the row', async () => {
    await row(true);

    const run = await runDeadlineReminders(noonOn(shiftDays(DUE, -1) ?? ''));

    expect(run).toMatchObject({ due: 0, sent: 0 });
    expect(readOutbox()).toHaveLength(0);
    expect(await prisma.deadlineReminder.count()).toBe(1);
  });

  it('sends ONE message however many passes run at once (the delete is the claim)', async () => {
    await row(true);

    await Promise.all([runDeadlineReminders(noonOn(DUE)), runDeadlineReminders(noonOn(DUE))]);

    expect(readOutbox()).toHaveLength(1);
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('a second pass the same day finds nothing to send', async () => {
    await row(true);
    await runDeadlineReminders(noonOn(DUE));

    const again = await runDeadlineReminders(noonOn(DUE));

    expect(again).toMatchObject({ due: 0, sent: 0 });
    expect(readOutbox()).toHaveLength(1);
  });
});

describe('R915: an UNCONFIRMED row never gets a reminder', () => {
  it('sends nothing for it on its due day, or on any day up to its date', async () => {
    await row(false);

    for (const day of [DUE, shiftDays(DUE, 7) ?? '', DEADLINE]) {
      const run = await runDeadlineReminders(noonOn(day));

      expect(run.sent).toBe(0);
    }

    expect(readOutbox()).toHaveLength(0);
  });
});

describe('R916: a failed send is retried, and the row stays until it succeeds or the date passes', () => {
  it('keeps the row when the send fails, and a later pass sends and deletes it', async () => {
    await row(true);

    const failed = await runDeadlineReminders(noonOn(DUE), refusing);

    expect(failed).toMatchObject({ due: 1, sent: 0, failed: 1 });
    expect(await prisma.deadlineReminder.count()).toBe(1);

    const retried = await runDeadlineReminders(noonOn(shiftDays(DUE, 1) ?? ''), sendMail);

    expect(retried).toMatchObject({ sent: 1, failed: 0 });
    expect(readOutbox()).toHaveLength(1);
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('after the date, the row is deleted UNSENT', async () => {
    await row(true);
    await runDeadlineReminders(noonOn(DEADLINE), refusing);

    expect(await prisma.deadlineReminder.count()).toBe(1);

    const after = await runDeadlineReminders(noonOn(shiftDays(DEADLINE, 1) ?? ''), sendMail);

    expect(after).toMatchObject({ lapsed: 1, due: 0, sent: 0 });
    expect(readOutbox()).toHaveLength(0);
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('on the date itself, a pending send still goes out', async () => {
    await row(true);

    const run = await runDeadlineReminders(noonOn(DEADLINE));

    expect(run).toMatchObject({ sent: 1, lapsed: 0 });
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('deletes an UNCONFIRMED row whose date has passed, too', async () => {
    await row(false);

    const run = await runDeadlineReminders(noonOn(shiftDays(DEADLINE, 1) ?? ''));

    expect(run.lapsed).toBe(1);
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('the daily purge deletes a row past its date as well, so it holds where the send queue is not scheduled', async () => {
    await row(true, shiftDays(parisDayOf(new Date()), -1) ?? '');

    const run = await purgeUnconfirmedReminders();

    expect(run.lapsed).toBe(1);
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });
});

describe('R916: the delete link in the REMINDER removes the row at once, where a row remains', () => {
  it('a message that went out but was reported failed: its link deletes the surviving row', async () => {
    await row(true);

    const run = await runDeadlineReminders(noonOn(DUE), deliveredButFailed);

    expect(run.failed).toBe(1);
    expect(await prisma.deadlineReminder.count()).toBe(1);

    const text = delivered[0]?.text ?? '';
    const link = text.split('\n').find((line) => line.startsWith(`${siteOrigin()}${DELETE_PATH}?token=`)) ?? '';

    expect(link, 'the reminder carries no delete link').not.toBe('');

    const response = await DELETE(new NextRequest(link));

    expect(response.headers.get('location')).toBe(landingFor(LANDING_STATES.deleted));
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('after a successful send, the same link finds nothing - the row went with the send', async () => {
    await row(true);
    await runDeadlineReminders(noonOn(DUE));

    const text = readOutbox()[0]?.text ?? '';
    const link = text.split('\n').find((line) => line.startsWith(`${siteOrigin()}${DELETE_PATH}?token=`)) ?? '';

    expect((await DELETE(new NextRequest(link))).headers.get('location')).toBe(landingFor(LANDING_STATES.deleteUnknown));
  });
});
