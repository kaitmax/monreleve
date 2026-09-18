// web/tests/db/bearer.test.ts
//
// FW22 increment 4: /api/v1 resolves the caller from a bearer token, and from
// nothing else.
//
// R198 - THE ERROR THAT CROSSES THE BOUNDARY NAMES WHICH RULE FIRED, and this
// file is where that is pinned down. The codes are the Android client's
// contract: they decide whether it refreshes silently or sends the person
// back to the sign-in screen, so collapsing them into one "unauthorized"
// would make a correct client impossible to write.
//
// THIS IS THE OPPOSITE CALL FROM /api/v1/auth/magic-link, ON PURPOSE. There,
// telling the caller which rule fired IS the vulnerability, so every outcome
// returns the same 202. Here the caller is holding a credential we issued,
// and what they are entitled to know is precisely what they need to act.
// R198 is not "always say more"; it is "the boundary decides, and the
// decision is deliberate".
//
// THE DISTINCTION BETWEEN unknown AND expired LEAKS ALMOST NOTHING and is
// worth the trade: a token is 32 random bytes, so an attacker cannot guess
// one to probe with, and a legitimate client that cannot tell "refresh me"
// from "sign in again" will either nag its user or loop forever.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair, revokeSession, rotateRefreshToken } from '@/lib/auth/tokens';
import { AUTH_CODES, authenticate } from '@/lib/auth/bearer';

let userId = '';

function bearer(token: string, init: RequestInit = {}): Request {
  return new Request('https://monreleve.ch/api/v1/probe', {
    headers: { authorization: `Bearer ${token}` },
    ...init,
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: 'porteur@example.com' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a valid bearer token', () => {
  it('resolves to the user and the session it belongs to', async () => {
    const pair = await issueTokenPair(userId);
    const result = await authenticate(bearer(pair.accessToken));

    expect(result).toEqual({ ok: true, userId, sessionId: pair.sessionId });
  });
});

describe('R198: every refusal names its own rule, and the codes are distinct', () => {
  it('refuses a request with no Authorization header', async () => {
    const result = await authenticate(new Request('https://monreleve.ch/api/v1/probe'));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.missingToken });
  });

  it.each([
    ['Bearer', 'the scheme alone'],
    ['Basic abc', 'the wrong scheme'],
    ['abc', 'no scheme'],
    ['Bearer a b', 'two values'],
  ])('refuses a malformed header: %s (%s)', async (header) => {
    const result = await authenticate(
      new Request('https://monreleve.ch/api/v1/probe', { headers: { authorization: header } }),
    );

    expect(result).toEqual({ ok: false, code: AUTH_CODES.malformedAuthorization });
  });

  it('refuses a token nobody issued', async () => {
    const result = await authenticate(bearer('jamais-emis'));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.unknownToken });
  });

  it('refuses an expired token, and says expired rather than unknown', async () => {
    // THE CLIENT ACTS ON THIS ONE. "Expired" means refresh silently; the
    // person never sees it. Reporting it as unknown would send them to a
    // sign-in screen they did not need.
    const pair = await issueTokenPair(userId);

    await prisma.sessionToken.updateMany({
      where: { kind: 'ACCESS' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const result = await authenticate(bearer(pair.accessToken));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.expiredToken });
  });

  it('refuses a revoked session, and says revoked rather than expired', async () => {
    // AND THIS ONE IS THE OTHER BRANCH. "Revoked" means the refresh token is
    // dead too, so the only way back is a new sign-in. A client told
    // "expired" here would refresh, be refused, and loop.
    const pair = await issueTokenPair(userId);

    await revokeSession(pair.sessionId, 'SIGNED_OUT');

    const result = await authenticate(bearer(pair.accessToken));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.revokedSession });
  });

  it('refuses an access token that rotation replaced', async () => {
    const pair = await issueTokenPair(userId);

    await rotateRefreshToken(pair.refreshToken);

    const result = await authenticate(bearer(pair.accessToken));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.rotatedToken });
  });

  it('refuses a REFRESH token presented as a bearer token', async () => {
    // A refresh token is not an access token and must not be usable as one.
    // Without this, the long-lived credential would be accepted on every
    // request and the short lifetime of the access token would bound nothing.
    const pair = await issueTokenPair(userId);
    const result = await authenticate(bearer(pair.refreshToken));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.unknownToken });
  });

  it('keeps every code distinct, because a client branches on them', () => {
    const codes = Object.values(AUTH_CODES);

    expect(new Set(codes).size).toBe(codes.length);

    // ASCII AND SNAKE_CASE. These are a contract with a client in the field:
    // they are never translated and never reworded, which is exactly why the
    // French lives in a different field.
    for (const code of codes) {
      expect(code).toMatch(/^[a-z][a-z_]*[a-z]$/);
    }
  });
});

describe('TENANCY: identity comes from the token and from nowhere else', () => {
  // THE PLANTS. R180: each one is verified to have landed before its result is
  // read - a plant that silently failed to reach the request would produce a
  // passing test and be recorded as proof.

  it('ignores a userId planted in the request BODY', async () => {
    const victim = await prisma.user.create({ data: { email: 'victime@example.com' } });
    const pair = await issueTokenPair(userId);

    const body = JSON.stringify({ userId: victim.id, note: 'planted' });

    const request = bearer(pair.accessToken, {
      method: 'POST',
      body,
      headers: { authorization: `Bearer ${pair.accessToken}`, 'content-type': 'application/json' },
    });

    // VERIFY THE PLANT LANDED (R180): the body really does carry the other
    // user's id, so a pass below means it was ignored rather than absent.
    const sent = await request.clone().json();

    expect(sent).toMatchObject({ userId: victim.id });
    expect(victim.id).not.toBe(userId);

    const result = await authenticate(request);

    expect(result).toEqual({ ok: true, userId, sessionId: pair.sessionId });
  });

  it('ignores a userId planted in the QUERY STRING', async () => {
    const victim = await prisma.user.create({ data: { email: 'victime2@example.com' } });
    const pair = await issueTokenPair(userId);

    const url = new URL('https://monreleve.ch/api/v1/probe');

    url.searchParams.set('userId', victim.id);

    const request = new Request(url, {
      headers: { authorization: `Bearer ${pair.accessToken}` },
    });

    // VERIFY THE PLANT LANDED (R180).
    expect(new URL(request.url).searchParams.get('userId')).toBe(victim.id);
    expect(victim.id).not.toBe(userId);

    const result = await authenticate(request);

    expect(result).toEqual({ ok: true, userId, sessionId: pair.sessionId });
  });

  it('ignores a userId planted in a HEADER', async () => {
    // The third channel, and the one a reverse proxy might plausibly add.
    const victim = await prisma.user.create({ data: { email: 'victime3@example.com' } });
    const pair = await issueTokenPair(userId);

    const request = new Request('https://monreleve.ch/api/v1/probe', {
      headers: {
        authorization: `Bearer ${pair.accessToken}`,
        'x-user-id': victim.id,
      },
    });

    expect(request.headers.get('x-user-id')).toBe(victim.id);

    const result = await authenticate(request);

    expect(result).toEqual({ ok: true, userId, sessionId: pair.sessionId });
  });

  it('refuses when the ONLY identity offered is a planted one', async () => {
    // THE NON-VACUITY HALF. The three tests above would all pass against a
    // guard that ignored everything and returned the token's user - including
    // one that ignored the token too. This asserts that removing the token
    // removes the identity: the planted id alone gets nothing.
    const victim = await prisma.user.create({ data: { email: 'victime4@example.com' } });

    const url = new URL('https://monreleve.ch/api/v1/probe');

    url.searchParams.set('userId', victim.id);

    const result = await authenticate(new Request(url, { headers: { 'x-user-id': victim.id } }));

    expect(result).toEqual({ ok: false, code: AUTH_CODES.missingToken });
  });
});
