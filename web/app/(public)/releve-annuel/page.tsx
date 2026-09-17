// web/app/(public)/releve-annuel/page.tsx
//
// R166: THE DEAD LINK. The calculator's `compliant` contextual link has
// pointed here since FW12, so a reader who reaches the best outcome the
// product has - inside both thresholds - is the one who got a 404. The same
// defect as /calculateur-lamal-cmu in the nav, closed by the same task.
//
// EVERY SENTENCE ABOUT THE DOCUMENT IS FUTURE OR CONDITIONAL (R138). The
// dossier does not exist; a page saying "le releve contient" would be the
// clearest possible violation of the rule this product is built on, on the
// page describing the artifact that rule exists to protect.
//
// THE LEAD SAYS SO FIRST. A page that lists contents and mentions the absence
// at the bottom has told the reader the opposite of the truth for three
// paragraphs.
//
// NO PRICE - that is /tarifs. No screenshot of a document nobody has
// produced. No waiting list: a form collecting addresses against a promise is
// a promise, and SPEC 20's vocabulary rule covers what this page may claim.

import type { Metadata } from 'next';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { RELEVE_COPY as COPY } from '@/lib/fr/releve-annuel';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../sources/sources.module.scss';

export const metadata: Metadata = {
  title: COPY.title,
  description: COPY.description(PRODUCT_STATE),
};

export default function ReleveAnnuelPage() {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.lead(PRODUCT_STATE)}</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.purposeHeading(PRODUCT_STATE)}</h2>
          <p className={styles.prose}>{COPY.purposeBody}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.contentsHeading(PRODUCT_STATE)}</h2>
          <p className={styles.prose}>{COPY.contentsIntro(PRODUCT_STATE)}</p>

          {/*
            SPEC 12's six sections, in a reader's words. An ordered list
            because the document has an order and the order is part of what is
            being described - the annex comes last because it is the evidence
            under the summary, not an appendix nobody reads.
          */}
          <ol className={styles.prose}>
            {COPY.contents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.vocabularyHeading(PRODUCT_STATE)}</h2>
          <p className={styles.prose}>{COPY.vocabularyBody(PRODUCT_STATE)}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.stateHeading}</h2>
          <p className={styles.prose}>{COPY.stateBody(PRODUCT_STATE)}</p>

          <p className={styles.prose}>
            <a href={CALCULATOR_PATH}>{COPY.calculatorLink}</a>
          </p>
          <p className={styles.prose}>
            <a href="/sources">{COPY.sourcesLink}</a>
          </p>
        </section>
      </Container>
    </main>
  );
}
