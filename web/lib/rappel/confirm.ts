// web/lib/rappel/confirm.ts
//
// FW-DELAI-RAPPEL, R915 and R916: the two links every message carries - the
// confirmation link and the delete link - and what each does to the row.
//
// THE ALERT FLOW'S PRINCIPLE (lib/alerts/confirm.ts): a link that no longer
// works says so honestly, without answering a question its holder should not
// be able to ask. A token never issued and a token already used get the SAME
// answer, so the endpoint cannot be fed tokens to learn which were real.
//
// TWO DIFFERENCES FROM THE ALERT FLOW, BOTH IN THE DIRECTION OF KEEPING LESS:
//   - an expired confirmation DELETES the request (the alert flow keeps an
//     unsubscribed row as a record of a refusal; a reminder nobody confirmed
//     has nothing left to protect);
//   - a confirmation that arrives fewer than DAYS_BEFORE days before the date
//     DELETES the request and programs nothing (R916's conservative choice:
//     no reminder is ever sent for such a date; the alternative is a QUESTION
//     in the report).

import { prisma } from '@/lib/db/client';
import { hashToken } from '@/lib/alerts/token';
import { fromStoredDay, parisDayOf } from '@/lib/entries/day';
import { LANDING_STATES, type LandingState } from '@/lib/rappel/landing';
import { reminderOffered } from '@/lib/rappel/window';

/**
 * Confirm, if that token still means anything, on the instant `now`.
 *
 * READ THEN WRITE, and the write is conditioned on the hash it read: two
 * simultaneous clicks - a prefetching mail client and a person - cannot both
 * confirm, and the second reports 'invalide' rather than confirming twice.
 */
export async function confirmReminderByToken(token: string, now: Date = new Date()): Promise<LandingState> {
  if (token === '') return LANDING_STATES.unknown;

  const hash = hashToken(token);
  const row = await prisma.deadlineReminder.findUnique({ where: { confirmationTokenHash: hash } });

  if (row === null) return LANDING_STATES.unknown;

  const expiry = row.confirmationExpiresAt;

  if (expiry !== null && expiry.getTime() <= now.getTime()) {
    await prisma.deadlineReminder.deleteMany({ where: { id: row.id, confirmationTokenHash: hash } });

    return LANDING_STATES.expired;
  }

  if (!reminderOffered(fromStoredDay(row.deadline), parisDayOf(now))) {
    await prisma.deadlineReminder.deleteMany({ where: { id: row.id, confirmationTokenHash: hash } });

    return LANDING_STATES.tooLate;
  }

  const updated = await prisma.deadlineReminder.updateMany({
    where: { id: row.id, confirmationTokenHash: hash },
    data: { confirmedAt: now, confirmationTokenHash: null, confirmationExpiresAt: null },
  });

  return updated.count === 1 ? LANDING_STATES.confirmed : LANDING_STATES.unknown;
}

/**
 * Delete the address and the date, AT ONCE (R916), for whoever holds the link.
 *
 * IDEMPOTENT: a second click finds nothing and says so with the same honest
 * page as a token never issued - "aucun rappel ne correspond à ce lien" is
 * true of both, and of the link in a reminder already sent (the row went with
 * the send).
 */
export async function deleteReminderByToken(token: string): Promise<LandingState> {
  if (token === '') return LANDING_STATES.deleteUnknown;

  const { count } = await prisma.deadlineReminder.deleteMany({
    where: { deleteTokenHash: hashToken(token) },
  });

  return count === 1 ? LANDING_STATES.deleted : LANDING_STATES.deleteUnknown;
}
