// web/lib/auth/web-session.ts
//
// The website's session: one row, one credential, a short life. FW-WEB-ACCOUNT
// (R899).
//
// ============================================================================
// WHY THIS IS NOT tokens.ts
// ============================================================================
//
// The Android client holds a bearer PAIR: an access token it presents on every
// request and a refresh token that rotates for ninety days (SPEC 10). A browser
// holding the account area open needs none of that. It holds ONE opaque value
// in an HttpOnly cookie, scoped to the account path, and that value dies on
// sign-out or after WEB_SESSION_TTL_MS, whichever comes first. There is no
// refresh and no rotation, so there is nothing to replay and no chain to end.
//
// It is the SAME DESIGN in every respect that matters, and deliberately:
//
//   - opaque, not signed. A self-contained value would stay valid until it
//     expired whatever the server decided; SPEC 10's "Tokens are opaque rows,
//     not signed claims" holds here for the same reason. `revokedAt` is a
//     complete answer to sign-out.
//   - hashed at rest. The table must not be a list of working credentials for
//     whoever reads a backup.
//   - server-assigned. Every timestamp is this server's clock; nothing a
//     request carries reaches a column.
//
// ============================================================================
// SESSION FIXATION: A NEW ROW ON EVERY SIGN-IN
// ============================================================================
//
// `openWebSession` always INSERTS. It never adopts a value the browser already
// holds, and nothing in this product creates a session before the code has
// been proven - so an attacker who plants a cookie in somebody's browser has
// planted a value no row will ever match. tests/db/web-session.test.ts signs
// the same person in twice and requires two different rows and two different
// values.

import { createHash, randomBytes } from 'node:crypto';
import type { SessionRevocation } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * How long a web session lives, from the instant of sign-in. STATED AS A
 * VALUE AND ASSERTED (R345), never left to a default.
 *
 * THIRTY MINUTES, ABSOLUTE, and the reasoning rather than a number somebody
 * picked. The account area is read-only: a person signs in to read a year's
 * figures and take a PDF or a CSV away, which is minutes of work. Anything
 * longer is a window in which a browser left open on a shared computer is a
 * working key to somebody's record of where they worked. It does not slide:
 * a session that renewed itself on every page would have no bound at all.
 *
 * THREE PLACES HOLD THIS NUMBER, AND TESTS TIE THEM: this constant, the
 * cookie's Max-Age (lib/web-account/cookie.ts derives it from here), and the
 * WebSession_short_life CHECK in the migration, which
 * tests/db/web-session.test.ts reads back from the catalogue.
 */
export const WEB_SESSION_TTL_MS = 30 * 60 * 1000;

/** Bytes of entropy in the cookie's value. The same as every other credential here. */
const TOKEN_BYTES = 32;

function mint(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Unsalted SHA-256, hex: the input is 32 random bytes, so there is nothing to guess. */
export function webSessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface OpenedWebSession {
  /** The cookie's value. Exists only in the Set-Cookie header; never stored. */
  readonly token: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
}

/**
 * Open a session for a person who has just proven their address.
 *
 * BOTH STAMPS FROM ONE INSTANT. The database's own default would read the
 * database's clock while `expiresAt` read this server's; a few hundred
 * milliseconds of skew would then put a row past the thirty-minute CHECK, or
 * under it by an amount nobody chose.
 */
export async function openWebSession(userId: string, now: Date = new Date()): Promise<OpenedWebSession> {
  const token = mint();
  const expiresAt = new Date(now.getTime() + WEB_SESSION_TTL_MS);

  const row = await prisma.webSession.create({
    data: { userId, tokenHash: webSessionHash(token), createdAt: now, expiresAt },
    select: { id: true },
  });

  return { token, sessionId: row.id, expiresAt };
}

/**
 * Why a cookie was refused. FOR THE SERVER, NEVER FOR THE PERSON.
 *
 * R210's rule: the caller holding a dead cookie is unauthenticated, and is
 * told one sentence whatever fired. These exist so a test and a log can tell
 * the cases apart.
 */
export type WebSessionDenial = 'unknown' | 'expired' | 'revoked';

export type WebSessionResolution =
  | { readonly ok: true; readonly userId: string; readonly sessionId: string }
  | { readonly ok: false; readonly denial: WebSessionDenial };

/**
 * Who holds this cookie value, and if nobody, why not.
 *
 * REVOCATION IS CHECKED BEFORE EXPIRY, as in tokens.ts: a value both revoked
 * and expired reports the more serious fact.
 */
export async function resolveWebSession(
  token: string,
  now: Date = new Date(),
): Promise<WebSessionResolution> {
  const row = await prisma.webSession.findUnique({
    where: { tokenHash: webSessionHash(token) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });

  if (row === null) return { ok: false, denial: 'unknown' };
  if (row.revokedAt !== null) return { ok: false, denial: 'revoked' };
  if (row.expiresAt <= now) return { ok: false, denial: 'expired' };

  return { ok: true, userId: row.userId, sessionId: row.id };
}

/**
 * End the session this value belongs to. Idempotent, and quiet about an
 * unknown value: signing out a dead or forged cookie is a no-op, not an error
 * that would confirm whether it ever existed.
 *
 * An already-revoked row keeps its ORIGINAL reason, as DeviceSession does: the
 * first answer to "why did this end" is the true one.
 */
export async function revokeWebSession(
  token: string,
  reason: SessionRevocation,
  now: Date = new Date(),
): Promise<void> {
  await prisma.webSession.updateMany({
    where: { tokenHash: webSessionHash(token), revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
}
