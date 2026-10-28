// web/lib/ui/react/ReleveExcerpt/ReleveExcerpt.tsx
//
// THE HOME PAGE'S RELEVE EXCERPT (FW-HOME-A2, R714): a card showing the top
// of an annual releve - title, year and holder, the verification code, five
// days and when each was recorded - beside the hero.
//
// A SAMPLE, AND IT SAYS SO. The days are lib/content/home.ts's RELEVE_SAMPLE,
// the words lib/fr/home.ts's, and the caption opens on "Exemple." The figure's
// accessible name says the same, so a screen reader is not told it is reading
// somebody's record.
//
// THE DATES ARE THE PRODUCT'S OWN FORMAT. The approved design wrote
// "lun. 19 oct." and "19 oct., 18:42"; the releve itself writes days in Swiss
// dots and instants in Paris time (SPEC 6.4, R28, R586), and a sample of the
// document that formatted dates differently from the document would be a
// second date format typed into copy. So formatDate and formatDateTime render
// the sample's data, and the column heading names the clock once (R714).
//
// THE COUNTRY DOTS ARE NEVER ALONE. Each sits beside the words that say the
// same thing (DESIGN-SYSTEM section 2: a dot plus the word, never a flag), and
// is aria-hidden because the words already carry it.
//
// THE TABLE SCROLLS, NEVER THE PAGE (R159), in DataGrid's pattern: an
// always-present overflow container that is a named, focusable region.
//
// A SERVER COMPONENT. Nothing here is interactive.

import { RELEVE_SAMPLE } from '@/lib/content/home';
import type { ReleveSampleKind } from '@/lib/content/home';
import type { ProductState } from '@/lib/content/product-state';
import { HOME_COPY } from '@/lib/fr/home';
import { formatDate, formatDateTime } from '@/lib/ui/core';
import styles from './ReleveExcerpt.module.scss';

const COPY = HOME_COPY.excerpt;

/** Which country dots a kind of day carries, in reading order. */
const DOTS: Readonly<Record<ReleveSampleKind, readonly ('france' | 'switzerland')[]>> = {
  swiss: ['switzerland'],
  home: ['france'],
  split: ['france', 'switzerland'],
  absence: [],
};

export interface ReleveExcerptProps {
  /** The caption's tense follows whether days can be recorded yet (R172). */
  readonly state: ProductState;
}

export function ReleveExcerpt({ state }: ReleveExcerptProps) {
  return (
    <figure className={styles.root} aria-label={COPY.label}>
      <div className={styles.head}>
        <div>
          <p className={styles.title}>{COPY.title}</p>
          <p className={styles.subtitle}>{COPY.subtitle(RELEVE_SAMPLE.year)}</p>
        </div>
        <p className={styles.code}>
          <span className={styles.codeLabel}>{COPY.codeLabel}</span>
          <span className={styles.codeValue}>{COPY.code}</span>
        </p>
      </div>

      <div
        className={styles.scroll}
        data-scroll="true"
        tabIndex={0}
        role="region"
        aria-label={COPY.label}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.header}>
                {COPY.columns.date}
              </th>
              <th scope="col" className={styles.header}>
                {COPY.columns.day}
              </th>
              <th scope="col" className={styles.header}>
                {COPY.columns.recorded}
              </th>
            </tr>
          </thead>
          <tbody>
            {RELEVE_SAMPLE.days.map((day) => (
              <tr className={styles.row} key={day.day}>
                <td className={styles.cell}>{formatDate(day.day)}</td>
                <td className={`${styles.cell} ${styles.cellKind}`}>
                  <span className={styles.kind}>
                    {DOTS[day.kind].map((country) => (
                      <span
                        className={country === 'france' ? styles.dotFrance : styles.dotSwitzerland}
                        aria-hidden="true"
                        key={country}
                      />
                    ))}
                    <span>{COPY.kinds[day.kind]}</span>
                  </span>
                </td>
                <td className={styles.cell}>{formatDateTime(day.recordedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className={styles.caption}>{COPY.caption(state)}</figcaption>
    </figure>
  );
}
