// web/app/(public)/tarifs/page.tsx
//
// SPEC D3 and SPEC 9.1: one page, one product, no tier grid.
//
// THE POSITION SENTENCE LEADS, because it is the whole page. A reader here
// has one question - will this start charging me - and the answer is two
// clauses long.
//
// THE THREE SECTIONS BELOW IT ARE THE FOLLOW-UP QUESTIONS, in the order they
// occur: why free now, what happens next year, and whether there is a cheaper
// version being kept from them. The last is answered by saying there are no
// versions at all, which is the honest form of the tier grid D3 forbids.

import type { Metadata } from 'next';
import { TARIFS_COPY as COPY } from '@/lib/fr/tarifs';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../sources/sources.module.scss';

export const metadata: Metadata = {
  title: COPY.title,
  description: COPY.description,
};

export default function TarifsPage() {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>

        {/* SPEC D3, verbatim, as the lead. */}
        <p className={styles.lead}>{COPY.position}</p>
        <p className={styles.prose}>{COPY.positionDetail(PRODUCT_STATE)}</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.whyHeading}</h2>
          <p className={styles.prose}>{COPY.whyBody}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.laterHeading}</h2>
          <p className={styles.prose}>{COPY.laterBody}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.noGridHeading}</h2>
          <p className={styles.prose}>{COPY.noGridBody}</p>

          <p className={styles.prose}>
            <a href="/sources">{COPY.sourcesLink}</a>
          </p>
        </section>
      </Container>
    </main>
  );
}
