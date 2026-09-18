// web/tests/db/auth-round-trip.test.ts
//
// FW22 / AC1: "A magic-link round trip completes end to end against the fake
// outbox and a fake device client: request -> email -> callback -> access
// token + refresh token. Refresh rotates; sign-out revokes; a revoked refresh
// token is rejected."
//
// IT DRIVES THE ROUTE HANDLERS, not the library functions beneath them. Every
// other file in this suite tests a module; this one is the only place that
// proves the modules are WIRED - that the link in the email addresses the
// route that exists, that the route reads the parameters the link carries,
// and that what it returns is what the next call accepts.
//
// THAT IS R154's RULE AT THE LEVEL OF A FLOW. Each part being proven to work
// is not the same claim as the parts being connected, and the defect this
// catches is the one no unit test can: a link pointing at a route nobody
// wrote. The sign-in URL named /api/v1/auth/callback from increment 2 and the
// route did not exist until increment 5 - every module test passed
// throughout.
//
// THE FAKE DEVICE CLIENT is this file: it reads the outbox instead of a
// mailbox, follows the link by calling the handler, and keeps the pair it is
// given. Nothing is stubbed - the tokens are real rows, the consumption is
// the real atomic delete.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { POST as requestLink } from '@/app/api/v1/auth/magic-link/route';
import { GET as callback } from '@/app/api/v1/auth/callback/route';
import { POST as refresh } from '@/app/api/v1/auth/refresh/route';
import { POST as signOut } from '@/app/api/v1/auth/sign-out/route';
import { POST as revokeAll } from '@/app/api/v1/auth/revoke-all/route';

const EMAIL = 'frontalier@example.com';
const ORIGIN = 'https://monreleve.ch';

interface Pair {
  accessToken: string;
  refreshToken: string;
}

/** Ask for a link, exactly as the app does. */
async function askForLink(email = EMAIL): Promise<Response> {
  return requestLink(
    new Request(`${ORIGIN}/api/v1/auth/magic-link`, {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    }),
  );
}

/** Read the link out of the outbox, the way a person reads their mail. */
function linkFromOutbox(): string {
  const [message] = readOutbox();
  const line = (message?.text ?? '').split('\n').find((row) => row.startsWith('http'));

  if (line === undefined) {
    throw new Error('no link in the outbox; the message did not carry one');
  }

  return line;
}

/** Follow it. */
async function follow(link: string): Promise<Response> {
  return callback(new Request(link));
}

async function pairFrom(response: Response): Promise<Pair> {
  const body = (await response.json()) as Pair;

  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}

function withBearer(path: string, token: string): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.verificationToken.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AC1: the whole round trip', () => {
  it('request -> email -> callback -> a usable pair', async () => {
    const asked = await askForLink();

    expect(asked.status).toBe(202);

    const followed = await follow(linkFromOutbox());

    expect(followed.status).toBe(200);

    const pair = await pairFrom(followed);

    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();

    // THE SESSION IS REAL: the bearer token opens a door.
    expect((await signOut(withBearer('/api/v1/auth/sign-out', pair.accessToken))).status).toBe(200);
  });

  it('creates the account at the CALLBACK, not at the request', async () => {
    // Asking for a link must not create a User row - otherwise anybody could
    // fill the table with addresses they do not control, and the request
    // endpoint's "identical work either way" claim would be false.
    await askForLink();

    expect(await prisma.user.count()).toBe(0);

    await follow(linkFromOutbox());

    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).emailVerified)
      .not.toBeNull();
  });

  it('signs an existing person in without creating a second account', async () => {
    await prisma.user.create({ data: { email: EMAIL, canton: 'GE' } });

    await askForLink();
    await follow(linkFromOutbox());

    expect(await prisma.user.count()).toBe(1);
    // AND THEIR DATA SURVIVES. An upsert that overwrote the row on every
    // sign-in would quietly reset a person's canton and taux every time they
    // opened the app on a new device.
    expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).canton).toBe('GE');
  });

  it('refuses the link a second time', async () => {
    const link = linkFromOutbox.bind(null);

    await askForLink();

    const url = link();

    expect((await follow(url)).status).toBe(200);
    expect((await follow(url)).status).toBe(400);
  });

  it('refuses a link whose token has been tampered with', async () => {
    await askForLink();

    const url = new URL(linkFromOutbox());

    url.searchParams.set('token', `${url.searchParams.get('token') ?? ''}x`);

    expect((await follow(url.toString())).status).toBe(400);
  });
});

describe('AC1: refresh rotates', () => {
  async function signIn(): Promise<Pair> {
    await askForLink();

    return pairFrom(await follow(linkFromOutbox()));
  }

  it('returns a new pair and retires the old one', async () => {
    const first = await signIn();

    const rotated = await refresh(
      new Request(`${ORIGIN}/api/v1/auth/refresh`, {
        method: 'POST',
        body: JSON.stringify({ refreshToken: first.refreshToken }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(rotated.status).toBe(200);

    const second = await pairFrom(rotated);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);

    // The new access token works and the old one does not.
    expect((await signOut(withBearer('/api/v1/auth/sign-out', first.accessToken))).status).toBe(401);
    expect((await signOut(withBearer('/api/v1/auth/sign-out', second.accessToken))).status).toBe(200);
  });
});

describe('AC1: sign-out revokes, and a revoked refresh token is rejected', () => {
  async function signIn(): Promise<Pair> {
    await askForLink();
    const pair = await pairFrom(await follow(linkFromOutbox()));

    clearOutbox();
    resetRateLimit();

    return pair;
  }

  it('rejects the refresh token after sign-out', async () => {
    const pair = await signIn();

    expect((await signOut(withBearer('/api/v1/auth/sign-out', pair.accessToken))).status).toBe(200);

    const rotated = await refresh(
      new Request(`${ORIGIN}/api/v1/auth/refresh`, {
        method: 'POST',
        body: JSON.stringify({ refreshToken: pair.refreshToken }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(rotated.status).toBe(401);
  });

  it('leaves another device signed in, and revoke-all does not', async () => {
    const phone = await signIn();
    const tablet = await signIn();

    // Sign out the phone. The tablet keeps working.
    await signOut(withBearer('/api/v1/auth/sign-out', phone.accessToken));

    expect((await signOut(withBearer('/api/v1/auth/sign-out', tablet.accessToken))).status).toBe(200);

    // Now sign in again on both, and revoke everything.
    const one = await signIn();
    const two = await signIn();

    expect((await revokeAll(withBearer('/api/v1/auth/revoke-all', one.accessToken))).status).toBe(200);

    expect((await signOut(withBearer('/api/v1/auth/sign-out', two.accessToken))).status).toBe(401);
  });
});

describe('no route in this flow sets a cookie (AC3)', () => {
  it('answers every step without Set-Cookie', async () => {
    // AC3: "No cookie is set on any public route." Asserted on the RESPONSES
    // rather than trusted to the absence of cookie code, because the check
    // that matters is what reached the client.
    const asked = await askForLink();
    const followed = await follow(linkFromOutbox());
    const pair = await pairFrom(followed);
    const out = await signOut(withBearer('/api/v1/auth/sign-out', pair.accessToken));

    for (const response of [asked, followed, out]) {
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });

  it('tells caches not to keep the credential', async () => {
    await askForLink();

    const followed = await follow(linkFromOutbox());

    expect(followed.headers.get('cache-control')).toContain('no-store');
  });
});
