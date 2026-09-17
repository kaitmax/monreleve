// web/tests/db/confirmation-email.test.ts
//
// FW14 increment 3: the double-opt-in message.
//
// THE OUTBOX IS THE BOUNDARY, and it is not a mock anybody installs. With no
// RESEND_API_KEY set - the state of CI, of the e2e suite and of this machine -
// lib/alerts/mailer.ts collects messages in memory and never touches the
// network. So "CI never sends a real email" is a property of one branch in
// one file, asserted here, rather than a habit maintained at every call site.
//
// WHAT THE MESSAGE HAS TO CONTAIN is not a matter of taste: somebody who
// forgot subscribing five minutes ago must be able to tell from the message
// itself whether it is legitimate, WITHOUT clicking the link. That is why the
// one-line statement of what the list is for is asserted, and why the
// "ignore this" sentence is too.

import { TEST_ORIGIN } from '../../lib/content/identity';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/alertes/route';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { CONFIRM_PATH, confirmUrl } from '@/lib/alerts/confirmation';
import { EMAIL_COPY } from '@/lib/fr/emails';
import { hashToken } from '@/lib/alerts/record';
import { resetRateLimit } from '@/lib/alerts/rate-limit';

// R171: the origin is a ROLE - "what the build was configured with" - and
// FW20c made it one constant. It was a literal in thirteen files, which is
// twelve chances for a rename to leave one behind pointing at a host that
// no longer means anything.
const ORIGIN = TEST_ORIGIN;

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

function post(fields: Record<string, string>): NextRequest {
  return new NextRequest(`${ORIGIN}/api/alertes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': '1.2.3.4',
    },
    body: new URLSearchParams(fields).toString(),
  });
}

describe('the message that goes out', () => {
  it('is sent to the address that subscribed, once', async () => {
    await POST(post({ email: 'frontalier@example.com', source: 'calculateur' }));

    const sent = readOutbox();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('frontalier@example.com');
    expect(sent[0]?.subject).toBe(EMAIL_COPY.confirmation.subject);
  });

  it('says what the list is for, so it can be believed without clicking', async () => {
    await POST(post({ email: 'a@example.com', source: 'calculateur' }));

    const text = String(readOutbox()[0]?.text);

    expect(text).toContain('télétravail');
    expect(text).toContain('seuils');

    // And what to do if it was not them. A double opt-in that does not say
    // "ignore this" turns an unwanted mail into an unanswerable one.
    expect(text).toContain('ignorez ce message');
    expect(text).toContain('trente jours');
  });

  it('carries a link that works exactly once and not forever', async () => {
    await POST(post({ email: 'a@example.com', source: 'calculateur' }));

    const text = String(readOutbox()[0]?.text);

    expect(text).toContain(CONFIRM_PATH);

    // THE SENTENCE COMES FROM THE COPY MODULE, not from here. R126 says
    // French is written once, in lib/fr, and the guard in
    // tests/unit/meta/french-literals.test.ts caught this file retyping
    // "qu’une fois" - which would have been a second place for that sentence
    // to drift from the one readers actually receive.
    const [singleUse] = EMAIL_COPY.confirmation
      .lines('https://x/confirm', 'https://x/unsubscribe')
      .filter((line) => line.includes('sept jours'));

    expect(singleUse, 'the copy no longer states the seven days').toBeDefined();
    expect(text).toContain(String(singleUse));
  });

  it('carries the PLAINTEXT token, whose hash is what the row holds', async () => {
    // THE PROPERTY HASHING EXISTS FOR, end to end. The link a reader receives
    // and the value in the database are different strings, and the second is
    // the SHA-256 of the first - so a database copy contains no working
    // links.
    await POST(post({ email: 'a@example.com', source: 'calculateur' }));

    const text = String(readOutbox()[0]?.text);
    const token = new URL(
      String(text.split('\n').find((line) => line.includes(CONFIRM_PATH))),
    ).searchParams.get('token');

    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const row = await prisma.alertSubscriber.findUniqueOrThrow({
      where: { email: 'a@example.com' },
    });

    expect(row.confirmationTokenHash).not.toBe(token);
    expect(row.confirmationTokenHash).toBe(hashToken(String(token)));
  });

  it('is plain text with no HTML part', async () => {
    // A double opt-in that looks like marketing mail is filtered like
    // marketing mail. lib/fr/emails.ts argues it; this holds it.
    await POST(post({ email: 'a@example.com', source: 'calculateur' }));

    const message = readOutbox()[0];

    expect(message).not.toHaveProperty('html');
    expect(String(message?.text)).not.toContain('<');
  });

  it('greets nobody by name, because there is no name', async () => {
    // The list holds an address and nothing else. "Bonjour Jean" would be
    // the first overstatement in a product whose value is not overstating.
    const text = String(
      (await POST(post({ email: 'a@example.com', source: 'calculateur' })),
      readOutbox()[0]?.text),
    );

    expect(text).toContain('Bonjour,');
  });
});

describe('when there is nothing to confirm, nothing is sent', () => {
  it('sends no mail to an address already on the list', async () => {
    // The easiest way to turn a subscribe endpoint into a way of mailing
    // strangers on demand is to re-send the confirmation every time somebody
    // types their address.
    await prisma.alertSubscriber.create({
      data: { email: 'known@example.com', source: 'calculateur', confirmedAt: new Date() },
    });

    await POST(post({ email: 'known@example.com', source: 'calculateur' }));

    expect(readOutbox()).toHaveLength(0);
  });

  it('DOES send again to an address that never confirmed', async () => {
    // NON-VACUITY for the test above, and a real case: the first mail was
    // lost or expired, and the reader is trying again.
    await prisma.alertSubscriber.create({
      data: {
        email: 'waiting@example.com',
        source: 'calculateur',
        confirmationTokenHash: 'old',
        confirmationExpiresAt: new Date(Date.now() + 1000),
      },
    });

    await POST(post({ email: 'waiting@example.com', source: 'calculateur' }));

    expect(readOutbox()).toHaveLength(1);
  });

  it('sends nothing when the address was rejected', async () => {
    await POST(post({ email: 'not-an-address', source: 'calculateur' }));

    expect(readOutbox()).toHaveLength(0);
  });

  it('sends nothing to a rate-limited client', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await POST(post({ email: `x${attempt}@example.com`, source: 'calculateur' }));
    }

    clearOutbox();
    await POST(post({ email: 'sixth@example.com', source: 'calculateur' }));

    expect(readOutbox()).toHaveLength(0);
  });
});

describe('the link itself', () => {
  it('is absolute, because a mail client has no base URL', () => {
    const url = new URL(confirmUrl('abc'));

    expect(url.protocol).toMatch(/^https?:$/);
    expect(url.pathname).toBe(CONFIRM_PATH);
    expect(url.searchParams.get('token')).toBe('abc');
  });
});
