// web/app/(public)/alertes/desinscription/[etat]/page.tsx
//
// What the reader sees after clicking "se désinscrire". FW14 increment 4.
//
// TWO OUTCOMES: it worked, or the link is no longer one we issued. There is
// deliberately no third page for "you were already unsubscribed" - clicking
// twice reports success both times, because a second click landing on
// anything else reads as a failed unsubscribe, and that is the one impression
// this page must never leave.
//
// The segment-not-query reasoning is in the confirmation page beside this one.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UNSUBSCRIBE_STATES } from '@/lib/alerts/status';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../../alertes.module.scss';

export const dynamicParams = false;

export function generateStaticParams(): { etat: string }[] {
  return Object.values(UNSUBSCRIBE_STATES).map((etat) => ({ etat }));
}

const PAGES = {
  [UNSUBSCRIBE_STATES.unsubscribed]: ALERTES_COPY.unsubscribe.done,
  [UNSUBSCRIBE_STATES.unknown]: ALERTES_COPY.unsubscribe.unknown,
} as const;

interface Props {
  readonly params: Promise<{ readonly etat: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { etat } = await params;
  const page = PAGES[etat as keyof typeof PAGES];

  return {
    title: page?.heading ?? ALERTES_COPY.unsubscribe.unknown.heading,
    robots: { index: false, follow: true },
  };
}

export default async function UnsubscribePage({ params }: Props): Promise<React.ReactElement> {
  const { etat } = await params;
  const page = PAGES[etat as keyof typeof PAGES];

  if (page === undefined) notFound();

  return (
    <Container width="article">
      <article className={styles.outcome}>
        <h1 className={styles.outcomeHeading}>{page.heading}</h1>
        <p className={styles.outcomeBody}>{page.body}</p>
      </article>
    </Container>
  );
}
