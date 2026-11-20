// web/lib/push/fcm.ts
//
// The real push adapter, written and deliberately uncredentialed.
// FW27 increment 3.
//
// ============================================================================
// R243: NOTHING IN THIS TASK MAY REACH A REAL PERSON
// ============================================================================
//
// No Firebase project is created, no service account is downloaded, and no
// value in this file's environment variables exists anywhere in this
// repository or on the machine that wrote it. What is built is the SHAPE of
// the call - the assertion, the token exchange, the message envelope - so that
// FW28 supplies three strings rather than writing a client.
//
// The parts that can be proven without a network are proven: the credential
// reader is tested in both directions, the JWT assertion is decoded and its
// claims asserted, and both requests are captured from an injected `fetch` and
// checked against Google's published shapes. The only untested thing is the
// wire itself, and it is named as such in REPORT-FW27.txt rather than being
// claimed.
//
// ============================================================================
// IT REFUSES A PLACEHOLDER, WHICH IS R205 APPLIED TO A CREDENTIAL
// ============================================================================
//
// FW25's print route refuses `change-me-local-only-not-for-deployment` rather
// than signing with it, and for the same reason: a credential that is present
// and wrong is worse than one that is absent. Absent is visible - the sender
// is not constructed, the warning says so, and the reminder job records a
// failure. Present-and-wrong looks configured, answers 401 for every token,
// and - without the whitelist in sender.ts - would have deleted every device
// row in the database on its first run.
//
// THE MALFORMED CASE IS SEPARATE FROM THE PLACEHOLDER CASE (R198), because
// they send whoever is debugging to different places: one means "you have not
// filled this in", the other means "what you pasted is not a private key".

import { createSign } from 'node:crypto';
import { classifyPushStatus } from '@/lib/push/sender';
import type { PushAttempt, PushNotification, PushSender } from '@/lib/push/sender';

/**
 * The values `.env.example` would carry if it carried any.
 *
 * R133 AS A POSITIVE GUARD, exactly as PLACEHOLDER_SECRET is: the code refuses
 * these strings explicitly rather than hoping nobody deploys them.
 *
 * RE-EXPORTED, NOT DECLARED (R206). FW28's entrypoint refuses the same three
 * before the server starts and cannot import TypeScript, so the text lives in
 * lib/deploy/placeholders.mjs and both sides name it. A test comparing two
 * copies would only prove they were equal when somebody last looked.
 */
import {
  PLACEHOLDER_CLIENT_EMAIL,
  PLACEHOLDER_PRIVATE_KEY,
  PLACEHOLDER_PROJECT_ID,
} from '@/lib/deploy/placeholders.mjs';

export { PLACEHOLDER_CLIENT_EMAIL, PLACEHOLDER_PRIVATE_KEY, PLACEHOLDER_PROJECT_ID };

/**
 * Just enough of an environment to read variables out of.
 *
 * NOT `NodeJS.ProcessEnv`, which Next augments with a REQUIRED `NODE_ENV` -
 * so a test presenting an unconfigured environment as `{}` does not typecheck
 * against it. The role here is "a bag of variables" (R171), and every caller
 * hands over either `process.env` or a literal standing in for one.
 */
export type EnvLike = Readonly<Record<string, string | undefined>>;

/** Why there is no sender, named so a log says which thing to go and fix. */
export type FcmRefusal = 'not_configured' | 'placeholder_credentials' | 'malformed_private_key';

const PEM_HEADER = '-----BEGIN PRIVATE KEY-----';
const PEM_FOOTER = '-----END PRIVATE KEY-----';

/**
 * R861: WHICH SHAPE OF FCM_PRIVATE_KEY FAILED - NEVER WHAT IT CONTAINED.
 *
 * Production logged `malformed_private_key` and nothing more (REPORT-FW-CHROMIUM
 * section 4, plan e). The escaped newlines were already restored, so the value
 * failed for some other reason the refusal could not name, and the next paste
 * would have failed just as silently. Each shape below is a way a real paste
 * goes wrong, and each sends whoever reads the log to a different fix.
 *
 * Every shape is a fact about the value's STRUCTURE - a quote at both ends, a
 * backslash, where a PEM line sits. None of them carries a character of the
 * key, its length or anything derived from it.
 */
export type MalformedKeyShape =
  | 'quoted'
  | 'backslash_after_restore'
  | 'no_pem_header'
  | 'text_before_pem_header'
  | 'no_pem_footer'
  | 'text_after_pem_footer';

/** One sentence per shape, for the startup log. Names the variable, never the value. */
export const MALFORMED_KEY_SHAPES: Readonly<Record<MalformedKeyShape, string>> = Object.freeze({
  quoted:
    'FCM_PRIVATE_KEY is wrapped in quotation marks: the value starts and ends with the same quote character.',
  backslash_after_restore:
    'FCM_PRIVATE_KEY still contains a backslash after its escaped newlines were restored: it was probably escaped twice.',
  no_pem_header: `FCM_PRIVATE_KEY does not contain "${PEM_HEADER}".`,
  text_before_pem_header: `FCM_PRIVATE_KEY has text before "${PEM_HEADER}".`,
  no_pem_footer: `FCM_PRIVATE_KEY does not contain "${PEM_FOOTER}": it may have been cut short.`,
  text_after_pem_footer: `FCM_PRIVATE_KEY has text after "${PEM_FOOTER}".`,
});

export interface FcmCredentials {
  readonly projectId: string;
  readonly clientEmail: string;
  /** PEM, with real newlines. */
  readonly privateKey: string;
}

/** A refusal, with the shape that failed when the key itself was the problem. */
export type FcmCredentialRefusal =
  | { readonly ok: false; readonly code: 'not_configured' | 'placeholder_credentials' }
  | {
      readonly ok: false;
      readonly code: 'malformed_private_key';
      readonly detail: MalformedKeyShape;
    };

export type FcmCredentialResult =
  | { readonly ok: true; readonly credentials: FcmCredentials }
  | FcmCredentialRefusal;

/**
 * The first shape a restored, trimmed key fails, or null for a key that has
 * the PEM structure.
 *
 * ORDER IS THE CONTRACT: the outermost cause wins, the one somebody looking at
 * the value meets first. A doubly-escaped key with a trailing newline ends in a
 * backslash once restored, so a footer test run first would report "text after
 * the footer" for a footer that is there; the backslash is the cause.
 *
 * A BACKSLASH IS NEVER PART OF A KEY. The body is base64 and the PEM lines are
 * fixed text, so a backslash left after the one restoration is always a paste
 * that was escaped twice (or carried another escape, like \r).
 */
function malformedKeyShape(privateKey: string): MalformedKeyShape | null {
  const first = privateKey.at(0);

  if (privateKey.length >= 2 && (first === '"' || first === "'") && privateKey.endsWith(first)) {
    return 'quoted';
  }

  if (privateKey.includes('\\')) return 'backslash_after_restore';

  const header = privateKey.indexOf(PEM_HEADER);

  if (header === -1) return 'no_pem_header';
  if (header > 0) return 'text_before_pem_header';

  const footer = privateKey.lastIndexOf(PEM_FOOTER);

  if (footer === -1) return 'no_pem_footer';
  if (footer + PEM_FOOTER.length !== privateKey.length) return 'text_after_pem_footer';

  return null;
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

/** One hour, which is the maximum Google accepts for an assertion. */
const ASSERTION_TTL_S = 3600;

/**
 * How early a cached access token is considered spent.
 *
 * A token that expires while a fan-out is in flight fails every device after
 * the boundary, and the whole run then reads as a delivery problem. Sixty
 * seconds is longer than any fan-out this product will have.
 */
const TOKEN_SKEW_S = 60;

/**
 * Read the three values, or say which rule refused.
 *
 * `env` is a parameter rather than `process.env` read inline so a test can
 * present a placeholder without setting one on the process, where it would
 * outlive the test file (R171: the role is "the environment this sender is
 * configured from").
 */
export function readFcmCredentials(env: EnvLike = process.env): FcmCredentialResult {
  const projectId = env.FCM_PROJECT_ID?.trim() ?? '';
  const clientEmail = env.FCM_CLIENT_EMAIL?.trim() ?? '';
  const rawKey = env.FCM_PRIVATE_KEY ?? '';

  if (projectId === '' || clientEmail === '' || rawKey.trim() === '') {
    return { ok: false, code: 'not_configured' };
  }

  if (
    projectId === PLACEHOLDER_PROJECT_ID ||
    clientEmail === PLACEHOLDER_CLIENT_EMAIL ||
    rawKey.trim() === PLACEHOLDER_PRIVATE_KEY
  ) {
    return { ok: false, code: 'placeholder_credentials' };
  }

  // A SERVICE-ACCOUNT KEY ARRIVES WITH ITS NEWLINES ESCAPED, because it is a
  // JSON string field and every deployment surface that carries it - a .env
  // file, a Coolify variable, a CI secret - is line-oriented. Restoring them
  // here is the one transformation; a key that still has no PEM header after
  // it is not a key.
  const privateKey = rawKey.replaceAll(String.raw`\n`, '\n').trim();
  const shape = malformedKeyShape(privateKey);

  if (shape !== null) {
    return { ok: false, code: 'malformed_private_key', detail: shape };
  }

  return { ok: true, credentials: { projectId, clientEmail, privateKey } };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * The signed assertion Google exchanges for an access token.
 *
 * Exported because it is the one piece of this file that can be verified
 * without a network: a test decodes it, asserts the claims, and asserts that
 * the signature verifies against the public half of a key pair it generated
 * itself. That is a positive test of the mechanism (R154) rather than the
 * absence of an error.
 */
export function signAssertion(credentials: FcmCredentials, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: MESSAGING_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: nowSeconds,
      exp: nowSeconds + ASSERTION_TTL_S,
    }),
  );

  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(credentials.privateKey, 'base64url');

  return `${header}.${claims}.${signature}`;
}

/** What the sender needs from the outside world, so a test can supply it. */
export interface FcmDependencies {
  readonly fetch: typeof globalThis.fetch;
  /** Milliseconds since the epoch. */
  readonly now: () => number;
}

interface CachedToken {
  readonly value: string;
  /** Seconds since the epoch. */
  readonly expiresAt: number;
}

class FcmSender implements PushSender {
  private token: CachedToken | null = null;

  constructor(
    private readonly credentials: FcmCredentials,
    private readonly deps: FcmDependencies,
  ) {}

  /**
   * An access token, minted at most once an hour.
   *
   * NOT CACHED ACROSS A FAILURE. A refused exchange leaves `token` null, so
   * the next send tries again rather than replaying whatever was there.
   */
  private async accessToken(): Promise<string> {
    const nowSeconds = Math.floor(this.deps.now() / 1000);

    if (this.token !== null && nowSeconds < this.token.expiresAt - TOKEN_SKEW_S) {
      return this.token.value;
    }

    const body = new URLSearchParams({
      grant_type: JWT_BEARER,
      assertion: signAssertion(this.credentials, nowSeconds),
    });

    const response = await this.deps.fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`[push] the token exchange answered ${response.status}`);
    }

    const payload = (await response.json()) as { access_token?: string; expires_in?: number };

    if (typeof payload.access_token !== 'string' || payload.access_token === '') {
      throw new Error('[push] the token exchange answered without an access_token');
    }

    this.token = {
      value: payload.access_token,
      expiresAt: nowSeconds + (payload.expires_in ?? ASSERTION_TTL_S),
    };

    return this.token.value;
  }

  async send(token: string, notification: PushNotification): Promise<PushAttempt> {
    // A FAILURE TO GET AN ACCESS TOKEN IS NOT A FACT ABOUT THE DEVICE TOKEN.
    // It is reported as `undelivered` with no status, which keeps the row -
    // the case the whitelist in sender.ts exists for, arriving one layer up.
    let bearer: string;

    try {
      bearer = await this.accessToken();
    } catch (cause) {
      console.error('[push] no access token:', cause instanceof Error ? cause.message : 'unknown');

      return { outcome: 'undelivered', status: null };
    }

    const url = `https://fcm.googleapis.com/v1/projects/${this.credentials.projectId}/messages:send`;

    try {
      const response = await this.deps.fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bearer}`,
          'content-type': 'application/json',
        },
        // AN-FCM-CLIENT (R1152): DATA-ONLY. A `notification` block is drawn by
        // the Android system tray whenever the app is backgrounded or not
        // running, and the app's code is never called - so the phone could not
        // apply its own rules for the one daily reminder (today confirmed on
        // the phone, a reminder already shown, nobody signed in) nor post it on
        // the R339 channel with its buttons and lock-screen version. The data
        // payload alone reaches FirebaseMessagingService, which decides and
        // writes its own sentence; `title` and `body` stay on PushNotification
        // for the console sender and are never sent. `high` because the
        // reminder is time-bound and a user-visible notification follows.
        body: JSON.stringify({
          message: {
            token,
            data: notification.data,
            android: { priority: 'high' },
          },
        }),
      });

      return { outcome: classifyPushStatus(response.status), status: response.status };
    } catch (cause) {
      // A NETWORK ERROR IS NOT A DEAD TOKEN, and this is the branch where
      // conflating them would be easiest: there is no status to read, so a
      // careless default would have to invent one.
      console.error('[push] send threw:', cause instanceof Error ? cause.message : 'unknown');

      return { outcome: 'undelivered', status: null };
    }
  }
}

export type FcmSenderResult =
  | { readonly ok: true; readonly sender: PushSender }
  | FcmCredentialRefusal;

/**
 * The real sender, or the named reason there is not one.
 *
 * IT RETURNS RATHER THAN THROWS, because every caller has something sensible
 * to do with the refusal and nothing sensible to do with an exception: the
 * scheduler logs it and carries on with no push transport, and a test asserts
 * the code. FW28 is where `not_configured` stops being the expected answer.
 */
export function createFcmSender(
  env: EnvLike = process.env,
  deps: FcmDependencies = { fetch: globalThis.fetch, now: () => Date.now() },
): FcmSenderResult {
  const read = readFcmCredentials(env);

  if (!read.ok) return read;

  return { ok: true, sender: new FcmSender(read.credentials, deps) };
}
