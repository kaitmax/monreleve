// web/tests/unit/meta/api-contract.test.ts
//
// EVERY /api/v1 ROUTE IS DESCRIBED BY THE CONTRACT. FW31.
//
// ============================================================================
// WHY THIS EXISTS
// ============================================================================
//
// `docs/api-v1.md` opens "the contract with the Android client" and says
// "FW23 freezes it". FW30 found it omitted FOUR of the thirteen /api/v1
// routes: /export/pdf, /export/csv, /account/export and /account/delete -
// including the one that produces the Releve annuel, which is the product's
// whole reason to exist, and both GDPR rights paths.
//
// THE FREEZE PROTECTS WHAT IS WRITTEN DOWN. R187, extended to routes, makes a
// rename a migration plus an app release plus every version still calling the
// old shape. A route the contract never mentions is outside that protection
// entirely: renaming /api/v1/export/pdf breached no frozen contract, because
// the contract did not know it existed.
//
// ============================================================================
// DERIVED, NOT LISTED (R246's lesson)
// ============================================================================
//
// The route set is read from the filesystem, because that is what Next routes
// from. A hand-kept list would be correct on the day it was written and would
// then drift in exactly the way it is here to prevent - which is how four
// routes went unnoticed through eleven tasks.
//
// BOTH DIRECTIONS (R196). Undocumented routes are the defect that prompted
// this; documented routes that no longer exist are the same defect facing the
// other way, and a client would discover those by calling them.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = 'app/api';
const CONTRACT = readFileSync('../docs/api-v1.md', 'utf8');

/** Every route handler under app/api, as the path Next serves it at. */
function routePaths(dir: string, prefix = ''): string[] {
  const found: string[] = [];

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);

    if (statSync(full).isDirectory()) {
      found.push(...routePaths(full, `${prefix}/${name}`));
      continue;
    }

    if (name === 'route.ts') found.push(prefix);
  }

  return found;
}

const ALL = routePaths(API_ROOT, '/api').sort();
const V1 = ALL.filter((path) => path.startsWith('/api/v1/'));

/**
 * Every /api/v1 path the contract mentions anywhere in its prose.
 *
 * A SOURCE REFERENCE IS NOT A ROUTE. The document cites handlers as
 * `web/app/api/v1/export/csv/route.ts`, and a naive scan reads that as a route
 * called /api/v1/export/csv/route - which the reverse assertion below would
 * then report as documented-but-not-served. The lookbehind drops anything
 * preceded by `app`, and the trailing `/route` is stripped for the same reason.
 */
function documented(): ReadonlySet<string> {
  const found = CONTRACT.match(/(?<!app)\/api\/v1\/[a-z0-9/-]+/g) ?? [];

  return new Set(found.map((m) => m.replace(/\/route$/, '').replace(/\/$/, '')));
}

describe('the /api/v1 contract describes every route (FW31)', () => {
  it('found the routes and the contract at all', () => {
    // R133: the assertions below are satisfied by an empty set, so this
    // establishes that both sides were actually read before either is judged.
    expect(V1.length, 'v1 route handlers found under app/api/v1').toBeGreaterThan(5);
    expect(CONTRACT.length, 'docs/api-v1.md was read').toBeGreaterThan(1_000);
    expect(documented().size, 'the contract mentions some /api/v1 paths').toBeGreaterThan(5);
  });

  it.each(V1)('%s is described by docs/api-v1.md', (path) => {
    expect(
      documented().has(path),
      `${path} is served by app${path}/route.ts and docs/api-v1.md never mentions it. ` +
        'The document calls itself the contract with the Android client and says FW23 froze ' +
        'it; a route it does not describe is outside that freeze, so renaming it would ' +
        'breach nothing and the client would find out by failing. Describe it - ' +
        'DOCUMENTING AN EXISTING ROUTE IS NOT A CHANGE TO THE CONTRACT.',
    ).toBe(true);
  });

  it('describes no /api/v1 route that does not exist', () => {
    // The other direction. A path in the document that Next does not serve is
    // a client instruction to call something that answers 404.
    const served = new Set(V1);
    const phantom = [...documented()].filter((path) => !served.has(path));

    expect(phantom, `docs/api-v1.md describes ${phantom.join(', ')}, which no route serves`).toEqual(
      [],
    );
  });
});
