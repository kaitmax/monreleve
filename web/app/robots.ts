// web/app/robots.ts
//
// RULING R53: "robots.txt disallows /dev/, /api/, and /releve/print. There is
// no /app, /connexion or /inscription to disallow."
//
// The disallow list comes from lib/content/routes.ts rather than being typed
// here, so it is the same list the sitemap is asserted against - a path cannot
// be disallowed and listed at the same time, and a test checks exactly that.
//
// SPEC 14 STILL LISTS THE OLD SET - "/app/, /connexion, /inscription, /dev/" -
// which decision D14 withdrew when it deleted the signed-in web area. That
// line is stale; it is noted in REPORT-FW10.txt rather than edited, because
// SPEC is the operator's document. Nothing in the code or config referenced
// those three paths, which is what R53 asked to be checked.
//
// THE SITEMAP REFERENCE IS ABSOLUTE, because the sitemap directive in
// robots.txt must be a full URL - a relative path is ignored by crawlers. It
// therefore depends on the site origin, and under ruling R81 a serving process
// without one is refusing to publish the sitemap anyway; robots still names
// where it would be, which costs nothing and is correct as soon as the origin
// is configured.
//
// NO `host` DIRECTIVE: it was a Yandex extension, is ignored elsewhere, and
// canonical URLs already say the same thing in a way every crawler reads.

import type { MetadataRoute } from 'next';
import { NON_INDEXED } from '@/lib/content/routes';
import { siteOrigin } from '@/lib/content/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Spread, so adding a prefix to the registry adds it here.
      disallow: [...NON_INDEXED],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
