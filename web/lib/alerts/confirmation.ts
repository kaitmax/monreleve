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
import { issueUnsubscribeToken } from '@/lib/alerts/confirm';
import { listUnsubscribeHeaders } from '@/lib/alerts/list-headers';

/** Where a confirmation link points. */
export const CONFIRM_PATH = '/api/alertes/confirm';

/** Where the one-click unsubscribe in every send points. */
export const UNSUBSCRIBE_ENDPOINT = '/api/alertes/desinscription';

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
  return tokenUrl(CONFIRM_PATH, token);
}

/** The one-click unsubscribe link that every send carries. */
export function unsubscribeUrl(token: string): string {
  return tokenUrl(UNSUBSCRIBE_ENDPOINT, token);
}

function tokenUrl(path: string, token: string): string {
  const url = new URL(path, siteOrigin());

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
  // A FRESH UNSUBSCRIBE TOKEN PER SEND, because the row keeps only a hash and
  // nothing can read an existing token back out. The consequence is
  // deliberate: the newest message's link is the one that works, and the
  // newest message is the one in front of the reader.
  const unsubscribeToken = await issueUnsubscribeToken(email);

  const off = unsubscribeUrl(unsubscribeToken);

  return sendMail({
    to: email,
    subject: EMAIL_COPY.confirmation.subject,
    text: EMAIL_COPY.confirmation.lines(confirmUrl(token), off).join('\n'),
    // RFC 8058, from THE SAME URL the body links to and therefore the same
    // token (R206). Two URLs built from two tokens would work and would mean
    // the control at the top of the message and the link at the bottom
    // expired at different moments.
    headers: listUnsubscribeHeaders(off),
  });
}
