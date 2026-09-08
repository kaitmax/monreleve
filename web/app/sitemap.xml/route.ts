// web/app/sitemap.xml/route.ts
//
// RULING R81: under the runtime marker, a site origin resolving to the
// localhost fallback makes this return 503.
//
// A ROUTE HANDLER RATHER THAN app/sitemap.ts, and that is forced by R81 rather
// than chosen. Next's `sitemap.ts` convention returns a data structure and
// Next serialises it; there is no way to return a status code from it, so a
// 503 is not expressible. This is the same URL by a mechanism that can refuse.
//
// WHY REFUSING BEATS SERVING SOMETHING. A sitemap listing
// http://localhost:3000/... is well-formed XML. A crawler fetches it, resolves
// nothing, and may treat the whole document as authoritative - so the failure
// is not "no sitemap" but "a sitemap that says the site has no reachable
// pages", and nothing in the pipeline objects because the file is valid. 503
// is the honest answer: the resource exists and cannot be produced correctly
// right now. Crawlers retry a 503; they act on a 200.
//
// THE CONTENT IS DELIBERATELY MINIMAL HERE. FW10 increment 5 builds the route
// registry in lib/content/routes.ts that feeds this, robots.txt and the
// footer alike - "one source for every public URL". This increment owes the
// REFUSAL, not the list, and listing routes by hand now would create the
// second source of truth increment 5 exists to prevent.

import { servingWithoutOrigin, siteOrigin } from '@/lib/content/site';

/**
 * Per-request, which is what makes R81 possible at all: the runtime marker is
 * invisible to a statically prerendered page, because its output was written
 * at build time. A route handler runs when asked.
 */
export const dynamic = 'force-dynamic';

const DEGRADED =
  'The site origin is not configured. NEXT_PUBLIC_SITE_URL is unset and this ' +
  'process is serving (FRONTALIER_RUNTIME=1), so every URL in this document ' +
  'would point at localhost. Refusing rather than publishing a sitemap that ' +
  'resolves to nothing. Ruling R81.';

export function GET(): Response {
  if (servingWithoutOrigin()) {
    return new Response(DEGRADED, {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // Nothing should cache a refusal: the fix is an environment variable,
        // and the next request after a redeploy must get the real document.
        'cache-control': 'no-store',
      },
    });
  }

  const origin = siteOrigin();

  // FW10 increment 5 replaces this with the route registry. Only "/" is
  // listed, because it is the only public route that exists today and a
  // hand-written list would be the second source increment 5 removes.
  const urls = ['/'];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((path) => `  <url><loc>${origin}${path}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
