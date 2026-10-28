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
// an insurer's name; a single LAMal figure - there are always three; a
// converted figure without its rate and date - the conversion line sits in
// the same card as the euros it explains.

import { formatDate } from '@/lib/ui/core';
import { formatChf, formatEur, formatRate, formatWholePercent } from '@/lib/lamal/format';
import { PREMIUM_DATASET_URL, PRIMINFO_URL } from '@/lib/lamal/years';
import type { Comparison } from '@/lib/lamal/types';
import { LAMAL_COPY as COPY, PREMIUM_DATASET } from '@/lib/fr/lamal';
import styles from './Comparison.module.scss';

export type PanelState =
  | { readonly kind: 'comparison'; readonly value: Comparison }
  | { readonly kind: 'refusal'; readonly year: number };

export const PANEL_HEADING_ID = 'comparaison-titre';

function Badge() {
  return (
    <p className={styles.badge} data-badge="true">
      {COPY.result.badge}
    </p>
  );
}

function Figure({ label, centimes, eur }: { label: string; centimes: number; eur: number }) {
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureValue}>
        <span className={styles.amount}>{formatChf(centimes)}</span>{' '}
        <span className={styles.perYear}>{COPY.result.perYear}</span>
        <span className={styles.converted}>{formatEur(eur)}</span>
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
      {cheaper === 'depends' ? (
        <p className={styles.depends} data-depends="true">
          {COPY.result.depends}
        </p>
      ) : null}

      <div className={styles.columns}>
        <article className={styles.side} data-side="switzerland" aria-labelledby="cote-suisse">
          <h3 className={styles.sideHeading} id="cote-suisse">
            {COPY.result.swiss.heading}
          </h3>
          {cheaper === 'switzerland' ? <Badge /> : null}

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
          <p className={styles.source} data-attribution="true">
            {COPY.result.swiss.attributionBefore}
            <a href={PREMIUM_DATASET_URL} rel="noreferrer">
              {PREMIUM_DATASET.title}
            </a>
            {COPY.result.swiss.attributionAfter(year.year)}
          </p>
          <p className={styles.note}>
            {COPY.result.swiss.priminfo.lead}
            <a href={PRIMINFO_URL} rel="noreferrer">
              {COPY.result.swiss.priminfo.text}
            </a>
          </p>
        </article>

        <article className={styles.side} data-side="france" aria-labelledby="cote-france">
          <h3 className={styles.sideHeading} id="cote-france">
            {COPY.result.french.heading}
          </h3>
          {cheaper === 'france' ? <Badge /> : null}

          <dl className={styles.figures}>
            <div className={styles.figure}>
              <dt className={styles.figureLabel}>{COPY.result.french.amount}</dt>
              <dd className={styles.figureValue}>
                <span className={styles.amount}>{formatEur(french.contributionEur)}</span>{' '}
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
            <p className={styles.note} data-pass="announced">
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
        </article>
      </div>

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
