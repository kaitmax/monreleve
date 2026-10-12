// web/app/(public)/HeroPhone.tsx
//
// The hero's phone card, RENDERED rather than pictured (FW34, relay 2). Its
// three figures - the rate, the days before each ceiling - are computed by the
// engine from lib/content/home.ts's worked example and never typed, so they can
// never drift from it (R147, R163). The card is composed from the site's own
// library components, the same ones the calculator's ResultPanel draws with, so
// the hero and the calculator say the same words (R206): ZoneBadge for the
// status, RateDisplay for the rate, ThresholdRail for the bar, MetricTile for
// the two headroom tiles.
//
// PAGE-SPECIFIC COMPOSITION, not a library component, for ResultPanel's own
// reason: it is an ARRANGEMENT with one call site, so it lives beside the page
// rather than in lib/ui/react.
//
// IT RECEIVES A TeleworkResult AND COMPUTES NOTHING (standing protocol 7). The
// engine is the only thing verified against the tax administration; a card that
// recomputed would be a second answer with no authority.
//
// rawRate IS NOT PASSED, deliberately. RateDisplay shows the raw rate only when
// it diverges from the declarable one, and for 38/240 it does (15,9 vs 15,83) -
// but the hero is a curated teaser, not the full result, and design/home shows
// a single headline rate. The full calculator, one tap away, shows both. The
// divergence block is omitted here by withholding the prop, which is exactly
// what RateDisplay's contract allows ("the caller may always pass it").

import {
  type TeleworkResult,
  ruleSetFor,
} from '@/lib/calc-engine';
import {
  type ZoneThresholds,
  formatSignedDays,
  statusFor,
  zoneFor,
} from '@/lib/ui/core';
import { HOME_COPY } from '@/lib/fr/home';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import { ZoneBadge } from '@/lib/ui/react/ZoneBadge/ZoneBadge';
import styles from './home.module.scss';

/** The rail's reference width inside the card; the SVG scales to 100 % below it. */
const RAIL_WIDTH = 232;

export interface HeroPhoneProps {
  readonly result: TeleworkResult;
  /** The year, so the tile labels name the ceilings the RuleSet carries. */
  readonly taxYear: number;
  /** The two ceilings, already formatted, for the tile labels (R73). */
  readonly fiscal: string;
  readonly social: string;
  /** The example's figures, for the caption that narrates the fixture (R163). */
  readonly exampleDays: string;
  readonly basisDays: string;
}

export function HeroPhone({ result, taxYear, fiscal, social, exampleDays, basisDays }: HeroPhoneProps) {
  const thresholds: ZoneThresholds = ruleSetFor(taxYear);
  const zone = zoneFor(result.declarableRate, thresholds);

  return (
    <div className={styles.phoneColumn}>
      <div className={styles.phone}>
        <div className={styles.phoneHeader}>
          <span className={styles.phoneMark} aria-hidden="true" />
          <span className={styles.phoneTitle}>{HOME_COPY.hero.cardTitle}</span>
        </div>

        <div className={styles.phoneCard}>
          <ZoneBadge status={statusFor(result)} />

          <RateDisplay declarableRate={result.declarableRate} zone={zone} />

          <div className={styles.phoneRail}>
            <ThresholdRail
              percentage={result.declarableRate}
              zone={zone}
              thresholds={thresholds}
              variant="compact"
              width={RAIL_WIDTH}
            />
          </div>

          <div className={styles.phoneTiles}>
            <MetricTile
              days={formatSignedDays(result.remainingToFiscal)}
              label={METRIC_COPY.remaining(fiscal)}
              overLabel={METRIC_COPY.over(fiscal)}
            />
            <MetricTile
              days={formatSignedDays(result.remainingToSocial)}
              label={METRIC_COPY.remaining(social)}
              overLabel={METRIC_COPY.over(social)}
            />
          </div>
        </div>
      </div>

      <p className={styles.phoneCaption}>{HOME_COPY.hero.cardCaption(exampleDays, basisDays)}</p>
    </div>
  );
}
