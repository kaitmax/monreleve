// web/tests/db/web-sign-in.test.ts
//
// THE WEBSITE'S SIGN-IN, THROUGH ITS ROUTE HANDLERS. FW-WEB-ACCOUNT.
//
//   R1066 Web Ruling 30, BOTH DIRECTIONS (W12): a known address is sent the
//         code and signs in; an unknown one writes NO row and is sent NO
//         mail, and gets the SAME answer; the app's /api/v1/auth/code still
//         creates the account, unchanged.
//   R901  the same answer for a known and an unknown address (enumeration);
//         the rate limits the existing routes enforce, asserted from the web
//         path; FW-CODE-CAP's budget, ONE budget across both doors.
//   R902  every state-changing request refused cross-origin, and accepted
//         same-origin - both directions.
//   R899  a new session on every sign-in; sign-out revokes server-side.
//   R900  the code step sets exactly one cookie, with exactly the attributes.
//   R905  the sign-in mail is transactional: no List-Unsubscribe pair.
//
// Every step goes through the handler a browser's form posts to (R204), and
// the code is read out of the fake outbox the way a person reads it.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db/client';
import { clearOutbox, readOutbox } from '@/lib/alerts/mailer';
import { resetRateLimit } from '@/lib/alerts/rate-limit';
import { MAX_CODE_ATTEMPTS, MAX_CODE_ATTEMPTS_PER_DAY } from '@/lib/auth/magic-link';
import { EXCHANGE_RATE_LIMIT } from '@/lib/auth/code-exchange';
import { resolveWebSession } from '@/lib/auth/web-session';
import { AUTH_EMAIL_COPY } from '@/lib/fr/auth';
import { AUTH_EMAIL_FROM } from '@/lib/fr/emails';
import { ACCOUNT_PARAMS, ACCOUNT_PATHS } from '@/lib/web-account/paths';
import { SESSION_COOKIE, SESSION_COOKIE_NAME, sessionTokenFrom } from '@/lib/web-account/cookie';
import { accountSessionFrom } from '@/lib/web-account/session';
import { POST as apiRequestLink } from '@/app/api/v1/auth/magic-link/route';
import { POST as apiExchangeCode } from '@/app/api/v1/auth/code/route';
import {
  SITE,
  SITE_IP,
  codeFromOutboxFor,
  cookiePairOf,
  locationOf,
  requestCodeOnSite,
  setCookies,
  signInOnSite,
  signOutOnSite,
  submitCodeOnSite,
} from '@/tests/support/web-account';
import { drainAfterWork, pendingAfterWork } from '@/tests/support/after-work';

// next/server's after() as a queue: step one sends a known address's mail after
// its response (Web Ruling 37, R1072). tests/support/after-work.ts says why.
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (await import('@/tests/support/after-work')).queueAfter,
}));

const KNOWN = 'known@monreleve.test';
const UNKNOWN = 'unknown@monreleve.test';

let saved: string | undefined;

beforeEach(async () => {
  saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET ??= 'web-sign-in-test-secret';
  await prisma.user.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.codeAttempt.deleteMany();
  await prisma.user.create({ data: { email: KNOWN, name: 'Camille Rey', canton: 'GE', employmentRate: 100 } });
  clearOutbox();
  resetRateLimit();
});

afterAll(async () => {
  if (saved === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = saved;
  await prisma.user.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.codeAttempt.deleteMany();
  await prisma.$disconnect();
});

/** What a caller can observe of step one's answer, minus the ciphertext. */
function shapeOf(response: Response): Record<string, unknown> {
  const location = locationOf(response);

  return {
    status: response.status,
    path: location.pathname,
    params: [...location.searchParams.keys()].sort(),
    headers: [...response.headers.keys()].sort(),
    setCookie: response.headers.get('set-cookie'),
  };
}

/** The API's own JSON request, for the cross-door tests. */
function apiJson(path: string, body: unknown): Request {
  return new Request(`${SITE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': SITE_IP },
    body: JSON.stringify(body),
  });
}

const sentTo = (email: string): number => readOutbox().filter((message) => message.to === email).length;

describe('R901: step one answers the same for a known and an unknown address', () => {
  it('gives both the identical shape: a 303 to the code page carrying a step, and no cookie', async () => {
    const known = await requestCodeOnSite(KNOWN);
    const unknown = await requestCodeOnSite(UNKNOWN);

    expect(shapeOf(known.response)).toEqual(shapeOf(unknown.response));
    expect(shapeOf(known.response)).toMatchObject({
      status: 303,
      path: ACCOUNT_PATHS.code,
      params: [ACCOUNT_PARAMS.step],
      setCookie: null,
    });
  });

  // R1066 / Web Ruling 30. C9's test here read "sends the same message to both -
  // the server does not look the address up", which was the design the operator
  // ruled against: a web sign-in never creates an account, so the website mails
  // only an address the application knows. The ANSWER stays the same (above);
  // the WORK does not, and these two say exactly what differs.
  it('R1066: a known address gets the code by mail, and its one request row', async () => {
    await requestCodeOnSite(KNOWN);

    expect(sentTo(KNOWN)).toBe(1);
    expect(await prisma.verificationToken.count({ where: { identifier: KNOWN } })).toBe(1);
  });

  it('R1066: an unknown address writes NO row and is sent NO mail', async () => {
    const before = {
      users: await prisma.user.count(),
      tokens: await prisma.verificationToken.count(),
      attempts: await prisma.codeAttempt.count(),
      sessions: await prisma.webSession.count(),
    };

    const { response } = await requestCodeOnSite(UNKNOWN);

    expect(response.status).toBe(303);
    expect(readOutbox()).toHaveLength(0);
    expect({
      users: await prisma.user.count(),
      tokens: await prisma.verificationToken.count(),
      attempts: await prisma.codeAttempt.count(),
      sessions: await prisma.webSession.count(),
    }).toEqual(before);
    expect(await prisma.user.count({ where: { email: UNKNOWN } })).toBe(0);
  });

  it('R1066: the unknown address spends the same buckets, so the limit says nothing either', async () => {
    for (let i = 0; i < 5; i += 1) await requestCodeOnSite(UNKNOWN);

    const limited = await requestCodeOnSite(UNKNOWN);

    // Limited (requestKnownAddressSignIn spends the buckets BEFORE the lookup),
    // and answered exactly as a known, unlimited address is.
    expect(shapeOf(limited.response)).toEqual(shapeOf((await requestCodeOnSite(KNOWN)).response));
    expect(readOutbox().filter((message) => message.to === UNKNOWN)).toHaveLength(0);
  });

  // R1072 (Web Ruling 37): THE SAME WORK IN THE REQUEST. A known address's row
  // and mail are handed to next/server's after(), so the response is sent
  // before either happens; an unknown address leaves nothing behind. Measured
  // through this handler (REPORT-FW-WEB-ACCOUNT-2.txt, R1072): equal medians.
  it('R1072: the known address writes and mails only AFTER the response; the unknown leaves nothing to do', async () => {
    const known = await requestCodeOnSite(KNOWN, { keepAfterWork: true });

    expect(known.response.status).toBe(303);
    expect(pendingAfterWork(), 'the known address must defer its row and mail').toBe(1);
    expect(readOutbox()).toHaveLength(0);
    expect(await prisma.verificationToken.count({ where: { identifier: KNOWN } })).toBe(0);

    await drainAfterWork();

    expect(sentTo(KNOWN)).toBe(1);
    expect(await prisma.verificationToken.count({ where: { identifier: KNOWN } })).toBe(1);

    const unknown = await requestCodeOnSite(UNKNOWN, { keepAfterWork: true });

    expect(shapeOf(unknown.response)).toEqual(shapeOf(known.response));
    expect(pendingAfterWork(), 'the unknown address must leave nothing behind').toBe(0);
  });

  it('keeps the address out of the Location - only ciphertext travels', async () => {
    const { response } = await requestCodeOnSite(KNOWN);

    expect(response.headers.get('location')).not.toContain('known');
    expect(response.headers.get('location')).not.toContain('monreleve.test');
  });

  it('answers a rate-limited address with that same shape, and sends nothing', async () => {
    for (let i = 0; i < 5; i += 1) await requestCodeOnSite(KNOWN);

    const before = sentTo(KNOWN);
    const limited = await requestCodeOnSite(KNOWN);

    expect(sentTo(KNOWN)).toBe(before);
    expect(shapeOf(limited.response)).toEqual(shapeOf((await requestCodeOnSite(UNKNOWN)).response));
  });

  it('tells a string that is not an address so - which says nothing about anybody', async () => {
    const { response } = await requestCodeOnSite('pas-une-adresse');

    expect(response.status).toBe(303);
    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.state)).toBe('adresse-invalide');
    expect(readOutbox()).toHaveLength(0);
  });

  it('refuses to send at all when no key can seal the step (R205)', async () => {
    const secret = process.env.AUTH_SECRET;

    delete process.env.AUTH_SECRET;

    try {
      const { response } = await requestCodeOnSite(KNOWN);

      expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.state)).toBe('indisponible');
      expect(readOutbox()).toHaveLength(0);
    } finally {
      process.env.AUTH_SECRET = secret;
    }
  });
});

describe('R901: the existing routes\' limits, asserted from the web path - one budget, two doors', () => {
  it('shares the request buckets: links asked through the API exhaust the website', async () => {
    for (let i = 0; i < 5; i += 1) {
      await apiRequestLink(apiJson('/api/v1/auth/magic-link', { email: KNOWN }));
    }

    const before = sentTo(KNOWN);

    await requestCodeOnSite(KNOWN);

    expect(sentTo(KNOWN), 'the website sent past the API route\'s limit').toBe(before);
  });

  it('shares the code exchange\'s edge window: API attempts fill it, the website is refused', async () => {
    await requestCodeOnSite(KNOWN);

    for (let i = 0; i < EXCHANGE_RATE_LIMIT; i += 1) {
      await apiExchangeCode(apiJson('/api/v1/auth/code', { email: KNOWN, code: '000000' }));
    }

    const { step } = await requestCodeOnSite(UNKNOWN);
    const sealedForKnown = (await requestCodeOnSite(KNOWN)).step;

    expect(step).not.toBeNull();

    const response = await submitCodeOnSite(String(sealedForKnown), codeFromOutboxFor(KNOWN));

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('limite');
  });

  it('shares FW-CODE-CAP\'s daily budget: spent on the website, refused by the API', async () => {
    for (let i = 0; i < MAX_CODE_ATTEMPTS_PER_DAY; i += 1) {
      // A fresh request every few tries, so the per-request limit is never what refuses.
      const { step } = await requestCodeOnSite(KNOWN);

      resetRateLimit();
      await submitCodeOnSite(String(step), '000000');
    }

    await requestCodeOnSite(KNOWN);
    resetRateLimit();

    const api = await apiExchangeCode(apiJson('/api/v1/auth/code', { email: KNOWN, code: codeFromOutboxFor(KNOWN) }));

    expect(api.status).toBe(429);
    expect(((await api.json()) as { code: string }).code).toBe('too_many_attempts');
  });

  it('shares it the other way: spent through the API, refused on the website', async () => {
    for (let i = 0; i < MAX_CODE_ATTEMPTS_PER_DAY; i += 1) {
      await apiRequestLink(apiJson('/api/v1/auth/magic-link', { email: KNOWN }));
      resetRateLimit();
      await apiExchangeCode(apiJson('/api/v1/auth/code', { email: KNOWN, code: '000000' }));
    }

    const { step } = await requestCodeOnSite(KNOWN);

    resetRateLimit();

    const response = await submitCodeOnSite(String(step), codeFromOutboxFor(KNOWN));

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('trop-d-essais');
    expect(setCookies(response)).toEqual([]);
  });
});

describe('step two names what went wrong with the CODE (R908)', () => {
  it('a wrong code', async () => {
    const { step } = await requestCodeOnSite(KNOWN);
    const real = codeFromOutboxFor(KNOWN);
    const wrong = real === '000000' ? '111111' : '000000';
    const response = await submitCodeOnSite(String(step), wrong);

    expect(response.status).toBe(303);
    expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.code);
    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('code-invalide');
    expect(setCookies(response)).toEqual([]);
  });

  it('an expired code, distinct from a wrong one', async () => {
    const { step } = await requestCodeOnSite(KNOWN);

    await prisma.verificationToken.updateMany({ where: { identifier: KNOWN }, data: { expires: new Date(Date.now() - 1000) } });

    const response = await submitCodeOnSite(String(step), codeFromOutboxFor(KNOWN));

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('code-expire');
  });

  it('a request spent by the per-request limit', async () => {
    const { step } = await requestCodeOnSite(KNOWN);
    const real = codeFromOutboxFor(KNOWN);
    const wrong = real === '000000' ? '111111' : '000000';

    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) await submitCodeOnSite(String(step), wrong);

    const response = await submitCodeOnSite(String(step), real);

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('trop-d-essais');
  });

  it('a string that cannot be a code is refused WITHOUT spending the budget', async () => {
    const { step } = await requestCodeOnSite(KNOWN);
    const response = await submitCodeOnSite(String(step), 'abcdef');

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('format');
    expect(await prisma.codeAttempt.count()).toBe(0);
  });

  it('a step that will not open sends the person back to step one', async () => {
    const response = await submitCodeOnSite('pas-une-etape', '123456');

    expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.signIn);
    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.state)).toBe('demande-expiree');
  });

  it('accepts the code typed with a space in the middle', async () => {
    const { step } = await requestCodeOnSite(KNOWN);
    const code = codeFromOutboxFor(KNOWN);
    const response = await submitCodeOnSite(String(step), `${code.slice(0, 3)} ${code.slice(3)}`);

    expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.home);
  });
});

describe('R1066: an unknown address cannot get in, and the website creates nothing', () => {
  it('has no code to type: any code is refused as a wrong one, and no user or session appears', async () => {
    const { step } = await requestCodeOnSite(UNKNOWN);

    expect(step).not.toBeNull();

    const response = await submitCodeOnSite(String(step), '123456');

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.error)).toBe('code-invalide');
    expect(setCookies(response)).toEqual([]);
    expect(await prisma.user.count({ where: { email: UNKNOWN } })).toBe(0);
    expect(await prisma.webSession.count()).toBe(0);
  });

  it('an account deleted between the steps: told so AFTER the proof, and nothing is re-created', async () => {
    const { step } = await requestCodeOnSite(KNOWN);
    const code = codeFromOutboxFor(KNOWN);

    await prisma.user.deleteMany({ where: { email: KNOWN } });

    const response = await submitCodeOnSite(String(step), code);

    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.state)).toBe('aucun-compte');
    expect(setCookies(response)).toEqual([]);
    expect(await prisma.user.count({ where: { email: KNOWN } })).toBe(0);
    expect(await prisma.webSession.count()).toBe(0);
  });
});

describe("R1066: the app's /api/v1/auth/code still creates the account, unchanged", () => {
  it('a new address signs in through the API and the account exists afterwards', async () => {
    const fresh = 'nouveau-compte@monreleve.test';

    expect(await prisma.user.count({ where: { email: fresh } })).toBe(0);

    await apiRequestLink(apiJson('/api/v1/auth/magic-link', { email: fresh }));

    const exchange = await apiExchangeCode(apiJson('/api/v1/auth/code', { email: fresh, code: codeFromOutboxFor(fresh) }));

    expect(exchange.status).toBe(200);
    expect(await prisma.user.count({ where: { email: fresh } })).toBe(1);
  });
});

describe('R900: a correct code sets exactly one cookie, with exactly the attributes', () => {
  it('is one Set-Cookie, the session cookie, nothing else', async () => {
    const response = await signInOnSite(KNOWN);
    const cookies = setCookies(response);

    expect(response.status).toBe(303);
    expect(locationOf(response).pathname).toBe(ACCOUNT_PATHS.home);
    expect(cookies).toHaveLength(1);

    const [cookie] = cookies;
    const parts = String(cookie).split(';').map((part) => part.trim());

    expect(parts[0]?.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(parts.slice(1).sort()).toEqual(
      [
        `Path=${SESSION_COOKIE.path}`,
        `Max-Age=${String(SESSION_COOKIE.maxAgeSeconds)}`,
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
      ].sort(),
    );
    expect(String(cookie).toLowerCase()).not.toContain('domain=');
  });

  it('carries a value that resolves to the person who proved the code', async () => {
    const response = await signInOnSite(KNOWN);
    const token = sessionTokenFrom(cookiePairOf(String(setCookies(response)[0])));
    const user = await prisma.user.findUniqueOrThrow({ where: { email: KNOWN } });

    expect(token).not.toBeNull();
    expect(await resolveWebSession(String(token))).toMatchObject({ ok: true, userId: user.id });
  });

  it('opens a NEW session on every sign-in (fixation): two values, two rows', async () => {
    const first = cookiePairOf(String(setCookies(await signInOnSite(KNOWN))[0]));

    resetRateLimit();

    const second = cookiePairOf(String(setCookies(await signInOnSite(KNOWN, { cookie: first }))[0]));

    expect(second).not.toBe(first);
    expect(await prisma.webSession.count()).toBe(2);
  });

  it('does not touch the User row - signing in to read is not a write', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { email: KNOWN } });

    await signInOnSite(KNOWN);

    const after = await prisma.user.findUniqueOrThrow({ where: { email: KNOWN } });

    expect(after).toEqual(before);
  });
});

describe('R899: sign-out revokes server-side and removes the cookie', () => {
  it('revokes the row, clears the cookie at the same Path, and says so', async () => {
    const cookie = cookiePairOf(String(setCookies(await signInOnSite(KNOWN))[0]));
    const response = await signOutOnSite(cookie);
    const cleared = setCookies(response);

    expect(response.status).toBe(303);
    expect(locationOf(response).searchParams.get(ACCOUNT_PARAMS.state)).toBe('deconnecte');
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cleared[0]).toContain('Max-Age=0');
    expect(cleared[0]).toContain(`Path=${SESSION_COOKIE.path}`);

    const row = await prisma.webSession.findFirstOrThrow();

    expect(row.revokedReason).toBe('SIGNED_OUT');
    expect(await accountSessionFrom(cookie)).toEqual({ state: 'ended' });
  });

  it('answers a dead or absent cookie exactly as a live one (R210)', async () => {
    const dead = await signOutOnSite(`${SESSION_COOKIE_NAME}=nobody-minted-this-value-0123456789`);
    const absent = await signOutOnSite(undefined);

    expect(dead.status).toBe(absent.status);
    expect(dead.headers.get('location')).toBe(absent.headers.get('location'));
  });
});

describe('R210: a dead session says one thing, whatever ended it', () => {
  it('reports expired, revoked and unknown values alike', async () => {
    const live = cookiePairOf(String(setCookies(await signInOnSite(KNOWN))[0]));
    const revoked = live;

    await signOutOnSite(revoked);

    resetRateLimit();

    const another = cookiePairOf(String(setCookies(await signInOnSite(KNOWN))[0]));

    await prisma.webSession.updateMany({
      where: { revokedAt: null },
      data: { createdAt: new Date(Date.now() - 60 * 60 * 1000), expiresAt: new Date(Date.now() - 31 * 60 * 1000) },
    });

    expect(await accountSessionFrom(revoked)).toEqual({ state: 'ended' });
    expect(await accountSessionFrom(another)).toEqual({ state: 'ended' });
    expect(await accountSessionFrom(`${SESSION_COOKIE_NAME}=never-minted-0123456789abcdef`)).toEqual({
      state: 'ended',
    });
    expect(await accountSessionFrom(null)).toEqual({ state: 'absent' });
  });
});

describe('R902: every state-changing request is refused cross-origin - and accepted same-origin', () => {
  it('refuses step one from another site, and sends nothing', async () => {
    const { response } = await requestCodeOnSite(KNOWN, { origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(readOutbox()).toHaveLength(0);
  });

  it('refuses step one with no Origin, and with cross-site fetch metadata', async () => {
    expect((await requestCodeOnSite(KNOWN, { origin: null })).response.status).toBe(403);
    expect((await requestCodeOnSite(KNOWN, { fetchSite: 'cross-site' })).response.status).toBe(403);
    expect(readOutbox()).toHaveLength(0);
  });

  it('refuses step two from another site, even with a valid step and the right code', async () => {
    const { step } = await requestCodeOnSite(KNOWN);
    const response = await submitCodeOnSite(String(step), codeFromOutboxFor(KNOWN), {
      origin: 'https://evil.example',
    });

    expect(response.status).toBe(403);
    expect(setCookies(response)).toEqual([]);
    expect(await prisma.webSession.count()).toBe(0);
    expect(await prisma.codeAttempt.count(), 'a refused request must spend nothing').toBe(0);
  });

  it('refuses a cross-origin sign-out, and the session stays alive', async () => {
    const cookie = cookiePairOf(String(setCookies(await signInOnSite(KNOWN))[0]));
    const response = await signOutOnSite(cookie, { origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(setCookies(response)).toEqual([]);
    expect(await accountSessionFrom(cookie)).toMatchObject({ state: 'signed-in' });
  });

  it('accepts the same requests from the site itself (the other direction)', async () => {
    const response = await signInOnSite(KNOWN, { fetchSite: 'same-origin' });

    expect(response.status).toBe(303);
    expect(setCookies(response)).toHaveLength(1);
  });
});

describe('R905: the sign-in mail sent from the website is transactional', () => {
  it('carries no List-Unsubscribe pair, from the sign-in sender, with the sign-in subject', async () => {
    await requestCodeOnSite(KNOWN);

    const [message] = readOutbox();

    expect(message?.from).toBe(AUTH_EMAIL_FROM);
    expect(message?.subject).toBe(AUTH_EMAIL_COPY.signIn.subject);

    const names = Object.keys(message?.headers ?? {}).map((name) => name.toLowerCase());

    expect(names).not.toContain('list-unsubscribe');
    expect(names).not.toContain('list-unsubscribe-post');
  });

  it('tells the reader where to type the code in words true on the site AND in the app (Ruling 13 item 6)', async () => {
    // READ OFF THE MAIL A WEB SIGN-IN ACTUALLY PRODUCES. It used to say
    // "saisissez ce code dans l'application", which sends a person standing on
    // the website's code page to an app they may not have. One generic line,
    // in lib/fr, for both clients (R165: written, not lifted per instance).
    await requestCodeOnSite(KNOWN);

    const [message] = readOutbox();
    const lines = (message?.text ?? '').split('\n');

    expect(lines).toContain(AUTH_EMAIL_COPY.signIn.codeInstruction);
    expect(message?.text ?? '').not.toMatch(/saisissez ce code dans l.application/iu);
  });

  it('is the same message the app path sends - one sender, one template', async () => {
    await requestCodeOnSite(KNOWN);
    await apiRequestLink(apiJson('/api/v1/auth/magic-link', { email: UNKNOWN }));

    const [web, api] = readOutbox();

    expect(web?.from).toBe(api?.from);
    expect(web?.subject).toBe(api?.subject);
    expect(Object.keys(web?.headers ?? {})).toEqual(Object.keys(api?.headers ?? {}));
  });
});
