// web/tests/db/one-click-unsubscribe.test.ts
//
// RFC 8058, end to end. FW27 increment 5.
//
// ============================================================================
// R204: THE HEADER IS TAKEN OUT OF THE OUTBOX AND FIRED AT THE ROUTE
// ============================================================================
//
// Three things are individually easy to get right and mean nothing apart: the
// headers are well formed, the POST handler unsubscribes, and the URL builder
// produces an absolute address. FW22 shipped exactly that arrangement - a
// sign-in email addressing a route that would not exist for three increments,
// with every unit test green.
//
// So the flow here is: subscribe, read the message the mailer collected, parse
// the URL OUT OF ITS List-Unsubscribe HEADER, and drive the route with it. A
// header pointing at nothing fails; a route that answers a different path
// fails; a token that does not round-trip fails.

import { TEST_ORIGIN } from '../../lib/content/identity';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NextRequest } from 'next/server';
import { POST as REQUEST_REMINDER } from '@/app/api/rappel-delai/route';
import { POST as SUBSCRIBE } from '@/app/api/alertes/route';
import { GET, POST } from '@/app/api/alertes/desinscription/route';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { ONE_CLICK_BODY } from '@/lib/alerts/list-headers';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { UNSUBSCRIBE_PATH, UNSUBSCRIBE_STATES } from '@/lib/alerts/status';
import { requestMagicLink } from '@/lib/auth/request';
import { hashToken } from '@/lib/alerts/token';
import { parisDayOf, toStoredDay } from '@/lib/entries/day';
import { runDeadlineReminders } from '@/lib/rappel/job';
import { reminderDay, shiftDays } from '@/lib/rappel/window';

const ORIGIN = TEST_ORIGIN;
const EMAIL = 'frontalier@example.com';

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterEach(() => {
  clearOutbox();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Subscribe, and hand back the message the mailer collected. */
async function subscribed(): Promise<{ headers: Readonly<Record<string, string>> }> {
  await SUBSCRIBE(
    new NextRequest(`${ORIGIN}/api/alertes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': '1.2.3.4',
      },
      body: new URLSearchParams({ email: EMAIL, source: 'calculateur' }).toString(),
    }),
  );

  const message = readOutbox()[0];

  expect(message, 'no message was collected: nothing below would test anything').toBeDefined();

  return { headers: message?.headers ?? {} };
}

/** The https URI out of a List-Unsubscribe header, brackets removed. */
function oneClickUrl(headers: Readonly<Record<string, string>>): string {
  const raw = headers['List-Unsubscribe'] ?? '';
  const match = /^<(?<uri>[^>]+)>$/u.exec(raw);

  expect(match, `List-Unsubscribe is not an RFC 2369 URI: ${JSON.stringify(raw)}`).not.toBeNull();

  return match?.groups?.uri ?? '';
}

function oneClickRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: ONE_CLICK_BODY,
  });
}

describe('every send carries the two headers a mail client reads', () => {
  it('carries List-Unsubscribe and List-Unsubscribe-Post', async () => {
    const { headers } = await subscribed();

    expect(headers['List-Unsubscribe-Post']).toBe(ONE_CLICK_BODY);
    expect(headers['List-Unsubscribe']).toMatch(/^<https?:\/\/.+>$/u);
  });

  it('lists exactly one URI, and it is the one that works', async () => {
    // RFC 2369 permits a mailto: alternative. One this product does not read
    // would be a published promise nobody keeps (R205), so there is one URI.
    const { headers } = await subscribed();

    expect(headers['List-Unsubscribe']?.split(',')).toHaveLength(1);
    expect(oneClickUrl(headers)).toContain(UNSUBSCRIBE_PATH.replace('/alertes', '/api/alertes'));
  });

  it('carries a token in it, since no human is there to supply one', async () => {
    const { headers } = await subscribed();

    expect(new URL(oneClickUrl(headers)).searchParams.get('token')).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe('R204: the URL out of the header, fired at the route', () => {
  it('takes the subscriber off the list', async () => {
    const { headers } = await subscribed();

    const before = await prisma.alertSubscriber.findFirstOrThrow();

    expect(before.unsubscribedAt).toBeNull();

    const response = await POST(oneClickRequest(oneClickUrl(headers)));

    expect(response.status).toBe(200);

    const after = await prisma.alertSubscriber.findFirstOrThrow();

    expect(after.unsubscribedAt).not.toBeNull();
  });

  it('is idempotent: a second POST changes nothing and still answers 200', async () => {
    // A mail client may retry, and a prefetching one may fire before a human
    // does. Unsubscribing twice is not an error.
    const { headers } = await subscribed();
    const url = oneClickUrl(headers);

    await POST(oneClickRequest(url));

    const first = await prisma.alertSubscriber.findFirstOrThrow();

    const second = await POST(oneClickRequest(url));

    expect(second.status).toBe(200);

    const after = await prisma.alertSubscriber.findFirstOrThrow();

    expect(after.unsubscribedAt?.getTime()).toBe(first.unsubscribedAt?.getTime());
  });

  it('answers 200 to an invented token and CHANGES NOTHING', async () => {
    // The status is deliberately the same for both, so the endpoint cannot be
    // fed tokens to learn which were real. The assertion is therefore about
    // the ROW - without it, "answers 200" would be satisfied by a route that
    // does nothing at all.
    await subscribed();

    const invented = `${ORIGIN}/api/alertes/desinscription?token=${'0'.repeat(64)}`;

    expect((await POST(oneClickRequest(invented))).status).toBe(200);

    const row = await prisma.alertSubscriber.findFirstOrThrow();

    expect(row.unsubscribedAt).toBeNull();
  });

  it('accepts a POST with no body, because the token is the authorisation', async () => {
    // A client that sends something other than RFC 8058's body must not leave
    // a reader subscribed - that is the wrong way round for an unsubscribe.
    const { headers } = await subscribed();

    const response = await POST(
      new NextRequest(oneClickUrl(headers), { method: 'POST' }),
    );

    expect(response.status).toBe(200);

    const row = await prisma.alertSubscriber.findFirstOrThrow();

    expect(row.unsubscribedAt).not.toBeNull();
  });
});

describe('the GET stays, and both reach the same handler', () => {
  it('still redirects a person to the page that says what happened', async () => {
    const { headers } = await subscribed();

    const response = await GET(new NextRequest(oneClickUrl(headers)));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain(
      `${UNSUBSCRIBE_PATH}/${UNSUBSCRIBE_STATES.unsubscribed}`,
    );

    const row = await prisma.alertSubscriber.findFirstOrThrow();

    expect(row.unsubscribedAt).not.toBeNull();
  });

  it('reaches the same state from either verb', async () => {
    // R206 asserted rather than assumed: two handlers over one function, and
    // the thing that would break it is somebody adding a second rule to one.
    const viaPost = await subscribed();

    await POST(oneClickRequest(oneClickUrl(viaPost.headers)));

    const afterPost = await prisma.alertSubscriber.findFirstOrThrow();

    await prisma.alertSubscriber.deleteMany();
    clearOutbox();
    resetRateLimit();

    const viaGet = await subscribed();

    await GET(new NextRequest(oneClickUrl(viaGet.headers)));

    const afterGet = await prisma.alertSubscriber.findFirstOrThrow();

    expect(afterGet.unsubscribedAt === null).toBe(afterPost.unsubscribedAt === null);
    expect(afterGet.unsubscribedAt).not.toBeNull();
  });
});

/**
 * R1008: EVERY MODULE THAT CAN PUT A MESSAGE ON THE WIRE, and the kind of mail
 * it sends. COUNTED, NOT REMEMBERED: the block below used to say "there are
 * exactly two callers of sendMail", and FW-DELAI-RAPPEL made it four with
 * nothing here noticing. A sender that imports sendMail and is not listed
 * fails the census, so the next one has to be classified - list mail carries
 * the pair, transactional mail never does - before it can ship.
 */
const SENDERS: Readonly<Record<string, 'list' | 'transactional'>> = {
  'lib/alerts/confirmation.ts': 'list',
  'lib/auth/request.ts': 'transactional',
  // The deadline reminder (R917, R245): one person, one request, no list.
  'lib/rappel/job.ts': 'transactional',
  'lib/rappel/mail.ts': 'transactional',
};

/** Every app/ or lib/ module importing sendMail from the one mailer, repo-relative. */
function mailSenders(): string[] {
  const web = process.cwd();
  const importsSendMail = /import\s*\{[^}]*\bsendMail\b[^}]*\}\s*from\s*'@\/lib\/alerts\/mailer'/u;
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) return walk(full);

      return /\.tsx?$/u.test(entry.name) ? [full] : [];
    });

  return ['app', 'lib']
    .flatMap((root) => walk(join(web, root)))
    .filter((file) => importsSendMail.test(readFileSync(file, 'utf8')))
    .map((file) => relative(web, file).split('\\').join('/'))
    .sort();
}

describe('R1008: every send site is enumerated, with the kind of mail it sends', () => {
  it('finds the senders by scanning, so the list below cannot fall behind', () => {
    // R133: an empty scan would agree with an empty list.
    expect(mailSenders()).toContain('lib/alerts/confirmation.ts');
    expect(mailSenders()).toEqual(Object.keys(SENDERS).sort());
  });
});

describe('a transactional message carries NO unsubscribe control', () => {
  it('the sign-in link has neither header', async () => {
    // ============================================================================
    // "EVERY SEND" MEANS EVERY SEND OF A LIST MESSAGE
    // ============================================================================
    //
    // The callers of sendMail are counted in SENDERS above (R1008): the alert
    // confirmation is list mail; this - a sign-in link somebody asked for
    // seconds ago - is transactional, and so are the deadline reminder's two
    // messages, asserted after it.
    //
    // AN UNSUBSCRIBE CONTROL ON A SIGN-IN MAIL IS A PROMISE NOTHING KEEPS. The
    // reader cannot unsubscribe from their own sign-in: pressing it would
    // either do nothing, or take them off a list they may not even be on, in a
    // message that has no connection to it. RFC 2369 is about mailing lists,
    // and R205 is about publishing a claim only where it can be believed -
    // this is the same rule in a header.
    //
    // IT IS ASSERTED RATHER THAN INTENDED, because the distinction erodes: the
    // obvious next step for somebody adding a third sender is to copy the
    // headers from whichever example they open first.
    await requestMagicLink(EMAIL, new Headers({ 'x-forwarded-for': '1.2.3.4' }));

    const message = readOutbox().at(-1);

    expect(message, 'no sign-in message was collected').toBeDefined();
    expect(message?.headers?.['List-Unsubscribe']).toBeUndefined();
    expect(message?.headers?.['List-Unsubscribe-Post']).toBeUndefined();
  });

  it("R1008: the deadline reminder's CONFIRMATION has neither header", async () => {
    await prisma.deadlineReminder.deleteMany();
    await REQUEST_REMINDER(
      new NextRequest(`${ORIGIN}/api/rappel-delai`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '1.2.3.5' },
        body: new URLSearchParams({ email: EMAIL, date: shiftDays(parisDayOf(new Date()), 120) ?? '' }).toString(),
      }),
    );

    const message = readOutbox().at(-1);

    expect(message, 'no reminder confirmation was collected').toBeDefined();
    expect(SENDERS['lib/rappel/mail.ts']).toBe('transactional');
    expect(message?.headers?.['List-Unsubscribe']).toBeUndefined();
    expect(message?.headers?.['List-Unsubscribe-Post']).toBeUndefined();
    await prisma.deadlineReminder.deleteMany();
  });

  it('R1008: the deadline REMINDER itself has neither header', async () => {
    const deadline = shiftDays(parisDayOf(new Date()), 120) ?? '';

    await prisma.deadlineReminder.deleteMany();
    await prisma.deadlineReminder.create({
      data: { email: EMAIL, deadline: toStoredDay(deadline), confirmedAt: new Date(), deleteTokenHashes: [hashToken('r1008')] },
    });
    await runDeadlineReminders(new Date(`${reminderDay(deadline) ?? ''}T11:00:00Z`));

    const message = readOutbox().at(-1);

    expect(message, 'no reminder was collected').toBeDefined();
    expect(SENDERS['lib/rappel/job.ts']).toBe('transactional');
    expect(message?.headers?.['List-Unsubscribe']).toBeUndefined();
    expect(message?.headers?.['List-Unsubscribe-Post']).toBeUndefined();
    await prisma.deadlineReminder.deleteMany();
  });

  it('and the list message in the same run still has both', async () => {
    // R196's other direction, and it is what makes the assertion above mean
    // something: a mailer that had silently stopped carrying headers at all
    // would pass it.
    const { headers } = await subscribed();

    expect(headers['List-Unsubscribe']).toBeDefined();
    expect(headers['List-Unsubscribe-Post']).toBe(ONE_CLICK_BODY);
  });
});
