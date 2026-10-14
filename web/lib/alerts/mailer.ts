// web/lib/alerts/mailer.ts
//
// The one place this product sends mail from. FW14 increment 3.
//
// A FIXED BOUNDARY, WHICH IS WHAT THE INCREMENT ASKS FOR. Everything above
// this file talks to `sendMail`; only this file knows Resend exists. That
// matters less for tidiness than for the guarantee underneath it: there is
// exactly one function that can put a message on the wire, so "CI never sends
// a real email" is a property of one branch rather than a habit spread across
// call sites.
//
// THE SWITCH IS THE ABSENCE OF A KEY, not a test flag. If RESEND_API_KEY is
// unset, the outbox collects messages in memory and nothing reaches the
// network - which is exactly the state of CI, of `pnpm test:e2e`, and of a
// developer's machine. Nobody has to remember to mock anything, and there is
// no NODE_ENV check to get wrong. A test flag can be true in production; a
// missing key cannot be.
//
// AND IT IS LOUD ABOUT IT. A production deployment with no key would silently
// accept subscriptions and deliver nothing, which looks like a working list
// until somebody asks why they never got the mail. The first fallback logs
// once, by design, naming what is missing.

import { Resend } from 'resend';

export interface Message {
  /**
   * WHO THE MESSAGE IS FROM, REQUIRED RATHER THAN DEFAULTED.
   *
   * There are two senders - alertes@ for the list, notifications@ for the
   * sign-in link (R245) - and a default here would mean the wrong one is
   * chosen by forgetting rather than by deciding. Required makes a new caller
   * a compile error instead of a message that looks right and is filed as
   * list mail by the recipient.
   */
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  /** Plain text. See lib/fr/emails.ts for why there is no HTML part. */
  readonly text: string;
  /**
   * Headers a MAIL CLIENT reads rather than a person.
   *
   * RFC 8058's List-Unsubscribe pair is the only user today, and it is the
   * reason this field exists at all: the unsubscribe link in the body is for
   * somebody who looks for it, and these are what put a control at the top of
   * the message for somebody who does not.
   */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface SentMessage extends Message {
  readonly sentAt: Date;
}

/**
 * What was sent while no key was configured.
 *
 * Exported for tests and for `pnpm dev`, where reading the confirmation link
 * out of the terminal is how the loop gets exercised without a mail provider.
 */
const outbox: SentMessage[] = [];

export function readOutbox(): readonly SentMessage[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}

let warned = false;

/** One instance, made on first use so an unset key is never constructed with. */
let client: Resend | null = null;

function resend(key: string): Resend {
  client ??= new Resend(key);

  return client;
}

/**
 * Send, or record that we would have.
 *
 * NEVER THROWS UPWARD ON A DELIVERY FAILURE - it returns false. The caller is
 * a route handler answering somebody's form POST, and a mail provider being
 * down is not a reason to tell a reader their subscription failed when the
 * row was written. What the caller does with `false` is its decision; what
 * this file guarantees is that it is told.
 */
export async function sendMail(message: Message): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();

  if (key === undefined || key === '') {
    if (!warned) {
      warned = true;
      console.warn(
        '[alerts] RESEND_API_KEY is unset: confirmation emails are being ' +
          'collected in memory and NOT delivered. This is expected in tests ' +
          'and in development; in production it means the alert list accepts ' +
          'subscriptions that nobody can confirm.',
      );
    }

    outbox.push({ ...message, sentAt: new Date() });

    // AND IT IS PRINTED, which FW14 said it was and never did. The comment on
    // `outbox` above has always read "for `pnpm dev`, where reading the
    // confirmation link out of the terminal is how the loop gets exercised
    // without a mail provider" - and nothing printed anything, so the loop it
    // describes could not be exercised. FW22's walkthrough needed the sign-in
    // link and found the mechanism missing: R154, a mechanism asserted in a
    // comment and never proven to deliver.
    //
    // DEVELOPMENT ONLY, AND BOTH CONDITIONS MATTER. No key means nothing was
    // delivered; NODE_ENV guards the case where production is missing its key,
    // where the right response is the warning above rather than sign-in links
    // in a production log. Tests keep the quiet path - they read the outbox
    // directly, and a suite that printed every message would bury its own
    // failures.
    if (process.env.NODE_ENV === 'development') {
      console.log(
        [
          '',
          '--- message not sent (no RESEND_API_KEY); here it is -----------',
          `to:      ${message.to}`,
          `subject: ${message.subject}`,
          // THE HEADERS ARE PRINTED TOO, because the one-click unsubscribe
          // URL exists ONLY in them - it is not the link in the body, it is
          // the one a mail client fires - and a walkthrough that cannot read
          // it cannot exercise the flow. R154: the same reason this block
          // exists at all.
          ...Object.entries(message.headers ?? {}).map(([name, value]) => `${name}: ${value}`),
          '',
          message.text,
          '---------------------------------------------------------------',
          '',
        ].join('\n'),
      );
    }

    return true;
  }

  try {
    const { error } = await resend(key).emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      // SPREAD RATHER THAN PASSED AS undefined: a provider that treats an
      // explicit undefined differently from an absent key is a class of bug
      // nobody finds from this side.
      ...(message.headers === undefined ? {} : { headers: message.headers }),
    });

    if (error !== null) {
      // The address, never the message body: a provider error is worth
      // knowing about and the contents of somebody's mail are not ours to
      // put in a log. /confidentialite says technical reports are stripped
      // of addresses before being stored - this one is a runtime line, not a
      // stored report, and it still says as little as it can.
      console.error('[alerts] Resend refused a message:', error.name);

      return false;
    }

    return true;
  } catch (cause) {
    console.error('[alerts] Resend threw:', cause instanceof Error ? cause.name : 'unknown');

    return false;
  }
}
