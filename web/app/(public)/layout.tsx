// web/app/(public)/layout.tsx
//
// The public layout. Everything a reader can reach sits inside this: the
// shell, the canonical, the language declaration.
//
// A ROUTE GROUP, so the URLs are unchanged - app/(public)/page.tsx still
// serves "/". That is why app/page.tsx had to MOVE here rather than stay:
// two files claiming the same route is a build error, not a merge.
//
// WHY THE GROUP AND NOT THE ROOT LAYOUT. app/dev/* must NOT get the public
// shell - the workbench renders components for inspection and a header round
// it would be furniture in every screenshot, and the rail gallery's baselines
// would all shift. Putting the shell in the root layout would wrap them too.
// This is also what makes ruling R60's scope - "app/ except app/dev/" -
// something the directory structure states rather than a convention.
//
// METADATA. metadataBase is what lets `canonical: './'` resolve per route, so
// every page below gets a correct absolute canonical without writing one. The
// origin comes from lib/content/site.ts, which refuses to fall back to
// localhost in a production build - see that file for why a sitemap of
// localhost URLs is worse than a build failure.
//
// NO THIRD-PARTY ANYTHING. No script, no analytics, no font CDN (SPEC 17:
// zero third-party requests; FW15 owns analytics if it ever lands). The
// e2e suite asserts it from a real network trace, because a hostname grep
// cannot see a request that a dependency makes at runtime.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { canonicalsAvailable, siteOrigin } from '@/lib/content/site';
import { APP_NAME, TITLE_TEMPLATE } from '@/lib/fr';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    // The home route gets the bare product name; every other page composes
    // into the template.
    default: APP_NAME,
    template: TITLE_TEMPLATE,
  },
  // RULING R81: OMITTED ENTIRELY while the origin is the localhost
  // stand-in. A canonical pointing at localhost is worse than no canonical,
  // because a crawler treats it as an INSTRUCTION rather than as an absence -
  // it would be told the real page lives at an address it cannot reach.
  //
  // It keys off the origin rather than the runtime marker, and that is not an
  // inconsistency: Next bakes a route's metadata at BUILD time when the route
  // is statically prerendered, so by the time FRONTALIER_RUNTIME is visible
  // this tag has
  // already been written. See lib/content/site.ts.
  ...(canonicalsAvailable()
    ? {
        alternates: {
          // Relative, so Next derives it per route against metadataBase. A
          // literal canonical here would point every public page at the home
          // page - the most damaging SEO mistake available on a content site.
          canonical: './',
          languages: {
            // One locale by design (SPEC section 1 non-goals: no i18n).
            // Declared rather than omitted so a crawler is told rather than
            // guessing from the copy.
            'fr-FR': './',
          },
        },
      }
    : {}),
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
