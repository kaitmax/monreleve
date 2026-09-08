// web/app/(public)/confidentialite/page.tsx
//
// Thin on purpose: metadata, and the one place the shipped LEGAL_ENTITY enters
// the page. The prose lives in ConfidentialiteContent, which takes the entity
// as a prop so ruling R84's count can be proved in both directions.

import type { Metadata } from 'next';
import { LEGAL_ENTITY } from '@/lib/content/legal-entity';
import { CONFIDENTIALITE_COPY } from '@/lib/fr/confidentialite';
import { ConfidentialiteContent } from './ConfidentialiteContent';

export const metadata: Metadata = {
  title: CONFIDENTIALITE_COPY.title,
  description: CONFIDENTIALITE_COPY.description,
};

export default function ConfidentialitePage() {
  return <ConfidentialiteContent entity={LEGAL_ENTITY} />;
}
