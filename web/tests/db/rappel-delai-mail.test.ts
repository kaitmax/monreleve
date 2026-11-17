// web/tests/db/rappel-delai-mail.test.ts
//
// FW-DELAI-RAPPEL, R917: THE MESSAGES. Each carries the indicative-date
// warning BY KEY, the delete link, and nothing the record does not support -
// and R245 decides their headers: one person, one request, no list, so they
// are TRANSACTIONAL and carry no List-Unsubscribe pair. Asserted both ways in
// one run: absent on both reminder messages, present on the alert list's.
//
// The messages are taken from the outbox the real paths fill - the POST route
// for the confirmation, the pass for the reminder - never built by hand here.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { TEST_ORIGIN } from '../../lib/content/identity';
import { POST } from '@/app/api/rappel-delai/route';
import { POST as SUBSCRIBE } from '@/app/api/alertes/route';
import { prisma } from '@/lib/db/client';
import { siteOrigin } from '@/lib/content/site';
import { clearOutbox, readOutbox, type SentMessage } from '@/lib/alerts/mailer';
import { ONE_CLICK_BODY } from '@/lib/alerts/list-headers';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { hashToken } from '@/lib/alerts/token';
import { AUTH_EMAIL_FROM, EMAIL_FROM } from '@/lib/fr/emails';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { parisDayOf, toStoredDay } from '@/lib/entries/day';
import { runDeadlineReminders } from '@/lib/rappel/job';
import { CONFIRM_PATH, DELETE_PATH } from '@/lib/rappel/mail';
import { reminderDay, shiftDays } from '@/lib/rappel/window';

const EMAIL = 'messages@monreleve.test';
const DEADLINE = shiftDays(parisDayOf(new Date()), 120) ?? '';

/** The long date with « environ », as the helper's step 2 says it (R206: derived here too). */
const UNTIL = LAMAL_COPY.deadline.until(LAMAL_COPY.deadline.longDate(DEADLINE));

/** Words a message must never use about a date nobody verified (CLAUDE.md; R673). */
const NEVER = ['certifi', 'attest', 'conforme', 'recommand', 'garanti'];

async function confirmation(): Promise<SentMessage> {
  await POST(
    new NextRequest(`${TEST_ORIGIN}/api/rappel-delai`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '10.4.4.4' },
      body: new URLSearchParams({ email: EMAIL, date: DEADLINE }).toString(),
    }),
  );

  const message = readOutbox().at(-1);

  expect(message, 'no confirmation was collected').toBeDefined();

  return message as SentMessage;
}

async function reminder(): Promise<SentMessage> {
  await prisma.deadlineReminder.create({
    data: { email: EMAIL, deadline: toStoredDay(DEADLINE), confirmedAt: new Date(), deleteTokenHash: hashToken('d') },
  });
  await runDeadlineReminders(new Date(`${reminderDay(DEADLINE) ?? ''}T11:00:00Z`));

  const message = readOutbox().at(-1);

  expect(message, 'no reminder was collected').toBeDefined();

  return message as SentMessage;
}

/** The lines of a message that are links to `path`. */
const linksTo = (message: SentMessage, path: string): string[] =>
  message.text.split('\n').filter((line) => line.startsWith(`${siteOrigin()}${path}?token=`));

beforeEach(async () => {
  await prisma.deadlineReminder.deleteMany();
  await prisma.alertSubscriber.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterEach(() => {
  clearOutbox();
});

afterAll(async () => {
  await prisma.deadlineReminder.deleteMany();
  await prisma.alertSubscriber.deleteMany();
  await prisma.$disconnect();
});

describe.each([
  ['the confirmation', confirmation],
  ['the reminder', reminder],
])('R917: %s', (_name, collect) => {
  it('carries the indicative-date warning, word for word, and the date with « environ »', async () => {
    const message = await collect();

    expect(message.text).toContain(LAMAL_COPY.deadline.warning);
    expect(message.text).toContain(UNTIL);
  });

  it('carries ONE delete link, with a 64-character token', async () => {
    const message = await collect();
    const links = linksTo(message, DELETE_PATH);

    expect(links).toHaveLength(1);
    expect(new URL(links[0] ?? '').searchParams.get('token')).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('says nothing the record does not hold: no event, no figure of the comparison', async () => {
    const message = await collect();

    // The event is never stored, so a message naming it would be inventing it.
    for (const event of LAMAL_COPY.deadline.choices) {
      expect(message.text.toLowerCase()).not.toContain(event.toLowerCase());
    }
    // The positive half, so the absence above is not of an empty message.
    expect(message.text).toContain(UNTIL);
    expect(message.text).not.toMatch(/€|CHF/u);
  });

  it('never claims more than an indicative date supports', async () => {
    const message = await collect();
    const lower = `${message.subject}\n${message.text}`.toLowerCase();

    expect(message.text).toContain(LAMAL_COPY.deadline.warning);
    for (const word of NEVER) expect(lower).not.toContain(word);
  });

  it('R245: is TRANSACTIONAL - the notifications sender, and no List-Unsubscribe pair', async () => {
    const message = await collect();

    expect(message.from).toBe(AUTH_EMAIL_FROM);
    expect(message.headers?.['List-Unsubscribe']).toBeUndefined();
    expect(message.headers?.['List-Unsubscribe-Post']).toBeUndefined();
  });
});

describe('R917: what each message alone carries', () => {
  it('the confirmation carries one confirmation link; the reminder carries none', async () => {
    expect(linksTo(await confirmation(), CONFIRM_PATH)).toHaveLength(1);

    clearOutbox();
    await prisma.deadlineReminder.deleteMany();

    expect(linksTo(await reminder(), CONFIRM_PATH)).toHaveLength(0);
  });

  it('the reminder says what happens without a choice, by the helper\'s key', async () => {
    expect((await reminder()).text).toContain(LAMAL_COPY.deadline.office);
  });

  it('the subject of the reminder names the date, with « environ »', async () => {
    const message = await reminder();

    expect(message.subject).toBe(RAPPEL_COPY.reminder.subject(DEADLINE));
    expect(message.subject).toContain(LAMAL_COPY.deadline.longDate(DEADLINE));
    expect(message.subject).toContain('environ');
  });
});

describe('R206: the warning is the helper\'s KEY, never a second copy of its words', () => {
  it('lib/fr/rappel.ts does not retype the warning', () => {
    const source = readFileSync('lib/fr/rappel.ts', 'utf8');

    // A phrase only the warning carries. Present in the messages (above),
    // absent from the module that builds them: so it arrives by key.
    expect(LAMAL_COPY.deadline.warning).toContain('façon exacte de compter');
    expect(source).not.toContain('façon exacte de compter');
    expect(source).toContain('LAMAL_COPY.deadline.warning');
  });
});

describe('R245: in the same run, the alert list message still carries the pair', () => {
  it('the other direction - a mailer that dropped every header would pass the absence above', async () => {
    await SUBSCRIBE(
      new NextRequest(`${TEST_ORIGIN}/api/alertes`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '10.5.5.5' },
        body: new URLSearchParams({ email: 'liste@monreleve.test', source: 'alertes' }).toString(),
      }),
    );

    const list = readOutbox().at(-1);

    expect(list?.from).toBe(EMAIL_FROM);
    expect(list?.headers?.['List-Unsubscribe']).toBeDefined();
    expect(list?.headers?.['List-Unsubscribe-Post']).toBe(ONE_CLICK_BODY);
  });
});
