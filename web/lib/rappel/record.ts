// web/lib/rappel/record.ts
//
// FW-DELAI-RAPPEL, R915: writing a reminder request down, by the alert flow's
// mechanics (lib/alerts/record.ts): a hashed, single-use confirmation token
// with the same lifetime, and one answer to the reader whatever state the
// address was in.
//
// THREE STATES IN, ONE SENTENCE OUT. An address arriving here is absent,
// awaiting confirmation, or confirmed. The CALLER learns which, because it
// must know whether to send a confirmation; the route handler throws that
// away before answering, because "already programmed" would tell anybody
// typing an address whether that person has a reminder (enumeration).
//
// THE SAME ADDRESS TWICE IS ONE REMINDER (R915). The unique index on `email`
// is the guarantee, in the database; this function decides what a second
// request does:
//   - awaiting confirmation: the new date replaces the old one, with a fresh
//     link (nothing has been sent for the old one, and the new message is the
//     one in front of the reader);
//   - confirmed: NOTHING is written and nothing is sent. Changing a confirmed
//     reminder because a stranger typed the address would let anybody cancel
//     somebody's reminder; the person changes it by the delete link and a new
//     request. (A QUESTION in the report, not a product decision taken here.)

import { prisma } from '@/lib/db/client';
import { freshToken } from '@/lib/alerts/token';
import { CONFIRMATION_TTL_DAYS } from '@/lib/alerts/lifetimes';
import { toStoredDay } from '@/lib/entries/day';
import type { ReminderRequest } from '@/lib/rappel/input';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Prisma's P2002, read without importing the runtime error class. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

export type RequestOutcome =
  /** No row existed. */
  | 'created'
  /** A row awaited confirmation; it has the new date and fresh links. */
  | 'renewed'
  /** Already confirmed. Nothing changed. */
  | 'already-confirmed'
  /**
   * A simultaneous first request for the same address won the unique index.
   * Its message is the one going out; this one sends nothing, and the reader
   * gets the same answer, because from their side it is the same outcome.
   */
  | 'concurrent';

export interface RequestResult {
  readonly outcome: RequestOutcome;
  /**
   * The plaintext tokens for the confirmation message, present exactly when
   * one is to be sent. A token issued with nothing to confirm is a live
   * capability nobody asked for.
   */
  readonly tokens?: { readonly confirm: string; readonly remove: string };
}

/** Record a request on the instant `now`, whatever state the address was in. */
export async function requestReminder(request: ReminderRequest, now: Date = new Date()): Promise<RequestResult> {
  const { email, deadline } = request;
  const existing = await prisma.deadlineReminder.findUnique({ where: { email } });

  if (existing !== null && existing.confirmedAt !== null) {
    return { outcome: 'already-confirmed' };
  }

  const confirm = freshToken();
  const remove = freshToken();
  const data = {
    deadline: toStoredDay(deadline),
    confirmationTokenHash: confirm.hash,
    confirmationExpiresAt: new Date(now.getTime() + CONFIRMATION_TTL_DAYS * DAY_MS),
    // A FRESH DELETE TOKEN PER MESSAGE, as the alert flow mints a fresh
    // unsubscribe token per send: the row keeps only a hash, so the newest
    // message's link is the one that works.
    deleteTokenHash: remove.hash,
  };

  if (existing === null) {
    try {
      await prisma.deadlineReminder.create({ data: { email, ...data } });
    } catch (error) {
      if (isUniqueViolation(error)) return { outcome: 'concurrent' };

      throw error;
    }

    return { outcome: 'created', tokens: { confirm: confirm.token, remove: remove.token } };
  }

  // Conditioned on the row still awaiting confirmation: a confirmation landing
  // between the read and this write must not be undone by it.
  const updated = await prisma.deadlineReminder.updateMany({
    where: { id: existing.id, confirmedAt: null },
    data,
  });

  if (updated.count !== 1) return { outcome: 'already-confirmed' };

  return { outcome: 'renewed', tokens: { confirm: confirm.token, remove: remove.token } };
}
