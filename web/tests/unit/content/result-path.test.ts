// web/tests/unit/content/result-path.test.ts
//
// R351: /calculateur-teletravail-frontalier/resultat is FROZEN, and the
// middleware's literals cannot drift from the constants.
//
// WHY A PATH THAT NOTHING LINKS BECOMES PERMANENT. SPEC 14 freezes a slug once
// it is published, and "published" usually means a crawler saw it. This one is
// never crawled - it is noindex and absent from the sitemap - yet it is at
// least as frozen, because a FORM ACTION is an address a reader lands on and
// bookmarks. The home page's form and the calculator's own inputs both submit
// here, so renaming it breaks every bookmark and every pasted result link, and
// costs a 301 forever. A rename should therefore be a deliberate act with a
// failing test in front of it.
//
// AND THE MIDDLEWARE CANNOT READ THE CONSTANT. Next evaluates `export const
// config` at build time, so the matcher has to be written as literals. That is
// precisely the transcription R181 warns about - correct the day it is typed,
// silently wrong afterwards - so the one thing this file really guards is that
// those literals still equal the constants everything else builds links from.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALCULATOR_PATH, PUBLIC_ROUTES, RESULT_PATH, sitemapPaths } from '@/lib/content/routes';

const MIDDLEWARE = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');

describe('R351: the result path is frozen', () => {
  it('is exactly the published address', () => {
    // The literal, spelled out. If this line is edited, every bookmark and
    // every shared result link that has ever been pasted is broken, and the
    // change needs a 301 rather than a rename.
    expect(RESULT_PATH).toBe('/calculateur-teletravail-frontalier/resultat');
  });

  it('is a child of the calculator, so the two cannot drift apart', () => {
    expect(RESULT_PATH.startsWith(`${CALCULATOR_PATH}/`)).toBe(true);
  });

  it('is NEVER in the sitemap, and never in the registry that feeds it', () => {
    // Two assertions, because they fail for different reasons: the first
    // would catch somebody adding it to PUBLIC_ROUTES, the second would catch
    // a future sitemap that stopped reading the registry.
    expect(PUBLIC_ROUTES.map((route) => route.path)).not.toContain(RESULT_PATH);
    expect(sitemapPaths()).not.toContain(RESULT_PATH);
  });

  it('is matched by the middleware, by a literal that equals the constant', () => {
    // The transcription guard. A matcher naming a path the product no longer
    // uses would leave the result page indexable with every test still green.
    const matcher = MIDDLEWARE.slice(MIDDLEWARE.indexOf('matcher:'));

    expect(matcher).toContain(`'${RESULT_PATH}'`);
    expect(matcher).toContain(`'${CALCULATOR_PATH}'`);
  });

  it('is matched as a literal, never as a prefix or a wildcard', () => {
    // A prefix would catch every future child of the calculator, which is the
    // broad-matcher failure middleware.ts's own comment was written about.
    const matcher = MIDDLEWARE.slice(MIDDLEWARE.indexOf('matcher:'));

    expect(matcher).not.toContain(':path*');
    expect(matcher).not.toContain('/:path');
  });

  it('can tell a present matcher from a file that failed to load', () => {
    // R133's positive half: every assertion above is a substring check, and
    // all of them would pass on an empty string if the read ever silently
    // returned one.
    expect(MIDDLEWARE.length).toBeGreaterThan(500);
    expect(MIDDLEWARE).toContain('X-Robots-Tag');
  });
});
