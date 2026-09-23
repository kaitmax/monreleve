// web/lib/push/message.ts
//
// One reminder, as it will appear on a lock screen. FW27 increment 3.
//
// SEPARATE FROM transport.ts, which reaches the database. What a notification
// SAYS is decidable from the message alone, and a test of the sentence should
// not need a database container to run - nor should a walkthrough that wants
// to print one.

import { NOTIFICATION_COPY } from '@/lib/fr/notifications';
import { formatDate } from '@/lib/ui/core/format/date';
import type { PushNotification } from '@/lib/push/sender';
import type { ReminderMessage } from '@/lib/reminders/transport';

/**
 * The stable code a client branches on, beside the French a person reads.
 *
 * The same contract as the auth refusal codes: ASCII, never translated, never
 * reworded, because an Android build from six months ago is reading it.
 */
export const REMINDER_PUSH_KIND = 'daily_reminder';

/**
 * EXPORTED SO IT CAN BE READ. FW26 shipped enum tokens to a French reader in a
 * document where every count was right, and what caught it was somebody
 * reading the output rather than a test asserting its shape. This is the seam
 * where a person - or a walkthrough - can see the sentence.
 *
 * THE DATA PAYLOAD CARRIES THE ISO DAY, not the rendered one. The client looks
 * the day up; the person reads it. Both are present, and the rendered form
 * comes from the product's one date formatter (R206), so a notification cannot
 * disagree with the dossier about what 07.07.2026 is.
 */
export function reminderNotification(message: ReminderMessage): PushNotification {
  const copy =
    message.mode === 'AUTO_DETECT'
      ? NOTIFICATION_COPY.reminder.auto
      : NOTIFICATION_COPY.reminder.manual;

  return {
    title: copy.title(formatDate(message.day)),
    body: copy.body,
    data: { kind: REMINDER_PUSH_KIND, day: message.day, mode: message.mode },
  };
}
