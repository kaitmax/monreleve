// web/app/(public)/calculateur-teletravail-frontalier/resultat/Projection.tsx
//
// FW-FORECAST: where the reader is heading, drawn by the SERVER.
//
// ============================================================================
// R340 GOVERNS THIS WHOLE COMPONENT: A PROJECTION IS NEVER A RECORD
// ============================================================================
//
// Four devices carry it, and none of them is colour:
//
//   1. the block is LABELLED "Projection", in text, in its own heading;
//   2. it names the DAY it was computed for, so a link opened in November
//      cannot be mistaken for the projection it showed in October;
//   3. its assumptions are written out as sentences a reader can disagree
//      with - a projection whose assumptions are invisible reads as a
//      measurement;
//   4. it says outright that nothing here reaches the releve.
//
// The Android forecast screen carries the same four, which is deliberate:
// somebody who meets this on the site and then in the app must not have to
// work out whether the two mean the same thing.
//
// ============================================================================
// IT COMPUTES NOTHING
// ============================================================================
//
// Every figure arrives from project(), which runs the same engine the current
// result does. There is no arithmetic in this file - not a division, not a
// subtraction - because a figure a component computed is a second engine
// nobody tested (FW12's defect, and R340's rule).
//
// THE SERVER DRAWS IT, and that is a budget decision as much as a no-JS one.
// The calculator route has the least headroom in the product (GATE A spare
// 3,0 KiB at this commit), so the projection renders here - on a route that is
// already dynamic and already noindex - rather than in the island.


import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { formatPercent, formatSignedDays, zoneFor, type ZoneThresholds } from '@/lib/ui/core';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import type { Projection as ProjectionData } from '@/lib/forecast/project';
import styles from './projection.module.scss';

const COPY = CALCULATEUR_COPY.projection;

/** The rail width the panel beside this one uses, so the two line up. */
const RAIL_WIDTH = 320;

export interface ProjectionProps {
  readonly projection: ProjectionData;
  readonly thresholds: ZoneThresholds;
  /** The day it was computed for, already formatted (R28 resolves it). */
  readonly day: string;
  /** PRODUCT_STATE.appExists, so the closing line picks its own tense (R138). */
  readonly appReleased: boolean;
  /** The ceilings as the tiles name them, formatted by the caller (R147). */
  readonly fiscal: string;
  readonly social: string;
}

export function Projection({
  projection,
  thresholds,
  day,
  appReleased,
  fiscal,
  social,
}: ProjectionProps) {
  const { current, projected } = projection;
  const zone = zoneFor(projected.declarableRate, thresholds);

  return (
    <section className={styles.block} data-projection aria-labelledby="projection-titre">
      {/*
        THE LABEL FIRST, before any figure. A reader who scrolls past the
        heading and lands on a percentage has already been told what kind of
        number it is.
      */}
      <p className={styles.label}>{COPY.label}</p>

      <h2 className={styles.heading} id="projection-titre">
        {COPY.heading}
      </h2>

      <p className={styles.asOf}>{COPY.asOf(day)}</p>

      {/*
        BOTH FIGURES, THE CURRENT ONE NAMED. The projection on its own invites
        the question "up from what?", and the answer is already computed.
      */}
      <p className={styles.current}>
        {COPY.current}
        <span className={styles.currentRate} data-projection-current>
          {formatPercent(current.declarableRate, 2)}
        </span>
      </p>

      <div data-projection-rate>
        <RateDisplay
          declarableRate={projected.declarableRate}
          rawRate={projected.rawRate}
          zone={zone}
        />
      </div>

      <div className={styles.rail} data-projection-rail>
        <ThresholdRail
          percentage={projected.declarableRate}
          thresholds={thresholds}
          variant="inline"
          width={RAIL_WIDTH}
          zone={zone}
        />
      </div>

      {/*
        THE TWO REMAINING-DAY TILES, and only two. The panel above shows four;
        the Swiss and French taxed-day tiles describe days already worked, and
        a projection of them would be stating where a reader WILL have paid
        tax - a claim about the future in the one register this product keeps
        in the past tense.
      */}
      <div className={styles.tiles} data-projection-tiles>
        <MetricTile
          days={formatSignedDays(projected.remainingToFiscal)}
          label={METRIC_COPY.remaining(fiscal)}
          overLabel={METRIC_COPY.over(fiscal)}
        />
        <MetricTile
          days={formatSignedDays(projected.remainingToSocial)}
          label={METRIC_COPY.remaining(social)}
          overLabel={METRIC_COPY.over(social)}
        />
      </div>

      <h3 className={styles.assumptionsHeading}>{COPY.assumptionsHeading}</h3>
      <ul className={styles.assumptions} data-projection-assumptions>
        <li>{COPY.assumptions.rhythm}</li>
        <li>{COPY.assumptions.holidays}</li>
        <li>{COPY.assumptions.today}</li>
      </ul>

      <p className={styles.never} data-projection-never>
        {COPY.neverRecorded}
      </p>

      <p className={styles.app}>{COPY.app(appReleased)}</p>
    </section>
  );
}
