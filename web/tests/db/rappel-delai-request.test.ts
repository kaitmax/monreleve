// web/tests/db/rappel-delai-request.test.ts
//
// FW-DELAI-RAPPEL, R915: CONFIRMATION FIRST, BY THE ALERT FLOW'S MECHANICS.
//
// Driven through the REAL ROUTE HANDLERS (R204): the POST the island makes,
// the confirmation message taken out of the outbox, its links parsed out of
// the text and fired at the confirm and delete routes. A link pointing at
// nothing, a route answering another path, a token that does not round-trip -
// each fails here rather than in a walkthrough.
//
// THE DATES ARE READ FROM THE CLOCK, NEVER TYPED (R171): "a date sixty days
// away" is computed from Paris's today, so this file means the same thing on
// every day it runs.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { TEST_ORIGIN } from '../../lib/content/identity';
import { POST } from '@/app/api/rappel-delai/route';
import { GET as CONFIRM } from '@/app/api/rappel-delai/confirm/route';
import { GET as DELETE } from '@/app/api/rappel-delai/suppression/route';
import { prisma } from '@/lib/db/client';
import { siteOrigin } from '@/lib/content/site';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/lifetimes';
import { hashToken } from '@/lib/alerts/token';
import { AUTH_EMAIL_FROM } from '@/lib/fr/emails';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { fromStoredDay, parisDayOf, toStoredDay } from '@/lib/entries/day';
import { confirmReminderByToken } from '@/lib/rappel/confirm';
import { LANDING_STATES, landingFor } from '@/lib/rappel/landing';
import { CONFIRM_PATH, DELETE_PATH } from '@/lib/rappel/mail';
import { purgeUnconfirmedReminders } from '@/lib/rappel/purge';
import { REMINDER_STATUS } from '@/lib/rappel/status';
import { DAYS_BEFORE, reminderDay, shiftDays } from '@/lib/rappel/window';

const EMAIL = 'rappel@monreleve.test';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Paris's today, and a deadline `days` after it. */
const today = (): string => parisDayOf(new Date());
const inDays = (days: number): string => shiftDays(today(), days) ?? '';

/** The POST the island makes: the address and the computed date, form-encoded. */
function submit(fields: Record<string, string>, ip = '10.0.0.1'): Promise<Response> {
  return POST(
    new NextRequest(`${TEST_ORIGIN}/api/rappel-delai`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip },
      body: new URLSearchParams(fields).toString(),
    }),
  );
}

async function answerOf(response: Response): Promise<{ status: string; message: string }> {
  return (await response.json()) as { status: string; message: string };
}

/** The URL in a message that points at `path`, with its token. */
function linkTo(text: string, path: string): string {
  const found = text.split('\n').find((line) => line.startsWith(`${siteOrigin()}${path}?token=`));

  expect(found, `no ${path} link in the message`).toBeDefined();

  return found ?? '';
}

/** The last message the mailer collected. */
function lastMessage(): { to: string; from: string; subject: string; text: string } {
  const message = readOutbox().at(-1);

  expect(message, 'no message was collected: nothing below would test anything').toBeDefined();

  return { to: message?.to ?? '', from: message?.from ?? '', subject: message?.subject ?? '', text: message?.text ?? '' };
}

beforeEach(async () => {
  await prisma.deadlineReminder.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterEach(() => {
  clearOutbox();
});

afterAll(async () => {
  await prisma.deadlineReminder.deleteMany();
  await prisma.$disconnect();
});

describe('R915: a request is written down UNCONFIRMED, and a confirmation goes out', () => {
  it('stores the address and the date, unconfirmed, and mails the confirmation', async () => {
    const deadline = inDays(60);
    const answer = await answerOf(await submit({ email: EMAIL, date: deadline }));

    expect(answer).toEqual({ status: REMINDER_STATUS.ok, message: RAPPEL_COPY.answers.ok });

    const row = await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(fromStoredDay(row.deadline)).toBe(deadline);
    expect(row.confirmedAt).toBeNull();
    expect(row.confirmationTokenHash).toMatch(/^[0-9a-f]{64}$/u);

    const message = lastMessage();

    expect(readOutbox()).toHaveLength(1);
    expect(message.to).toBe(EMAIL);
    expect(message.from).toBe(AUTH_EMAIL_FROM);
    expect(message.subject).toBe(RAPPEL_COPY.confirmation.subject);
  });

  it('stores the HASH of the token in the link, never the token', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const token = new URL(linkTo(lastMessage().text, CONFIRM_PATH)).searchParams.get('token') ?? '';
    const row = await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(token).toMatch(/^[0-9a-f]{64}$/u);
    expect(row.confirmationTokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('normalises the address, so a capital letter is the same reminder', async () => {
    await submit({ email: '  Rappel@MonReleve.test ', date: inDays(60) });

    expect(await prisma.deadlineReminder.findUnique({ where: { email: EMAIL } })).not.toBeNull();
  });
});

describe('R915 / R204: the confirmation link, out of the message, through the route', () => {
  it('confirms, and lands on the comparator with the outcome named', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const response = await CONFIRM(new NextRequest(linkTo(lastMessage().text, CONFIRM_PATH)));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(landingFor(LANDING_STATES.confirmed));

    const row = await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.confirmedAt).not.toBeNull();
    expect(row.confirmationTokenHash).toBeNull();
    expect(row.confirmationExpiresAt).toBeNull();
  });

  it('works once: the same link a second time says only that it is no longer valid', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const link = linkTo(lastMessage().text, CONFIRM_PATH);

    await CONFIRM(new NextRequest(link));

    const second = await CONFIRM(new NextRequest(link));

    expect(second.headers.get('location')).toBe(landingFor(LANDING_STATES.unknown));
    expect((await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } })).confirmedAt).not.toBeNull();
  });

  it('answers a token never issued exactly as a used one (no oracle)', async () => {
    const response = await CONFIRM(new NextRequest(`${TEST_ORIGIN}${CONFIRM_PATH}?token=${'f'.repeat(64)}`));

    expect(response.headers.get('location')).toBe(landingFor(LANDING_STATES.unknown));
  });

  it('DELETES a request whose link has expired, and says so', async () => {
    await submit({ email: EMAIL, date: inDays(60) });
    await prisma.deadlineReminder.update({
      where: { email: EMAIL },
      data: { confirmationExpiresAt: new Date(Date.now() - 1000) },
    });

    const response = await CONFIRM(new NextRequest(linkTo(lastMessage().text, CONFIRM_PATH)));

    expect(response.headers.get('location')).toBe(landingFor(LANDING_STATES.expired));
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it(`R916's question, the conservative side: a confirmation fewer than ${DAYS_BEFORE} days before the date programs nothing and deletes the request`, async () => {
    const deadline = inDays(30);

    await submit({ email: EMAIL, date: deadline });

    const token = new URL(linkTo(lastMessage().text, CONFIRM_PATH)).searchParams.get('token') ?? '';
    // The day after the due day, at noon in Paris: within the link's life
    // would need the link to outlive seven days, so the expiry is lifted here
    // to isolate the rule under test.
    await prisma.deadlineReminder.update({
      where: { email: EMAIL },
      data: { confirmationExpiresAt: new Date(Date.now() + 365 * DAY_MS) },
    });

    const late = new Date(`${shiftDays(reminderDay(deadline) ?? '', 1)}T11:00:00Z`);

    expect(await confirmReminderByToken(token, late)).toBe(LANDING_STATES.tooLate);
    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it(`still confirms ON the due day itself`, async () => {
    const deadline = inDays(30);

    await submit({ email: EMAIL, date: deadline });

    const token = new URL(linkTo(lastMessage().text, CONFIRM_PATH)).searchParams.get('token') ?? '';

    await prisma.deadlineReminder.update({
      where: { email: EMAIL },
      data: { confirmationExpiresAt: new Date(Date.now() + 365 * DAY_MS) },
    });

    const onDue = new Date(`${reminderDay(deadline) ?? ''}T11:00:00Z`);

    expect(await confirmReminderByToken(token, onDue)).toBe(LANDING_STATES.confirmed);
  });
});

describe('R915: the same address twice is ONE reminder, and the answer never tells which case it was', () => {
  it('a second request while unconfirmed replaces the date and the link, in one row', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const firstLink = linkTo(lastMessage().text, CONFIRM_PATH);

    await submit({ email: EMAIL, date: inDays(90) });

    expect(await prisma.deadlineReminder.count()).toBe(1);
    expect(fromStoredDay((await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } })).deadline)).toBe(
      inDays(90),
    );
    expect(readOutbox()).toHaveLength(2);

    // The older message's link stops working; the newest one is in front of the reader.
    expect((await CONFIRM(new NextRequest(firstLink))).headers.get('location')).toBe(landingFor(LANDING_STATES.unknown));
    expect((await CONFIRM(new NextRequest(linkTo(lastMessage().text, CONFIRM_PATH)))).headers.get('location')).toBe(
      landingFor(LANDING_STATES.confirmed),
    );
  });

  it('a request for a CONFIRMED address writes nothing and sends nothing', async () => {
    const deadline = inDays(60);

    await submit({ email: EMAIL, date: deadline });
    await CONFIRM(new NextRequest(linkTo(lastMessage().text, CONFIRM_PATH)));

    const before = await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } });

    clearOutbox();
    await submit({ email: EMAIL, date: inDays(90) });

    const after = await prisma.deadlineReminder.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(after).toEqual(before);
    expect(fromStoredDay(after.deadline)).toBe(deadline);
    expect(readOutbox()).toHaveLength(0);
  });

  it('answers a new, an unconfirmed and a confirmed address IDENTICALLY (enumeration)', async () => {
    const fresh = await answerOf(await submit({ email: 'neuf@monreleve.test', date: inDays(60) }));

    await submit({ email: EMAIL, date: inDays(60) });

    const pending = await answerOf(await submit({ email: EMAIL, date: inDays(60) }));

    await CONFIRM(new NextRequest(linkTo(lastMessage().text, CONFIRM_PATH)));

    const confirmed = await answerOf(await submit({ email: EMAIL, date: inDays(60) }));

    expect(pending).toEqual(fresh);
    expect(confirmed).toEqual(fresh);
  });
});

describe('R915: what is refused writes nothing and sends nothing', () => {
  it.each([
    ['an empty address', { email: '', date: '' }, REMINDER_STATUS.missing],
    ['an address with no at-sign', { email: 'rappel.monreleve.test', date: '' }, REMINDER_STATUS.invalid],
    ['a date the calendar does not have', { email: EMAIL, date: '2027-02-30' }, REMINDER_STATUS.date],
    ['no date at all', { email: EMAIL }, REMINDER_STATUS.date],
  ])('%s', async (_case, fields, status) => {
    const answer = await answerOf(await submit(fields as Record<string, string>));

    expect(answer.status).toBe(status);
    expect(await prisma.deadlineReminder.count()).toBe(0);
    expect(readOutbox()).toHaveLength(0);
  });

  it(`a date fewer than ${DAYS_BEFORE} days away (R916's conservative choice)`, async () => {
    const answer = await answerOf(await submit({ email: EMAIL, date: inDays(DAYS_BEFORE - 1) }));

    expect(answer).toEqual({ status: REMINDER_STATUS.date, message: RAPPEL_COPY.answers.date });
    expect(await prisma.deadlineReminder.count()).toBe(0);
    expect(readOutbox()).toHaveLength(0);
  });

  it(`but a date exactly ${DAYS_BEFORE} days away is accepted - its reminder is due today`, async () => {
    const answer = await answerOf(await submit({ email: EMAIL, date: inDays(DAYS_BEFORE) }));

    expect(answer.status).toBe(REMINDER_STATUS.ok);
  });

  it('too many requests from one connection', async () => {
    for (let index = 0; index < 5; index += 1) {
      await submit({ email: `r${index}@monreleve.test`, date: inDays(60) });
    }

    const answer = await answerOf(await submit({ email: 'r6@monreleve.test', date: inDays(60) }));

    expect(answer.status).toBe(REMINDER_STATUS.rate);
    expect(await prisma.deadlineReminder.count()).toBe(5);
  });
});

describe('R916: the delete link in the confirmation removes the row AT ONCE', () => {
  it('deletes the address and the date, and a second click finds nothing', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const link = linkTo(lastMessage().text, DELETE_PATH);
    const first = await DELETE(new NextRequest(link));

    expect(first.status).toBe(303);
    expect(first.headers.get('location')).toBe(landingFor(LANDING_STATES.deleted));
    expect(await prisma.deadlineReminder.count()).toBe(0);

    const second = await DELETE(new NextRequest(link));

    expect(second.headers.get('location')).toBe(landingFor(LANDING_STATES.deleteUnknown));
  });

  it('deletes a CONFIRMED reminder too', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const text = lastMessage().text;

    await CONFIRM(new NextRequest(linkTo(text, CONFIRM_PATH)));
    await DELETE(new NextRequest(linkTo(text, DELETE_PATH)));

    expect(await prisma.deadlineReminder.count()).toBe(0);
  });

  it('deletes nothing for a token never issued', async () => {
    await submit({ email: EMAIL, date: inDays(60) });

    const response = await DELETE(new NextRequest(`${TEST_ORIGIN}${DELETE_PATH}?token=${'e'.repeat(64)}`));

    expect(response.headers.get('location')).toBe(landingFor(LANDING_STATES.deleteUnknown));
    expect(await prisma.deadlineReminder.count()).toBe(1);
  });
});

describe(`R915 / R919: an unconfirmed request is purged after ${PURGE_AFTER_DAYS} days, on the alert flow's schedule`, () => {
  /** A row as the request route writes one, aged `days`. */
  async function aged(email: string, days: number, confirmed: boolean): Promise<void> {
    await prisma.deadlineReminder.create({
      data: {
        email,
        deadline: toStoredDay(inDays(200)),
        confirmationTokenHash: confirmed ? null : hashToken(email),
        confirmationExpiresAt: confirmed ? null : new Date(),
        confirmedAt: confirmed ? new Date() : null,
        deleteTokenHash: hashToken(`delete:${email}`),
        createdAt: new Date(Date.now() - days * DAY_MS),
      },
    });
  }

  it('deletes the unconfirmed row past the cutoff, keeps the recent one and every confirmed one', async () => {
    await aged('vieux@monreleve.test', PURGE_AFTER_DAYS + 1, false);
    await aged('recent@monreleve.test', PURGE_AFTER_DAYS - 1, false);
    await aged('confirme@monreleve.test', PURGE_AFTER_DAYS + 40, true);

    const run = await purgeUnconfirmedReminders();

    expect(run).toMatchObject({ considered: 2, deleted: 1, keptTooRecent: 1 });
    expect((await prisma.deadlineReminder.findMany({ orderBy: { email: 'asc' } })).map((row) => row.email)).toEqual([
      'confirme@monreleve.test',
      'recent@monreleve.test',
    ]);
  });
});
