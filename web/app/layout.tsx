// web/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/fr';
import '@/lib/ui/core/styles/global.scss';

export const metadata: Metadata = {
  title: APP_NAME,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* The brand mark (mon-releve-logo kit). The SVG is the primary tab
            icon; the 32 px PNG is the fallback for clients that do not take an
            SVG favicon; apple-touch-icon is the iOS home-screen square. The
            manifest and its icon and maskable PNGs are declared in
            app/manifest.ts. */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Same-origin, latin subset: the only font file a French page needs. */}
        <link
          rel="preload"
          href="/fonts/inter-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
