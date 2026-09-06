// web/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/fr';

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
      <body>{children}</body>
    </html>
  );
}
