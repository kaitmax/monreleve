// web/app/dev/composants/page.tsx
// The workbench: every component, every state. No Storybook (SPEC section 4).
// Components start arriving at FW8; this is the route they register into.

import type { Metadata } from 'next';
import { WORKBENCH_TITLE } from '@/lib/fr';

export const metadata: Metadata = {
  title: WORKBENCH_TITLE,
  robots: { index: false, follow: false },
};

export default function WorkbenchPage() {
  return (
    <main>
      <h1>{WORKBENCH_TITLE}</h1>
    </main>
  );
}
