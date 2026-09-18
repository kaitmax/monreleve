// web/lib/auth/tokens.ts
//
// The token pair the Android client holds. FW22 increment 3.
//
// ============================================================================
// OPAQUE AND REVOCABLE BY ROW, WHICH IS A SPEC REQUIREMENT AND NOT A TASTE
// ============================================================================
//
// SPEC 10: "the refresh token is only invalidated by sign-out, account
// deletion, or a server-side revoke."
//
// A JWT cannot deliver that sentence. A self-contained token carrying claims
// stays valid until it expires, whatever the server decides in between -
// there is no un-signing. "Invalidated by account deletion" would then be a
// promise the architecture cannot keep, and FW26's deletion path is exactly
// where it would be found out, on a product whose argument is that it never
// claims more than the record supports.
//
// So a token here is 32 random bytes with no meaning of its own. Everything
// about it - who it belongs to, when it dies, whether it still counts - is a
// row. The cost is one indexed lookup per request; the benefit is that
// `DELETE` is a complete answer.
//
// THE HASH IS STORED, NEVER THE TOKEN, for the reason the sign-in link is
// hashed: this table must not be a list of working credentials for whoever
// reads a backup.

import { createHash, randomBytes } from 'node:crypto';
import type { SessionRevocation } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * How long an access token lives.
 *
 * FIFTEEN MINUTES. It is presented on every request, so it is the credential
 * most likely to be captured - in a log, a proxy, a crash report - and its
 * lifetime is the window in which a capture is worth anything. Short enough
 * that a leaked token is stale before it is useful; long enough that a
 * foreground session is not spending a round trip on refresh every minute.
 */
export const ACCESS_TTL_MS = 15 * 60 * 1000;

/**
 * How long a refresh token lives.
 *
 * NINETY DAYS, and it is SPEC 10 that sets the shape: "A daily-use tax app
 * must not demand a login every session." Rotation renews it on every use, so
 * somebody who opens the app weekly never signs in again; ninety days is what
 * happens to somebody who stops using it entirely, and asking them to sign in
 * again after a quarter of silence is reasonable.
 */
export const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const TOKEN_BYTES = 32;

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionId: string;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
}

export interface ResolvedToken {
  readonly userId: string;
  readonly sessionId: string;
}

function mint(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Unsalted SHA-256: the input is 32 random bytes, so there is nothing to guess. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function writePair(sessionId: string, now: Date): Promise<TokenPair> {
  const accessToken = mint();
  const refreshToken = mint();
  const accessExpiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);

  await prisma.sessionToken.createMany({
    data: [
      { sessionId, kind: 'ACCESS', tokenHash: hash(accessToken), expiresAt: accessExpiresAt },
      { sessionId, kind: 'REFRESH', tokenHash: hash(refreshToken), expiresAt: refreshExpiresAt },
    ],
  });

  return { accessToken, refreshToken, sessionId, accessExpiresAt, refreshExpiresAt };
}

/** Open a session for one device and issue its first pair. */
export async function issueTokenPair(userId: string, deviceId?: string): Promise<TokenPair> {
  const session = await prisma.deviceSession.create({
    data: { userId, deviceId: deviceId ?? null },
  });

  return writePair(session.id, new Date());
}

/**
 * Who is this access token, if anyone.
 *
 * THE SESSION IS CHECKED, NOT ONLY THE TOKEN. A revoked session must kill
 * every token inside it in one write, so the question "is this still valid?"
 * has to look at the session row - otherwise revocation would mean finding
 * and expiring each token individually, and the one it missed is the one that
 * matters.
 */
export async function resolveAccessToken(token: string): Promise<ResolvedToken | null> {
  const row = await prisma.sessionToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { session: true },
  });

  if (row === null || row.kind !== 'ACCESS') {
    return null;
  }

  if (row.consumedAt !== null || row.expiresAt <= new Date()) {
    return null;
  }

  if (row.session.revokedAt !== null) {
    return null;
  }

  return { userId: row.session.userId, sessionId: row.sessionId };
}

/** End one session, and every token in it, in one write. */
export async function revokeSession(
  sessionId: string,
  reason: SessionRevocation,
): Promise<void> {
  await prisma.deviceSession.updateMany({
    // Already-revoked sessions keep their ORIGINAL reason. The first answer
    // to "why did this end" is the true one; overwriting it with a later
    // sign-out would erase a TOKEN_REPLAYED, which is the one worth keeping.
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/** End every session a person has. Sign-out-everywhere, and FW26's deletion. */
export async function revokeAllSessions(
  userId: string,
  reason: SessionRevocation,
): Promise<void> {
  await prisma.deviceSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/**
 * Exchange a refresh token for a new pair.
 *
 * ============================================================================
 * REUSE DETECTION, AND THE POLICY IS: THE WHOLE SESSION DIES
 * ============================================================================
 *
 * A consumed refresh token presented a second time means it was CAPTURED. The
 * legitimate client has already moved on to the successor and has no reason to
 * send the old one again; the only party still holding it is somebody who
 * copied it before the rotation.
 *
 * The server cannot tell which of the two holders is the thief - both present
 * a valid-looking secret - so it trusts NEITHER and ends the session. The real
 * user signs in again through an email they control, which is a small cost.
 * The thief is left with nothing, which is the point.
 *
 * REFUSING ONLY THE REPLAYED TOKEN would be the gentler-looking option and is
 * the wrong one: the thief's stolen SUCCESSOR keeps working, which is exactly
 * the outcome the detection exists to prevent.
 *
 * IT IS A FOURTH WAY A SESSION ENDS, beyond SPEC 10's three. SPEC's sentence
 * is about a daily-use app not nagging its user; this is about a credential
 * known to be in two hands. Recorded in REPORT-FW22.txt rather than resolved
 * quietly.
 *
 * THE CONSUMPTION IS ONE STATEMENT, for magic-link reasons: `updateMany` with
 * `consumedAt: null` in its WHERE means two concurrent rotations cannot both
 * be told yes, and the count is the answer.
 */
export async function rotateRefreshToken(token: string): Promise<TokenPair | null> {
  const tokenHash = hash(token);

  const row = await prisma.sessionToken.findUnique({
    where: { tokenHash },
    include: { session: true },
  });

  if (row === null || row.kind !== 'REFRESH') {
    return null;
  }

  if (row.session.revokedAt !== null) {
    return null;
  }

  if (row.consumedAt !== null) {
    // THE REPLAY. Everything in this session stops working.
    await revokeSession(row.sessionId, 'TOKEN_REPLAYED');

    return null;
  }

  if (row.expiresAt <= new Date()) {
    return null;
  }

  const now = new Date();

  // ONE STATEMENT, and the count decides. A second rotation arriving at the
  // same moment finds consumedAt already set and matches nothing.
  const { count } = await prisma.sessionToken.updateMany({
    where: { tokenHash, consumedAt: null },
    data: { consumedAt: now },
  });

  if (count === 0) {
    return null;
  }

  // The access token issued alongside it dies with it. Otherwise a captured
  // access token outlives the rotation meant to replace it, and its short
  // lifetime stops bounding anything.
  await prisma.sessionToken.updateMany({
    where: { sessionId: row.sessionId, kind: 'ACCESS', consumedAt: null },
    data: { consumedAt: now },
  });

  await prisma.deviceSession.update({
    where: { id: row.sessionId },
    data: { lastUsedAt: now },
  });

  return writePair(row.sessionId, now);
}
