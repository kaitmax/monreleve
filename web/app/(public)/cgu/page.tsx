// web/app/(public)/cgu/page.tsx
//
// Thin on purpose: metadata, and the one place the shipped LEGAL_ENTITY enters
// the page.

import type { Metadata } from 'next';
import { LEGAL_ENTITY } from '@/lib/content/legal-entity';
import { CGU_COPY } from '@/lib/fr/cgu';
import { CguContent } from './CguContent';

export const metadata: Metadata = {
  title: CGU_COPY.title,
  description: CGU_COPY.description,
};

export default function CguPage() {
  return <CguContent entity={LEGAL_ENTITY} />;
}
