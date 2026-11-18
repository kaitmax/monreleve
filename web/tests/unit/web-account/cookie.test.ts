// web/tests/unit/web-account/cookie.test.ts
//
// R899/R900: THE ONE COOKIE, ATTRIBUTE BY ATTRIBUTE (R345 - values, not
// defaults), and the one parser that reads it.

import { describe, expect, it } from 'vitest';
import { ACCOUNT_PATH } from '@/lib/content/routes';
import { WEB_SESSION_TTL_MS } from '@/lib/auth/web-session';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_NAME,
  clearedSessionCookieHeader,
  sessionCookieHeader,
  sessionTokenFrom,
} from '@/lib/web-account/cookie';

const TOKEN = 'Abc_def-0123456789ABCDEFGHIJKLMNOPQRSTUVWXY';

/** The attributes of a Set-Cookie value, lower-cased names, as a map. */
function attributes(header: string): Map<string, string> {
  const [, ...parts] = header.split(';').map((part) => part.trim());

  return new Map(
    parts.map((part) => {
      const [name, ...value] = part.split('=');

      return [String(name).toLowerCase(), value.join('=')];
    }),
  );
}

describe('the session cookie carries exactly the stated attributes', () => {
  const header = sessionCookieHeader(TOKEN);
  const attrs = attributes(header);

  it('is name=value first', () => {
    expect(header.startsWith(`${SESSION_COOKIE_NAME}=${TOKEN};`)).toBe(true);
  });

  it('has exactly Path, Max-Age, HttpOnly, Secure and SameSite - nothing else, no Domain', () => {
    expect([...attrs.keys()].sort()).toEqual(['httponly', 'max-age', 'path', 'samesite', 'secure']);
    expect(attrs.has('domain')).toBe(false);
    expect(attrs.has('expires')).toBe(false);
  });

  it('is scoped to the account path, which is the registry constant', () => {
    expect(attrs.get('path')).toBe(ACCOUNT_PATH);
    expect(SESSION_COOKIE.path).toBe(ACCOUNT_PATH);
  });

  it('lives exactly as long as the server session', () => {
    expect(Number(attrs.get('max-age'))).toBe(WEB_SESSION_TTL_MS / 1000);
    expect(Number(attrs.get('max-age'))).toBe(1800);
  });

  it('is HttpOnly, Secure and SameSite=Lax', () => {
    expect(attrs.get('httponly')).toBe('');
    expect(attrs.get('secure')).toBe('');
    expect(attrs.get('samesite')).toBe('Lax');
  });

  it('declares the same values as data', () => {
    expect(SESSION_COOKIE).toEqual({
      name: 'monreleve_session',
      path: '/mon-releve',
      maxAgeSeconds: 1800,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });
  });
});

describe('the removal matches the cookie it removes', () => {
  const cleared = attributes(clearedSessionCookieHeader());

  it('is an empty value with Max-Age=0', () => {
    expect(clearedSessionCookieHeader().startsWith(`${SESSION_COOKIE_NAME}=;`)).toBe(true);
    expect(cleared.get('max-age')).toBe('0');
  });

  it('uses the SAME Path - a browser deletes only on a name, path and domain match', () => {
    expect(cleared.get('path')).toBe(ACCOUNT_PATH);
    expect(cleared.has('domain')).toBe(false);
  });
});

describe('one parser reads it', () => {
  it('finds the value among other cookies', () => {
    expect(sessionTokenFrom(`other=1; ${SESSION_COOKIE_NAME}=${TOKEN}; third=x`)).toBe(TOKEN);
  });

  it('answers null with no header, no cookie of ours, or an empty value', () => {
    expect(sessionTokenFrom(null)).toBeNull();
    expect(sessionTokenFrom('')).toBeNull();
    expect(sessionTokenFrom('other=1')).toBeNull();
    expect(sessionTokenFrom(`${SESSION_COOKIE_NAME}=`)).toBeNull();
  });

  it('refuses a value that cannot be one this server minted, before any lookup', () => {
    expect(sessionTokenFrom(`${SESSION_COOKIE_NAME}=not a token`)).toBeNull();
    expect(sessionTokenFrom(`${SESSION_COOKIE_NAME}=short`)).toBeNull();
    expect(sessionTokenFrom(`${SESSION_COOKIE_NAME}=${'x'.repeat(201)}`)).toBeNull();
  });

  it('does not mistake a cookie whose name merely starts with ours', () => {
    expect(sessionTokenFrom(`${SESSION_COOKIE_NAME}x=${TOKEN}`)).toBeNull();
  });
});
