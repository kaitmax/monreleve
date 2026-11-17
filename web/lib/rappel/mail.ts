// web/lib/rappel/mail.ts
//
// FW-DELAI-RAPPEL, R917: the two messages - the confirmation and the one
// reminder - put together and handed to the product's one mailer
// (lib/alerts/mailer.ts, the only place that can put a message on the wire).
//
// R245, DECIDED: THESE ARE TRANSACTIONAL, NOT LIST MAIL. One person asks for
// one reminder about their own date; there is no list to leave, and RFC
// 2369's List-* headers belong to mailing lists. So neither message carries
// List-Unsubscribe or List-Unsubscribe-Post, and both go from the
// transactional sender (AUTH_EMAIL_FROM, notifications@) rather than the
// list's (alertes@) - the field every mail client shows before the subject.
// tests/db/rappel-delai-mail.test.ts asserts the pair absent on both and
// present, in the same run, on the alert list's message.
//
// THE WAY OUT IS THE DELETE LINK IN THE BODY of each message (R916, R917).
// It opens a page with one button, and only that button deletes (R1002): the
// confirmation carries both links, and a mail client that fetches links to
// build a preview must not remove a request before anybody has read it.

import { AUTH_EMAIL_FROM } from '@/lib/fr/emails';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { siteOrigin } from '@/lib/content/site';
import { sendMail, type Message } from '@/lib/alerts/mailer';
import type { EnvLike } from '@/lib/push/resolve';
import { DELETE_PATH } from '@/lib/rappel/landing';

/** Where the confirmation link points. */
export const CONFIRM_PATH = '/api/rappel-delai/confirm';

/** Where the delete link in every message points: the one-button page (R1002), whose path lives in lib/rappel/landing.ts. */
export { DELETE_PATH };

/** An absolute link for a message: a mail client has no base URL (R81's siteOrigin). */
function tokenUrl(path: string, token: string): string {
  const url = new URL(path, siteOrigin());

  url.searchParams.set('token', token);

  return String(url);
}

export const confirmUrl = (token: string): string => tokenUrl(CONFIRM_PATH, token);

export const deleteUrl = (token: string): string => tokenUrl(DELETE_PATH, token);

/** The sending function, injectable so a test can make a send fail (R916). */
export type Send = (message: Message) => Promise<boolean>;

/**
 * Send the confirmation. Returns whether it went; the caller does NOT change
 * its answer to the reader on it (the enumeration property, as the alert
 * flow's sendConfirmation explains).
 */
export async function sendReminderConfirmation(
  email: string,
  deadline: string,
  tokens: { readonly confirm: string; readonly remove: string },
  send: Send = sendMail,
): Promise<boolean> {
  return send({
    from: AUTH_EMAIL_FROM,
    to: email,
    subject: RAPPEL_COPY.confirmation.subject,
    text: RAPPEL_COPY.confirmation.lines(deadline, confirmUrl(tokens.confirm), deleteUrl(tokens.remove)).join('\n'),
  });
}


/**
 * Send the one reminder (R916). Called inside the transaction that deletes
 * the row (lib/rappel/job.ts); `false` rolls that transaction back.
 */
export async function sendDeadlineReminder(
  email: string,
  deadline: string,
  removeToken: string,
  send: Send = sendMail,
): Promise<boolean> {
  return send({
    from: AUTH_EMAIL_FROM,
    to: email,
    subject: RAPPEL_COPY.reminder.subject(deadline),
    text: RAPPEL_COPY.reminder.lines(deadline, deleteUrl(removeToken)).join('\n'),
  });
}

/**
 * WHETHER THE REMINDER PASS CAN DO ITS WORK (R205, lib/scheduler/jobs.ts's
 * rule for a queue): with no RESEND_API_KEY the mailer collects messages in
 * memory and reports success, so a pass outside development would delete
 * every due row against a reminder nobody receives. The queue is then NOT
 * scheduled, and the skip is reported (R198); rows past their date are still
 * deleted by the daily purge (lib/rappel/purge.ts), so the notice's retention
 * holds either way.
 */
export function describeMailSender(env: EnvLike): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if ((env.RESEND_API_KEY ?? '').trim() !== '') return { ok: true };

  // Development prints each message to the terminal (lib/alerts/mailer.ts).
  if (env.NODE_ENV === 'development') return { ok: true };

  return {
    ok: false,
    reason:
      '[mail] no mail sender (not_configured): RESEND_API_KEY is unset, so a deadline ' +
      'reminder would be collected in memory and its row deleted with nothing delivered. ' +
      'Rows past their date are still deleted by the daily purge.',
  };
}
