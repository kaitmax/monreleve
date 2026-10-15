// web/tests/unit/auth/sign-in-origin.test.ts
//
// FW-FOLLOWUP (R378): a local server mints local links, and nothing else does.
//
// THE COST THAT PRODUCED THIS RULING. FW-CODE-CAP's walkthrough read a
// sign-in link out of `pnpm dev`'s terminal and followed it. The link named
// https://monreleve.ch, so the request went to the LIVE SITE, which answered
// 400 - it knew nothing of a local token. Nothing was damaged and nothing was
// sent to a real person, but a developer following a link printed by their
// own dev server should not be able to reach production by accident.
//
// THE DANGEROUS DIRECTION IS THE OTHER ONE, and it is what most of this file
// is about: a link minted on localhost and sent to a real inbox is a link
// that cannot be used at all, and on Android it also defeats the App Link,
// which verifies against monreleve.ch's /.well-known/assetlinks.json. So the
// condition fails closed - every environment that is not a confirmed dev
// server gets PRODUCTION_ORIGIN.
//
// `env` is a PARAMETER rather than a mutation of process.env, so these cases
// cannot leak into another test file (R171).

import { describe, expect, it } from 'vitest';
import { signInOrigin } from '@/lib/auth/request';
import { PRODUCTION_ORIGIN } from '@/lib/content/identity';

describe('R378: the production path is unchanged', () => {
  it('mints on the production origin under the built server', () => {
    // `next start` and `next build` both set NODE_ENV=production.
    expect(signInOrigin({ NODE_ENV: 'production' })).toBe(PRODUCTION_ORIGIN);
  });

  it('mints on the production origin inside the image', () => {
    // The runner stage sets both.
    expect(signInOrigin({ NODE_ENV: 'production', FRONTALIER_RUNTIME: '1', PORT: '3000' })).toBe(
      PRODUCTION_ORIGIN,
    );
  });

  it('mints on the production origin when nothing is set at all', () => {
    // FAILS CLOSED. An empty environment is not evidence of a dev server.
    expect(signInOrigin({})).toBe(PRODUCTION_ORIGIN);
  });

  it('mints on the production origin in a container whose NODE_ENV is wrong', () => {
    // THE REASON THE CONDITION IS TWO THINGS. If NODE_ENV alone decided this,
    // a container started with NODE_ENV=development by hand would email
    // localhost links to real people. The runtime marker overrides it.
    expect(signInOrigin({ NODE_ENV: 'development', FRONTALIER_RUNTIME: '1' })).toBe(
      PRODUCTION_ORIGIN,
    );
  });

  it('is literally https://monreleve.ch', () => {
    // R171: the assertions above read the constant, so they would all still
    // pass if it changed. This one pins the value, because it is the host
    // App Links verify against and that is a published fact, not a setting.
    expect(PRODUCTION_ORIGIN).toBe('https://monreleve.ch');
  });
});

describe('R378: only the dev server mints a local link', () => {
  it('mints on localhost under pnpm dev', () => {
    expect(signInOrigin({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });

  it('follows PORT, so a dev server moved off 3000 still mints a link to itself', () => {
    // R170: the port is a thing that moves on this machine, because other
    // products hold 3000.
    expect(signInOrigin({ NODE_ENV: 'development', PORT: '3100' })).toBe('http://localhost:3100');
  });
});
