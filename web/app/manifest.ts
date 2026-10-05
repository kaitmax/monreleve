// web/app/manifest.ts
//
// The web app manifest (mon-releve-logo kit install). It exists for ONE
// reason: to give the kit's icon-192 / icon-512 / icon-maskable-512 PNGs a
// home. Without a manifest referencing them they are dead files, which is what
// the LOGO task's "wire the manifest icons" closes.
//
// NO manifest existed before this - the kit install created it. It is kept
// deliberately small: a name (from lib/fr, never inlined - R155) and the three
// icons the README names, nothing more. No theme/background colour is declared
// here, because a colour literal does not belong in code (DESIGN-SYSTEM.md
// tokens live in tokens.scss), and no `display`/PWA behaviour is claimed,
// because this task installs assets and does not turn the site into an
// installable app.
//
// Next serves this at /manifest.webmanifest and auto-emits the
// <link rel="manifest"> tag; the favicon/apple-touch <link> tags are in
// app/layout.tsx.

import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/fr';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
