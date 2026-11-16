// web/lib/alerts/record.ts
//
// Writing a subscription down. FW14 increment 2.
//
// FOUR STATES IN, ONE SENTENCE OUT. An address arriving here is absent,
// unconfirmed, confirmed, or previously unsubscribed, and each needs
// different work. What the READER is told is identical in all four cases,
// because the alternative is address enumeration: type an address into a
// public form, read the answer, learn whether that person is on a list about
// cross-border tax compliance. Membership is the sensitive fact.
//
// So this function returns the outcome for the CALLER's use - increment 3
// needs to know whether to send an email, and which one - and the route
// handler throws that distinction away before answering. The distinction
// lives exactly as long as it is needed and never reaches the response.

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import { CONFIRMATION_TTL_DAYS } from '@/lib/alerts/lifetimes';
import type { Subscription } from '@/lib/alerts/subscribe';

/** Seven days, in milliseconds. The schema explains the seven; lib/alerts/lifetimes.ts holds it. */
const TOKEN_TTL_MS = CONFIRMATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** 32 bytes of randomness, hex-encoded: 64 characters in the link. */
const TOKEN_BYTES = 32;

export type Outcome =
  /** No row existed. */
  | 'created'
  /** A row existed, unconfirmed; it has a fresh token and a fresh week. */
  | 'reconfirmation'
  /** Already on the list. Nothing changed. */
  | 'already-confirmed'
  /** They had left. A fresh double opt-in starts now. */
  | 'resubscribed';

export interface RecordResult {
  readonly outcome: Outcome;
  /**
   * The plaintext token, for the email that is about to go out.
   *
   * Present for every outcome that needs confirming and absent for
   * 'already-confirmed', because there is nothing to confirm - and a token
   * issued with nothing to confirm is a live capability nobody asked for.
   */
  readonly token?: string;
}

/** What goes in the link. */
function freshToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('hex');

  return { token, hash: hashToken(token) };
}

/**
 * SHA-256, and no salt.
 *
 * A password hash needs a slow function and a per-row salt because passwords
 * are low-entropy and reused. This is 256 bits from a CSPRNG, used once, for
 * seven days: there is no dictionary to attack and no other account it
 * unlocks. What hashing buys here is that a database copy does not contain
 * working confirmation links, and SHA-256 buys that completely.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Record a subscription, whatever state the address was already in.
 *
 * NOT AN UPSERT. Prisma's upsert would need the update and the create to say
 * the same thing, and they must not: a confirmed row is left strictly alone,
 * while an absent one is created and an unsubscribed one is reset. The read
 * is followed by a write, so two simultaneous first-time subscriptions can
 * race - the unique index is what settles that, and the handler treats its
 * error as success because from the reader's side it is.
 */
export async function recordSubscription(subscription: Subscription): Promise<RecordResult> {
  const { email, source } = subscription;
  const existing = await prisma.alertSubscriber.findUnique({ where: { email } });

  if (existing === null) {
    const { token, hash } = freshToken();

    await prisma.alertSubscriber.create({
      data: {
        email,
        source,
        confirmationTokenHash: hash,
        confirmationExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    return { outcome: 'created', token };
  }

  // ALREADY ON THE LIST. Nothing is written at all - not the source, not the
  // consent date. That date records when the READER agreed; moving it
  // because a stranger typed their address into a form would make the record
  // say something that is not true.
  if (existing.confirmedAt !== null && existing.unsubscribedAt === null) {
    return { outcome: 'already-confirmed' };
  }

  const { token, hash } = freshToken();
  const resubscribing = existing.unsubscribedAt !== null;

  await prisma.alertSubscriber.update({
    where: { email },
    data: {
      confirmationTokenHash: hash,
      confirmationExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      // Leaving is undone by CONFIRMING, not by asking. Clearing these two
      // here is what makes the returning reader unconfirmed rather than
      // re-added: an unsubscribe that anyone could reverse by typing the
      // address would not be an unsubscribe.
      unsubscribedAt: null,
      confirmedAt: null,
    },
  });

  return { outcome: resubscribing ? 'resubscribed' : 'reconfirmation', token };
}
