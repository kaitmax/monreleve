// web/app/dev/island/page.tsx
//
// RULING R122: /dev/island, the client-cost harness.
//
// A THIN SERVER PAGE OVER A CLIENT ISLAND, which is the same shape every
// public page uses - and the shape is the point. The measurement has to be of
// a component library inside a 'use client' boundary reached from a server
// page, because that is the arrangement in which the 207 KiB defect existed
// and the arrangement /dev/composants does not have.
//
// WHY IT IS A SECOND DEV ROUTE RATHER THAN A CHANGE TO THE FIRST. The
// operator's ruling: "/dev/composants is the visual workbench, /dev/island is
// the client-cost harness. Two routes, two purposes." Making the workbench a
// client component would have measured the right thing and broken the other
// one: its ten container baselines and its axe sweep are of a server-rendered
// page, and moving them under a hydration boundary changes what they record
// for no reason connected to their purpose.
//
// Noindex and out of the sitemap, like every /dev route. Excluded from the R2
// public gates by segment; `pnpm size` reports it under GATE I.

import type { Metadata } from 'next';
import { ISLAND_HARNESS } from '@/lib/fr/workbench';
import { IslandHarness } from './IslandHarness';

export const metadata: Metadata = {
  title: ISLAND_HARNESS.title,
  robots: { index: false, follow: false },
};

export default function IslandPage() {
  return (
    <main>
      <IslandHarness />
    </main>
  );
}
