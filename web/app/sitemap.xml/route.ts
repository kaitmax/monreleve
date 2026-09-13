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
// THE LIST COMES FROM THE REGISTRY (increment 5). lib/content/routes.ts is
// the single source for every public URL: this document, robots.txt's
// disallow list, and the hrefs the shell's nav and footer render are all
// checked against it.
//
// ONLY `live` ROUTES ARE LISTED, and that is not caution. Thirteen URLs of
// which nine are 404s is worse than four: it tells a crawler the pages exist,
// it is well-formed XML, and no other gate objects - the same failure mode as
// the localhost sitemap above, one level up. A route joins this document when
// its page ships.

import { liveRoutes } from '@/lib/content/routes';
import { GUIDES_PATH, publishedGuides } from '@/lib/guides/registry';
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

/**
 * THE GUIDES ARE RESOLVED AT MODULE SCOPE, AND A FAILED BUILD IS WHY.
 *
 * FW16 increment 1 claimed that an invalid frontmatter fails the build,
 * planted a bad lastReviewed in the fixture to prove it, and the build
 * PASSED. `next build` imports a route module to collect page data; it
 * does not CALL the handler. A registry read inside GET() therefore runs
 * for the first time when a crawler asks for the sitemap - in production.
 *
 * At module scope it runs when the module is imported, which is during
 * the build and again at server start. So a malformed article stops the
 * build, and if one ever reached a deploy it would refuse to START rather
 * than serve 500s to whoever asked first. That is the same preference
 * R83's readiness split encodes: fail where somebody is watching.
 *
 * The cost is that an article edited while a dev server runs is not seen
 * until it restarts - which is already true of the registry's own
 * per-process cache, and of MDX compilation.
 */
const PUBLISHED = publishedGuides();

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

  // lastmod is deliberately absent. A build timestamp on every URL says "all
  // of these changed just now" on every deploy, which is a claim a crawler
  // learns to discount; a real one needs a content date the registry does not
  // carry yet. The sitemap protocol makes it optional, and omitting it is
  // honest.
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...liveRoutes().map(
      (route) =>
        `  <url><loc>${origin}${route.path}</loc>` +
        `<changefreq>${route.changeFrequency}</changefreq>` +
        `<priority>${route.priority.toFixed(1)}</priority></url>`,
    ),

    // THE GUIDES COME FROM THE CONTENT DIRECTORY, not from the route
    // registry, and that is the point of FW16: an article that exists on
    // disk is an article the product knows about. A hand-maintained list
    // would be one entry behind after FW18 and nothing would say so.
    //
    // FIXTURES ARE EXCLUDED HERE BY publishedGuides(), which filters the
    // leading underscore. A fixture in the sitemap would be a crawler
    // told to index a page that exists to test a template.
    //
    // The list is resolved at MODULE SCOPE - see PUBLISHED below.
    ...PUBLISHED.map(
      (guide) =>
        `  <url><loc>${origin}${GUIDES_PATH}/${guide.frontmatter.slug}</loc>` +
        `<changefreq>monthly</changefreq>` +
        `<priority>0.7</priority></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
