// web/tests/unit/push/fcm.test.ts
//
// The uncredentialed adapter, proven as far as the wire. FW27 increment 3.
//
// ============================================================================
// R243: NOTHING HERE TOUCHES A NETWORK
// ============================================================================
//
// `fetch` is injected. There is no Firebase project, no service account and no
// token; the key pair below is generated in this file and exists for the
// length of the run.
//
// ============================================================================
// R154: THE MECHANISM IS PROVEN TO DELIVER, NOT PROVEN NOT TO FAIL
// ============================================================================
//
// "createFcmSender did not throw" is worth nothing - a sender that posted an
// empty body to the wrong URL would satisfy it. So the two requests are
// captured and read: the assertion is DECODED and its signature VERIFIED
// against the public half of the key, and the message envelope is checked
// against the shape Google publishes. That is as far as a positive test can
// reach without a credential, and the rest is named in the report rather than
// claimed.

import { createVerify, generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_CLIENT_EMAIL,
  PLACEHOLDER_PRIVATE_KEY,
  PLACEHOLDER_PROJECT_ID,
  createFcmSender,
  readFcmCredentials,
  signAssertion,
} from '@/lib/push/fcm';
import type { EnvLike } from '@/lib/push/fcm';
import type { PushNotification } from '@/lib/push/sender';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const PROJECT = 'mon-releve-test';
const EMAIL = 'pushes@mon-releve-test.iam.gserviceaccount.com';

/** The environment as a deployment would carry it: newlines escaped. */
function env(overrides: EnvLike = {}): EnvLike {
  return {
    FCM_PROJECT_ID: PROJECT,
    FCM_CLIENT_EMAIL: EMAIL,
    FCM_PRIVATE_KEY: privateKey.replaceAll('\n', String.raw`\n`),
    ...overrides,
  };
}

const NOTIFICATION: PushNotification = {
  title: 'Journée du 07.07.2026 à enregistrer',
  body: 'Indiquez où vous avez travaillé.',
  data: { kind: 'daily_reminder', day: '2026-07-07' },
};

interface Captured {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** A fetch that answers from a script and records everything it was asked. */
function fetcher(answers: readonly Response[]): {
  fetch: typeof globalThis.fetch;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  let index = 0;

  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });

    const answer = answers[index] ?? answers.at(-1);

    index += 1;

    if (answer === undefined) throw new Error('the fake fetch has no answer scripted');

    return answer;
  }) as unknown as typeof globalThis.fetch;

  return { fetch, calls };
}

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: 'ya29.fake', expires_in: 3600 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('readFcmCredentials names which rule refused (R198)', () => {
  it('says not_configured when nothing is set', () => {
    expect(readFcmCredentials({})).toEqual({ ok: false, code: 'not_configured' });
  });

  it('says not_configured when one of the three is missing', () => {
    // A PARTIAL CONFIGURATION IS NOT A CONFIGURATION. Two of three would
    // otherwise reach the PEM check and report a malformed key, sending
    // whoever is debugging to look at the wrong variable.
    expect(readFcmCredentials(env({ FCM_CLIENT_EMAIL: '' }))).toEqual({
      ok: false,
      code: 'not_configured',
    });
  });

  it('refuses each placeholder BY NAME, so a half-filled deployment is loud', () => {
    for (const overrides of [
      { FCM_PROJECT_ID: PLACEHOLDER_PROJECT_ID },
      { FCM_CLIENT_EMAIL: PLACEHOLDER_CLIENT_EMAIL },
      { FCM_PRIVATE_KEY: PLACEHOLDER_PRIVATE_KEY },
    ]) {
      expect(readFcmCredentials(env(overrides))).toEqual({
        ok: false,
        code: 'placeholder_credentials',
      });
    }
  });

  it('distinguishes a key that is not a key from one that is missing', () => {
    expect(readFcmCredentials(env({ FCM_PRIVATE_KEY: 'a-password-someone-pasted' }))).toEqual({
      ok: false,
      code: 'malformed_private_key',
    });
  });

  it('ACCEPTS a well-formed set, so the refusals above are not refusing everything', () => {
    // R196's other direction. Without this, a reader that returned
    // not_configured unconditionally would pass every test above.
    const read = readFcmCredentials(env());

    expect(read.ok).toBe(true);

    if (!read.ok) throw new Error('unreachable');

    expect(read.credentials.projectId).toBe(PROJECT);
    expect(read.credentials.clientEmail).toBe(EMAIL);
    // THE ESCAPED NEWLINES ARE RESTORED. A key with literal backslash-n in it
    // is refused by node:crypto at signing time, which is a failure a whole
    // deployment away from its cause.
    expect(read.credentials.privateKey).toBe(privateKey.trim());
    expect(read.credentials.privateKey).toContain('\n');
  });
});

describe('the assertion is a real signed JWT, not a string that looks like one', () => {
  it('carries the claims Google requires and verifies against the public key', () => {
    const read = readFcmCredentials(env());

    if (!read.ok) throw new Error('credentials should have been accepted');

    const assertion = signAssertion(read.credentials, 1_780_000_000);
    const [header, claims, signature] = assertion.split('.') as [string, string, string];

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });

    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toEqual({
      iss: EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_780_000_000,
      exp: 1_780_003_600,
    });

    // THE SIGNATURE IS VERIFIED, not merely present. A non-empty third segment
    // is what a broken signer produces too.
    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, 'base64url'));

    expect(verified).toBe(true);
  });
});

describe('a send makes the two requests Google documents', () => {
  let now = 1_780_000_000_000;

  beforeEach(() => {
    now = 1_780_000_000_000;
  });

  function sender(answers: readonly Response[]) {
    const { fetch, calls } = fetcher(answers);
    const made = createFcmSender(env(), { fetch, now: () => now });

    if (!made.ok) throw new Error(`the sender should have been built: ${made.code}`);

    return { sender: made.sender, calls };
  }

  it('exchanges the assertion, then posts the message to the project', async () => {
    const { sender: push, calls } = sender([tokenResponse(), new Response('{}', { status: 200 })]);

    const attempt = await push.send('device-token-1', NOTIFICATION);

    expect(attempt).toEqual({ outcome: 'delivered', status: 200 });
    expect(calls).toHaveLength(2);

    const exchange = calls[0];

    expect(exchange?.url).toBe('https://oauth2.googleapis.com/token');

    const form = new URLSearchParams(String(exchange?.init?.body));

    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(form.get('assertion')?.split('.')).toHaveLength(3);

    const message = calls[1];

    expect(message?.url).toBe(
      `https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`,
    );
    const headers = (message?.init?.headers ?? {}) as Record<string, string>;

    expect(headers.authorization).toBe('Bearer ya29.fake');
    expect(JSON.parse(String(message?.init?.body))).toEqual({
      message: {
        token: 'device-token-1',
        notification: { title: NOTIFICATION.title, body: NOTIFICATION.body },
        data: NOTIFICATION.data,
      },
    });
  });

  it('reuses the access token rather than minting one per device', async () => {
    const { sender: push, calls } = sender([tokenResponse(), new Response('{}', { status: 200 })]);

    await push.send('device-token-1', NOTIFICATION);
    await push.send('device-token-2', NOTIFICATION);

    // Three calls, not four: one exchange and two messages. A fan-out over
    // twenty devices that re-signed twenty assertions would work and would be
    // rate-limited in production, which is the kind of defect that only
    // appears once there are users.
    expect(calls).toHaveLength(3);
    expect(calls.filter((call) => call.url.includes('oauth2'))).toHaveLength(1);
  });

  it('mints a new one once the cached token is close to expiring', async () => {
    const { sender: push, calls } = sender([tokenResponse(), new Response('{}', { status: 200 })]);

    await push.send('device-token-1', NOTIFICATION);

    now += 3600 * 1000;

    await push.send('device-token-2', NOTIFICATION);

    expect(calls.filter((call) => call.url.includes('oauth2'))).toHaveLength(2);
  });

  it('reads 404 as a dead token and 503 as nothing about the token', async () => {
    const dead = sender([tokenResponse(), new Response('', { status: 404 })]);

    expect(await dead.sender.send('gone', NOTIFICATION)).toEqual({
      outcome: 'token_dead',
      status: 404,
    });

    const flaky = sender([tokenResponse(), new Response('', { status: 503 })]);

    expect(await flaky.sender.send('fine', NOTIFICATION)).toEqual({
      outcome: 'undelivered',
      status: 503,
    });
  });

  it('NEVER reports a dead token when it was the credentials that failed', async () => {
    // THE TEST THIS FILE EXISTS FOR. A refused token exchange means every
    // device in the fan-out fails, and reading that as "these tokens are gone"
    // would delete every registration this product has in one run, silently,
    // with no way back except every client re-registering.
    const { sender: push, calls } = sender([new Response('', { status: 401 })]);

    expect(await push.send('perfectly-good-token', NOTIFICATION)).toEqual({
      outcome: 'undelivered',
      status: null,
    });

    // AND IT DID NOT POST THE MESSAGE. One call, the exchange.
    expect(calls).toHaveLength(1);
  });

  it('reports a network error as undelivered with no status', async () => {
    const { fetch, calls } = fetcher([tokenResponse()]);
    const throwing = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('fcm.googleapis.com')) throw new Error('ENOTFOUND');

      return fetch(url as string, init);
    }) as unknown as typeof globalThis.fetch;

    const made = createFcmSender(env(), { fetch: throwing, now: () => now });

    if (!made.ok) throw new Error('the sender should have been built');

    expect(await made.sender.send('token', NOTIFICATION)).toEqual({
      outcome: 'undelivered',
      status: null,
    });

    expect(calls).toHaveLength(1);
  });
});

describe('createFcmSender refuses rather than throwing', () => {
  it('hands back the named refusal when there are no credentials', () => {
    // WHICH IS THE ANSWER ON EVERY MACHINE THAT EXISTS TODAY (R243). FW28 is
    // where this stops being the expected result.
    expect(createFcmSender({})).toEqual({ ok: false, code: 'not_configured' });
  });
});
