// web/tests/unit/content/account-path.test.ts
//
// R900: WHERE THE ACCOUNT AREA LIVES, AND WHERE ITS COOKIE CAN GO.
//
// The cookie's Path is ACCOUNT_PATH. A browser sends it to a request whose path
// RFC 6265 section 5.1.4 "path-matches" that value - and to nothing else. So
// the question "can a public page ever receive the cookie?" has a mechanical
// answer: run the RFC's algorithm against every other route this app serves.
//
// EVERY ROUTE IS DISCOVERED FROM app/, NOT LISTED (R246's mechanism). A hand
// list would be wrong the day a route is added; this walks the directory and
// fails if any route outside app/(account)/ path-matches the cookie.

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_PATH,
  ACCOUNT_ROUTE,
  ACCOUNT_SIGN_IN_PATH,
  PUBLIC_ROUTES,
  RESULT_PATH,
  accountHrefIfLive,
} from '@/lib/content/routes';
import { PRODUCT_STATE } from '@/lib/content/product-state';

const APP = join(process.cwd(), 'app');

/** RFC 6265 5.1.4, verbatim in code. */
function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;

  return cookiePath.endsWith('/') || requestPath.charAt(cookiePath.length) === '/';
}

/** Every route file under app/, as [the URL path it serves, whether it is in the account group]. */
function discoveredRoutes(): Array<{ readonly path: string; readonly account: boolean }> {
  const found: Array<{ path: string; account: boolean }> = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (!/^(page|route)(\.dev)?\.tsx?$/u.test(entry.name)) continue;

      const segments = relative(APP, dir).split(sep).filter((segment) => segment !== '');
      const account = segments[0] === '(account)';
      const url = segments
        // Route groups do not appear in the URL.
        .filter((segment) => !/^\(.+\)$/u.test(segment))
        // A dynamic segment, given a value that could not collide by accident.
        .map((segment) => (/^\[.+\]$/u.test(segment) ? 'valeur' : segment));

      found.push({ path: `/${url.join('/')}`, account });
    }
  };

  walk(APP);

  return found;
}

describe('the account path is pinned', () => {
  it('is /mon-releve - a rename is a published URL and every session lost', () => {
    expect(ACCOUNT_PATH).toBe('/mon-releve');
  });

  it('is its own registry entry, outside PUBLIC_ROUTES (which feeds the sitemap)', () => {
    expect(PUBLIC_ROUTES.map((route) => route.path)).not.toContain(ACCOUNT_PATH);
    expect(ACCOUNT_ROUTE.path).toBe(ACCOUNT_PATH);
  });

  it('is live exactly when the product state says the area exists (R172)', () => {
    expect(ACCOUNT_ROUTE.status).toBe(PRODUCT_STATE.webAccountExists ? 'live' : 'planned');
    expect(accountHrefIfLive()).toBe(PRODUCT_STATE.webAccountExists ? ACCOUNT_SIGN_IN_PATH : null);
  });

  it('answers null for a planned area, so the header link disappears with it (R85)', () => {
    expect(accountHrefIfLive({ ...ACCOUNT_ROUTE, status: 'planned' })).toBeNull();
    expect(accountHrefIfLive({ ...ACCOUNT_ROUTE, status: 'live' })).toBe(ACCOUNT_SIGN_IN_PATH);
  });

  it('links the header to step one, inside the cookie Path - a page that answers a signed-out reader 200', () => {
    expect(ACCOUNT_SIGN_IN_PATH).toBe(`${ACCOUNT_PATH}/connexion`);
    expect(pathMatches(ACCOUNT_SIGN_IN_PATH, ACCOUNT_PATH)).toBe(true);
  });
});

describe('RFC 6265 path-match, the algorithm itself', () => {
  it('matches the path and its children', () => {
    expect(pathMatches('/mon-releve', '/mon-releve')).toBe(true);
    expect(pathMatches('/mon-releve/connexion', '/mon-releve')).toBe(true);
  });

  it('does not match a longer sibling, a parent, or a different path', () => {
    expect(pathMatches('/mon-relevex', '/mon-releve')).toBe(false);
    expect(pathMatches('/', '/mon-releve')).toBe(false);
    expect(pathMatches('/releve-annuel', '/mon-releve')).toBe(false);
    expect(pathMatches('/releve/print', '/mon-releve')).toBe(false);
  });
});

describe('no route outside the account area can receive the cookie', () => {
  const routes = discoveredRoutes();

  it('found the app routes, so nothing below passes vacuously', () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(routes.some((route) => route.path === '/api/v1/export/pdf')).toBe(true);
    expect(routes.some((route) => route.path === '/releve/print')).toBe(true);
    expect(routes.some((route) => route.account && route.path === ACCOUNT_PATH)).toBe(true);
  });

  it('every public route, every API route and every other page is outside the cookie Path', () => {
    const exposed = routes.filter((route) => !route.account && pathMatches(route.path, ACCOUNT_PATH));

    expect(exposed.map((route) => route.path)).toEqual([]);
  });

  it('every account route is inside it - a form posting outside would arrive without the cookie', () => {
    const outside = routes.filter((route) => route.account && !pathMatches(route.path, ACCOUNT_PATH));

    expect(outside.map((route) => route.path)).toEqual([]);
  });

  it('every registered public route and the result page are outside it', () => {
    for (const path of [...PUBLIC_ROUTES.map((route) => route.path), RESULT_PATH]) {
      expect(pathMatches(path, ACCOUNT_PATH), path).toBe(false);
    }
  });
});
