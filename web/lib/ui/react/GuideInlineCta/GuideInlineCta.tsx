// web/lib/ui/react/GuideInlineCta/GuideInlineCta.tsx
//
// FD13's inline calculator card: "a white card, radius 16, padding 24, one
// line of prose left and a primary 48 h button right."
//
// IT IS NOT THE CLOSING CARD. GuideCta ends every guide - "this exact card
// ends every guide on the site, one CTA, no variants" - and stays unique.
// This one sits MID-ARTICLE, and SPEC 9.5 is what puts it there: "every guide
// to a calculator, TWICE: inline at the moment the reader realises they
// cannot do the math, and the end Tile."
//
// WHAT IT REPLACES. Until FW18b each article carried that inline reference as
// a sentence with a link in it - "le calcul cesse vite d'etre faisable de
// tete : calculez vos jours restants". The sentence was right and the
// TREATMENT was wrong: the one moment FD13 identifies as decisive looked
// exactly like every other link in the prose, which is to say it looked like
// nothing. A card is the whole point of naming that moment.
//
// NO PROPS, AND THAT IS THE DESIGN - GuideCta's reasoning, unchanged. A
// `variant`, `title` or `href` prop is the seam through which seven articles
// grow seven calls to action pointing at five places. The copy comes from
// lib/fr and the destination is the calculator, always.
//
// AN <aside>, NOT A <section>. A section with no heading is an unnamed
// region, and a mid-article card that announced itself as one would appear in
// the document outline between two real sections. The closing card is an
// aside for the same reason.
//
// A SERVER COMPONENT. R136: content ships zero client JavaScript, and a link
// in a card needs none.

import { CALCULATOR_PATH } from '@/lib/content/routes';
import { GUIDES_COPY } from '@/lib/fr/guides';
import styles from './GuideInlineCta.module.scss';

export function GuideInlineCta() {
  return (
    <aside className={styles.card} data-guide-inline-cta>
      <p className={styles.body}>{GUIDES_COPY.inlineCtaBody}</p>

      {/*
        THE SAME ACTION LABEL AS THE CLOSING CARD, deliberately. Both send the
        reader to the same page to do the same thing; two wordings for that
        are two strings to keep in step, and the day they diverge a reader
        meets two different promises for one destination. The PROSE differs,
        because the moment in the article differs.
      */}
      <a className={styles.action} href={CALCULATOR_PATH}>
        {GUIDES_COPY.ctaAction}
      </a>
    </aside>
  );
}
