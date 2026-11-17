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
//     DELETES the request and programs nothing (R916's conservative choice,
//     KEPT by R1000: no reminder is ever sent for such a date - it would only
//     repeat what the page showed - and the "trop-tard" outcome says nothing
//     was kept).

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
 * Delete the address and the date for whoever holds a delete link, when its
 * page's one button is pressed (R1002: only the POST reaches this).
 *
 * R1003: EVERY delete link a message ever carried for this row matches it,
 * for as long as the row exists - the row keeps the hash of each one
 * (deleteTokenHashes), so a reminder whose send was reported failed, or a
 * confirmation sent before it, still removes what is left.
 *
 * ONE ANSWER FOR 'DELETED NOW' AND 'NO ROW FOR THIS LINK' (R1003): since
 * every issued link works while its row exists, a link that matches nothing
 * means nothing is kept under it - after a send, a deletion, a lapse or a
 * purge, and for a token never issued. The outcome's words are true of all
 * of them, and a caller learns nothing about which it was (R915).
 */
export async function deleteReminderByToken(token: string): Promise<LandingState> {
  if (token !== '') {
    await prisma.deadlineReminder.deleteMany({ where: { deleteTokenHashes: { has: hashToken(token) } } });
  }

  return LANDING_STATES.deleted;
}
