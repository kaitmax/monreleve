// web/lib/ui/react/Comparison/ComparisonPanel.tsx
//
// The result: the two annual estimates side by side, each with its year and
// its source under it (R658), or the refusal of a year the site does not hold
// (R657). Presentational only - it receives a Comparison and renders it - so
// the island and the workbench render the same component, and the refusal
// state, which no reader can reach from the year selector, still has a
// picture (R661's baselines).
//
// R673, WHAT THIS PANEL NEVER SAYS: which option to choose; « recommandé »;
// and, since R674, no badge at all - one sentence states where the French
// figure falls against the Swiss range;
// an insurer's name; a single LAMal figure - there are always three; a
// converted figure without its rate and date - the conversion line sits in
// the same card as the euros it explains.

import { formatDate } from '@/lib/ui/core';
import { formatChf, formatEur, formatRate, formatWholePercent } from '@/lib/lamal/format';
import { PREMIUM_DATASET_URL, PRIMINFO_URL } from '@/lib/lamal/years';
import type { Comparison } from '@/lib/lamal/types';
import { LAMAL_COPY as COPY, PREMIUM_DATASET } from '@/lib/fr/lamal';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import styles from './Comparison.module.scss';

export type PanelState =
  | { readonly kind: 'comparison'; readonly value: Comparison }
  | { readonly kind: 'refusal'; readonly year: number };

export const PANEL_HEADING_ID = 'comparaison-titre';

/**
 * R674 (the operator, 28.10.2026): ONE FACTUAL SENTENCE, CHOSEN BY THE CASE,
 * in place of the badge. Between the lowest and the highest Swiss total there
 * is no cheaper side, so a badge on one column could not stay true; a sentence
 * about where the French figure falls always is.
 */
const CASE_SENTENCE: Readonly<Record<Comparison['cheaper'], string>> = {
  france: COPY.result.below,
  switzerland: COPY.result.above,
  depends: COPY.result.depends,
};

/**
 * One Swiss total. FW-CALCS-A2, R731: comparateur-lamal-a2 sets the EUROS
 * large and the FRANCS beneath - the reader compares against a French
 * contribution in euros - where the panel set them the other way round. The
 * same two figures, from the same Comparison; only their sizes swapped. The
 * converted figure never stands without its rate and date: the conversion
 * line is in this same card (R673).
 */
function Figure({ label, centimes, eur }: { label: string; centimes: number; eur: number }) {
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureValue}>
        <span className={styles.amount}>{formatEur(eur)}</span>{' '}
        <span className={styles.perYear}>{COPY.result.perYear}</span>
        <span className={styles.converted}>{formatChf(centimes)}</span>
      </dd>
    </div>
  );
}

function ComparisonBody({ value }: { value: Comparison }) {
  const { year, swiss, french, cheaper, rate } = value;
  const allowance = formatWholePercent(year.allowancePercentOfPass);
  const franchise = year.premiums.franchiseChf;

  return (
    <>
      {/* R731: the two cards side by side, then the case sentence. */}
      <div className={styles.columns}>
        <ResultCard element="article" data-side="switzerland" aria-labelledby="cote-suisse">
          <h3 className={styles.sideHeading} id="cote-suisse">
            {COPY.result.swiss.heading}
          </h3>

          <dl className={styles.figures}>
            <Figure label={COPY.result.swiss.lowest} centimes={swiss.lowestCentimes} eur={swiss.lowestEur} />
            <Figure label={COPY.result.swiss.median} centimes={swiss.medianCentimes} eur={swiss.medianEur} />
            <Figure label={COPY.result.swiss.highest} centimes={swiss.highestCentimes} eur={swiss.highestEur} />
          </dl>

          <p className={styles.note}>
            {COPY.result.swiss.basis(
              swiss.insurerCount,
              formatChf(franchise.adult * 100),
              formatChf(franchise.child * 100),
            )}
          </p>
          <p className={styles.note} data-conversion="true">
            {COPY.result.swiss.conversion(formatRate(rate.chfPerEurTenThousandths), formatDate(rate.date))}
          </p>
        </ResultCard>

        <ResultCard element="article" data-side="france" aria-labelledby="cote-france">
          <h3 className={styles.sideHeading} id="cote-france">
            {COPY.result.french.heading}
          </h3>

          <dl className={styles.figures}>
            <div className={styles.figure}>
              <dt className={styles.figureLabel}>{COPY.result.french.amount}</dt>
              <dd className={styles.figureValue}>
                <span className={styles.amountLarge}>{formatEur(french.contributionEur)}</span>{' '}
                <span className={styles.perYear}>{COPY.result.perYear}</span>
              </dd>
            </div>
          </dl>

          <p className={styles.note}>
            {COPY.result.french.formula(
              formatWholePercent(year.ratePercent),
              allowance,
              formatEur(year.passEur),
              year.year,
            )}
          </p>
          {year.passStatus === 'announced' ? (
            <p className={styles.badge} data-pass="announced">
              {COPY.result.french.passAnnounced(year.year)}
            </p>
          ) : null}
          {french.floored ? (
            <p className={styles.note} data-floored="true">
              {COPY.result.french.floored(allowance)}
            </p>
          ) : null}
          <p className={styles.note}>{COPY.result.french.household}</p>
          <p className={styles.source}>{COPY.result.french.source}</p>
        </ResultCard>
      </div>

      <p className={styles.caseSentence} data-case-sentence={cheaper}>
        {CASE_SENTENCE[cheaper]}
      </p>

      {/*
        R731: the OFSP attribution (R664's mandatory credit, under the Swiss
        figures), the priminfo link and the legal line - as the page carried
        them, below the comparison rather than inside the Swiss card.
      */}
      <p className={styles.source} data-attribution="true">
        {COPY.result.swiss.attributionBefore}
        <a href={PREMIUM_DATASET_URL} rel="noreferrer">
          {PREMIUM_DATASET.title}
        </a>
        {COPY.result.swiss.attributionAfter(year.year)}
      </p>
      <p className={styles.source}>
        {COPY.result.swiss.priminfo.lead}
        <a href={PRIMINFO_URL} rel="noreferrer">
          {COPY.result.swiss.priminfo.text}
        </a>
      </p>
      <p className={styles.legal} data-legal="true">
        {COPY.result.legal}
      </p>
    </>
  );
}

export function ComparisonPanel({ state }: { readonly state: PanelState }) {
  const year = state.kind === 'comparison' ? state.value.year.year : state.year;

  return (
    <section className={styles.panel} aria-labelledby={PANEL_HEADING_ID} data-panel={state.kind}>
      <h2 className={styles.panelHeading} id={PANEL_HEADING_ID}>
        {state.kind === 'comparison' ? COPY.result.heading(year) : COPY.refusal.heading(year)}
      </h2>

      {state.kind === 'comparison' ? (
        <ComparisonBody value={state.value} />
      ) : (
        <p className={styles.note}>{COPY.refusal.body(year)}</p>
      )}
    </section>
  );
}
