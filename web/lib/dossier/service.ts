// web/lib/dossier/service.ts
//
// The dossier payload. FW24 increment 4.
//
// ============================================================================
// EVERY FIGURE COMES FROM THE ENGINE. THIS FILE ARRANGES, IT DOES NOT DECIDE.
// ============================================================================
//
// Nothing here divides, rounds, compares against a threshold, or recomputes a
// value the engine produced. FW12's tile defect was a panel doing exactly that
// and passing, because every fixture agreed with both implementations.
//
// The one arithmetic this file does is COUNTING, and it does it by calling
// lib/dossier/aggregate rather than counting again.
//
// ============================================================================
// BOTH RATES TRAVEL. R224.
// ============================================================================
//
// `declarableRate` is the figure: it is what the reader files with the AFC, it
// is what SPEC 12's monthly column means by "cumul % declarable", and it is
// what positions the rail (SPEC 6.2). `rawRate` is the explanatory figure -
// *part de jours hors de Suisse* - and it belongs BESIDE the declarable rate
// where the two differ, never as the headline.
//
// They differ because the numerators differ: the declarable rate counts the
// days charged against the ceiling, the raw rate counts every day spent outside
// Switzerland. On the demo year that is 42,70 against 43,60 - under a point
// apart, which is precisely why putting the wrong one in the panel would be
// invisible to any test that checks a percentage looks plausible.
//
// THE SERVICE CARRIES BOTH AND CHOOSES NEITHER'S PRESENTATION. FD3 specifies a
// two-rate state with an explanatory sentence when they diverge; discarding
// `rawRate` here would make that state unbuildable in FW25.

import type { TeleworkResult, Warning } from '@/lib/calc-engine';
import { isLate } from '@/lib/entries/late';
import {
  type AggregatableEntry,
  type AggregatableUser,
  countDays,
} from '@/lib/dossier/aggregate';
import { type MonthRow, annualResult, monthlyBreakdown } from '@/lib/dossier/monthly';

/** One row of the evidence annex - SPEC 12 item 5. */
export interface AnnexRow {
  readonly dayDate: string;
  readonly portion: string;
  readonly kind: string;
  readonly absenceReason: string | null;
  readonly note: string | null;
  readonly provenance: string;
  readonly detectedKind: string | null;
  readonly firstRecordedAt: string;
  /**
   * Null when the day has never been edited.
   *
   * SPEC 12 prints it "when different", and R215 made that answerable: it is
   * derived from the MODIFIED events rather than from `updatedAt`, which
   * differs from `firstRecordedAt` by milliseconds on every untouched row.
   */
  readonly lastModifiedAt: string | null;
  readonly clientClaimedAt: string | null;
  /** SPEC 11.3, computed here so the document, the CSV and the API agree. */
  readonly late: boolean;
}

/** What the zone panel needs. R224. */
export interface ZoneFigures {
  /** THE figure. Filed with the AFC, and what positions the rail. */
  readonly declarableRate: number;
  /** The explanatory one: every day outside Switzerland, rounded up. */
  readonly rawRate: number;
  /**
   * Whether the renderer must show FD3's two-rate state.
   *
   * DERIVED, not a second opinion: it is simply whether the two differ. A
   * renderer deciding this for itself would be a second implementation of a
   * comparison, and the two would disagree on the day one of them changed its
   * rounding.
   */
  readonly ratesDiffer: boolean;
  readonly fiscalCeilingDays: number;
  readonly remainingToFiscal: number;
  readonly remainingToSocial: number;
  readonly warnings: readonly Warning[];
}

/** The four MetricTiles - SPEC 12 item 2. */
export interface Tiles {
  readonly workedDays: number;
  readonly swissDays: number;
  readonly teleworkDays: number;
  readonly missionDays: number;
}

export interface Dossier {
  readonly taxYear: number;
  readonly canton: string;
  readonly employmentRate: number;
  readonly denominatorKind: string;
  readonly tiles: Tiles;
  readonly zone: ZoneFigures;
  readonly months: readonly MonthRow[];
  readonly annex: readonly AnnexRow[];
  /** D28: counted once, here, and in no other figure. */
  readonly absenceDays: number;
  /** Working days in the year with no entry at all - SPEC 12 item 5. */
  readonly result: TeleworkResult;
}

/** An entry as the annex needs it, which is more columns than the engine sees. */
export interface AnnexEntry extends AggregatableEntry {
  readonly absenceReason: string | null;
  readonly note: string | null;
  readonly provenance: string;
  readonly detectedKind: string | null;
  readonly firstRecordedAt: Date;
  readonly lastModifiedAt: Date | null;
  readonly clientClaimedAt: Date | null;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);
const instant = (date: Date | null): string | null => (date === null ? null : date.toISOString());

/**
 * Build the whole payload.
 *
 * THE ANNEX IS SORTED, AND BY THE SAME RULE AS THE API. A document whose rows
 * arrive in query-plan order is a document that changes between two
 * regenerations of the same year, which is the opposite of what an evidence
 * annex is for.
 */
export function buildDossier(
  user: AggregatableUser,
  entries: readonly AnnexEntry[],
  taxYear: number,
): Dossier {
  const result = annualResult(user, entries, taxYear);
  const counts = countDays(entries);

  if (user.canton === null) {
    throw new Error('the dossier needs a canton; toTeleworkInput refuses first, this is belt');
  }

  return {
    taxYear,
    canton: user.canton,
    employmentRate: user.employmentRate,
    denominatorKind: user.denominatorKind,

    tiles: {
      // FROM THE ENGINE, not from a count. `totalWorkDays` is the prorated
      // denominator (SPEC 7.4), which is NOT the number of rows - a person who
      // logged 261 days still has a 240-day denominator under the simplified
      // basis, and the tile must say the figure the rate was computed against.
      workedDays: result.totalWorkDays,
      swissDays: counts.swissDays,
      teleworkDays: counts.teleworkDays,
      missionDays: counts.missionDaysFrance + counts.missionDaysThirdState,
    },

    zone: {
      declarableRate: result.declarableRate,
      rawRate: result.rawRate,
      ratesDiffer: result.declarableRate !== result.rawRate,
      fiscalCeilingDays: result.fiscalCeilingDays,
      remainingToFiscal: result.remainingToFiscal,
      remainingToSocial: result.remainingToSocial,
      warnings: result.warnings,
    },

    months: monthlyBreakdown(user, entries, taxYear),

    annex: [...entries]
      .sort((left, right) => {
        const a = isoDay(left.dayDate);
        const b = isoDay(right.dayDate);

        if (a !== b) return a < b ? -1 : 1;

        return PORTION_ORDER.indexOf(left.portion) - PORTION_ORDER.indexOf(right.portion);
      })
      .map((entry) => ({
        dayDate: isoDay(entry.dayDate),
        portion: entry.portion,
        kind: entry.kind,
        absenceReason: entry.absenceReason,
        note: entry.note,
        provenance: entry.provenance,
        detectedKind: entry.detectedKind,
        firstRecordedAt: entry.firstRecordedAt.toISOString(),
        lastModifiedAt: instant(entry.lastModifiedAt),
        clientClaimedAt: instant(entry.clientClaimedAt),
        late: isLate(entry.dayDate, entry.firstRecordedAt),
      })),

    absenceDays: counts.absenceDays,
    result,
  };
}

/** FULL, AM, PM - the same order the API states in words. */
const PORTION_ORDER: readonly AggregatableEntry['portion'][] = ['FULL', 'AM', 'PM'];
