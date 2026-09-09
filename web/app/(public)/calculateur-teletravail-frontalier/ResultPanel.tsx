// web/app/(public)/calculateur-teletravail-frontalier/ResultPanel.tsx
//
// FW12: the result panel, in SPEC 9.3's order.
//
// NOT IN lib/ui/react, and the prompt is explicit about why: this is
// page-specific composition, not a reusable component. Everything it draws
// with comes from FW8's library; what it adds is the ARRANGEMENT, and an
// arrangement with one call site does not belong in a library.
//
// IT COMPUTES NOTHING (standing protocol 7). It receives a TeleworkResult and
// renders it. Zone and Status come from lib/ui/core. The engine is the only
// thing verified against the tax administration, so a panel that recalculated
// would be a second answer with no authority behind it.
//
// THE ORDER IS THE DESIGN. SPEC 9.3: "Order is decision-relevance." Status
// first because it is the answer, the rate because it is the number, the rail
// because it places the number, the tiles because they are the consequences,
// warnings because they are conditional, the legal note because it qualifies
// everything above it, and one contextual link last because it is what to do
// next. tests/unit/pages/result-panel-order.test.tsx asserts the DOM sequence,
// because all seven render correctly in any order and a diff that swaps two of
// them looks like a formatting change.

import { ChevronRight } from 'lucide-react';
import {
  type TeleworkInput,
  type TeleworkResult,
  type Warning,
} from '@/lib/calc-engine';
import { ctaHrefIfLive } from '@/lib/content/routes';
import { RESULT_COPY as COPY } from '@/lib/fr/result';
import {
  type ZoneThresholds,
  formatPercent,
  formatSignedDays,
  statusFor,
  zoneFor,
} from '@/lib/ui/core';
import { LegalNote } from '@/lib/ui/react/LegalNote/LegalNote';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import { ZoneBadge } from '@/lib/ui/react/ZoneBadge/ZoneBadge';
import { METRIC_COPY } from '@/lib/fr/metrics';
import styles from './ResultPanel.module.scss';

const ICON = 16;
const STROKE = 1.75;

/** FD1's rail width for the panel column. */
const RAIL_WIDTH = 376;

/** Percent, from the fraction RuleSet stores. */
const PERCENT = 100;

/**
 * A ceiling as the panel prints it: no decimal on a whole percentage.
 *
 * The same rule the page's prose uses, so "40 %" reads identically in a tile
 * label and in the explanatory paragraph below the form.
 */
function ceiling(fraction: number): string {
  const percent = fraction * PERCENT;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
}

/**
 * The order warnings appear in, defined once.
 *
 * INDEPENDENT OF THE ENGINE'S EMISSION ORDER, deliberately. warnings.ts pushes
 * them in the order its checks happen to run, which is an implementation
 * detail; a reader needs the most consequential first. Increment 4 tests this
 * list against the union so a new code cannot be added without a position.
 */
const WARNING_ORDER: readonly Warning['code'][] = [
  'FISCAL_CEILING_EXCEEDED',
  'FRONTALIER_STATUS_AT_RISK',
  'SOCIAL_CEILING_EXCEEDED',
  'MISSION_CAP_EXCEEDED',
  'MISSIONS_EXCEED_HEADROOM',
  'A1_REQUIRED',
  'EXACT_METHOD_UNVERIFIED',
];

/**
 * RULE_SET_FALLBACK IS NOT IN THAT LIST YET, and the reason is a real
 * limitation rather than an oversight.
 *
 * Its message has to name the year that was asked for and the year that was
 * applied - "aucune regle publiee pour 2099, le calcul applique celles de
 * 2026" - and WARNING_COPY's bodies are static strings. Giving them parameters
 * is increment 4's work, so until then the island keeps rendering the banner
 * it already had, which does carry the years. Two banners for one warning
 * would be worse than one in the wrong place.
 *
 * Asserted rather than remembered: increment 4's exhaustiveness test compares
 * WARNING_ORDER against the union and will fail on this gap.
 */

export interface ResultPanelProps {
  readonly result: TeleworkResult;
  /** The year's ceilings, for the rail and the tile labels (R35, R73). */
  readonly thresholds: ZoneThresholds;
  /** Carried for ruling R110's input-specific notice, added in increment 5. */
  readonly input: TeleworkInput;
}

export function ResultPanel({ result, thresholds }: ResultPanelProps) {
  const status = statusFor(result);
  const zone = zoneFor(result.declarableRate, thresholds);
  const fiscal = ceiling(thresholds.fiscalCeiling);
  const social = ceiling(thresholds.socialCeiling);

  const ordered = WARNING_ORDER.flatMap((code) =>
    result.warnings.filter((warning) => warning.code === code),
  );

  const link = COPY.links[status];
  const liveHref = ctaHrefIfLive(link.href);

  return (
    <section
      className={styles.panel}
      id="resultat"
      aria-labelledby="resultat-titre"
      aria-live="polite"
      tabIndex={-1}
    >
      <h2 className={styles.heading} id="resultat-titre">
        {COPY.heading}
      </h2>

      {/* 1. STATUS. The answer, before the number that produced it. */}
      <div className={styles.badge} data-panel="badge">
        <ZoneBadge status={status} />
      </div>

      {/* 2. THE RATE. Increment 2 adds the second rate and its sentence. */}
      <div data-panel="rate">
        <RateDisplay declarableRate={result.declarableRate} zone={zone} />
      </div>

      {/* 3. THE RAIL, which places the rate between the two ceilings. */}
      <div className={styles.rail} data-panel="rail">
        <ThresholdRail
          percentage={result.declarableRate}
          thresholds={thresholds}
          variant="inline"
          width={RAIL_WIDTH}
          zone={zone}
        />
      </div>

      {/*
        4. THE FOUR CONSEQUENCES. Increment 3 owns the negative variant and
        its labels; the values are the engine's throughout, never recomputed.
      */}
      <div className={styles.tiles} data-panel="tiles">
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
        <MetricTile
          days={formatSignedDays(result.swissTaxedDays)}
          label={COPY.tiles.swiss}
          overLabel={COPY.tiles.swiss}
        />
        <MetricTile
          days={formatSignedDays(result.frenchTaxedDays)}
          label={COPY.tiles.france}
          overLabel={COPY.tiles.france}
        />
      </div>

      {/*
        5. WARNINGS, one banner per engine Warning, in WARNING_ORDER rather
        than the engine's emission order. The slot renders even when empty so
        the panel's shape - and this test's assertion - does not depend on the
        input having produced one.
      */}
      <div className={styles.warnings} data-panel="warnings">
        {ordered.length === 0 ? null : (
          <>
            <h3 className={styles.warningsHeading}>{COPY.warningsHeading}</h3>
            <ul className={styles.warningList}>
              {ordered.map((warning) => (
                <li className={styles.warning} key={warning.code}>
                  <p className={styles.warningHeading}>
                    {COPY.warnings[warning.code].heading}
                  </p>
                  <p className={styles.warningBody}>{COPY.warnings[warning.code].body}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 6. THE STANDING DISCLAIMER, after everything it qualifies. */}
      <div className={styles.legal} data-panel="legal">
        <LegalNote />
      </div>

      {/*
        7. EXACTLY ONE CONTEXTUAL LINK, by status.

        RENDERED AS TEXT WHILE ITS TARGET IS PLANNED. All four destinations -
        /releve-annuel and three guides - are `status: 'planned'` in the route
        registry today, and ruling R85 is that a target renders only when it is
        live. An anchor here would promise a 404 from the one place a reader
        has just been told something about their own money. Naming it says the
        guide is coming; ctaHrefIfLive decides, so the day FW17 ships the
        anchor appears with no edit here.
      */}
      <div className={styles.link} data-panel="link">
        {liveHref === null ? (
          <p className={styles.linkPending}>{COPY.linkPending(link.text)}</p>
        ) : (
          <a className={styles.linkAnchor} href={liveHref}>
            <span>{link.text}</span>
            <ChevronRight aria-hidden="true" size={ICON} strokeWidth={STROKE} />
          </a>
        )}
      </div>
    </section>
  );
}
