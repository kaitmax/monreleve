// web/lib/auth/magic-link.ts
//
// The sign-in token: issued to an address, used once, short-lived.
//
// WHY THIS FILE EXISTS RATHER THAN Auth.js's OWN FLOW. D14: there is no
// signed-in web area. Authentication exists so the Android client can call
// /api/v1, and AC3 requires that no cookie is set anywhere and that /api/v1
// accepts a bearer token and nothing else. Auth.js's route handlers are built
// to set a session cookie and redirect a browser, which is the right design
// for a product that has a signed-in web area and the wrong one for this.
//
// So this product uses Auth.js's ADAPTER and its VerificationToken table -
// the parts that model the data - and issues and consumes the token itself.
// Nothing here mounts an Auth.js handler, so there is no route that can set a
// cookie by accident.
//
// ============================================================================
// THE TOKEN IS CONSUMED IN ONE STATEMENT, AND THAT IS THE POINT OF THE FILE
// ============================================================================
//
// The obvious implementation reads, checks, then deletes:
//
//     const row = await prisma.verificationToken.findUnique(...)
//     if (row === null || row.expires < new Date()) return null
//     await prisma.verificationToken.delete(...)
//     return row.identifier
//
// It passes every sequential test anybody writes. Two requests arriving
// together both pass the findUnique, both delete, and both sign in - once for
// the person who asked and once for whoever else has the URL. None of the ways
// that happens are exotic: a mail forwarded to a colleague, a link-preview
// fetcher that follows URLs before a human does, a phone retrying a tap on a
// bad connection.
//
// `deleteMany` with the whole condition in its WHERE is ONE statement. The row
// is matched and removed in the same breath, so the loser of a race matches
// nothing rather than matching a row that is about to disappear. PostgreSQL
// reports how many rows it actually removed, and that count IS the answer to
// "did I win?".
//
// It is proven by tests/db/magic-link.test.ts firing ten concurrent
// consumptions and requiring exactly one to succeed, and by an ablation in
// REPORT-FW22.txt showing the read-then-delete version failing that test.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/client';

/**
 * How long a sign-in link lives.
 *
 * FIFTEEN MINUTES, and the reasoning rather than a number somebody picked.
 * The link is requested and used within one interaction: a person taps
 * "envoyer le lien", switches to their mail app and taps the link. Anything
 * beyond a few minutes is a window in which a forwarded or intercepted mail
 * is still a working key to somebody's record of where they worked.
 *
 * It is longer than the interaction needs because mail is not instant - a
 * greylisting provider can hold a message for several minutes, and a link
 * that expires before it arrives is a product that does not work.
 */
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/** Bytes of entropy in the token that travels in the email. */
const TOKEN_BYTES = 32;

export interface IssuedMagicLink {
  /** The secret, which exists only in the email. Never stored. */
  readonly token: string;
  readonly expires: Date;
}

/**
 * Hash what is stored.
 *
 * THE TABLE MUST NOT BE A LIST OF VALID LINKS. A backup, a support query or a
 * leaked dump would otherwise let the reader sign in as every person with an
 * unexpired link. SHA-256 with no salt is right here and would be wrong for a
 * password: the input is 32 random bytes, so there is no dictionary to attack
 * and no work factor worth paying - what is being defended against is reading
 * the table, not guessing the token.
 */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a token for an address.
 *
 * IT DOES NOT CHECK WHETHER THE ADDRESS IS REGISTERED, deliberately. That
 * check is what makes a sign-in form an account-enumeration oracle, and AC2
 * requires the response to be identical either way. Whether a user row exists
 * is decided at consumption, out of sight of the caller.
 */
export async function issueMagicLink(email: string): Promise<IssuedMagicLink> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expires = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  // A previous unused link for the same address is replaced rather than left
  // alive. Two working links for one person is two chances for the older one
  // to be the one that leaks, and a reader who asks again has told us the
  // first did not reach them.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  await prisma.verificationToken.create({
    data: { identifier: email, token: hash(token), expires },
  });

  return { token, expires };
}

/**
 * Consume a token. Returns the address on success, null on every failure.
 *
 * ONE STATEMENT. See the header: the condition that decides whether the token
 * is valid is inside the same WHERE that removes it, so two callers cannot
 * both be told yes. `count` is PostgreSQL reporting what it actually deleted.
 *
 * NULL FOR EVERY FAILURE, with no distinction between "no such token",
 * "expired" and "wrong address". A caller that could tell those apart would
 * hand the same power to anybody probing the endpoint.
 */
export async function consumeMagicLink(email: string, token: string): Promise<string | null> {
  const { count } = await prisma.verificationToken.deleteMany({
    where: {
      identifier: email,
      token: hash(token),
      expires: { gt: new Date() },
    },
  });

  if (count === 0) {
    // An expired row for this address is swept on the way out. Otherwise the
    // table accumulates a record of when somebody tried to sign in and
    // failed, kept for no purpose - which is the opposite of what
    // /confidentialite says this product does with data it does not need.
    await prisma.verificationToken.deleteMany({
      where: { identifier: email, expires: { lte: new Date() } },
    });

    return null;
  }

  return email;
}

/**
 * Compare two tokens without leaking how far they matched.
 *
 * Not used by consumeMagicLink - the database does that comparison - but the
 * refresh-token path in increment 3 needs it, and a second hand-rolled
 * comparison is how one of them ends up using `===`.
 */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
