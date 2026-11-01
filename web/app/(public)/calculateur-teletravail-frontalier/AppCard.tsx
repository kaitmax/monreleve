// web/app/(public)/calculateur-teletravail-frontalier/AppCard.tsx
//
// FW-CALCS-A2, R726: the application card that closes the result column, in
// brand colour (calculateur-a2).
//
// A SERVER COMPONENT, handed to the island as an element (CalculatorForm's
// `aside`) and rendered as-is by /resultat, so neither its words nor
// PRODUCT_STATE enter the calculator's client bundle.
//
// THE LINK FOLLOWS PRODUCT_STATE EXACTLY AS THE HOME PAGE'S DOES: the same
// label function (HOME_COPY.mobile.cta - "Decouvrir l'application" until the
// app is released) and the same target (SHELL_COPY.ctaHref, /application),
// referenced by key rather than retyped (R206). No store link until a listing
// exists (R713).
//
// The heading is a paragraph, not an h3: the page's outline is h1 and h2
// (tests/unit/pages/calculateur.test.tsx), and this card is not a section of
// it.

import { PRODUCT_STATE } from '@/lib/content/product-state';
import { CALCULATOR_APP_CARD as COPY } from '@/lib/fr/calculateur';
import { HOME_COPY } from '@/lib/fr/home';
import { SHELL_COPY } from '@/lib/fr/shell';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import styles from './AppCard.module.scss';

export function AppCard() {
  return (
    <ResultCard tone="brand" element="div" data-app-card>
      <p className={styles.heading}>{COPY.heading}</p>
      <p className={styles.body}>{COPY.body(PRODUCT_STATE)}</p>
      <a href={SHELL_COPY.ctaHref}>{HOME_COPY.mobile.cta(PRODUCT_STATE)}</a>
    </ResultCard>
  );
}
