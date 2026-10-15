// web/tests/unit/meta/redirect-origin.test.ts
//
// FW-REDIRECT (R365): no redirect is built from an origin the REQUEST
// supplied.
//
// ============================================================================
// THE BUG THIS FENCES, WHICH WAS FOUND ON THE LIVE SITE AND NOT BY A TEST
// ============================================================================
//
// The confirmation email links to /api/alertes/confirm?token=..., which
// confirmed the subscription and then redirected the browser to
//
//     https://0.0.0.0:3000/alertes/confirmation/confirmee
//
// an address no browser can open. Inside the image `request.nextUrl.origin`
// IS http://0.0.0.0:3000, because the standalone server is started with
// ENV HOSTNAME="0.0.0.0" so that it binds every interface behind the proxy.
// The server's view of its own address is not the reader's view of it.
//
// app/api/alertes/route.ts had already met this exact defect and fixed it
// with a RELATIVE Location - its comment block says "4 of 284 e2e specs,
// green against next start, failing against the image". The two sibling
// routes were never moved over, and both are in every alert email.
//
// ============================================================================
// WHY A SOURCE SCAN RATHER THAN A BEHAVIOUR TEST
// ============================================================================
//
// A behaviour test CANNOT see this. Under `next start` on a developer's
// machine the origin is http://localhost:3000 and every assertion about the
// Location passes; the value only becomes wrong when HOSTNAME is 0.0.0.0,
// which is the image. The e2e suite proved that twice over - four specs that
// were green locally and red against the container.
//
// So the fence is on the SHAPE OF THE CODE, which is the same everywhere.
// R366 proves the behaviour in the image separately; this stops the class
// coming back in a route nobody thought to run against a container.
//
// WHAT IS FORBIDDEN IS NARROW ON PURPOSE: an origin taken from the request,
// reaching a redirect or a Location header. Reading query parameters off
// `request.nextUrl` or `new URL(request.url)` is entirely fine and is what
// most of these files do - the report lists every other use and why each is
// safe.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const SKIP = new Set([
  'node_modules',
  '.next',
  '.next-dev-routes',
  'dist-parity',
  'test-results',
  'playwright-report',
]);

const norm = (path: string): string => relative(root, path).split(sep).join('/');

function sources(from: string): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };

  walk(join(root, from));

  return found;
}

/**
 * An origin the REQUEST supplied.
 *
 * `request.nextUrl.origin` is the one that shipped. The others are the same
 * mistake spelled differently, and are included because the next instance
 * will not be a copy of this one: a fence that only knows the spelling it was
 * written against is a fence against one commit.
 */
const REQUEST_ORIGIN =
  /(?:request|req)\.nextUrl\.origin|new URL\(\s*(?:request|req)\.url\s*\)\.origin|(?:request|req)\.nextUrl\.href|\.headers\.get\(\s*['"`](?:host|x-forwarded-host)['"`]\s*\)/;

/**
 * A place a URL is handed to the browser as somewhere to GO.
 *
 * NextResponse.redirect, a Location header, and next/navigation's redirect.
 */
const REDIRECT_SINK =
  /NextResponse\.redirect|Response\.redirect|["'`]?Location["'`]?\s*:|\bredirect\(/;

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/**
 * Both halves within a short window of each other.
 *
 * THE WINDOW IS THE WHOLE STATEMENT, NOT THE LINE, because the shipped
 * instance is spread over three lines:
 *
 *     return NextResponse.redirect(
 *       new URL(`${CONFIRMATION_PATH}/${state}`, request.nextUrl.origin),
 *       303,
 *     );
 *
 * A line-by-line scan finds the sink on one line and the origin on another
 * and reports neither, which is how a guard passes over the exact code it
 * was written for.
 */
/**
 * A line that is entirely a comment.
 *
 * COMMENTS ARE BLANKED BEFORE SCANNING, and the reason is not convenience.
 * This fence's first run after the fix flagged lib/http/redirect.ts, whose
 * header QUOTES the broken call in order to explain it:
 *
 *     //     NextResponse.redirect(new URL(path, request.nextUrl.origin), 303)
 *
 * The rule is about what the code DOES. The two ways out were to blank
 * comments or to reword the explanation around the scanner - and rewording
 * is evasion (R181): it leaves the fence unable to tell prose from code and
 * teaches the next author to describe the defect vaguely so the guard stays
 * quiet. A file documenting the mistake it exists to prevent is exactly the
 * file you want.
 *
 * ONLY WHOLE-LINE COMMENTS ARE BLANKED. A line carrying real code plus a
 * trailing comment still has its code scanned, so this cannot be used to
 * hide a call by putting a comment on the same line.
 */
const COMMENT_ONLY = /^\s*(?:\/\/|\/\*|\*)/;

function offences(paths: readonly string[]): Offence[] {
  const found: Offence[] = [];

  for (const path of paths) {
    const lines = readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => (COMMENT_ONLY.test(line) ? '' : line));

    for (let i = 0; i < lines.length; i += 1) {
      if (!REDIRECT_SINK.test(lines[i] ?? '')) continue;

      // The sink's line plus the three after it: enough for a multi-line
      // call, short enough that two unrelated statements do not pair up.
      const window = lines.slice(i, i + 4).join('\n');

      if (REQUEST_ORIGIN.test(window)) {
        found.push({ file: norm(path), line: i + 1, text: (lines[i] ?? '').trim() });
      }
    }
  }

  return found;
}

const SCANNED = [...sources('app'), ...sources('lib')].filter(
  (path) => !/\.test\.tsx?$/.test(path),
);

describe('R365: a redirect never carries an origin the request supplied', () => {
  it('scans a non-empty set of files, so an empty result means something', () => {
    // R169's presence corollary: "no offences" is satisfied by scanning
    // nothing at all. The number is a floor, not a census - it moves when
    // the product grows, and it is here to catch a walk that found nothing.
    expect(SCANNED.length).toBeGreaterThan(50);
  });

  it('finds the sink AND the origin when both are present', () => {
    // The scanner is tested before its result is trusted (R180's shape,
    // applied to a guard rather than to a plant). Without this, a regex
    // typo makes the fence below pass for the wrong reason, forever.
    const sample = [
      'return NextResponse.redirect(',
      '  new URL(`${PATH}/${state}`, request.nextUrl.origin),',
      '  303,',
      ');',
    ].join('\n');

    const lines = sample.split('\n');

    expect(REDIRECT_SINK.test(lines[0] ?? '')).toBe(true);
    expect(REQUEST_ORIGIN.test(lines.slice(0, 4).join('\n'))).toBe(true);
  });

  it('does not flag reading a query parameter off the request', () => {
    // The thing that must stay legal, asserted so the fence cannot be
    // tightened into uselessness by a later edit.
    const legal = "const token = request.nextUrl.searchParams.get('token') ?? '';";

    expect(REQUEST_ORIGIN.test(legal)).toBe(false);
  });

  it('holds across app/ and lib/', () => {
    const found = offences(SCANNED);

    expect(
      found,
      found.length === 0
        ? ''
        : `a redirect built from the request's own origin, which is ` +
          `http://0.0.0.0:3000 inside the image:\n` +
          found.map((one) => `  ${one.file}:${one.line}  ${one.text}`).join('\n'),
    ).toEqual([]);
  });
});

describe('R365: the fence reads code, not prose', () => {
  it('ignores a comment that quotes the broken call, and still sees the call', () => {
    // Both directions in one test, because blanking comments is only safe if
    // it blanks ONLY comments (R196). The first line is the header of
    // lib/http/redirect.ts verbatim; the second is the shipped defect.
    expect(COMMENT_ONLY.test('//     NextResponse.redirect(new URL(p, request.nextUrl.origin), 303)')).toBe(
      true,
    );
    expect(COMMENT_ONLY.test('  return NextResponse.redirect(')).toBe(false);
  });

  it('does not let a trailing comment hide a call', () => {
    // A line with code on it is scanned whatever follows the code.
    expect(COMMENT_ONLY.test('  return NextResponse.redirect(u); // explained above')).toBe(false);
  });
});
