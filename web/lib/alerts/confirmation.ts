// web/lib/alerts/confirmation.ts
//
// Turning a token into a message. FW14 increment 3.
//
// SEPARATE FROM THE MAILER because they answer different questions: the
// mailer knows how to put a message on the wire, and this knows what the
// message says and where the link points. Testing the second does not
// require the first to exist.

import { EMAIL_COPY } from '@/lib/fr/emails';
import { siteOrigin } from '@/lib/content/site';
import { sendMail } from '@/lib/alerts/mailer';

/** Where a confirmation link points. The handler is built in increment 4. */
export const CONFIRM_PATH = '/api/alertes/confirm';

/**
 * The absolute URL that goes in the email.
 *
 * ABSOLUTE BY NECESSITY: a mail client has no base URL to resolve against.
 * siteOrigin() is R81's single answer to "what is this site called", and it
 * falls back to localhost when nothing is configured - which is right for
 * development and is the reason R81 has a separate production guard. A
 * confirmation link is not a canonical: pointing one at localhost costs a
 * developer a broken link, where pointing a canonical there costs the site
 * its indexing.
 */
export function confirmUrl(token: string): string {
  const url = new URL(CONFIRM_PATH, siteOrigin());

  url.searchParams.set('token', token);

  return String(url);
}

/**
 * Send the double-opt-in message.
 *
 * Returns whether it went. The caller does NOT change its answer to the
 * reader based on this: the row is already written, the enumeration property
 * says every case answers identically, and "we could not send you a mail" is
 * the one thing that would distinguish a new address from a confirmed one.
 */
export async function sendConfirmation(email: string, token: string): Promise<boolean> {
  return sendMail({
    to: email,
    subject: EMAIL_COPY.confirmation.subject,
    text: EMAIL_COPY.confirmation.lines(confirmUrl(token)).join('\n'),
  });
}
