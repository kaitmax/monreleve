// web/tests/support/web-account.ts
//
// Driving the website's account area THROUGH ITS ROUTE HANDLERS (R204): the
// two sign-in steps, sign-out, and the code read out of the fake outbox the way
// a person reads it off their screen. Shared by tests/db/web-sign-in.test.ts,
// tests/db/privacy-claims.test.ts and tests/db/web-round-trip.test.ts, so the
// three cannot drive the flow three slightly different ways.

import { readOutbox } from '@/lib/alerts/mailer';
import { drainAfterWork } from '@/tests/support/after-work';
import { ACCOUNT_FIELDS, ACCOUNT_PARAMS, ACCOUNT_PATHS } from '@/lib/web-account/paths';
import { POST as sendRoute } from '@/app/(account)/mon-releve/connexion/envoi/route';
import { POST as verifyRoute } from '@/app/(account)/mon-releve/connexion/verification/route';
import { POST as signOutRoute } from '@/app/(account)/mon-releve/deconnexion/route';

/** The site the handlers are addressed at. Any host works in-process; this one is ours. */
export const SITE = 'https://monreleve.ch';

/** A network source, so the per-IP buckets are exercised. */
export const SITE_IP = '203.0.113.40';

export interface PostOptions {
  /** The Origin header. `null` sends none at all. Defaults to SITE. */
  readonly origin?: string | null;
  readonly fetchSite?: string;
  readonly cookie?: string;
  readonly ip?: string;
  /**
   * Leave the work step one handed to after() un-run (Web Ruling 37, R1072),
   * to observe the response alone. By default it runs, as Next runs it once
   * the response has gone.
   */
  readonly keepAfterWork?: boolean;
}

/** A form POST as a browser on this site sends one. */
export function sitePost(path: string, fields: Readonly<Record<string, string>>, options: PostOptions = {}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    host: new URL(SITE).host,
    'x-forwarded-for': options.ip ?? SITE_IP,
  };
  const origin = options.origin === undefined ? SITE : options.origin;

  if (origin !== null) headers.origin = origin;
  if (options.fetchSite !== undefined) headers['sec-fetch-site'] = options.fetchSite;
  if (options.cookie !== undefined) headers.cookie = options.cookie;

  return new Request(`${SITE}${path}`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(fields).toString(),
  });
}

/** Where a 303 sends the browser, as a URL resolved against the site. */
export function locationOf(response: Response): URL {
  const location = response.headers.get('location');

  if (location === null) throw new Error(`no Location on a ${String(response.status)}`);

  return new URL(location, SITE);
}

/** The latest code the outbox holds for an address, read off the message text. */
export function codeFromOutboxFor(email: string): string {
  const messages = readOutbox().filter((message) => message.to === email);
  const latest = messages.at(-1);
  const line = (latest?.text ?? '').split('\n').find((row) => /^\d+$/u.test(row.trim()));

  if (line === undefined) throw new Error(`no code in the outbox for ${email}`);

  return line.trim();
}

/** Step one through its handler. Returns the response and the sealed step it carries. */
export async function requestCodeOnSite(
  email: string,
  options: PostOptions = {},
): Promise<{ readonly response: Response; readonly step: string | null }> {
  const response = await sendRoute(sitePost(ACCOUNT_PATHS.send, { [ACCOUNT_FIELDS.email]: email }, options));

  if (options.keepAfterWork !== true) await drainAfterWork();
  const step = response.headers.get('location') === null
    ? null
    : locationOf(response).searchParams.get(ACCOUNT_PARAMS.step);

  return { response, step };
}

/** Step two through its handler. */
export async function submitCodeOnSite(step: string, code: string, options: PostOptions = {}): Promise<Response> {
  return verifyRoute(
    sitePost(ACCOUNT_PATHS.verify, { [ACCOUNT_FIELDS.step]: step, [ACCOUNT_FIELDS.code]: code }, options),
  );
}

/** Sign-out through its handler. */
export async function signOutOnSite(cookie: string | undefined, options: PostOptions = {}): Promise<Response> {
  return signOutRoute(sitePost(ACCOUNT_PATHS.signOut, {}, { ...options, ...(cookie === undefined ? {} : { cookie }) }));
}

/** Both steps, the code read from the outbox. Returns the code step's response. */
export async function signInOnSite(email: string, options: PostOptions = {}): Promise<Response> {
  const { step } = await requestCodeOnSite(email, options);

  if (step === null) throw new Error('step one did not carry a sealed step');

  return submitCodeOnSite(step, codeFromOutboxFor(email), options);
}

/** Every Set-Cookie a response carries, one entry each. */
export function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

/** The `name=value` pair of a Set-Cookie, for sending it back as a Cookie header. */
export function cookiePairOf(setCookie: string): string {
  return setCookie.split(';')[0]?.trim() ?? '';
}
