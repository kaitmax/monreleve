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
//
// ONE EXCEPTION, AND IT IS THE OPERATOR'S (Web Ruling 30, 2026-11-17): THE
// WEBSITE'S SIGN-IN NEVER CREATES AN ACCOUNT AND NEVER MAILS AN ADDRESS THE
// APPLICATION DOES NOT KNOW. requestKnownAddressSignIn below is that door. It
// answers its caller exactly as this one does - the same result for a known
// and an unknown address, so the page cannot be used to ask who has an
// account - but for an unknown address it writes no row and sends no mail.
// Its two paths therefore do NOT do the same work, and what that costs is
// stated there rather than hidden: the timing argument above holds for this
// route and not for that one.

import { z } from 'zod';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { sendMail } from '@/lib/alerts/mailer';
import { AUTH_EMAIL_COPY } from '@/lib/fr/auth';
import { AUTH_EMAIL_FROM } from '@/lib/fr/emails';
import { PRODUCTION_ORIGIN } from '@/lib/content/identity';
import { MAGIC_LINK_TTL_MS, issueMagicLink } from '@/lib/auth/magic-link';
import { prisma } from '@/lib/db/client';

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

/**
 * The origin a sign-in link is minted on.
 *
 * PRODUCTION IS BYTE-FOR-BYTE UNCHANGED (R378). A link in a real email must
 * name the production host, because that is the host App Links verify
 * against: /.well-known/assetlinks.json is served from monreleve.ch, and a
 * link on any other origin opens a browser instead of the app. Nothing here
 * may change that, which is why the condition below FAILS CLOSED - anything
 * other than a confirmed dev server lands on PRODUCTION_ORIGIN.
 *
 * WHAT CHANGES IS `next dev` ONLY, and it changes because of a measured cost:
 * FW-CODE-CAP's walkthrough read a link out of the dev server's terminal,
 * followed it, and sent a request to the LIVE SITE, which answered 400
 * knowing nothing of a local token. A link a developer cannot follow is a
 * link that gets followed somewhere else.
 *
 * ==========================================================================
 * THE CONDITION IS TWO THINGS, NOT ONE
 * ==========================================================================
 *
 * NODE_ENV ALONE IS NOT ENOUGH EVIDENCE, and this repository has already paid
 * for that lesson: `next build` sets NODE_ENV=production too, so an earlier
 * guard keyed on it broke every local build (tasks/todo.md, the
 * FRONTALIER_RUNTIME entry). The test here runs the other way round -
 * development rather than production - so `next build` and `next start` are
 * both correctly excluded. But "NODE_ENV happens to say development" is a
 * weak thing to hang a production URL on.
 *
 * SO THE RUNTIME MARKER IS CHECKED TOO. The Dockerfile's runner stage sets
 * FRONTALIER_RUNTIME=1 and `next dev` does not, so requiring its ABSENCE
 * means a container whose NODE_ENV was set wrong by hand still mints
 * production links. Two independent conditions, and the dangerous direction
 * needs both of them to be wrong at once.
 *
 * THE PORT COMES FROM THE ENVIRONMENT (R170), not from the request: `pnpm
 * dev` takes PORT, so a dev server moved off 3000 still mints a link that
 * resolves to itself.
 */
/**
 * The three variables this decision reads, and nothing else.
 *
 * NARROWER THAN NodeJS.ProcessEnv ON PURPOSE. This repository augments that
 * type to REQUIRE NODE_ENV, so a test could not pass `{}` - and "nothing is
 * set at all" is precisely the case that must land on the production origin.
 * Taking only what is read also means a reader can see the whole input to the
 * branch without leaving this file.
 */
export interface SignInEnv {
  readonly NODE_ENV?: string;
  readonly FRONTALIER_RUNTIME?: string;
  readonly PORT?: string;
}

export function signInOrigin(env: SignInEnv = process.env): string {
  const isDevServer = env.NODE_ENV === 'development' && env.FRONTALIER_RUNTIME !== '1';

  if (!isDevServer) return PRODUCTION_ORIGIN;

  return `http://localhost:${env.PORT ?? '3000'}`;
}

function signInUrl(token: string, email: string): string {
  const url = new URL('/api/v1/auth/callback', signInOrigin());

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

  return issueAndSend(email);
}

/**
 * The row and the mail, for an address that has already passed validation and
 * both buckets. ONE implementation for both doors (R206): the website's sign-in
 * sends exactly the mail the application's does, through exactly this code.
 */
async function issueAndSend(email: string): Promise<MagicLinkRequestResult> {
  const issued = await issueMagicLink(email);

  const delivered = await sendMail({
    // TRANSACTIONAL: a sign-in link is not list mail, and must not look
    // like it (R245).
    from: AUTH_EMAIL_FROM,
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

/** Hands work to run after the response; the route passes next/server's after(). */
export type DeferWork = (work: () => Promise<void>) => void;

/**
 * THE WEBSITE'S DOOR (FW-WEB-ACCOUNT, Web Ruling 30): a sign-in for an address
 * the application already knows, and for no other.
 *
 * - THE SAME VALIDATION AND THE SAME BUCKETS as requestMagicLink, spent BEFORE
 *   the lookup and for every address, known or not. A rate limit that counted
 *   only known addresses would itself answer the question this hides: hammer
 *   an address, and the one that gets limited is the one with an account.
 * - AN UNKNOWN ADDRESS WRITES NO ROW AND SENDS NO MAIL, and gets the SAME
 *   result as a known one ({ ok: true }), so the route answers both alike
 *   (docs/api-v1.md 1.5: nothing tells a caller which case fired).
 * - A KNOWN ADDRESS gets issueAndSend - the row and the one mail, as the
 *   application's sign-in does. The website never creates the account; the
 *   application's code exchange still does (/api/v1/auth/code, unchanged).
 *
 * THE TWO PATHS DO THE SAME WORK IN THE REQUEST (Web Ruling 37, R1072). An
 * unknown address costs the validation, both buckets and one indexed read; so
 * does a known one - its row and its mail are handed to `defer`, which the
 * route sets to Next's own after() (next/server: work run once the response
 * has been sent). Measured inline, the known path was the slower by its two
 * writes and the send - a gap that answers "does this address have an
 * account?" to anybody with a stopwatch, and in production the send is a call
 * to the mail provider. No pad: a pad is a number somebody tunes and then
 * stops trusting; moving the work out of the request is the fix. Without a
 * `defer`, the work runs inline, as the application's door does.
 */
export async function requestKnownAddressSignIn(
  rawEmail: string,
  headers: Headers,
  defer?: DeferWork,
): Promise<MagicLinkRequestResult> {
  const parsed = ADDRESS.safeParse(rawEmail);

  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const email = parsed.data;

  if (!allowed(email, headers)) return { ok: false, reason: 'rate-limited' };

  const known = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Nothing written, nothing sent - and the caller cannot tell (Web Ruling 30).
  if (known === null) return SERVED;

  if (defer === undefined) return issueAndSend(email);

  defer(async () => {
    const sent = await issueAndSend(email);

    // LOGGED, NOT RETURNED - the response has already gone, and it said the
    // same thing it says to every address.
    if (!sent.ok) console.error('[auth] the mail provider refused a sign-in link (web, sent after the response)');
  });

  return SERVED;
}
