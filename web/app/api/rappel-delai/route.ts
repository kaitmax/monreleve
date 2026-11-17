// web/app/api/rappel-delai/route.ts
//
// POST /api/rappel-delai - FW-DELAI-RAPPEL, R915: ask for one reminder before
// the end of the droit d'option period.
//
// THE BODY IS TWO FIELDS, form-encoded: `email` and `date` (the end of the
// period as the comparator computed it). Nothing else is read (lib/rappel/
// input.ts), so nothing else the comparator holds can be stored (R750).
//
// THE ANSWER IS JSON - { status, message } - because the caller is the
// comparator's island, which keeps the reader's comparison on screen rather
// than navigating away from it; the sentence is the server's (lib/fr/
// rappel.ts), so the island carries status codes and not the French.
//
// ONE ANSWER FOR EVERY ADDRESS (R915). A new address, one awaiting
// confirmation and one already confirmed get the same status and the same
// sentence; the difference decides only whether a confirmation is sent, and
// it never reaches the response. A mail provider being down does not change
// the answer either - "we could not send you a message" is exactly the
// sentence that would tell a new address from a known one.

import { NextResponse, type NextRequest } from 'next/server';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { parisDayOf } from '@/lib/entries/day';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import { parseReminderRequest } from '@/lib/rappel/input';
import { sendReminderConfirmation } from '@/lib/rappel/mail';
import { requestReminder } from '@/lib/rappel/record';
import { REMINDER_STATUS, type ReminderStatus } from '@/lib/rappel/status';

/** Each status's sentence, from the one copy module. */
const ANSWERS: Readonly<Record<ReminderStatus, string>> = {
  [REMINDER_STATUS.ok]: RAPPEL_COPY.answers.ok,
  [REMINDER_STATUS.missing]: RAPPEL_COPY.answers.missing,
  [REMINDER_STATUS.invalid]: RAPPEL_COPY.answers.invalid,
  [REMINDER_STATUS.date]: RAPPEL_COPY.answers.date,
  [REMINDER_STATUS.rate]: RAPPEL_COPY.answers.rate,
  [REMINDER_STATUS.unavailable]: RAPPEL_COPY.answers.unavailable,
};

function answer(status: ReminderStatus): NextResponse {
  // 200 for every status: the island reads the status field, and a refusal
  // is an answer, not a transport failure. no-store: an answer about an
  // address is never a thing to cache.
  return NextResponse.json(
    { status, message: ANSWERS[status] },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // THE RATE LIMIT FIRST, on its own budget beside the alert form's: this
  // endpoint sends mail to an address somebody else typed.
  const rate = checkRate(`rappel-delai:${clientKey(request.headers)}`);

  if (!rate.allowed) return answer(REMINDER_STATUS.rate);

  try {
    const now = new Date();
    const parsed = parseReminderRequest(await request.formData(), parisDayOf(now));

    if (!parsed.ok) return answer(parsed.status);

    const recorded = await requestReminder(parsed.value, now);

    if (recorded.tokens !== undefined) {
      // The result is deliberately not read: the row is written, and the
      // answer must not depend on the mailer (see the header).
      await sendReminderConfirmation(parsed.value.email, parsed.value.deadline, recorded.tokens);
    }

    return answer(REMINDER_STATUS.ok);
  } catch {
    // The body was not a form, or the database refused. Never a stack trace,
    // and never a success that did not happen.
    return answer(REMINDER_STATUS.unavailable);
  }
}
