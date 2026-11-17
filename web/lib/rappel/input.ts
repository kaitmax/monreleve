// web/lib/rappel/input.ts
//
// FW-DELAI-RAPPEL: what a reminder request has to contain, and nothing more.
//
// TWO FIELDS ARE READ, AND ONLY TWO: `email` and `date`. Whatever else a body
// carries is never looked at, so nothing else the comparator holds can be
// stored by accident (R750) - the island sends only these two, and
// e2e/rappel-delai.spec.ts reads the request body to prove it.
//
// TOTAL, LIKE THE ALERT FORM'S PARSER: it never throws. A hostile body gets a
// status, never a stack trace.
//
// THE DATE IS THE COMPUTED END, an ISO day, and the server refuses one fewer
// than DAYS_BEFORE days away on Paris's calendar (R916's conservative choice:
// no mail is ever sent for such a date). The island hides its form for those
// dates on the reader's own calendar; this is the rule that holds.

import { normaliseEmail } from '@/lib/db/alert-subscriber';
import { isPlausibleEmail } from '@/lib/alerts/email';
import { REMINDER_STATUS, type ReminderStatus } from '@/lib/rappel/status';
import { isIsoDay, reminderOffered } from '@/lib/rappel/window';

export interface ReminderRequest {
  /** Normalised: trimmed and lowercased, as the unique index sees it. */
  readonly email: string;
  /** The end of the period, an ISO day. */
  readonly deadline: string;
}

export type ParsedRequest =
  | { readonly ok: true; readonly value: ReminderRequest }
  | { readonly ok: false; readonly status: ReminderStatus };

/** A field as a string, or '' - FormData can hold a File, and a File is not an answer. */
function field(data: FormData, name: string): string {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
}

/**
 * Read a request, on the day `today` (Paris, ISO).
 *
 * The address problem is reported first: it is the reader's to fix, where a
 * refused date is the page's.
 */
export function parseReminderRequest(data: FormData, today: string): ParsedRequest {
  const email = normaliseEmail(field(data, 'email'));

  if (email === '') return { ok: false, status: REMINDER_STATUS.missing };
  if (!isPlausibleEmail(email)) return { ok: false, status: REMINDER_STATUS.invalid };

  const deadline = field(data, 'date');

  if (!isIsoDay(deadline) || !reminderOffered(deadline, today)) {
    return { ok: false, status: REMINDER_STATUS.date };
  }

  return { ok: true, value: { email, deadline } };
}
