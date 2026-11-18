// web/tests/unit/meta/account-cookie-scope.test.ts
//
// R900: NO PUBLIC ROUTE READS OR WRITES THE ACCOUNT COOKIE, AND THE CENSUS IS
// NOT VACUOUS.
//
// The zero-cookie guarantee is now "every public page" (SPEC 10, R898), and the
// account area is the one exception. This file is the exception's boundary,
// stated as code:
//
//   1. only the account area imports the cookie module;
//   2. no page, layout, route handler or middleware outside app/(account)/
//      reaches it through any chain of imports;
//   3. nothing in those graphs reads a request cookie by any other means.
//
// PRESENCE FIRST (R169's corollary). Each absence below is only meaningful
// once the census is shown to SEE things: it finds the account area's own
// importers, the account entry points do reach the module, and the reader
// pattern recognises each form of a cookie read.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COOKIE_MODULE,
  COOKIE_READ,
  WEB,
  cookieImportersOutsideTheArea,
  cookieModuleImporters,
  cookieReadsOutsideTheArea,
  entryPointsReachingTheCookie,
  importClosure,
  nonAccountEntryPoints,
} from '@/tests/support/account-cookie-scope';

describe('the census sees what it is looking for (presence first)', () => {
  it('finds the account area importing the cookie module', () => {
    const importers = cookieModuleImporters();

    expect(importers).toContain('lib/web-account/session.ts');
    expect(importers).toContain('app/(account)/mon-releve/connexion/verification/route.ts');
    expect(importers).toContain('app/(account)/mon-releve/deconnexion/route.ts');
  });

  it('follows imports: the account page reaches the cookie module through session.ts', () => {
    const page = join(WEB, 'app', '(account)', 'mon-releve', 'page.tsx');

    expect(importClosure(page).has(COOKIE_MODULE)).toBe(true);
  });

  it('walks the real public surface, not a chosen few', () => {
    const entries = nonAccountEntryPoints().map((file) => file.replace(/\\/gu, '/'));

    expect(entries.length).toBeGreaterThan(30);
    expect(entries.some((file) => file.endsWith('app/(public)/page.tsx'))).toBe(true);
    expect(entries.some((file) => file.endsWith('app/api/v1/export/pdf/route.ts'))).toBe(true);
    expect(entries.some((file) => file.endsWith('middleware.ts'))).toBe(true);
    expect(entries.some((file) => file.includes('(account)'))).toBe(false);
  });

  it('recognises every form of a cookie read', () => {
    expect(COOKIE_READ.test("const jar = await cookies();")).toBe(true);
    expect(COOKIE_READ.test('request.cookies.get(name)')).toBe(true);
    expect(COOKIE_READ.test("request.headers.get('cookie')")).toBe(true);
    expect(COOKIE_READ.test('headers.get("cookie")')).toBe(true);
    expect(COOKIE_READ.test('the cookie sentence')).toBe(false);
  });
});

describe('the boundary holds', () => {
  it('only the account area imports the cookie module', () => {
    expect(cookieImportersOutsideTheArea()).toEqual([]);
  });

  it('no public page, API route or middleware reaches it through any import chain', () => {
    expect(entryPointsReachingTheCookie()).toEqual([]);
  });

  it('nothing in a public module graph reads a request cookie by any other means', () => {
    expect(cookieReadsOutsideTheArea()).toEqual([]);
  });
});
