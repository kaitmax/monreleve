// web/app/(public)/alertes/confirmation/[etat]/page.tsx
//
// What the reader sees after opening the link in the confirmation email.
// FW14 increment 4.
//
// THE OUTCOME IS A PATH SEGMENT, NOT A QUERY PARAMETER, and FW13 measured
// why: reading searchParams in a page makes the route dynamic in Next
// 15.5.25, which emits <title> and <link rel="canonical"> into the BODY. The
// SEO cost would be nil here - these pages are noindex - but the defect would
// still be present for the next person to find and misdiagnose. With a
// segment and generateStaticParams, each outcome is its own statically
// rendered page and an unknown segment is a 404 rather than a page rendering
// a stranger's string.
//
// THREE PAGES BECAUSE THE NEXT ACTION DIFFERS. Confirmed: nothing to do.
// Expired: subscribe again, and it will work. No longer valid: it may have
// been used already, and subscribing again is safe. One "something went
// wrong" page for all three would leave the reader whose link simply aged out
// with no idea that trying again would help.
//
// NOINDEX. There is nothing here for a search engine: the pages are the tail
// of a transaction, they exist in three near-identical variants, and one of
// them says "you are subscribed" to whoever finds it.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CONFIRM_STATES } from '@/lib/alerts/status';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../../alertes.module.scss';

/** The three outcomes, and nothing else: an unknown segment is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { etat: string }[] {
  return Object.values(CONFIRM_STATES).map((etat) => ({ etat }));
}

const PAGES = {
  [CONFIRM_STATES.confirmed]: ALERTES_COPY.confirmation.ok,
  [CONFIRM_STATES.expired]: ALERTES_COPY.confirmation.expired,
  [CONFIRM_STATES.unknown]: ALERTES_COPY.confirmation.unknown,
} as const;

interface Props {
  readonly params: Promise<{ readonly etat: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { etat } = await params;
  const page = PAGES[etat as keyof typeof PAGES];

  return {
    title: page?.heading ?? ALERTES_COPY.confirmation.unknown.heading,
    // Not indexable, and not followed either: every link from here is in the
    // shell, which every indexable page already carries.
    robots: { index: false, follow: true },
  };
}

export default async function ConfirmationPage({ params }: Props): Promise<React.ReactElement> {
  const { etat } = await params;
  const page = PAGES[etat as keyof typeof PAGES];

  // dynamicParams = false already refuses unknown segments; this is what
  // makes that true for the TYPE as well, so the render below cannot be
  // reading an undefined.
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
