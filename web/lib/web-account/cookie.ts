// web/lib/web-account/cookie.ts
//
// THE ONE COOKIE THIS PRODUCT SETS, AND THE ONE PLACE IT IS READ. FW-WEB-ACCOUNT
// (R899, R900).
//
// ============================================================================
// WHY A HAND-WRITTEN HEADER, NOT A LIBRARY OR next/headers' cookies().set
// ============================================================================
//
// No dependency (the prompt's hard boundary: a cookie library is Ask first),
// and no framework helper either, for a reason that is not taste: the
// attributes are the security property, and a helper's defaults are settings
// nobody chose (R345). Spelled out here, every attribute is a value somebody
// can read and a test asserts byte for byte.
//
// ============================================================================
// THE ATTRIBUTES, EACH FOR A REASON
// ============================================================================
//
//   HttpOnly        no script can read it, so an injected script cannot lift a
//                   session out of the page.
//   Secure          never sent over plain http. Browsers treat
//                   http://localhost as a secure context, which is why the e2e
//                   suite still holds it.
//   SameSite=Lax    not sent on a cross-site POST or subresource request. It
//                   IS sent on a cross-site top-level GET, which is why every
//                   state-changing request in the area is a POST behind the
//                   Origin check too (lib/web-account/csrf.ts, R902) - Lax
//                   alone is not the whole answer.
//   Path            ACCOUNT_PATH: the browser sends it to the account area and
//                   to NO public page and NO public API route (R900).
//   no Domain       host-only: never sent to a subdomain.
//   Max-Age         the session's life, derived from WEB_SESSION_TTL_MS so the
//                   browser forgets the value when the server would refuse it.
//
// ============================================================================
// WHO MAY IMPORT THIS FILE
// ============================================================================
//
// Only the account area: app/(account)/** and lib/web-account/**.
// tests/unit/meta/account-cookie-scope.test.ts fails on any other importer and
// on any public route whose module graph reaches it - the static half of
// "no public page reads the cookie".

import { ACCOUNT_PATH } from '@/lib/content/routes';
import { WEB_SESSION_TTL_MS } from '@/lib/auth/web-session';

/** The cookie's name. ASCII, no prefix: `__Host-` requires Path=/, which R900 forbids. */
export const SESSION_COOKIE_NAME = 'monreleve_session';

/** Every attribute, as values a test reads (R345). */
export const SESSION_COOKIE = {
  name: SESSION_COOKIE_NAME,
  path: ACCOUNT_PATH,
  maxAgeSeconds: WEB_SESSION_TTL_MS / 1000,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
} as const;

const ATTRIBUTES = (maxAge: number): string =>
  [
    `Path=${SESSION_COOKIE.path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    `SameSite=${SESSION_COOKIE.sameSite}`,
  ].join('; ');

/** The Set-Cookie value that opens a session. */
export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; ${ATTRIBUTES(SESSION_COOKIE.maxAgeSeconds)}`;
}

/**
 * The Set-Cookie value that removes it: an empty value, Max-Age=0, and the SAME
 * Path - a browser deletes a cookie only when name, path and domain all match,
 * so a removal at any other path would leave the session cookie in place.
 */
export function clearedSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; ${ATTRIBUTES(0)}`;
}

/** The value a base64url token can take; anything else is not ours. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,200}$/u;

/**
 * The session value in a Cookie request header, or null.
 *
 * ONE PARSER for the page and the route handlers alike, so the two cannot
 * disagree about which value is the session. A malformed value is null rather
 * than a database lookup: it cannot be one this server minted.
 */
export function sessionTokenFrom(cookieHeader: string | null): string | null {
  if (cookieHeader === null || cookieHeader === '') return null;

  for (const part of cookieHeader.split(';')) {
    const pair = part.trim();
    const equals = pair.indexOf('=');

    if (equals <= 0) continue;
    if (pair.slice(0, equals) !== SESSION_COOKIE_NAME) continue;

    const value = pair.slice(equals + 1);

    return TOKEN_SHAPE.test(value) ? value : null;
  }

  return null;
}
