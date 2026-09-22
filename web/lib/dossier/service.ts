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
  /**
   * False for a working day nobody logged.
   *
   * ============================================================================
   * SPEC 12 ITEM 5: A DAY WITH NO ENTRY IS PRINTED, NOT SKIPPED
   * ============================================================================
   *
   * "Days with no entry are printed as *Non renseigné* rather than skipped: a
   * document that silently omits dates invites the question of what else it
   * omits."
   *
   * Until FW25b the annex mapped over ENTRIES, so a gap simply was not there.
   * Reading the demo document found it: 16.06 present, 18.06 present, 17.06 -
   * a Wednesday the seed deliberately leaves empty - absent, with nothing
   * saying so.
   *
   * That single mapping choice caused two of the six defects the read-through
   * found. It is also what makes `workedDaysNote` honest: with gaps as rows the
   * note explains a real relationship between 240 and the row count, rather
   * than papering over the fact that the annex was counting a different thing.
   */
  readonly recorded: boolean;
  /** Null on an unlogged day - there is no portion to state. */
  readonly portion: string | null;
  readonly kind: string | null;
  readonly absenceReason: string | null;
  readonly note: string | null;
  readonly provenance: string | null;
  readonly detectedKind: string | null;
  /** Null on an unlogged day: nothing was recorded, so nothing was stamped. */
  readonly firstRecordedAt: string | null;
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

/**
 * The dossier needs one fact about the person the engine never does.
 *
 * SPEC 12 item 1 puts the NAME first in the header, and `AggregatableUser` is
 * the engine's view - it has no business carrying one.
 */
export interface DossierUser extends AggregatableUser {
  readonly name: string | null;
}

/**
 * The document has no identified titulaire, so it is not a dossier.
 *
 * ============================================================================
 * A CORRECTNESS DEFECT, NOT A MISSING FIELD (R205)
 * ============================================================================
 *
 * Every other gap the read-through found makes the document INCOMPLETE. This
 * one makes it UNATTRIBUTABLE: a PDF that cannot be filed against a person is
 * not a relevé, it is a table of numbers. A fiduciaire holding two of them
 * cannot tell whose is whose.
 *
 * So the route refuses rather than rendering, which is R205's rule on a
 * document: served only when it can be believed. An unnamed dossier is the
 * `assetlinks.json` of `[]` - syntactically complete and a statement of
 * something nobody meant.
 */
export class MissingTitulaireError extends Error {
  constructor() {
    super('the dossier has no titulaire; SPEC 12 item 1 requires a name in the header');
    this.name = 'MissingTitulaireError';
  }
}

/**
 * The titulaire's name, or null when there is not one.
 *
 * ONE PREDICATE, TWO CALLERS (R206). `buildDossier` uses it to refuse, and the
 * PDF route uses it to refuse EARLY with a name a client can act on - before
 * minting a token and launching a browser for a document that cannot exist.
 * Two callers each deciding what "blank" means is how one accepts a name of
 * three spaces that the other rejects.
 */
export function titulaireOf(name: string | null): string | null {
  const trimmed = (name ?? '').trim();

  return trimmed === '' ? null : trimmed;
}

export interface Dossier {
  readonly taxYear: number;
  /** SPEC 12 item 1. Never empty - `buildDossier` refuses first. */
  readonly titulaire: string;
  /** SPEC 12 item 1, ISO. Server-assigned, like every other stamp. */
  readonly generatedAt: string;
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
/**
 * Every Monday-to-Friday of the year, as ISO days.
 *
 * ============================================================================
 * WHICH DAYS FORM THE ANNEX'S UNIVERSE, AND WHY THIS IS A DECISION
 * ============================================================================
 *
 * SPEC 12 item 5 says days with no entry are printed rather than skipped. It
 * does not say WHICH days, and the two readings differ by 104 rows.
 *
 * WEEKDAYS, because the annex exists to account for WORKING days: a Saturday
 * nobody logged is not a fact about anybody's telework, and printing 104 of
 * them would bury the one Wednesday that matters under noise - which is the
 * opposite of what "a document that silently omits dates" is guarding against.
 *
 * A weekend day that HAS an entry still appears: the universe is the weekdays
 * UNION the days actually logged, so somebody who worked a Saturday sees it.
 *
 * Public holidays are not excluded, because this product does not know the
 * canton's holiday calendar and inventing one would be a second source of
 * truth about what a working day is.
 */
function weekdaysOf(year: number): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));

  while (cursor.getUTCFullYear() === year) {
    const weekday = cursor.getUTCDay();

    if (weekday !== 0 && weekday !== 6) {
      days.push(cursor.toISOString().slice(0, 10));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

/** One unlogged working day, as SPEC 12 item 5 requires it to appear. */
function notRecorded(dayDate: string): AnnexRow {
  return {
    dayDate,
    recorded: false,
    portion: null,
    kind: null,
    absenceReason: null,
    note: null,
    provenance: null,
    detectedKind: null,
    firstRecordedAt: null,
    lastModifiedAt: null,
    clientClaimedAt: null,
    // NOT late. Lateness is a property of a recording, and there was none -
    // `false` here means "no late recording", not "recorded on time".
    late: false,
  };
}

/**
 * The evidence annex: every logged entry, plus every working day that has none.
 *
 * ONE PASS OVER A UNION, not a merge of two sorted lists, because the sort is
 * then stated once. A document whose rows arrive in query-plan order changes
 * between two regenerations of the same year.
 */
function buildAnnex(entries: readonly AnnexEntry[], taxYear: number): AnnexRow[] {
  const byDay = new Map<string, AnnexEntry[]>();

  for (const entry of entries) {
    const day = isoDay(entry.dayDate);
    const existing = byDay.get(day);

    if (existing === undefined) byDay.set(day, [entry]);
    else existing.push(entry);
  }

  const universe = [...new Set([...weekdaysOf(taxYear), ...byDay.keys()])].sort();
  const rows: AnnexRow[] = [];

  for (const day of universe) {
    const logged = byDay.get(day);

    if (logged === undefined) {
      rows.push(notRecorded(day));

      continue;
    }

    for (const entry of [...logged].sort(
      (left, right) => PORTION_ORDER.indexOf(left.portion) - PORTION_ORDER.indexOf(right.portion),
    )) {
      rows.push({
        dayDate: day,
        recorded: true,
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
      });
    }
  }

  return rows;
}

export function buildDossier(
  user: DossierUser,
  entries: readonly AnnexEntry[],
  taxYear: number,
  generatedAt: Date = new Date(),
): Dossier {
  const result = annualResult(user, entries, taxYear);
  const counts = countDays(entries);

  if (user.canton === null) {
    throw new Error('the dossier needs a canton; toTeleworkInput refuses first, this is belt');
  }

  // BEFORE ANYTHING IS COMPUTED. A document that cannot be attributed should
  // not be half-built and then discarded by a renderer.
  const titulaire = titulaireOf(user.name);

  if (titulaire === null) {
    throw new MissingTitulaireError();
  }

  return {
    taxYear,
    titulaire,
    generatedAt: generatedAt.toISOString(),
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

    annex: buildAnnex(entries, taxYear),

    absenceDays: counts.absenceDays,
    result,
  };
}

/** FULL, AM, PM - the same order the API states in words. */
const PORTION_ORDER: readonly AggregatableEntry['portion'][] = ['FULL', 'AM', 'PM'];
