// web/lib/ui/react/RateDisplay/RateDisplay.tsx
//
// The two rates (SPEC 9.3). In Geneva case (c) they differ sharply - 39,16 %
// declarable against 45,0 % of days actually outside Switzerland - and the
// spec is explicit about why both must appear: "Showing only the declarable
// rate hides real exposure; showing only the raw rate contradicts the
// payslip."
//
// WHEN THEY DIFFER, and not otherwise. A component that always rendered the
// second block would print the same percentage twice under two labels on
// every ordinary result, which teaches the reader to ignore it - so the
// second block is exactly the signal that something needs explaining, and the
// explanatory line goes with it.
//
// COLOURED BY Zone, never by Status (SPEC 6.2). This figure sits directly
// above the rail and is positioned by the same number, so taking the badge's
// colour here would put two different answers on one surface. Geneva case (c)
// is the case that proves it: the rate is in the compliant band while the
// badge warns about mission days.
//
// RULING R57's ONE EXCEPTION LIVES HERE. #B7791F is 3,43:1 on the canvas and
// fails AA for normal text, which is why the ZoneBadge label is text-primary
// instead. At Display 48/600 this is LARGE text, where the bar is 3:1, so the
// warning band's rate may carry the band colour. That is measured from the
// real tokens - 3,43 canvas, 3,64 surface - and the audit re-derives it.
//
// Every number goes through formatPercent (SPEC 6.4). Nothing here formats.

import { formatPercent, ZONE_BAND_TOKEN } from '@/lib/ui/core';
import type { Zone } from '@/lib/ui/core';
import { RATE_COPY } from '@/lib/fr/rates';
import styles from './RateDisplay.module.scss';

export interface RateDisplayProps {
  /** The rate that goes on the tax return, and the one that positions the rail. */
  readonly declarableRate: number;
  readonly zone: Zone;
  /**
   * The share of days actually outside Switzerland. Optional because it is
   * worth showing only when it diverges from the declarable rate; the caller
   * may always pass it and this component decides.
   */
  readonly rawRate?: number;
}

export function RateDisplay({ declarableRate, zone, rawRate }: RateDisplayProps) {
  const diverges = rawRate !== undefined && rawRate !== declarableRate;

  return (
    <div className={styles.root}>
      <p className={styles.rate} style={{ color: `var(${ZONE_BAND_TOKEN[zone]})` }}>
        {formatPercent(declarableRate)}
      </p>
      <p className={styles.caption}>{RATE_COPY.declarableCaption}</p>

      {diverges ? (
        <div className={styles.secondary}>
          <p className={styles.rawRate}>{formatPercent(rawRate)}</p>
          <p className={styles.caption}>{RATE_COPY.rawCaption}</p>
          <p className={styles.divergence}>{RATE_COPY.divergence}</p>
        </div>
      ) : null}
    </div>
  );
}
