// web/middleware.ts
//
// FW13 AC3, the half a static page cannot serve: noindex on a param URL.
//
// WHY A HEADER RATHER THAN A META TAG. SPEC 9.4 requires every param-bearing
// URL to carry noindex and a canonical to the bare path. The canonical comes
// free - the route is static and its self-referencing canonical names the bare
// path from every URL, which is exactly what the rule asks for. The noindex
// cannot: emitting it per-URL means reading searchParams, and in Next 15.5.25
// that moves <title> and <link rel="canonical"> out of <head> and into the
// body on THIS route, which is SPEC 14's target-query page. Five arrangements
// were built and served to confirm it; the page's own header lists them.
//
// X-Robots-Tag IS THE SAME INSTRUCTION IN THE OTHER CHANNEL. Google documents
// the header and the meta tag as equivalent, and a header has two properties
// the tag lacks here: it needs no <head> to live in, and it does not force a
// dynamic render - middleware runs per request while the page stays static and
// cacheable.
//
// ONLY WHERE THERE IS A QUERY. A bare path is the indexable page and must stay
// indexable: R54's gate decides that, and this must not quietly override it.
// "?" with nothing after it is the bare path too (SPEC 9.4), so an empty query
// gets no header either.
//
// NOTHING ELSE. No rewrites, no redirects, no cookies - SPEC 20 forbids a
// cookie on a public route and this file is the one place it would be easy to
// add one by accident.

import { NextResponse, type NextRequest } from 'next/server';

/** Header and value, spelled out so the test can assert both. */
export const ROBOTS_HEADER = 'X-Robots-Tag';
export const ROBOTS_NOINDEX = 'noindex, follow';

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // `follow` rather than `none`: the links on a shared calculator page are the
  // same links as on the bare one, and there is no reason to stop a crawler
  // walking to /sources or a guide from here.
  if (request.nextUrl.search !== '' && request.nextUrl.search !== '?') {
    response.headers.set(ROBOTS_HEADER, ROBOTS_NOINDEX);
  }

  return response;
}

/**
 * The calculator only.
 *
 * SPEC 9.4's contract is about the calculator's URL, and a matcher that caught
 * every route would put noindex on any page somebody happened to append a
 * tracking parameter to - including the home page, which is exactly the kind
 * of quiet de-indexing nobody notices until traffic goes.
 */
export const config = {
  matcher: ['/calculateur-teletravail-frontalier'],
};
