// web/app/(public)/mentions-legales/page.tsx
//
// Thin on purpose: metadata, and the one place the shipped LEGAL_ENTITY enters
// the page. The prose lives in MentionsLegalesContent, which takes the entity
// as a prop so ruling R84's count can be proved in both directions - see that
// file's comment.

import type { Metadata } from 'next';
import { LEGAL_ENTITY } from '@/lib/content/legal-entity';
import { MENTIONS_LEGALES_COPY } from '@/lib/fr/mentions-legales';
import { MentionsLegalesContent } from './MentionsLegalesContent';

export const metadata: Metadata = {
  title: MENTIONS_LEGALES_COPY.title,
  description: MENTIONS_LEGALES_COPY.description,
};

export default function MentionsLegalesPage() {
  return <MentionsLegalesContent entity={LEGAL_ENTITY} />;
}
