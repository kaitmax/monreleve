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
//
// AND EACH RATE ASKS FOR ITS OWN PRECISION, which this component got wrong
// from FW8 until FW11's inputs were gathered. formatPercent's signature is
// formatPercent(value, decimals = 1), and both calls here passed one argument.
// So a declarable rate of 39.16 - the figure SPEC 7.3 says "must match the
// employer's filing" - reached the page as "39,1 %". The formatter is pinned to
// roundingMode 'trunc', so it truncated rather than rounded; either way the
// second decimal, which is the whole point of that rule, was dropped.
//
// SPEC 7.3: "The declarable rate truncates to 2 decimals. Geneva publishes
// 39.16% for 94/240 (39.1666...) ... because this number must match the
// employer's filing." The raw rate keeps ONE decimal - R26's second domain -
// because it is a share of days rather than a filed figure, and a second
// decimal would imply a precision a day count does not have.
//
// The defect survived a test suite because the assertion was
// formatter-relative: expect(html).toContain(formatPercent(39.16)) agrees with
// whatever this call produces. The precision tests added in FW11 are literal
// for that reason.

import { formatPercent, ZONE_BAND_TOKEN } from '@/lib/ui/core';
import type { Zone } from '@/lib/ui/core';
import { RATE_COPY } from '@/lib/fr/rates';
import styles from './RateDisplay.module.scss';

/** SPEC 7.3: the filed figure, truncated to two decimals. */
const DECLARABLE_DECIMALS = 2;

/** R26's second domain: a share of days, at one decimal. */
const RAW_DECIMALS = 1;

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
        {formatPercent(declarableRate, DECLARABLE_DECIMALS)}
      </p>
      <p className={styles.caption}>{RATE_COPY.declarableCaption}</p>

      {diverges ? (
        <div className={styles.secondary}>
          <p className={styles.rawRate}>{formatPercent(rawRate, RAW_DECIMALS)}</p>
          <p className={styles.caption}>{RATE_COPY.rawCaption}</p>
          <p className={styles.divergence}>{RATE_COPY.divergence}</p>
        </div>
      ) : null}
    </div>
  );
}
