// web/lib/push/resolve.ts
//
// Which sender this process gets, and the case where it gets none.
// FW27 increment 3.
//
// ============================================================================
// AN ABSENT CREDENTIAL MEANS NO SENDER, NOT A SENDER THAT PRETENDS
// ============================================================================
//
// FW14's mailer answers a missing key with an in-memory outbox and returns
// true: nothing is delivered, and the caller is told the message was accepted.
// That is right THERE, because the caller is a route handler answering
// somebody's form POST and the alternative is telling a reader their
// subscription failed when the row was written.
//
// IT WOULD BE WRONG HERE, and the difference is R244. The reminder job
// publishes a count of how many reminders it SENT, and that number is the only
// signal anybody has that the feature works. A sender that silently accepted
// everything would make `sent` a count of pushes nobody received - a number
// that looks healthy precisely when the product is broken, which is the shape
// R133 refuses and the reason `/api/health` must NAME this product rather than
// merely answer.
//
// So production with no credentials gets NOTHING, loudly: increment 4's
// scheduler does not register the reminder job at all, and says which rule
// refused (R198). That is R205 applied to a job rather than to a file - a
// thing runs only when what it claims can be believed.
//
// ============================================================================
// DEVELOPMENT IS THE ONE EXCEPTION, AND IT PRINTS
// ============================================================================
//
// On a developer's machine there are no credentials either, and the whole
// point of a walkthrough (R176/R177) is to read what a reminder says. So
// `NODE_ENV=development` gets the console sender, which prints the
// notification and delivers nothing. Both conditions matter, exactly as they
// do in the mailer: no credentials means nothing was sent, and NODE_ENV is
// what keeps production on the refusing branch.
//
// R243: THERE IS NO PATH FROM A TEST TO A NETWORK. `NODE_ENV` is `test` under
// vitest, so a test that called this without arguments would get the refusal,
// not the console sender and certainly not FCM - which would need three
// environment variables set to values nobody has.

import { ConsolePushSender } from '@/lib/push/console';
import { createFcmSender } from '@/lib/push/fcm';
import { MALFORMED_KEY_SHAPES } from '@/lib/push/fcm';
import type { EnvLike, FcmCredentialRefusal } from '@/lib/push/fcm';
import type { PushSender } from '@/lib/push/sender';

export type { EnvLike };

export type PushSenderKind = 'fcm' | 'console';

export type PushAvailability =
  | { readonly ok: true; readonly sender: PushSender; readonly kind: PushSenderKind }
  | FcmCredentialRefusal;

/**
 * The sender for this process, or the named reason there is none.
 *
 * `env` is a parameter so a test can present a development environment without
 * setting one on the process, where it would outlive the test file (R171).
 */
export function resolvePushSender(env: EnvLike = process.env): PushAvailability {
  const made = createFcmSender(env);

  if (made.ok) return { ok: true, sender: made.sender, kind: 'fcm' };

  if (env.NODE_ENV === 'development') {
    return { ok: true, sender: new ConsolePushSender(), kind: 'console' };
  }

  return made;
}

/**
 * One sentence saying what happened, for whoever reads a server log.
 *
 * R198: it names which rule fired. `not_configured` and
 * `placeholder_credentials` send somebody to different places - one means
 * "you have not filled this in", the other means "you filled it in with the
 * example".
 *
 * R861: A MALFORMED KEY ALSO SAYS WHICH SHAPE FAILED, and only the shape. This
 * line is what instrumentation.ts logs at startup, so it is the one place an
 * operator reads after pasting a key - and a log is a place things get pasted
 * FROM, so it carries the variable's name and never a character of its value.
 * The other two refusals read exactly as they always have.
 */
export function describePushSender(availability: PushAvailability): string {
  if (availability.ok) {
    return availability.kind === 'fcm'
      ? '[push] Firebase credentials found: reminders will be delivered.'
      : '[push] no Firebase credentials: reminders will be PRINTED to this terminal ' +
          'and delivered to nobody (development only).';
  }

  if (availability.code === 'malformed_private_key') {
    return (
      `[push] no push sender (${availability.code}: ${availability.detail}): ` +
      `${MALFORMED_KEY_SHAPES[availability.detail]} The daily reminder will NOT be ` +
      'scheduled. Reminders are opt-in and nobody is told they stopped, so this ' +
      'refuses rather than reporting sends that reached no device.'
    );
  }

  return (
    `[push] no push sender (${availability.code}): the daily reminder will NOT be ` +
    'scheduled. Reminders are opt-in and nobody is told they stopped, so this ' +
    'refuses rather than reporting sends that reached no device.'
  );
}
