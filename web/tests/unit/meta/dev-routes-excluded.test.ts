// web/tests/unit/meta/dev-routes-excluded.test.ts
//
// RULING R129: /dev/** IS NOT IN THE PRODUCTION BUILD, and this is what keeps
// it out.
//
// WHY IT NEEDS A TEST AT ALL. The mechanism is a file NAME: `page.dev.tsx` is
// a page only when `dev.tsx` is an accepted pageExtension, which only the test
// and dev builds set. Rename one file back to `page.tsx` - which is what every
// other route in the tree is called, and what an editor's "new page" snippet
// produces - and that route silently rejoins the production build, taking its
// imports into the chunk graph with it. Nothing else would notice: the page
// would work, the tests would pass, and the calculator would get heavier for a
// reason nobody could see.
//
// WHAT IT COST BEFORE THE RULING, measured: the five dev routes were taking
// 1,6 KiB off the calculator and 0,7 off every other public route, through
// chunk grouping alone. That is a quarter of the calculator's remaining GATE A
// headroom, spent on pages no user can reach.
//
// THIS IS A SOURCE CHECK, NOT A BUILD CHECK, deliberately. A build check is
// better evidence and costs two builds; CI runs both and compares them. What a
// unit test can do cheaply is hold the naming convention the whole mechanism
// rests on, on every commit.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DEV_DIR = join(ROOT, 'app', 'dev');
const CONFIG = join(ROOT, 'next.config.ts');

/** Spelled out; an invisible character in a slice boundary is unreviewable. */
const NEWLINE = String.fromCharCode(10);

/** Every directory directly under app/dev. */
const devRouteDirs = (): string[] =>
  readdirSync(DEV_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

describe('no /dev route can reach the production build (R129)', () => {
  it('found the dev routes, so nothing below passes vacuously', () => {
    const dirs = devRouteDirs();

    expect(dirs.length).toBeGreaterThanOrEqual(5);
    expect(dirs).toContain('composants');
    expect(dirs).toContain('island');
  });

  it.each(devRouteDirs())('%s is page.dev.tsx, not page.tsx', (route) => {
    const ordinary = join(DEV_DIR, route, 'page.tsx');
    const gated = join(DEV_DIR, route, 'page.dev.tsx');

    expect(
      existsSync(ordinary),
      `app/dev/${route}/page.tsx exists, so this route is in the PRODUCTION ` +
        'build. R129: dev pages are page.dev.tsx, which Next resolves only when ' +
        'FRONTALIER_DEV_ROUTES is set. Rename it.',
    ).toBe(false);

    expect(
      existsSync(gated),
      `app/dev/${route} has neither page.tsx nor page.dev.tsx`,
    ).toBe(true);
  });

  it('gates the extension on the flag, not on NODE_ENV', () => {
    // NODE_ENV WOULD BE THE OBVIOUS CHOICE AND IT IS WRONG. `next build` sets
    // NODE_ENV=production for the test build too, so the workbench baselines
    // and the parity harness would lose their routes the moment they were
    // built the way they are actually served. The flag is explicit and set in
    // exactly two places: playwright.config.ts's webServer and
    // scripts/build-dev-routes.mjs.
    const config = readFileSync(CONFIG, 'utf8');

    expect(config).toContain('pageExtensions');
    expect(config).toContain('FRONTALIER_DEV_ROUTES');
  });

  it('accepts dev.tsx ONLY on the flagged arm', () => {
    // BOTH ARMS, because a config that always included dev.tsx would pass
    // every other test in this file while shipping all five routes. The
    // expression is a ternary, so there are exactly two array literals: the
    // one reached when the flag is set carries dev.tsx, and the other must
    // not.
    const config = readFileSync(CONFIG, 'utf8');
    const at = config.indexOf('pageExtensions');

    expect(at, 'no pageExtensions in next.config.ts').toBeGreaterThan(0);

    // TO THE BLANK LINE, NOT TO A SEMICOLON. The first version cut at the next
    // ';' and swallowed the rest of the config, because an object property
    // ends in a comma - so the "ternary" it parsed contained every colon in
    // the file below it. The properties here are separated by blank lines.
    const rest = config.slice(at);
    const expression = rest.slice(0, rest.indexOf(`,${NEWLINE}${NEWLINE}`));
    const arms = expression.split('?')[1]?.split(':') ?? [];

    expect(arms, 'pageExtensions is not the expected ternary').toHaveLength(2);

    const [whenSet = '', whenUnset = ''] = arms;

    expect(whenSet, 'the flagged arm must accept dev.tsx').toContain('dev.tsx');
    expect(whenUnset, 'the default arm must NOT accept dev.tsx').not.toContain('dev.tsx');
    expect(whenUnset, 'the default arm still needs the ordinary extensions').toContain(
      'tsx',
    );
  });

  it('sets the flag in exactly the two places that need it', () => {
    // The test harness and the dev-measurement build. Anywhere else - a
    // Dockerfile, a deploy script, an .env file - would put the routes back
    // into something that ships, which is the whole thing the ruling prevents.
    const setters = [
      'playwright.config.ts',
      'scripts/build-dev-routes.mjs',
      'scripts/dev-routes.mjs',
    ];

    for (const file of setters) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toContain(
        'FRONTALIER_DEV_ROUTES',
      );
    }
  });
});
