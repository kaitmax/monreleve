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
//
// FW-CALCS-A2, ADDENDUM 2 - FOUR CARDS MORE, and the hooks R751 reads stay
// exactly where they were: one h2, two [data-side] cards with the same
// dt/dd pairs, one [data-case-sentence], [data-floored], [data-pass] and
// [data-conversion] once each. Every new card is an h3 outside [data-side].
//
//   the insurers' chart (R745)   one dot per insurer total, the French line
//                                labelled, one role="img" with a sentence
//   the care card (R746, S1)     the Swiss annual cap on top of the premiums,
//                                never added to either side
//   the franc card (R747)        the slider, when the island passes one
//   a start date (R744)          "pour N mois" / "pour N jours", the prorata
//                                line, the start-month note
//
// Every euro figure here is read from the Comparison, whose rate IS the
// slider's (lib/lamal/scenario.ts): move it and every figure follows.

import { formatDate } from '@/lib/ui/core';
import { MONTHS_PER_YEAR } from '@/lib/lamal/compare';
import { FRANC_SHIFT_LIMIT_PERCENT, convertAt } from '@/lib/lamal/convert';
import { COST_SHARING, careCapCentimes, childrenCapApplies } from '@/lib/lamal/cost-sharing';
import { formatChf, formatEur, formatRate, formatWholePercent } from '@/lib/lamal/format';
import { PRORATA_YEAR_DAYS, countAgainst, householdTotals } from '@/lib/lamal/scenario';
import { EXCHANGE_RATE, PREMIUM_DATASET_URL, PRIMINFO_URL } from '@/lib/lamal/years';
import type { Comparison, CoveragePeriod } from '@/lib/lamal/types';
import { LAMAL_COPY as COPY, PREMIUM_DATASET } from '@/lib/fr/lamal';
import { ResultCard } from '@/lib/ui/react/ResultCard/ResultCard';
import styles from './Comparison.module.scss';

/** R747: the slider, owned by the island. */
export interface FrancControl {
  readonly shiftPercent: number;
  readonly onShift: (shiftPercent: number) => void;
}

export type PanelState =
  | {
      readonly kind: 'comparison';
      readonly value: Comparison;
      /** R744: absent or null for the whole year. */
      readonly period?: CoveragePeriod | null;
      /** R747: absent where nothing can move it (the workbench, a static test). */
      readonly franc?: FrancControl;
    }
  | { readonly kind: 'refusal'; readonly year: number };

export const PANEL_HEADING_ID = 'comparaison-titre';

/** The slider's control id; FIXED, like the form's (the specs address it). */
export const FRANC_INPUT_ID = 'cours-franc';

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

/** The chart's right end: the furthest mark plus a margin, up to a round step. */
const SCALE_STEP_EUR = 1000;
const SCALE_MARGIN = 1.1;

/** True when the slider moved the rate away from the ECB's (R747). */
function isHypothesis(value: Comparison): boolean {
  return value.rate.chfPerEurTenThousandths !== EXCHANGE_RATE.chfPerEurTenThousandths;
}

/**
 * The rate beside euros converted from francs (R673): the ECB reference and
 * its date, or - the slider moved - its hypothesis with the reference beside
 * it (R747, row L14).
 */
function rateSentence(value: Comparison): string {
  const date = formatDate(EXCHANGE_RATE.date);
  const reference = formatRate(EXCHANGE_RATE.chfPerEurTenThousandths);

  return isHypothesis(value)
    ? COPY.result.swiss.hypothesis(formatRate(value.rate.chfPerEurTenThousandths), reference, date)
    : COPY.result.swiss.conversion(reference, date);
}

/**
 * One Swiss total. FW-CALCS-A2, R731: comparateur-lamal-a2 sets the EUROS
 * large and the FRANCS beneath - the reader compares against a French
 * contribution in euros - where the panel set them the other way round. The
 * same two figures, from the same Comparison; only their sizes swapped. The
 * converted figure never stands without its rate and date: the conversion
 * line is in this same card (R673).
 */
function Figure({ label, centimes, eur, per }: { label: string; centimes: number; eur: number; per: string }) {
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureValue}>
        <span className={styles.amount}>{formatEur(eur)}</span>{' '}
        <span className={styles.perYear}>{per}</span>
        <span className={styles.converted}>{formatChf(centimes)}</span>
      </dd>
    </div>
  );
}

/** R745: the insurers' totals as dots, the French contribution as a labelled line. */
function InsurerChart({ value, months }: { value: Comparison; months: number }) {
  const totals = householdTotals(value, months).map((total) => total.eur);
  const french = value.french.contributionEur;
  const { above, below, count } = countAgainst(totals, french);
  const lowest = totals[0] ?? 0;
  const highest = totals[totals.length - 1] ?? 0;
  const scaleMax = Math.max(
    SCALE_STEP_EUR,
    Math.ceil((Math.max(highest, french) * SCALE_MARGIN) / SCALE_STEP_EUR) * SCALE_STEP_EUR,
  );
  const at = (eur: number): string => `${((eur / scaleMax) * 100).toFixed(2)}%`;
  const sentence = COPY.result.chart.sentence(above, below, count);
  // CA12: a tie is not-below, so nothing strictly above reads as 'none'.
  const caseName = above === count ? 'all' : above === 0 ? 'none' : 'some';

  return (
    <ResultCard element="article" aria-labelledby="assureurs-titre" data-chart="insurers">
      <h3 className={styles.sideHeading} id="assureurs-titre">
        {COPY.result.chart.heading(count)}
      </h3>
      <p className={styles.note}>{COPY.result.chart.intro}</p>

      <div
        className={styles.plot}
        role="img"
        aria-label={COPY.result.chart.label(count, formatEur(lowest), formatEur(highest), formatEur(french), sentence)}
      >
        <div className={styles.track} aria-hidden="true">
          <span className={styles.axis} />
          {totals.map((eur, index) => (
            // The order IS the identity here: the totals are sorted and no
            // insurer is named (R668), so the index is all a dot has.
            <span key={index} className={styles.dot} style={{ insetInlineStart: at(eur) }} data-dot="true" />
          ))}
          <span className={styles.frenchMark} style={{ insetInlineStart: at(french) }} data-french-line="true" />
        </div>
        {/*
          The label sits under the line and slides with it: its start at the
          line's position, pulled back by the same share of its own width, so
          it is left-aligned at 0, right-aligned at the scale's end, and never
          leaves the card.
        */}
        <p className={styles.markRow} aria-hidden="true">
          <span className={styles.markLabel} style={{ marginInlineStart: at(french), translate: `-${at(french)} 0` }}>
            {COPY.result.chart.french(formatEur(french))}
          </span>
        </p>
        <p className={styles.scale} aria-hidden="true">
          <span>{formatEur(0)}</span>
          <span>{formatEur(scaleMax)}</span>
        </p>
      </div>

      <p className={styles.note} data-count-sentence={caseName}>
        {sentence}
      </p>
      <p className={styles.note}>{rateSentence(value)}</p>
    </ResultCard>
  );
}

/** R746 (S1): the Swiss annual cap on what is paid on top of the premiums. */
function CareCard({ value }: { value: Comparison }) {
  const { franchiseChf } = value.year.premiums;
  const cap = careCapCentimes(value.year, value.persons);

  return (
    <ResultCard element="article" aria-labelledby="soins-titre" data-care="true">
      <h3 className={styles.sideHeading} id="soins-titre">
        {COPY.result.care.heading}
      </h3>
      <p className={styles.note}>{COPY.result.care.intro}</p>
      <p className={styles.figureLabel}>{COPY.result.care.label}</p>
      <p className={styles.amountLine}>
        <span className={styles.amount}>{formatChf(cap)}</span>
      </p>
      <p className={styles.note}>{COPY.result.care.inEuros(formatEur(convertAt(cap, value.rate)))}</p>
      <p className={styles.note}>
        {COPY.result.care.rule(
          formatChf(franchiseChf.adult * 100),
          formatWholePercent(COST_SHARING.sharePercent),
          formatChf(COST_SHARING.shareCapAdultChf * 100),
          formatChf(COST_SHARING.shareCapChildChf * 100),
        )}
      </p>
      {childrenCapApplies(value.year, value.persons) ? (
        <p className={styles.note} data-children-cap="true">
          {COPY.result.care.children(formatChf((franchiseChf.adult + COST_SHARING.shareCapAdultChf) * 100))}
        </p>
      ) : null}
      <p className={styles.note}>{COPY.result.care.hospital}</p>
      <p className={styles.note}>{COPY.result.care.apart}</p>
      <p className={styles.note}>{rateSentence(value)}</p>
      <p className={styles.source}>{COPY.result.care.source}</p>
    </ResultCard>
  );
}

/** R747: the franc slider - a hypothesis, never a rate. */
function FrancCard({ value, franc, totals }: { value: Comparison; franc: FrancControl; totals: boolean }) {
  const shift = franc.shiftPercent;
  const state =
    shift === 0
      ? COPY.result.franc.atReference
      : shift > 0
        ? COPY.result.franc.stronger(shift)
        : COPY.result.franc.weaker(-shift);
  const noteId = `${FRANC_INPUT_ID}-note`;

  return (
    <ResultCard element="article" aria-labelledby="franc-titre" data-franc="true">
      <h3 className={styles.sideHeading} id="franc-titre">
        {COPY.result.franc.heading}
      </h3>
      <p className={styles.note}>{COPY.result.franc.intro}</p>

      <label className={styles.rangeLabel} htmlFor={FRANC_INPUT_ID}>
        {COPY.result.franc.label(state)}
      </label>
      <input
        id={FRANC_INPUT_ID}
        className={styles.range}
        type="range"
        min={-FRANC_SHIFT_LIMIT_PERCENT}
        max={FRANC_SHIFT_LIMIT_PERCENT}
        step={1}
        value={shift}
        aria-valuetext={state}
        aria-describedby={noteId}
        onChange={(event) => franc.onShift(Number(event.target.value))}
      />
      <p className={styles.rangeEnds} aria-hidden="true">
        <span>{COPY.result.franc.weakest(FRANC_SHIFT_LIMIT_PERCENT)}</span>
        <span>{COPY.result.franc.middle}</span>
        <span>{COPY.result.franc.strongest(FRANC_SHIFT_LIMIT_PERCENT)}</span>
      </p>

      <p className={styles.note}>
        {COPY.result.franc.rateLead}
        <strong>{formatRate(value.rate.chfPerEurTenThousandths)}</strong>
      </p>
      {totals ? (
        <p className={styles.note}>
          {COPY.result.franc.totals(formatEur(value.swiss.lowestEur), formatEur(value.swiss.highestEur))}
        </p>
      ) : null}
      <p className={styles.source} id={noteId}>
        {COPY.result.franc.reference(formatRate(EXCHANGE_RATE.chfPerEurTenThousandths), formatDate(EXCHANGE_RATE.date))}
      </p>
    </ResultCard>
  );
}

function ComparisonBody({
  value,
  period,
  franc,
}: {
  value: Comparison;
  period: CoveragePeriod | null;
  franc: FrancControl | undefined;
}) {
  const { year, swiss, french, cheaper } = value;
  const allowance = formatWholePercent(year.allowancePercentOfPass);
  const franchise = year.premiums.franchiseChf;
  const months = period?.months ?? MONTHS_PER_YEAR;
  // Q5 (ADVISOR RULING 1, 2026-11-03): zero whole months under R744's
  // fallback means NO Swiss total - never "0 EUR" - and nothing that compares
  // against one (the chart, the case sentence, the slider's totals line).
  const noSwiss = period !== null && period.months === 0;
  const swissPer = period === null ? COPY.result.perYear : COPY.result.forMonths(period.months);
  const frenchPer = period === null ? COPY.result.perYear : COPY.result.forDays(period.days);

  return (
    <>
      {/* R731: the two cards side by side, then the case sentence. */}
      <div className={styles.columns}>
        <ResultCard element="article" data-side="switzerland" aria-labelledby="cote-suisse">
          <h3 className={styles.sideHeading} id="cote-suisse">
            {COPY.result.swiss.heading}
          </h3>

          {noSwiss ? (
            <p className={styles.note} data-too-short="true">
              {COPY.result.swiss.tooShort}
            </p>
          ) : (
            <>
              <dl className={styles.figures}>
                <Figure label={COPY.result.swiss.lowest} centimes={swiss.lowestCentimes} eur={swiss.lowestEur} per={swissPer} />
                <Figure label={COPY.result.swiss.median} centimes={swiss.medianCentimes} eur={swiss.medianEur} per={swissPer} />
                <Figure label={COPY.result.swiss.highest} centimes={swiss.highestCentimes} eur={swiss.highestEur} per={swissPer} />
              </dl>

              <p className={styles.note}>
                {COPY.result.swiss.basis(
                  months,
                  swiss.insurerCount,
                  formatChf(franchise.adult * 100),
                  formatChf(franchise.child * 100),
                )}
              </p>
            </>
          )}
          {period === null ? null : (
            <p className={styles.note} data-start-month="true">
              {COPY.result.swiss.startMonth}
            </p>
          )}
          {noSwiss ? null : (
            <p className={styles.note} data-conversion="true">
              {rateSentence(value)}
            </p>
          )}
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
                <span className={styles.perYear}>{frenchPer}</span>
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
          {period === null ? null : (
            <p className={styles.note} data-prorata="true">
              {COPY.result.french.prorata(period.days, PRORATA_YEAR_DAYS)}
            </p>
          )}
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

      {noSwiss ? null : <InsurerChart value={value} months={months} />}

      <div className={styles.columns}>
        <CareCard value={value} />
        {franc === undefined ? null : <FrancCard value={value} franc={franc} totals={!noSwiss} />}
      </div>

      {noSwiss ? null : (
        <p className={styles.caseSentence} data-case-sentence={cheaper}>
          {CASE_SENTENCE[cheaper]}
        </p>
      )}

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
  const period = state.kind === 'comparison' ? (state.period ?? null) : null;

  return (
    <section className={styles.panel} aria-labelledby={PANEL_HEADING_ID} data-panel={state.kind}>
      <h2 className={styles.panelHeading} id={PANEL_HEADING_ID}>
        {state.kind === 'refusal'
          ? COPY.refusal.heading(year)
          : period === null
            ? COPY.result.heading(year)
            : COPY.result.headingFrom(year, period.startIso)}
      </h2>

      {state.kind === 'comparison' ? (
        <ComparisonBody value={state.value} period={period} franc={state.franc} />
      ) : (
        <p className={styles.note}>{COPY.refusal.body(year)}</p>
      )}
    </section>
  );
}
