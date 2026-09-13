// web/tests/db/confirm-unsubscribe.test.ts
//
// FW14 increment 4: the other end of the double opt-in.
//
// FOUR THINGS THE INCREMENT NAMES - reuse, expiry, unsubscribe, re-subscribe -
// and one property underneath all of them: a link that no longer works must
// say so honestly, and must not say WHY in a way that answers a question the
// person holding it should not be able to ask.
//
// A TOKEN THAT IS NOT FOUND IS NOT DISTINGUISHED FROM ONE THAT WAS USED. Both
// get "this link is no longer valid". Distinguishing them would turn the
// confirm endpoint into an oracle: feed it tokens, learn which ones once
// existed. There is no honest reason a reader needs to know the difference -
// either way, the thing to do is subscribe again.
//
// AND THE UNSUBSCRIBE TOKEN OUTLIVES THE CONFIRMATION ONE, deliberately. They
// have opposite lifetimes: confirmation is single-use and cleared the moment
// it works, while an unsubscribe link has to keep working for as long as the
// reader might still have one of our messages - which, from their side, is
// forever.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hashToken, recordSubscription } from '@/lib/alerts/record';
import { confirmByToken, unsubscribeByToken } from '@/lib/alerts/confirm';

const EMAIL = 'frontalier@example.com';

beforeEach(async () => {
  await prisma.alertSubscriber.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Subscribe, and hand back the token the email would have carried. */
async function subscribed(): Promise<string> {
  const { token } = await recordSubscription({ email: EMAIL, source: 'calculateur' });

  return String(token);
}

describe('confirming', () => {
  it('sets the date of consent', async () => {
    // /confidentialite: "la date de votre accord est enregistrée". This is
    // the line that makes that sentence true.
    const token = await subscribed();

    expect(await confirmByToken(token)).toBe('confirmed');

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.confirmedAt).toBeInstanceOf(Date);
    expect(Math.abs(Number(row.confirmedAt) - Date.now())).toBeLessThan(10_000);
  });

  it('consumes the token, so the link works exactly once', async () => {
    const token = await subscribed();

    await confirmByToken(token);

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.confirmationTokenHash).toBeNull();
    expect(row.confirmationExpiresAt).toBeNull();
  });

  it('refuses the SECOND use of the same link', async () => {
    // Mail clients prefetch links and people click twice. The second attempt
    // must not confirm again, and must not error in a way that reads as a
    // broken subscription.
    const token = await subscribed();

    await confirmByToken(token);

    expect(await confirmByToken(token)).toBe('unknown');
  });

  it('refuses an EXPIRED link, and says expired rather than unknown', async () => {
    // A reader who waited eight days deserves a page that tells them the link
    // aged out, because the fix is to subscribe again. This is the one
    // distinction worth drawing, and it is safe to draw: it only tells
    // somebody holding a real token something they could have worked out
    // from the date they received it.
    const token = await subscribed();

    await prisma.alertSubscriber.update({
      where: { email: EMAIL },
      data: { confirmationExpiresAt: new Date(Date.now() - 1000) },
    });

    expect(await confirmByToken(token)).toBe('expired');

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.confirmedAt).toBeNull();

    // The dead token is cleared, so it cannot be tried again.
    expect(row.confirmationTokenHash).toBeNull();
  });

  it('refuses a token nobody ever issued, with the same answer as a used one', async () => {
    // THE ORACLE THIS CLOSES. If "never existed" and "already used" gave
    // different answers, the endpoint would tell anybody feeding it tokens
    // which ones were once real.
    expect(await confirmByToken('0'.repeat(64))).toBe('unknown');
    expect(await confirmByToken('not-even-a-token')).toBe('unknown');
    expect(await confirmByToken('')).toBe('unknown');
  });

  it('gives a confirmed row an unsubscribe token that outlives the other one', async () => {
    const token = await subscribed();

    await confirmByToken(token);

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.unsubscribeTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.confirmationTokenHash).toBeNull();
  });
});

describe('unsubscribing', () => {
  it('sets unsubscribedAt', async () => {
    const confirmToken = await subscribed();

    await confirmByToken(confirmToken);

    const plaintext = await plaintextUnsubscribeToken();

    expect(await unsubscribeByToken(plaintext)).toBe('unsubscribed');

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('is idempotent: clicking twice is not an error', async () => {
    // A mail client that prefetches the link has already "clicked" it. A
    // second click landing on "lien invalide" reads as a failed unsubscribe,
    // which is the one thing this page must never look like.
    const confirmToken = await subscribed();

    await confirmByToken(confirmToken);

    const plaintext = await plaintextUnsubscribeToken();

    expect(await unsubscribeByToken(plaintext)).toBe('unsubscribed');
    expect(await unsubscribeByToken(plaintext)).toBe('unsubscribed');
  });

  it('refuses a token nobody issued', async () => {
    expect(await unsubscribeByToken('0'.repeat(64))).toBe('unknown');
  });

  it('leaves the row in place rather than deleting it', async () => {
    // Kept so that re-subscribing is a decision the record can show, and so
    // the same person does not silently get a second consent date.
    const confirmToken = await subscribed();

    await confirmByToken(confirmToken);
    await unsubscribeByToken(await plaintextUnsubscribeToken());

    expect(await prisma.alertSubscriber.count({ where: { email: EMAIL } })).toBe(1);
  });
});

describe('re-subscribing after leaving', () => {
  it('starts a fresh double opt-in rather than re-adding', async () => {
    const confirmToken = await subscribed();

    await confirmByToken(confirmToken);
    await unsubscribeByToken(await plaintextUnsubscribeToken());

    const again = await recordSubscription({ email: EMAIL, source: 'alertes' });

    expect(again.outcome).toBe('resubscribed');
    expect(again.token).toBeTypeOf('string');

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    // NOT ON THE LIST YET. An unsubscribe that anyone could reverse by typing
    // the address into a form would not be an unsubscribe.
    expect(row.confirmedAt).toBeNull();
    expect(row.unsubscribedAt).toBeNull();

    // And confirming again puts them back.
    expect(await confirmByToken(String(again.token))).toBe('confirmed');

    const after = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(after.confirmedAt).toBeInstanceOf(Date);
  });

  it('does not reuse the old confirmation token', async () => {
    const first = await subscribed();

    await confirmByToken(first);
    await unsubscribeByToken(await plaintextUnsubscribeToken());
    await recordSubscription({ email: EMAIL, source: 'alertes' });

    // The token from before they left is dead, and stays dead.
    expect(await confirmByToken(first)).toBe('unknown');
  });
});

/**
 * The plaintext unsubscribe token for the seeded row.
 *
 * The database holds only a hash - which is the point - so the test asks the
 * module to mint one and reads it back the way the mailer would. Written as a
 * helper so no test reaches into the hashing directly.
 */
async function plaintextUnsubscribeToken(): Promise<string> {
  const { issueUnsubscribeToken } = await import('@/lib/alerts/confirm');
  const token = await issueUnsubscribeToken(EMAIL);
  const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

  expect(row.unsubscribeTokenHash).toBe(hashToken(token));

  return token;
}

describe('every send carries a working one-click unsubscribe (increment 4)', () => {
  it('puts the link in the confirmation email, and it works', async () => {
    // END TO END, through the real handler and the real message: subscribe,
    // read what was "sent", pull the unsubscribe link out of it, and use it.
    // This is the property that matters and it spans four files, so it is
    // asserted where they meet rather than in any one of them.
    const { POST } = await import('@/app/api/alertes/route');
    const { readOutbox, clearOutbox } = await import('@/lib/alerts/mailer');
    const { resetRateLimit } = await import('@/lib/alerts/rate-limit');
    const { NextRequest } = await import('next/server');
    const { ALERTES_COPY } = await import('@/lib/fr/alertes');

    clearOutbox();
    resetRateLimit();

    await POST(
      new NextRequest('https://frontalier.example/api/alertes', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': '1.2.3.4',
        },
        body: new URLSearchParams({ email: EMAIL, source: 'calculateur' }).toString(),
      }),
    );

    const text = String(readOutbox()[0]?.text);

    expect(text).toContain(ALERTES_COPY.unsubscribe.emailLink);

    const link = text
      .split('\n')
      .find((line) => line.includes('/api/alertes/desinscription'));

    expect(link, 'no unsubscribe link in the confirmation email').toBeDefined();

    const token = new URL(String(link)).searchParams.get('token');

    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // AND IT WORKS EVEN THOUGH THEY NEVER CONFIRMED. A reader who says "not
    // me, and stop" should not have to first accept a subscription they did
    // not ask for, nor wait thirty days for the row to lapse.
    expect(await unsubscribeByToken(String(token))).toBe('unsubscribed');

    const row = await prisma.alertSubscriber.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(row.unsubscribedAt).toBeInstanceOf(Date);
    expect(row.confirmedAt).toBeNull();

    clearOutbox();
  });
});
