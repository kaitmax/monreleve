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
import { type TeleworkResult, type Warning } from '@/lib/calc-engine';
import { ctaHrefIfLive } from '@/lib/content/routes';
import { RESULT_COPY as COPY, warningEntry } from '@/lib/fr/result';
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
 * detail; a reader needs the most consequential first. The panel's own order
 * is a claim about what to deal with first, so it is declared here and
 * asserted against the union - a code with no position renders no banner at
 * all, which is silence rather than a visible defect.
 *
 * RULE_SET_FALLBACK IS FIRST. It is not a consequence of the numbers, it is a
 * statement about which rules produced them, so it conditions how every line
 * below it should be read. R11: "the substitution must reach the user rather
 * than being implied by a taxYear a caller has to think to compare."
 *
 * Then the two breaches, fiscal before social, because the fiscal ceiling is
 * the one that moves taxable income and, in a 1983 canton, the status; then
 * the mission-day codes, which are the usual cause of a breach; then the two
 * disclosures, which are true regardless of the figures.
 */
const WARNING_ORDER = [
  'RULE_SET_FALLBACK',
  'FISCAL_CEILING_EXCEEDED',
  'FRONTALIER_STATUS_AT_RISK',
  'SOCIAL_CEILING_EXCEEDED',
  'MISSION_CAP_EXCEEDED',
  'MISSIONS_EXCEED_HEADROOM',
  'A1_REQUIRED',
  'EXACT_METHOD_UNVERIFIED',
] as const satisfies readonly Warning['code'][];

/**
 * Every code has a position, checked at compile time.
 *
 * THE ARRAY'S LENGTH SAYS NOTHING ABOUT COVERAGE. This list shipped with
 * seven of the eight codes in it and read as complete; the missing one was
 * RULE_SET_FALLBACK, and a code with no position renders no banner rather
 * than a broken one. `satisfies` above catches a typo in a code; this catches
 * an omission, which is the direction that failed.
 *
 * The same shape as provisional.ts's TRIGGERS_ARE_ALL_PUBLISHED: one unused
 * type and one exported constant, for a property no test has to remember.
 */
type EveryCodeHasAPosition = Warning['code'] extends (typeof WARNING_ORDER)[number]
  ? true
  : never;

export const ORDER_COVERS_EVERY_CODE: EveryCodeHasAPosition = true;

export interface ResultPanelProps {
  readonly result: TeleworkResult;
  /** The year's ceilings, for the rail and the tile labels (R35, R73). */
  readonly thresholds: ZoneThresholds;
}

export function ResultPanel({ result, thresholds }: ResultPanelProps) {
  const status = statusFor(result);
  const zone = zoneFor(result.declarableRate, thresholds);
  const fiscal = ceiling(thresholds.fiscalCeiling);
  const social = ceiling(thresholds.socialCeiling);

  /**
   * The engine's warnings, in the panel's order.
   *
   * A FILTER PER CODE RATHER THAN A SORT, so a code with no position in
   * WARNING_ORDER is dropped rather than sorted to one end - and it CANNOT
   * be dropped, because ORDER_COVERS_EVERY_CODE makes an omission a compile
   * error. It also does not deduplicate: the engine emits each code at most
   * once, and a panel that silently collapsed two banners would be hiding a
   * defect in the engine instead of showing it.
   */
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

      {/*
        2. BOTH RATES. SPEC 9.3's two-rate problem, and AC1.

        "In Geneva case (c) the rates differ sharply: 39,16 % declarable
        against 45,0 % of days actually outside Switzerland. Showing only the
        declarable rate hides real exposure; showing only the raw rate
        contradicts the payslip."

        rawRate is passed UNCONDITIONALLY and RateDisplay decides. Its prop
        documentation says so - "worth showing only when it diverges from the
        declarable rate; the caller may always pass it and this component
        decides" - so a condition here would be a second opinion about a
        question FW8 already answered, and the two could disagree.
      */}
      <div data-panel="rate">
        <RateDisplay
          declarableRate={result.declarableRate}
          rawRate={result.rawRate}
          zone={zone}
        />
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
              {ordered.map((warning, position) => {
                const entry = warningEntry(warning);

                return (
                  <li
                    className={styles.warning}
                    // The engine emits each code at most once, so the code is
                    // the identity. The position is appended because the
                    // panel does NOT deduplicate - see the note on `ordered` -
                    // and two banners with one key is a React warning that
                    // would be the reader's problem rather than the engine's.
                    key={`${warning.code}-${position}`}
                    data-warning={warning.code}
                  >
                    <p className={styles.warningHeading}>{entry.heading}</p>
                    <p className={styles.warningBody}>{entry.body}</p>
                  </li>
                );
              })}
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
