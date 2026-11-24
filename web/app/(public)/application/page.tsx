// web/app/(public)/application/page.tsx
//
// SPEC 9.1's /application. The target of the product's single primary CTA,
// `planned` in the registry since FW9, and 404ing from every page until FW20
// stopped rendering the link at all (PARK-12).
//
// THE PAGE EXISTS AND THE APP DOES NOT, and keeping those two facts apart is
// the whole job here. `PRODUCT_STATE.appExists` is false - there is no
// android/ directory in this repository - so every sentence about what the
// application does is in the future, derived from that flag rather than typed.
// The same distinction /releve-annuel's module calls load-bearing: a page
// existing is not the thing existing.
//
// NO STORE BADGES AND NO SCREENSHOTS, both of which FD12 specifies in detail.
// A Google Play badge is a link a reader would click; two screenshots of an
// Aujourd'hui screen and an exported PDF would be drawings of a product
// rather than pictures of one. The brief is not wrong, it is early, and
// lib/fr/application.ts records which of its parts are held back and why.
//
// THE TWO MODE CARDS COME OUT OF ONE ARRAY AND ONE CLASS. FD12's rule is that
// manual and automatic are genuine equals and its warning is a page that
// takes a side by degrees. Two JSX blocks written side by side are two blocks
// somebody edits one of, so there is one `map` over APPLICATION_COPY.modes
// and one `.modeCard` - there is no markup hook on which a distinction could
// be hung, including on the line about background location.

import type { Metadata } from 'next';
import { APPLICATION_COPY as COPY } from '@/lib/fr/application';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from './application.module.scss';

export const metadata: Metadata = {
  title: COPY.metaTitle,
  description: COPY.description(PRODUCT_STATE),
};

/**
 * The one affirmative glyph, used on every line of both cards.
 *
 * INLINE AND aria-hidden. It carries no information the sentence beside it
 * does not already carry, so a screen reader reading "check mark" six times
 * would be noise - and a decorative glyph is a glyph whose colour cannot be
 * the sole carrier of meaning, which is the accessibility half of FD12's
 * rule. The visual half is that there is exactly one of these in the file.
 */
function Check() {
  return (
    <svg
      className={styles.modeCheck}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13 4.5 6.2 11.5 3 8.3" />
    </svg>
  );
}

export default function ApplicationPage() {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.lead(PRODUCT_STATE)}</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.modesHeading}</h2>
          <p className={styles.prose}>{COPY.modesIntro(PRODUCT_STATE)}</p>

          {/*
            A LIST, because it is two of a kind and a reader on a screen
            reader should hear "list of 2 items" rather than two headings
            floating in a section. The order is the array's, and the array's
            order is FD12's: manual first, which is the mode that asks for
            nothing.
          */}
          <ul className={styles.modes} data-modes>
            {COPY.modes.map((mode) => (
              <li className={styles.modeCard} data-mode={mode.id} key={mode.id}>
                <h3 className={styles.modeTitle}>{mode.title}</h3>
                <p className={styles.modeBody}>{mode.body(PRODUCT_STATE)}</p>

                <ul className={styles.modeLines}>
                  {mode.lines(PRODUCT_STATE).map((line) => (
                    <li className={styles.modeLine} key={line}>
                      <Check />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className={styles.prose}>{COPY.modesFooter}</p>
        </section>

        {/*
          BEFORE ANY ARGUMENT TO INSTALL, which is FD12's instruction and the
          right order on its own merits: a page asking for background location
          that puts its limits after the pitch has arranged for them to be
          read last, or not at all.
        */}
        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.refusalsHeading}</h2>

          <ul className={styles.refusals}>
            {COPY.refusals.map((refusal) => (
              <li key={refusal.heading}>
                <h3 className={styles.refusalHeading}>{refusal.heading}</h3>
                <p className={styles.refusalBody}>{refusal.body}</p>
              </li>
            ))}
          </ul>

          <p className={styles.prose}>
            <a href="/confidentialite">{COPY.privacyLink}</a>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.stateHeading}</h2>
          <p className={styles.prose}>{COPY.stateBody(PRODUCT_STATE)}</p>

          {/*
            THE LAST THING ON THE PAGE POINTS AT THE FREE TOOL, not at a
            store - FD12's closing instruction, and the only one of its
            closing options that is available to a product with no app.
          */}
          <p className={styles.prose}>
            <a href={CALCULATOR_PATH}>{COPY.calculatorLink}</a>
          </p>
          <p className={styles.prose}>
            <a href="/releve-annuel">{COPY.dossierLink}</a>
          </p>
        </section>
      </Container>
    </main>
  );
}
