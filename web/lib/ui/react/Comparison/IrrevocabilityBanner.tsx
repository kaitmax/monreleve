// web/lib/ui/react/Comparison/IrrevocabilityBanner.tsx
//
// SPEC 9.6: "a prominent error banner stating the choice is IRREVOCABLE and
// the window is THREE MONTHS". Worded from rows D1-D6 (CLEISS, corroborated
// by ameli), in the error style: the accent on the RULE and the soft error
// background, the text in text-primary (R57 - the status colour fails 4,5:1
// as body text and passes as a border). An icon AND a heading carry it, never
// the colour alone (SPEC 16).
//
// role="note", not role="alert": it is standing content present from the
// first render, not an event; an alert role on load is read out before the
// page's own heading.

import { CircleAlert } from 'lucide-react';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import styles from './Comparison.module.scss';

export function IrrevocabilityBanner() {
  return (
    <aside className={styles.banner} aria-labelledby="irrevocable-titre" data-banner="irrevocable">
      <p className={styles.bannerHeading} id="irrevocable-titre">
        <CircleAlert className={styles.bannerIcon} aria-hidden="true" />
        {COPY.banner.heading}
      </p>
      <p className={styles.bannerBody}>{COPY.banner.body}</p>
      <p className={styles.bannerBody}>
        <a href={COPY.banner.link.href}>{COPY.banner.link.text}</a>
      </p>
    </aside>
  );
}
