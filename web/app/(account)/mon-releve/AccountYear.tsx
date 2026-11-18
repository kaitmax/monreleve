// web/app/(account)/mon-releve/AccountYear.tsx
//
// The signed-in page's figures for one year: a PURE VIEW of the dossier the
// server built. FW-WEB-ACCOUNT (R903); W12 adds the engine's warnings (Web
// Ruling 32, R1067).
//
// ONE ENGINE, DERIVED, NEVER RECOMPUTED. Every number here is a field of the
// Dossier that lib/dossier/load.ts builds with the same engine the app's
// GET /api/v1/dossier serialises - this component formats, it does not count.
// The labels are the document's own (DOSSIER_COPY, R206): a figure called one
// thing in the PDF and another on the page would be two answers to one
// question.
//
// THE ENGINE'S WARNINGS COME FIRST, AND ALL OF THEM (docs/api-v1.md 6.5:
// "surface every warning a calculation returns, never only the figures"). The
// one Web Ruling 32 names is RULE_SET_FALLBACK: a year with no rule set of its
// own is computed under the latest known rules, and the warning naming the
// year actually applied is "the only thing standing between an honest answer
// and a wrong one". It is first, before any figure it qualifies, as the
// calculator's result panel puts it first. The words are the calculator's
// (warningEntry, R206), so one warning reads the same everywhere.
//
// A SERVER COMPONENT, and pure: the page passes it the dossier; the R225 test
// passes it a dossier built by the engine from a fixture. No script reaches the
// browser for it.

import { ruleSetFor } from '@/lib/calc-engine';
import { DOSSIER_COPY } from '@/lib/fr/dossier';
import { MON_RELEVE_COPY as COPY } from '@/lib/fr/mon-releve';
import { warningEntry } from '@/lib/fr/result';
import { formatDays, formatPercent, formatSignedDays, zoneFor } from '@/lib/ui/core';
// By its own path, not the barrel: the barrel is the print page's, and a second
// importer would take it out of what only the print page renders through (R990).
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import type { Dossier } from '@/lib/dossier/service';
import styles from './mon-releve.module.scss';

/** What the view reads of a dossier - nothing else, so a fixture needs nothing else. */
export type AccountYearFigures = Pick<Dossier, 'taxYear' | 'tiles' | 'zone' | 'recordedEntries'>;

/** The rail's drawn width, the document's (app/releve/print uses the same compact variant). */
const RAIL_WIDTH = 320;

export function AccountYear({ figures }: { readonly figures: AccountYearFigures }) {
  const rules = ruleSetFor(figures.taxYear);
  const thresholds = { fiscalCeiling: rules.fiscalCeiling, socialCeiling: rules.socialCeiling };
  const fiscal = formatSignedDays(figures.zone.remainingToFiscal);
  const social = formatSignedDays(figures.zone.remainingToSocial);

  // RULE_SET_FALLBACK first, the rest in the engine's own order.
  const warnings = [
    ...figures.zone.warnings.filter((warning) => warning.code === 'RULE_SET_FALLBACK'),
    ...figures.zone.warnings.filter((warning) => warning.code !== 'RULE_SET_FALLBACK'),
  ];

  return (
    <>
      {warnings.length === 0 ? null : (
        <ul className={styles.warnings}>
          {warnings.map((warning, position) => {
            const entry = warningEntry(warning);

            return (
              <li className={styles.alert} data-warning={warning.code} key={`${warning.code}-${String(position)}`}>
                <strong>{entry.heading}</strong> {entry.body}
              </li>
            );
          })}
        </ul>
      )}

      {/* R516's rule on the document, here too: an empty year says so FIRST,
          because 0 % for a year with nothing recorded and 0 % for a year spent
          entirely in Switzerland are the same number and opposite facts. */}
      {figures.recordedEntries === 0 ? (
        <p className={styles.alert} role="status" data-empty-year>
          {COPY.page.emptyYear(figures.taxYear)}
        </p>
      ) : null}

      <div className={styles.rate}>
        <p className={styles.rateValue} data-figure="declarableRate">
          {formatPercent(figures.zone.declarableRate, 2)}
        </p>
        <p className={styles.rateLabel}>{DOSSIER_COPY.zone.declarableLabel}</p>
        <div className={styles.rail}>
          <ThresholdRail
            percentage={figures.zone.declarableRate}
            zone={zoneFor(figures.zone.declarableRate, thresholds)}
            thresholds={thresholds}
            variant="compact"
            width={RAIL_WIDTH}
          />
        </div>
      </div>

      {/* R239's question - HOW FAR - answered with the document's own words,
          and a negative REPORTED rather than clamped (R12). */}
      <dl className={styles.headroom}>
        <div className={styles.headroomItem}>
          <dt>{fiscal.negative ? DOSSIER_COPY.zone.overFiscal : DOSSIER_COPY.zone.remainingToFiscal}</dt>
          <dd data-figure="remainingToFiscal">{fiscal.text}</dd>
        </div>
        <div className={styles.headroomItem}>
          <dt>{social.negative ? DOSSIER_COPY.zone.overSocial : DOSSIER_COPY.zone.remainingToSocial}</dt>
          <dd data-figure="remainingToSocial">{social.text}</dd>
        </div>
      </dl>

      <dl className={styles.tiles}>
        <div className={styles.tile}>
          <dt>{DOSSIER_COPY.tiles.workedDays}</dt>
          <dd data-figure="workedDays">{formatDays(figures.tiles.workedDays)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{DOSSIER_COPY.tiles.swissDays}</dt>
          <dd data-figure="swissDays">{formatDays(figures.tiles.swissDays)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{DOSSIER_COPY.tiles.teleworkDays}</dt>
          <dd data-figure="teleworkDays">{formatDays(figures.tiles.teleworkDays)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>{DOSSIER_COPY.tiles.missionDays}</dt>
          <dd data-figure="missionDays">{formatDays(figures.tiles.missionDays)}</dd>
        </div>
      </dl>
    </>
  );
}
