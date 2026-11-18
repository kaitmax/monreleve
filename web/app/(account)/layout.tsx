// web/app/(account)/layout.tsx
//
// The website's account area. FW-WEB-ACCOUNT (R898-R903).
//
// A ROUTE GROUP OF ITS OWN, BESIDE (public), and the separation is the point.
// Everything under (public) is held to the zero-cookie guarantee; everything
// here is the one exception, and tests/unit/meta/account-cookie-scope.test.ts
// reads the directory boundary to tell which is which - only files under
// app/(account)/ may import the cookie module, and no public route's module
// graph may reach it.
//
// THE SAME SHELL, so the area speaks the A2 header and footer like every page.
// The shell renders the sign-in link itself since W12 (it is a server
// component now), so this layout passes only what every layout passes.
//
// NOINDEX, NOT A ROBOTS DISALLOW. R53 fixes robots.txt at three prefixes "and
// no more", and a disallow would stop a crawler reading the noindex anyway.
// No canonical and no social card: these pages are one person's, and a
// canonical is an instruction to index.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME, TITLE_TEMPLATE } from '@/lib/fr';
import { guideNavLinks } from '@/lib/guides/registry';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: TITLE_TEMPLATE },
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell guideLinks={guideNavLinks()}>
      {children}
    </PublicShell>
  );
}
