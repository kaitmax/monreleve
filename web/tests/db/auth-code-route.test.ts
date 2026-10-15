// web/tests/db/auth-code-route.test.ts
//
// AN-ONBOARD / O1: the six-digit code exchange, DRIVEN THROUGH THE ROUTE HANDLERS.
//
// R204 at the level of a flow, the same shape auth-round-trip.test.ts proves for
// the link: this is the only place that proves the code the EMAIL carries is the
// code the /auth/code ROUTE accepts, and that exchanging it opens the same session
// the callback does. consumeCode is unit-proven in code-sign-in.test.ts; this
// proves the parts are WIRED - the email, the request endpoint, and the exchange
// endpoint - which no unit test can.
//
// THE FAKE DEVICE CLIENT is this file: it reads the code out of the outbox the way
// a person reads it off their screen, and posts it. Nothing is stubbed.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { POST as requestLink } from '@/app/api/v1/auth/magic-link/route';
import { POST as exchangeCode } from '@/app/api/v1/auth/code/route';
import { POST as signOut } from '@/app/api/v1/auth/sign-out/route';

const EMAIL = 'frontalier@example.com';
const ORIGIN = 'https://monreleve.ch';

async function askForCode(email = EMAIL): Promise<Response> {
  return requestLink(
    new Request(`${ORIGIN}/api/v1/auth/magic-link`, {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    }),
  );
}

/** Read the six-digit code out of the outbox, the way a person reads it off the screen. */
function codeFromOutbox(): string {
  const [message] = readOutbox();
  const line = (message?.text ?? '').split('\n').find((row) => /^\d{6}$/u.test(row.trim()));

  if (line === undefined) {
    throw new Error('no six-digit code in the outbox; the message did not carry one');
  }

  return line.trim();
}

function submitCode(code: string, email = EMAIL): Request {
  return new Request(`${ORIGIN}/api/v1/auth/code`, {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
  });
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
  // FW-CODE-CAP: the per-address budget (R358) survives a request on purpose,
  // so it survives a test unless it is cleared here.
  await prisma.codeAttempt.deleteMany();
  clearOutbox();
  resetRateLimit();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('O1: the email carries a code beside the link', () => {
  it('puts a six-digit code in the message', async () => {
    await askForCode();

    expect(() => codeFromOutbox()).not.toThrow();
    expect(codeFromOutbox()).toMatch(/^\d{6}$/u);
  });

  it('still carries the link, unchanged (the code is an ADDITIONAL way in)', async () => {
    await askForCode();

    const [message] = readOutbox();
    const link = (message?.text ?? '').split('\n').find((row) => row.startsWith('http'));

    expect(link).toContain('/api/v1/auth/callback?token=');
  });
});

describe('O1: exchanging the code opens the same session the link does', () => {
  it('request -> email -> code -> a usable pair', async () => {
    expect((await askForCode()).status).toBe(202);

    const response = await exchangeCode(submitCode(codeFromOutbox()));

    expect(response.status).toBe(200);

    const pair = (await response.json()) as { accessToken: string; refreshToken: string };

    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();

    // The session is real: the bearer token opens a door.
    expect((await signOut(withBearer('/api/v1/auth/sign-out', pair.accessToken))).status).toBe(200);
  });

  it('creates the account at the EXCHANGE, not at the request (like the callback)', async () => {
    await askForCode();

    expect(await prisma.user.count()).toBe(0);

    await exchangeCode(submitCode(codeFromOutbox()));

    expect(await prisma.user.count()).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).emailVerified,
    ).not.toBeNull();
  });

  it('refuses the code a second time', async () => {
    await askForCode();

    const code = codeFromOutbox();

    expect((await exchangeCode(submitCode(code))).status).toBe(200);
    expect((await exchangeCode(submitCode(code))).status).toBe(400);
  });

  it('sets no cookie (AC3)', async () => {
    await askForCode();

    const response = await exchangeCode(submitCode(codeFromOutbox()));

    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});

describe('O1: each refusal is named', () => {
  it('names a wrong code, and tells the person how to recover', async () => {
    await askForCode();

    const response = await exchangeCode(submitCode('000000' === codeFromOutbox() ? '111111' : '000000'));

    expect(response.status).toBe(400);

    const json = (await response.json()) as { code: string; message: string };

    expect(json.code).toBe('invalid_code');
    // Never just "erreur": the message says how to recover (R198).
    expect(json.message.length).toBeGreaterThan(20);
  });

  it('names too many attempts once the request is spent', async () => {
    await askForCode();

    const real = codeFromOutbox();
    const wrong = real === '000000' ? '111111' : '000000';

    // Exhaust the limit (5), then one more.
    for (let i = 0; i < 5; i += 1) {
      await exchangeCode(submitCode(wrong));
    }

    const response = await exchangeCode(submitCode(real));

    expect(response.status).toBe(429);
    expect(((await response.json()) as { code: string }).code).toBe('too_many_attempts');
  });

  it('refuses a malformed body', async () => {
    const response = await exchangeCode(
      new Request(`${ORIGIN}/api/v1/auth/code`, {
        method: 'POST',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('malformed_body');
  });

  it('refuses an unknown address exactly as it refuses a wrong code (no enumeration)', async () => {
    const response = await exchangeCode(submitCode('123456', 'nobody@example.com'));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('invalid_code');
  });
});

describe('FW-CODE-CAP (R358/R361): exhausting the budget tells a caller nothing', () => {
  // ==========================================================================
  // THE BUDGET IS THE NEW THING THAT COULD LEAK, AND THE TEST IS AT THE ROUTE
  // ==========================================================================
  //
  // `consumeCode` claims the slot BEFORE it reads the VerificationToken row,
  // so an address with no account and an address with one walk the same path
  // and spend the same budget. That is a property of the order of two lines,
  // which is exactly the kind of property a refactor moves without noticing.
  //
  // It is asserted AT THE ROUTE rather than against `consumeCode` (R204),
  // because what a caller can see is a status and a body - and the status
  // comes from the route's switch, not from the function.
  //
  // ELEVEN ATTEMPTS, so the run crosses every boundary there is: five
  // comparisons, five refusals from the per-code counter, and the eleventh
  // from the budget. If any of the three answers differed by registration,
  // this would catch it.
  const ATTEMPTS = 11;

  /** Every answer the route gave, in order, as a caller would see them. */
  async function run(email: string, ip: string): Promise<unknown[]> {
    await requestLink(
      new Request(`${ORIGIN}/api/v1/auth/magic-link`, {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      }),
    );

    const seen: unknown[] = [];

    for (let i = 0; i < ATTEMPTS; i += 1) {
      const response = await exchangeCode(
        new Request(`${ORIGIN}/api/v1/auth/code`, {
          method: 'POST',
          body: JSON.stringify({ email, code: '000000' }),
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        }),
      );

      seen.push({ status: response.status, body: await response.json() });
    }

    return seen;
  }

  it('answers an address with an account exactly as it answers one without', async () => {
    // The ONLY difference between the two runs. Separate source addresses so
    // neither run's rate bucket or budget can reach the other.
    await prisma.user.create({ data: { email: 'inscrite@example.com' } });

    const registered = await run('inscrite@example.com', '203.0.113.21');
    const unknown = await run('jamais-vue@example.com', '203.0.113.22');

    expect(registered).toEqual(unknown);

    // And the run really did cross the budget, rather than being eleven
    // identical refusals for some other reason (R169's corollary: an
    // absence assertion is satisfied by absence).
    expect(registered.at(-1)).toMatchObject({
      status: 429,
      body: { code: 'too_many_attempts' },
    });
    expect(registered.at(0)).toMatchObject({ status: 400, body: { code: 'invalid_code' } });
  });

  it('spends the budget for an address nobody ever requested a code for', async () => {
    // No request at all: the slot is claimed before the row is read, so this
    // costs the same as a guess against a live request. If it did not, the
    // budget itself would answer "has a code been asked for here".
    for (let i = 0; i < 3; i += 1) {
      await exchangeCode(
        new Request(`${ORIGIN}/api/v1/auth/code`, {
          method: 'POST',
          body: JSON.stringify({ email: 'silence@example.com', code: '000000' }),
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.23' },
        }),
      );
    }

    expect(await prisma.codeAttempt.count()).toBe(3);
  });
});
