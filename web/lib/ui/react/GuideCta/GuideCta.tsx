// web/lib/ui/react/GuideCta/GuideCta.tsx
//
// The card that ends every guide. FD13: "This exact card ends every guide on
// the site - one CTA, no variants."
//
// NO PROPS, AND THAT IS THE DESIGN. A `variant` or a `title` prop would be
// the seam through which seven articles grow seven calls to action, which is
// the thing FD13's sentence exists to prevent. The copy comes from lib/fr and
// the destination is the calculator, on every guide, always.
//
// IT LINKS THE CALCULATOR, AND FD13 CONTRADICTS ITSELF HERE. Its rules say
// "exactly two calculator CTAs: the inline card mid-article and the closing
// card"; its example copy for the closing card says "Decouvrir le releve
// annuel" and points at /releve-annuel. SPEC 9.5 settles it - "every guide to
// a calculator, TWICE: inline at the moment the reader realises they cannot
// do the math, and the end Tile" - and the prompt says SPEC wins on conflict.
//
// It is also the only reading that works today: /releve-annuel is `planned`
// for FW20, so a closing card pointing at it would link a page that 404s,
// which the mesh checker refuses and rightly.
//
// A SERVER COMPONENT. R136: content ships zero client JavaScript, and a link
// in a card needs none.

import { FileCheck } from 'lucide-react';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { GUIDES_COPY } from '@/lib/fr/guides';
import styles from './GuideCta.module.scss';

/** FD13: Lucide file-check at 24 in the icon square, 1.75 stroke. */
const ICON = 24;
const STROKE = 1.75;

export function GuideCta() {
  return (
    <aside className={styles.cta} data-guide-cta>
      <span className={styles.icon} aria-hidden="true">
        <FileCheck size={ICON} strokeWidth={STROKE} />
      </span>

      <h2 className={styles.title}>{GUIDES_COPY.ctaTitle}</h2>
      <p className={styles.body}>{GUIDES_COPY.ctaBody}</p>

      <a className={styles.button} href={CALCULATOR_PATH}>
        {GUIDES_COPY.ctaAction}
      </a>
    </aside>
  );
}
