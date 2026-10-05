// web/lib/auth/request.ts
//
// "Send me a sign-in link." FW22 increment 2.
//
// ============================================================================
// AC2: THIS ENDPOINT MUST NOT SAY WHETHER AN ADDRESS IS REGISTERED
// ============================================================================
//
// A sign-in form is the classic account-enumeration oracle. Ask for a link,
// and if the answer differs for a known and an unknown address, anybody can
// test whether a given person uses this product.
//
// FOR THIS PRODUCT THAT LEAK IS WORSE THAN USUAL. The population is
// cross-border workers, and membership is itself the sensitive fact: knowing
// somebody has an account here says they live in France and work in
// Switzerland, and pairs that with a tax threshold. /confidentialite promises
// not to enable that inference, and an enumerable sign-in form would make the
// promise false on the one endpoint everybody touches.
//
// SO THE SAME WORK IS DONE EITHER WAY. A token is written and a message is
// sent for any syntactically valid address, registered or not. Whether a User
// row exists is decided at CONSUMPTION, where no attacker is watching the
// response. The cost is one wasted row and one message to an address that
// asked for it; the alternative is a public oracle.
//
// THE TIMING ENVELOPE FOLLOWS FROM THAT rather than from a sleep. Both paths
// run the same two database writes and the same send, so there is no branch
// whose duration encodes the answer. A constant-time pad would be the fix if
// the paths differed - making them not differ is better, because a pad is a
// number somebody tunes and then stops trusting.

import { z } from 'zod';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { sendMail } from '@/lib/alerts/mailer';
import { AUTH_EMAIL_COPY } from '@/lib/fr/auth';
import { PRODUCTION_ORIGIN } from '@/lib/content/identity';
import { MAGIC_LINK_TTL_MS, issueMagicLink } from '@/lib/auth/magic-link';

/**
 * Why a request was not served. FOR THE SERVER, NEVER FOR THE CALLER.
 *
 * The route maps every one of these to the same public response - see
 * app/api/v1/auth/magic-link/route.ts. They exist so a log line and a test
 * can tell the cases apart, which is R198's shape: the error preserves which
 * rule fired, and the boundary decides how much of that a client is told.
 */
export type RequestRefusal = 'invalid' | 'rate-limited' | 'undeliverable';

export interface MagicLinkRequestResult {
  readonly ok: boolean;
  readonly reason?: RequestRefusal;
}

const SERVED: MagicLinkRequestResult = { ok: true };

/**
 * The address, normalised the way FW14 normalises one.
 *
 * Zod rather than a regular expression, and lowercased+trimmed so that
 * `Jean@Example.COM ` and `jean@example.com` are one bucket for the rate
 * limiter. Two buckets for one address is a rate limit somebody walks around
 * by pressing shift.
 */
const ADDRESS = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  // A length bound because this string becomes a database key and a rate
  // limiter key. RFC 5321 puts the practical maximum at 254.
  .max(254);

/** Attempts are counted in two buckets, and both have to allow the request. */
function allowed(email: string, headers: Headers): boolean {
  const ip = clientKey(headers);

  // NAMESPACED, so these do not share FW14's buckets. The alert form and the
  // sign-in form are different actions with different consequences, and one
  // exhausting the other's budget would be a denial of service by way of a
  // shared Map.
  //
  // BOTH ARE CHECKED, AND BOTH ARE COUNTED. Checking the address only would
  // let one client walk a list of addresses, mailing a thousand people once
  // each; checking the IP only would let a script walk IPs and mail ONE
  // person a thousand times. The second is the one with a victim.
  const byAddress = checkRate(`auth:email:${email}`);
  const byIp = checkRate(`auth:ip:${ip}`);

  return byAddress.allowed && byIp.allowed;
}

function signInUrl(token: string, email: string): string {
  const url = new URL('/api/v1/auth/callback', PRODUCTION_ORIGIN);

  url.searchParams.set('token', token);
  url.searchParams.set('email', email);

  return url.toString();
}

/**
 * Issue and send a sign-in link.
 *
 * Returns `ok` for a served request and a REASON for a refused one, which the
 * route flattens before it answers.
 */
export async function requestMagicLink(
  rawEmail: string,
  headers: Headers,
): Promise<MagicLinkRequestResult> {
  const parsed = ADDRESS.safeParse(rawEmail);

  if (!parsed.success) {
    // NOT AN ORACLE. "That is not an address" is true of the string itself
    // and says nothing about who is registered - a caller learns only what
    // they already typed.
    return { ok: false, reason: 'invalid' };
  }

  const email = parsed.data;

  if (!allowed(email, headers)) {
    return { ok: false, reason: 'rate-limited' };
  }

  const issued = await issueMagicLink(email);

  const delivered = await sendMail({
    to: email,
    subject: AUTH_EMAIL_COPY.signIn.subject,
    text: AUTH_EMAIL_COPY.signIn.lines(
      signInUrl(issued.token, email),
      // AN-ONBOARD: the same request's six-digit code, carried beside the link.
      issued.code,
      // FROM THE CONSTANT, NEVER TYPED. R153: an email template cannot
      // interpolate, so a figure written into the copy goes stale silently.
      // The copy takes it as an argument for exactly that reason.
      MAGIC_LINK_TTL_MS / 60_000,
    ).join('\n'),
  });

  if (!delivered) {
    // The row stays. A provider outage is not a reason to destroy a token
    // that may already be in flight, and the row expires on its own in
    // fifteen minutes.
    return { ok: false, reason: 'undeliverable' };
  }

  return SERVED;
}
