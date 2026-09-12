// web/tests/unit/pages/param-metadata.test.ts
//
// FW13 increment 3 and AC3: noindex and a bare-path canonical on a param URL.
//
// THE SHAPE OF THIS INCREMENT CHANGED, and the reason is in the calculator
// page's header. The prompt asks generateMetadata to emit robots and a
// canonical conditionally on the params - and in Next 15.5.25 reading
// searchParams there makes the route dynamic, which puts <title> and the
// canonical in the BODY of the product's target-query page. Measured five
// ways. The operator's ruling: the head wins.
//
// SO THE TWO HALVES COME FROM TWO PLACES, and both are asserted here:
//
//   canonical   from the STATIC metadata, self-referencing to the bare path.
//               A canonical naming the bare path is exactly what SPEC 9.4
//               requires a param URL to carry, so this needs no condition at
//               all - it is correct for every URL by construction.
//   noindex     from middleware.ts, as an X-Robots-Tag header, which Google
//               documents as equivalent to the meta tag and which needs no
//               <head> to live in.
//
// R119: ASSERTED BY COUNT. "noindex present exactly when params exist" is a
// count of one and a count of zero, not a presence check - a matcher looking
// for "is it there" passes on a page that sets the header twice, and on one
// that sets it for every route including the bare path, which would quietly
// de-index the page the whole SEO strategy rests on.

import { describe, expect, it, vi } from 'vitest';
import { generateMetadata } from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { NextRequest } from 'next/server';
import { ROBOTS_HEADER, ROBOTS_NOINDEX, middleware } from '@/middleware';

/** The states SPEC 9.4 distinguishes, plus the two the prompt names. */
const QUERIES: ReadonlyArray<readonly [string, string, boolean]> = [
  ['the bare path', '', false],
  ['an empty ?', '?', false],
  ['one param', '?canton=GE', true],
  ['all nine', '?canton=GE&taux=80&tt=84&mfr=6&mtiers=4&methode=exact&total=200&decompte=h&debut=2026-04-01', true],
  ['an unknown param only', '?utm_source=facebook', true],
  ['a mangled value', '?canton=GE&tt=abc', true],
];

/** A request through the middleware, as Next would route it. */
function headersFor(query: string): Headers {
  const url = `https://frontalier.example${CALCULATOR_PATH}${query}`;

  // A REAL NextRequest, because the middleware reads `nextUrl` and a plain
  // Request has none - the first version of this passed one and every case
  // failed on "Cannot read properties of undefined". Building the real
  // object keeps this a test OF the middleware rather than of a
  // re-implementation of its condition.
  const response = middleware(new NextRequest(url));

  return response.headers;
}

describe('AC3: noindex exactly when params exist, by count (R119)', () => {
  it.each(QUERIES)('%s', (_label, query, expected) => {
    const value = headersFor(query).get(ROBOTS_HEADER);

    expect(value === null ? 0 : 1, `${query || '(bare)'} -> ${String(value)}`).toBe(
      expected ? 1 : 0,
    );
  });

  it('covers the bare path, the empty query and four param shapes', () => {
    // Without this the table could shrink to the cases that pass, which is
    // the vacuous-pass shape R63 exists to catch.
    expect(QUERIES).toHaveLength(6);
    expect(QUERIES.filter(([, , noindex]) => noindex)).toHaveLength(4);
    expect(QUERIES.filter(([, , noindex]) => !noindex)).toHaveLength(2);
  });

  it('treats "?" as the bare path because the URL parser drops it', () => {
    // SPEC 9.4: "? present but empty behaves exactly like the bare path."
    // The middleware has ONE condition - search is non-empty - and this is
    // what makes that sufficient. Asserted here because the property would
    // otherwise rest on a fact about URL parsing that nothing in the
    // repository states, and a mutation probe on the middleware passed while
    // a dead second clause was pretending to hold it.
    expect(new URL('https://x/p?').search).toBe('');
    expect(new URL('https://x/p').search).toBe('');
    expect(new URL('https://x/p?a=1').search).toBe('?a=1');
  });

  it('says noindex AND follow, not none', () => {
    // The links on a shared calculator page are the same links as on the bare
    // one. There is no reason to stop a crawler walking to /sources from here,
    // and `none` would.
    expect(ROBOTS_NOINDEX).toContain('noindex');
    expect(ROBOTS_NOINDEX).toContain('follow');
    expect(ROBOTS_NOINDEX).not.toContain('none');
  });

  it('sets the header once, not twice', () => {
    // A count assertion on the header itself: Headers.append would produce a
    // second value and a crawler reading the first would be reading a guess.
    const headers = headersFor('?canton=GE');
    let seen = 0;

    headers.forEach((_value, key) => {
      if (key.toLowerCase() === ROBOTS_HEADER.toLowerCase()) seen += 1;
    });

    expect(seen).toBe(1);
  });
});

describe('AC3: the canonical names the bare path, from every URL', () => {
  // IT IS THE LAYOUT'S, AND IT IS RELATIVE. app/(public)/layout.tsx sets
  // `canonical: './'`, which Next resolves per route against metadataBase -
  // so it names the ROUTE, and a route has no query string. That is why AC3
  // needs no condition here: a canonical that cannot carry a query already
  // names the bare path from every param URL.
  //
  // The RESOLVED value is asserted in e2e, against a nine-param URL, because
  // the resolution is the framework's and only a served page shows it.

  it('is absent with no origin configured, which is R81', async () => {
    // THE TEST ENVIRONMENT HAS NO NEXT_PUBLIC_SITE_URL, and R81 omits the
    // canonical entirely rather than pointing one at a localhost stand-in:
    // "a canonical pointing at localhost is an INSTRUCTION to a crawler, and
    // absence is the safer failure." So the first version of this assertion
    // expected './' and got undefined - the ruling, not a defect.
    const layout = await import('@/app/(public)/layout');

    expect(layout.metadata.alternates).toBeUndefined();
  });

  it('is RELATIVE once an origin exists, so no query can reach it', async () => {
    // The arm that matters for AC3, with the origin supplied the way the
    // e2e suite supplies it. A relative canonical is resolved per ROUTE, and
    // a route has no query string - which is why the bare-path requirement
    // needs no condition anywhere.
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://frontalier.example');
    vi.resetModules();

    try {
      const layout = await import('@/app/(public)/layout');
      const canonical = layout.metadata.alternates?.canonical;

      expect(String(canonical)).toBe('./');
      expect(String(canonical)).not.toContain('?');
      expect(String(canonical)).not.toContain('canton');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('the page adds no canonical of its own', async () => {
    // Two canonicals on one page is a crawler choosing between them. The
    // page owns the title and description; the layout owns the canonical.
    const meta = await generateMetadata();

    expect(meta.alternates).toBeUndefined();
  });

  it('is indexable metadata, because R54 decides that and not the params', async () => {
    // The bare path must stay indexable: the header is what makes a PARAM
    // URL noindex, and it must not be doing that here.
    const meta = await generateMetadata();

    expect(meta.robots).toBeUndefined();
  });
});

describe('the middleware touches the calculator and nothing else', () => {
  it('is scoped to one route', async () => {
    // A matcher catching every route would put noindex on any page somebody
    // appended a tracking parameter to - including the home page. That is the
    // kind of quiet de-indexing nobody notices until the traffic goes.
    const { config } = await import('@/middleware');

    expect(config.matcher).toEqual([CALCULATOR_PATH]);
  });

  it('sets nothing else on the response', async () => {
    // SPEC 20 forbids a cookie on a public route, and middleware is the one
    // place it would be easy to add one by accident.
    const headers = headersFor('?canton=GE');
    const names: string[] = [];

    headers.forEach((_value, key) => names.push(key.toLowerCase()));

    expect(names.filter((name) => name.includes('cookie'))).toEqual([]);
    expect(names).toContain(ROBOTS_HEADER.toLowerCase());
  });
});
