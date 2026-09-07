// web/app/dev/spike/page.tsx
//
// ==========================================================================
// SPIKE QUALITY. NOT A COMPONENT LIBRARY.
//
// Everything under app/dev/spike/ exists to be weighed, not to be reused. It
// is deliberately minimal, styled only through tokens, and has no tests
// beyond a render smoke. The real components are lib/ui/react, built in
// FW8-FW9. Nothing outside this directory may import from here - enforced in
// eslint.config.mjs, not just asked for.
// ==========================================================================

import type { Metadata } from 'next';
import { SPIKE } from '@/lib/fr/spike';
import styles from './spike.module.scss';

export const metadata: Metadata = {
  title: SPIKE.title,
  robots: { index: false, follow: false },
};

export default function SpikePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{SPIKE.title}</h1>
      <p className={styles.intro}>{SPIKE.intro}</p>
    </main>
  );
}
