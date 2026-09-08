// web/app/api/health/route.ts
//
// RULING R81: under the runtime marker, a site origin resolving to the
// localhost fallback makes this "report degraded".
//
// PULLED FORWARD FROM FW28, which owns this file in tasks/todo.md ("`/api/health`
// wired to Coolify", and the route is in its Files-likely-touched list). R81
// specifies the endpoint's BEHAVIOUR, and behaviour needs a route to belong
// to, so the route exists now and FW28 wires it to the platform.
//
// IT RETURNS 200 WITH status: "degraded", NOT 503, and that reading is
// deliberate. R81 says the sitemap "return 503" and says this one "report
// degraded" - different words for the two surfaces, and the difference makes
// sense: a degraded origin does not stop pages rendering, so taking the
// container out of rotation for it would turn a configuration mistake into an
// outage. The sitemap refuses because publishing it would be WRONG; this
// reports because the site is up and honest about what is missing.
//
// Whether Coolify should treat degraded as a failing check is FW28's decision,
// not this file's, and it is written up as a question rather than assumed -
// there is a real argument that a deploy should not go live degraded.
//
// R53 disallows /api/* in robots.txt, so this is never crawled.

import { isProvisionalOrigin, isRuntime, servingWithoutOrigin, siteOrigin } from '@/lib/content/site';

/** Per-request: the runtime marker means nothing to a prerendered response. */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const degraded = servingWithoutOrigin();

  // Named reasons rather than a bare boolean. A health endpoint that says
  // "degraded" and nothing else sends whoever is on call to read the source;
  // this one tells them which variable to set.
  const reasons = degraded
    ? [
        'NEXT_PUBLIC_SITE_URL is unset while FRONTALIER_RUNTIME=1, so the ' +
          'site origin is the localhost stand-in. /sitemap.xml is returning ' +
          '503 and canonical URLs are omitted. Ruling R81.',
      ]
    : [];

  return Response.json(
    {
      status: degraded ? 'degraded' : 'ok',
      reasons,
      // Deliberately NOT the resolved origin when it is provisional: a health
      // payload echoing "http://localhost:3000" invites someone to read it as
      // the configured value. The boolean says what matters.
      origin: isProvisionalOrigin() ? null : siteOrigin(),
      runtime: isRuntime(),
    },
    {
      // 200 even when degraded - see the module comment. The body is the
      // report; the status says the process is answering.
      status: 200,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
