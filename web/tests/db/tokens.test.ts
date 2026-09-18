// web/tests/db/tokens.test.ts
//
// FW22 increment 3: the opaque, revocable token pair.
//
// WHY ROWS RATHER THAN A JWT, asserted here rather than argued in a comment.
// SPEC 10: "the refresh token is only invalidated by sign-out, account
// deletion, or a server-side revoke." A self-contained token carrying claims
// cannot be withdrawn - it stays valid until it expires, whatever the server
// decides in between - so that sentence would be a promise the architecture
// cannot keep, and FW26's deletion path is where it would be discovered. The
// tests below revoke and then assert the token stops working, which is the
// property a signature cannot have.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  issueTokenPair,
  resolveAccessToken,
  revokeAllSessions,
  revokeSession,
  rotateRefreshToken,
} from '@/lib/auth/tokens';

let userId = '';
let otherId = '';

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: 'jeton@example.com' } })).id;
  otherId = (await prisma.user.create({ data: { email: 'autre@example.com' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('issuing a pair', () => {
  it('returns two opaque tokens and stores neither', async () => {
    const pair = await issueTokenPair(userId);

    expect(pair.accessToken).not.toBe('');
    expect(pair.refreshToken).not.toBe('');
    expect(pair.accessToken).not.toBe(pair.refreshToken);

    const stored = await prisma.sessionToken.findMany();

    expect(stored).toHaveLength(2);

    for (const row of stored) {
      expect(row.tokenHash).not.toBe(pair.accessToken);
      expect(row.tokenHash).not.toBe(pair.refreshToken);
      expect(row.tokenHash).toHaveLength(64);
    }
  });

  it('gives each token the lifetime its module states, not a typed number', async () => {
    // R171: read the constant, never a literal that happens to match today.
    const before = Date.now();

    await issueTokenPair(userId);

    const access = await prisma.sessionToken.findFirstOrThrow({ where: { kind: 'ACCESS' } });
    const refresh = await prisma.sessionToken.findFirstOrThrow({ where: { kind: 'REFRESH' } });

    expect(access.expiresAt.getTime() - before).toBeGreaterThan(ACCESS_TTL_MS - 5_000);
    expect(access.expiresAt.getTime() - before).toBeLessThanOrEqual(ACCESS_TTL_MS + 5_000);
    expect(refresh.expiresAt.getTime() - before).toBeGreaterThan(REFRESH_TTL_MS - 5_000);

    // THE ACCESS TOKEN IS MUCH SHORTER THAN THE REFRESH TOKEN. If they ever
    // converge, the pair has stopped being a pair and the short-lived half is
    // no longer limiting anything.
    expect(ACCESS_TTL_MS * 10).toBeLessThan(REFRESH_TTL_MS);
  });

  it('resolves the access token to its user', async () => {
    const pair = await issueTokenPair(userId);

    expect(await resolveAccessToken(pair.accessToken)).toEqual({
      userId,
      sessionId: pair.sessionId,
    });
  });

  it('refuses an access token nobody issued', async () => {
    expect(await resolveAccessToken('inventé')).toBeNull();
  });

  it('refuses an expired access token', async () => {
    const pair = await issueTokenPair(userId);

    await prisma.sessionToken.updateMany({
      where: { kind: 'ACCESS' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    expect(await resolveAccessToken(pair.accessToken)).toBeNull();
  });
});

describe('rotation', () => {
  it('exchanges a refresh token for a new pair', async () => {
    const first = await issueTokenPair(userId);
    const second = await rotateRefreshToken(first.refreshToken);

    expect(second).not.toBeNull();
    expect(second?.refreshToken).not.toBe(first.refreshToken);
    expect(second?.accessToken).not.toBe(first.accessToken);
    // THE SESSION SURVIVES THE ROTATION. Rotating is not signing in again:
    // SPEC 10 says a daily-use app must not demand a login every session, and
    // a new session per refresh would lose the revocation history.
    expect(second?.sessionId).toBe(first.sessionId);
  });

  it('kills the old refresh token as it issues the new one', async () => {
    const first = await issueTokenPair(userId);

    await rotateRefreshToken(first.refreshToken);

    expect(await rotateRefreshToken(first.refreshToken)).toBeNull();
  });

  it('kills the old ACCESS token too', async () => {
    // Otherwise a captured access token outlives the rotation that was
    // supposed to replace it, and the short lifetime stops being a bound.
    const first = await issueTokenPair(userId);

    await rotateRefreshToken(first.refreshToken);

    expect(await resolveAccessToken(first.accessToken)).toBeNull();
  });

  it('refuses a refresh token nobody issued', async () => {
    expect(await rotateRefreshToken('inventé')).toBeNull();
  });
});

describe('REUSE DETECTION: a replayed refresh token kills the whole chain', () => {
  // THE POLICY, AND WHY. A consumed refresh token presented a second time
  // means it was captured: the legitimate client has already moved on to the
  // successor and has no reason to send the old one again. The server cannot
  // tell which of the two holders is the thief, so it trusts neither and ends
  // the session. The real user signs in again with an email they control;
  // the thief is left with nothing.
  //
  // THE ALTERNATIVE - refusing only the replayed token - leaves the thief's
  // stolen successor working, which is the outcome the detection exists to
  // prevent.
  //
  // IT IS A FOURTH WAY A SESSION ENDS, beyond SPEC 10's three (sign-out,
  // account deletion, server-side revoke). Recorded in REPORT-FW22.txt as a
  // deviation, because SPEC's sentence is about a user's convenience and this
  // is about a captured credential.

  it('revokes the session when a consumed refresh token comes back', async () => {
    const first = await issueTokenPair(userId);
    const second = await rotateRefreshToken(first.refreshToken);

    expect(second).not.toBeNull();

    // The thief replays the token they captured before the rotation.
    expect(await rotateRefreshToken(first.refreshToken)).toBeNull();

    // AND THE HONEST CLIENT'S CURRENT TOKENS ARE DEAD TOO. That is the point:
    // half a revocation leaves the thief holding a working credential.
    expect(await resolveAccessToken(second?.accessToken ?? '')).toBeNull();
    expect(await rotateRefreshToken(second?.refreshToken ?? '')).toBeNull();
  });

  it('records WHY the session ended, so the answer is a fact', async () => {
    const first = await issueTokenPair(userId);

    await rotateRefreshToken(first.refreshToken);
    await rotateRefreshToken(first.refreshToken);

    const session = await prisma.deviceSession.findUniqueOrThrow({
      where: { id: first.sessionId },
    });

    expect(session.revokedAt).not.toBeNull();
    expect(session.revokedReason).toBe('TOKEN_REPLAYED');
  });

  it('leaves another device signed in', async () => {
    // A captured token on one phone must not sign the person out of their
    // tablet. The session is the unit, not the account.
    const phone = await issueTokenPair(userId);
    const tablet = await issueTokenPair(userId);

    await rotateRefreshToken(phone.refreshToken);
    await rotateRefreshToken(phone.refreshToken);

    expect(await resolveAccessToken(tablet.accessToken)).toEqual({
      userId,
      sessionId: tablet.sessionId,
    });
  });
});

describe('revocation', () => {
  it('ends one session and leaves the others alive', async () => {
    const phone = await issueTokenPair(userId);
    const tablet = await issueTokenPair(userId);

    await revokeSession(phone.sessionId, 'SIGNED_OUT');

    expect(await resolveAccessToken(phone.accessToken)).toBeNull();
    expect(await rotateRefreshToken(phone.refreshToken)).toBeNull();
    expect(await resolveAccessToken(tablet.accessToken)).not.toBeNull();
  });

  it('ends every session of one user and nobody else', async () => {
    const phone = await issueTokenPair(userId);
    const tablet = await issueTokenPair(userId);
    const stranger = await issueTokenPair(otherId);

    await revokeAllSessions(userId, 'REVOKED_ALL');

    expect(await resolveAccessToken(phone.accessToken)).toBeNull();
    expect(await resolveAccessToken(tablet.accessToken)).toBeNull();
    // TENANCY. Revoking one person's sessions must not touch another's, and
    // asserting it here is cheaper than discovering it from a support ticket.
    expect(await resolveAccessToken(stranger.accessToken)).not.toBeNull();
  });

  it('is what makes SPEC 10 deliverable: deleting the account ends the session', async () => {
    // The sentence this whole design exists for. A JWT would still be valid
    // here, because nothing can un-sign it.
    const pair = await issueTokenPair(userId);

    await prisma.user.delete({ where: { id: userId } });

    expect(await resolveAccessToken(pair.accessToken)).toBeNull();
    expect(await prisma.deviceSession.count({ where: { userId } })).toBe(0);
  });
});
