// web/tests/db/container-auth.test.ts
//
// ============================================================================
// RULING R249: THE AUTH ROUND TRIP, OVER HTTP, AGAINST THE RUNNING IMAGE
// ============================================================================
//
// tests/db/auth-round-trip.test.ts already proves the flow end to end by
// DRIVING THE ROUTE HANDLERS in this process (R204). That is the right unit
// for "the modules are wired": it catches a link addressing a route nobody
// wrote, which is the defect it was written for.
//
// It cannot prove the DEPLOYED artefact does the same thing, and FW28 has now
// measured why that is a different claim. The handlers under `next start` and
// the handlers inside the image differ in the standalone bundle they are
// loaded from, the address the server is bound to, the timezone the process
// resolves, and - as increment 3 found the expensive way - in what
// `request.nextUrl.origin` evaluates to. An in-process test cannot see any of
// that, because there is no process boundary and no network.
//
// So this drives the same flow over real HTTP against a real container.
//
// ============================================================================
// THE SEAM, STATED RATHER THAN PAPERED OVER
// ============================================================================
//
// One step is NOT observable here, and the reason is a guard that must not be
// weakened: lib/alerts/mailer.ts prints an unsent message only when
// NODE_ENV === 'development', because "in production it means sign-in links
// in a production log". The image is NODE_ENV=production, correctly, so the
// message cannot be read out of `docker logs`.
//
// The round trip is therefore proven in two halves, each real:
//
//   HALF A  The container's own magic-link endpoint is driven over HTTP and
//           must answer 202 AND leave a VerificationToken row behind. That
//           proves the container issues links; what it does not give us is
//           the plaintext token, which is hashed before storage on purpose.
//   HALF B  A link is minted into the SAME database by this process - which
//           is exactly what the mail would have delivered - and the
//           CONTAINER's callback consumes it over HTTP.
//
// What is not claimed: that the token the container issued in half A is the
// one consumed in half B. Nothing short of reading the container's memory or
// weakening the production-log guard could establish that, and the in-process
// round trip already owns it.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueMagicLink } from '@/lib/auth/magic-link';
import { instanceRefusal } from '@/lib/content/identity';

/**
 * Where the container is listening. Unset means this file has nothing to talk
 * to, and `pnpm test:db` skips it.
 *
 * R169'S COROLLARY MAKES THE SKIP SAFE: scripts/container-e2e.mjs asserts a
 * non-zero passing count from this file, so "skipped everywhere" cannot read
 * as "passing everywhere". An absence assertion is only meaningful once
 * presence is established.
 */
const BASE = process.env.CONTAINER_BASE_URL;

const EMAIL = 'container-auth@example.com';

interface Pair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Every response this file has seen, so the cookie census can be total. */
const seen: Response[] = [];

async function call(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, { ...init, redirect: 'manual' });

  seen.push(response);

  return response;
}

async function pairFrom(response: Response): Promise<Pair> {
  const body = (await response.json()) as Pair;

  expect(body.accessToken, 'no access token in the answer').toBeTruthy();
  expect(body.refreshToken, 'no refresh token in the answer').toBeTruthy();

  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}

function bearer(token: string): RequestInit {
  return { method: 'POST', headers: { authorization: `Bearer ${token}` } };
}

/** Sign in, the way the mail would have let somebody sign in. */
async function signIn(): Promise<Pair> {
  const issued = await issueMagicLink(EMAIL);
  const token = encodeURIComponent(issued.token);
  const response = await call(
    `/api/v1/auth/callback?token=${token}&email=${encodeURIComponent(EMAIL)}`,
  );

  expect(response.status, 'the container refused a freshly minted link').toBe(200);

  return pairFrom(response);
}

describe.skipIf(BASE === undefined)('R249: the auth round trip, over HTTP, against the image', () => {
  beforeAll(async () => {
    // R169: ESTABLISH WHAT IS ANSWERING BEFORE ASSERTING ANYTHING ABOUT IT.
    // Every assertion below would hold against a server that 404s everything
    // if it were written as an absence check, and the measured cost of not
    // doing this was 91 tests passing against another product.
    const health = await fetch(`${String(BASE)}/api/health`);
    const body = (await health.json()) as { service?: string; instance?: unknown };

    expect(health.status).toBe(200);
    expect(body.service, `${String(BASE)} answered /api/health but did not name this product`).toBe(
      'monreleve',
    );

    // R301: the right PRODUCT is not yet the right INSTANCE. scripts/container-
    // e2e.mjs starts this container with a per-run FRONTALIER_INSTANCE_ID and
    // hands this process the same value; a sibling container of the same product
    // (which would pass the check above) does not echo it and is refused by
    // name - the FW33 case where a sibling's AUTH_SECRET 503-ed every token.
    const mismatch = instanceRefusal(process.env.FRONTALIER_INSTANCE_ID, body.instance);

    expect(mismatch, mismatch ?? 'instance matches').toBeNull();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.verificationToken.deleteMany({ where: { identifier: EMAIL } });
    seen.length = 0;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it('HALF A: the container issues a link of its own', async () => {
    const response = await call('/api/v1/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL }),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status, 'the container would not issue a link').toBe(202);

    // THE POSITIVE SIGNAL (R133). A 202 alone is satisfied by a handler that
    // accepts the request and does nothing - which is exactly what an
    // account-enumeration-proof endpoint is SUPPOSED to look like from
    // outside. The row is the evidence that work happened.
    expect(
      await prisma.verificationToken.count({ where: { identifier: EMAIL } }),
      'the container answered 202 and stored no token',
    ).toBe(1);

    // AND IT CREATED NO ACCOUNT. Asking for a link must not fill the user
    // table with addresses nobody controls.
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(0);
  });

  it('HALF B: the container consumes a link and opens a session', async () => {
    const pair = await signIn();

    // The account exists now, and not before - created at the callback.
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);

    // THE SESSION IS REAL: the bearer token opens a door, over the wire.
    const me = await call('/api/v1/me', { headers: { authorization: `Bearer ${pair.accessToken}` } });

    expect(me.status, 'the access token did not open /api/v1/me').toBe(200);
  });

  it('refuses the same link twice, across the process boundary', async () => {
    const issued = await issueMagicLink(EMAIL);
    const url = `/api/v1/auth/callback?token=${encodeURIComponent(issued.token)}&email=${encodeURIComponent(EMAIL)}`;

    expect((await call(url)).status).toBe(200);
    expect((await call(url)).status, 'a consumed link was accepted a second time').toBe(400);
  });

  it('refresh rotates, and the retired access token stops working', async () => {
    const first = await signIn();

    const rotated = await call('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: first.refreshToken }),
      headers: { 'content-type': 'application/json' },
    });

    expect(rotated.status).toBe(200);

    const second = await pairFrom(rotated);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);

    // BOTH DIRECTIONS (R196). Rotation that invalidated everything would pass
    // the first of these perfectly.
    expect((await call('/api/v1/auth/sign-out', bearer(first.accessToken))).status).toBe(401);
    expect((await call('/api/v1/auth/sign-out', bearer(second.accessToken))).status).toBe(200);
  });

  it('a REPLAYED refresh token ends the session, not just the request (R210)', async () => {
    const first = await signIn();

    const rotated = await call('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: first.refreshToken }),
      headers: { 'content-type': 'application/json' },
    });

    const second = await pairFrom(rotated);

    // The thief replays the token the victim already spent.
    const replayed = await call('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: first.refreshToken }),
      headers: { 'content-type': 'application/json' },
    });

    expect(replayed.status, 'a replayed refresh token was accepted').not.toBe(200);

    // R210's WHOLE POINT, and the half a refusal alone does not give: the
    // thief's ROTATED SUCCESSOR must stop working too. A refusal that leaves
    // the session alive means the attacker keeps their token and the victim
    // is merely inconvenienced.
    const afterReplay = await call('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: second.refreshToken }),
      headers: { 'content-type': 'application/json' },
    });

    expect(
      afterReplay.status,
      'the successor still worked after a replay - the chain did not end',
    ).not.toBe(200);
  });

  it('sign-out revokes, and the refresh token is rejected afterwards', async () => {
    const pair = await signIn();

    expect((await call('/api/v1/auth/sign-out', bearer(pair.accessToken))).status).toBe(200);

    const after = await call('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: pair.refreshToken }),
      headers: { 'content-type': 'application/json' },
    });

    expect(after.status, 'a revoked refresh token was accepted').not.toBe(200);
  });

  it('sets no cookie anywhere in the flow (D14, AC3)', async () => {
    // THE WHOLE FLOW, NOT ONE RESPONSE. D14 deleted the signed-in web area,
    // so there is no session for a cookie to carry - and the guarantee is
    // about every response, which is why every call this file makes is
    // recorded and censused here rather than spot-checked.
    // THE CENSUS IS ONLY WORTH ITS NAME IF THE FLOW IS ACTUALLY WALKED. The
    // first version called signIn() alone, recorded ONE response, and the
    // non-vacuity check below caught it: a claim about "anywhere in the flow"
    // resting on a single callback. So every step runs here.
    const pair = await signIn();

    await call('/api/v1/me', { headers: { authorization: `Bearer ${pair.accessToken}` } });

    const rotated = await call('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: pair.refreshToken }),
      headers: { 'content-type': 'application/json' },
    });

    const second = await pairFrom(rotated);

    await call('/api/v1/auth/sign-out', bearer(second.accessToken));

    // And an UNAUTHENTICATED refusal, which is the response most likely to
    // carry a session cookie in a product that had one.
    await call('/api/v1/me', { headers: { authorization: 'Bearer not-a-token' } });

    const withCookies = seen.filter((response) => response.headers.get('set-cookie') !== null);

    expect(
      withCookies.map((response) => response.url),
      'a response in the auth flow set a cookie',
    ).toEqual([]);

    // R63: the census must have had something to count.
    expect(
      seen.length,
      'no responses were recorded, so the census proves nothing',
    ).toBeGreaterThan(4);
  });
});
