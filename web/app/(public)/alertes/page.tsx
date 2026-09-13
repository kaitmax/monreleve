// web/app/(public)/alertes/page.tsx
//
// /alertes - the standalone landing. FW14 increment 5.
//
// WHO ARRIVES HERE. Somebody who followed a link from a Facebook group post,
// not from the calculator. They may never have used the calculator at all, so
// this page has to say what the list is in two sentences and then get out of
// the way. It is the same card and the same handler as the calculator's, with
// source=alertes, so there is one form in the product rather than two that
// drift.
//
// STATIC, AND THEREFORE WITH ITS HEAD INTACT. The capture card renders every
// status hidden and CSS :target reveals the one the handler names in the
// fragment, so this page never reads searchParams - which is what would make
// it dynamic and move <title> into the body (FW13).

import type { Metadata } from 'next';
import { AlertCapture } from '@/lib/ui/react/AlertCapture/AlertCapture';
import { ALERTES_COPY } from '@/lib/fr/alertes';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from './alertes.module.scss';

export function generateMetadata(): Metadata {
  return {
    title: ALERTES_COPY.heading,
    description: ALERTES_COPY.intro,
  };
}

export default function AlertesPage(): React.ReactElement {
  return (
    <Container width="article">
      <article className={styles.landing}>
        {/* ONE h1. The card's own heading is an h2 beneath it. */}
        <h1 className={styles.landingHeading}>{ALERTES_COPY.heading}</h1>

        <p className={styles.landingIntro}>{ALERTES_COPY.intro}</p>
        <p className={styles.landingIntro}>{ALERTES_COPY.helper}</p>

        <AlertCapture source="alertes" />
      </article>
    </Container>
  );
}
