// web/tests/db/dossier-engine.test.ts
//
// FW-DOSSIER-ENGINE (R940-R943), plan Checkpoint D item 2: "Dossier payload
// for a seeded year matches a direct engine computation exactly; PDF is A4
// with the annex expanded and provenance per row". The A4 half is
// FW-PDF-A4's. This file is the payload half, the annex and the provenance.
//
// ============================================================================
// THE EXPECTED VALUE NEVER PASSES THROUGH lib/dossier
// ============================================================================
//
// dossier-route.test.ts already proves the route serialises what
// `buildDossierFor` computed - by comparing the route with `buildDossierFor`.
// That is the right test for "the route assembles nothing" and it says
// nothing about whether the computation is RIGHT: a wrong figure in
// lib/dossier is wrong on both sides of that comparison and passes.
//
// So this file seeds a year in the database, asks the ROUTE for it (R204: the
// entry point, not the module), and compares every figure the engine produces
// with `calculateTelework` called on inputs THIS FILE derives from the SEED
// TABLE. It imports nothing from lib/dossier - not toTeleworkInput, not
// countDays, not monthlyBreakdown - because those are the code under test.
// The only shared code is the engine itself, which is the reference.
//
// THE SEED LIVES IN tests/support/seeded-year.ts (FW-ANNEX-RENDERED, R986):
// one home for the year this file asserts from the payload and
// tests/db/annex-rendered.test.ts asserts from the rendered document (R206).
// The derivation below is still this file's own.
//
// The derivation here is a deliberate second reading of the rows, kept as
// small as SPEC lets it be: a FULL day is one day and a half-day is half
// (SPEC 8), HOME is telework, the two mission kinds are missions, CH and
// ABSENT reach no engine input (D28), and a person with no activity start
// date is computed over the whole year (SPEC 7.4).
//
// A mismatch is a DEFECT in the dossier (R944), never a reason to move the
// expectation toward the payload.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET } from '@/app/api/v1/dossier/route';
import {
  calculateTelework,
  type Granularity,
  type TeleworkInput,
  type TeleworkResult,
} from '@/lib/calc-engine';
import {
  PERSON,
  SEED,
  YEAR,
  seedYear,
  weekdaysOfYear,
  type Kind,
  type Portion,
  type SeedRow,
} from '@/tests/support/seeded-year';

const ORIGIN = 'https://monreleve.ch';

/** The engine's vocabulary for the person's stored granularity. */
const ENGINE_GRANULARITY: Readonly<Record<'DAY' | 'HALF_DAY', Granularity>> = {
  DAY: 'day',
  HALF_DAY: 'halfDay',
};

/** SPEC 8: a FULL day is one day, AM and PM half a day each. */
const PORTION_DAYS: Readonly<Record<Portion, number>> = { FULL: 1, AM: 0.5, PM: 0.5 };

// ----------------------------------------------------------------------------
// The test's own reading of the seed. Nothing here is imported.
// ----------------------------------------------------------------------------

/** The month of a seeded day, read from the ISO string, never a Date getter. */
const monthOf = (day: string): number => Number(day.slice(5, 7));

/** Days of one kind among some rows, halves added as halves. */
function daysOf(rows: readonly SeedRow[], kind: Kind): number {
  return rows
    .filter((seeded) => seeded.kind === kind)
    .reduce((total, seeded) => total + PORTION_DAYS[seeded.portion], 0);
}

/** The engine input for some of the seeded rows, derived here. */
function engineInput(rows: readonly SeedRow[]): TeleworkInput {
  return {
    taxYear: YEAR,
    canton: PERSON.canton,
    employmentRate: PERSON.employmentRate,
    // No activityStartDate is seeded, so the period is the whole year.
    periodFraction: 1,
    denominator: { kind: 'simplified240' },
    granularity: ENGINE_GRANULARITY[PERSON.granularity],
    teleworkDays: daysOf(rows, 'HOME'),
    missionDaysFrance: daysOf(rows, 'MISSION_FR'),
    missionDaysThirdState: daysOf(rows, 'MISSION_THIRD'),
  };
}

/** The reference: one engine call, refusing loudly if this file built a bad input. */
function engine(rows: readonly SeedRow[]): TeleworkResult {
  const outcome = calculateTelework(engineInput(rows));

  if (!outcome.ok) {
    throw new Error(`the engine refused this test's own input: ${JSON.stringify(outcome.error)}`);
  }

  return outcome.value;
}

/** A value as it arrives over the wire, so the comparison is with what a client reads. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

const isMission = (kind: Kind): boolean => kind === 'MISSION_FR' || kind === 'MISSION_THIRD';

/** How an annex row is identified: one entry per (day, portion), SPEC 8's unique key. */
const keyOf = (day: string, portion: string | null): string => `${day} ${portion ?? '-'}`;

// ----------------------------------------------------------------------------
// The wire shape, as far as this file reads it.
// ----------------------------------------------------------------------------

interface WireAnnexRow {
  readonly dayDate: string;
  readonly recorded: boolean;
  readonly portion: string | null;
  readonly kind: string | null;
  readonly absenceReason: string | null;
  readonly note: string | null;
  readonly provenance: string | null;
  readonly detectedKind: string | null;
  readonly firstRecordedAt: string | null;
  readonly lastModifiedAt: string | null;
  readonly clientClaimedAt: string | null;
  readonly late: boolean;
}

interface WireMonth {
  readonly month: number;
  readonly swissDays: number;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
  readonly absenceDays: number;
  readonly cumulativeDeclarableRate: number;
}

interface WirePayload {
  readonly taxYear: number;
  readonly period: { readonly fraction: number; readonly startDate: string | null };
  readonly employmentRate: number;
  readonly tiles: {
    readonly workedDays: number;
    readonly swissDays: number;
    readonly teleworkDays: number;
    readonly missionDays: number;
  };
  readonly zone: {
    readonly declarableRate: number;
    readonly rawRate: number;
    readonly ratesDiffer: boolean;
    readonly fiscalCeilingDays: number;
    readonly remainingToFiscal: number;
    readonly remainingToSocial: number;
    readonly warnings: readonly unknown[];
  };
  readonly months: readonly WireMonth[];
  readonly annex: readonly WireAnnexRow[];
  readonly absenceDays: number;
  readonly recordedEntries: number;
  readonly creditedMissionDays: number;
  readonly rateWithoutMissions: number;
}

let status = 0;
let payload: WirePayload;
let storedRows = 0;

beforeAll(async () => {
  await prisma.user.deleteMany();

  const userId = await seedYear();

  storedRows = await prisma.entry.count({ where: { userId } });

  const { accessToken } = await issueTokenPair(userId);
  const response = await GET(
    new Request(`${ORIGIN}/api/v1/dossier?year=${YEAR}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );

  status = response.status;
  payload = (await response.json()) as WirePayload;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('FW-DOSSIER-ENGINE: a seeded year, through GET /api/v1/dossier', () => {
  it('PRESENCE FIRST: the route served the seeded year, and the seed can tell a wrong dossier from a right one', () => {
    // A 500 here is a seed error to fix, not a figure to compare (R169).
    expect(status, JSON.stringify(payload)).toBe(200);
    expect(payload.taxYear).toBe(YEAR);
    expect(storedRows, 'rows in the database against rows in the seed table').toBe(SEED.length);

    const annual = engine(SEED);

    // Each condition is one a wrong dossier could otherwise hide behind.
    expect(annual.declarableRate, 'a non-zero rate').toBeGreaterThan(0);
    expect(annual.creditedMissionDays, 'missions credited').toBeGreaterThan(0);
    expect(annual.creditedMissionDays, 'credited differs from logged').not.toBe(
      daysOf(SEED, 'MISSION_FR') + daysOf(SEED, 'MISSION_THIRD'),
    );
    expect(annual.warnings.length, 'the engine warns on this year').toBeGreaterThan(0);
    expect(annual.rawRate, 'the two rates differ').not.toBe(annual.declarableRate);
    expect(
      engine(SEED.filter((seeded) => !isMission(seeded.kind))).declarableRate,
      'the rate without missions differs from the rate',
    ).not.toBe(annual.declarableRate);

    // The boundary matters: March's cumulative and April's differ, and moving
    // 31 March into April would change March's.
    const toMarch = SEED.filter((seeded) => monthOf(seeded.day) <= 3);
    const toApril = SEED.filter((seeded) => monthOf(seeded.day) <= 4);
    const marchWithoutTheLastDay = toMarch.filter((seeded) => seeded.day !== '2026-03-31');

    expect(engine(toMarch).declarableRate).not.toBe(engine(toApril).declarableRate);
    expect(engine(toMarch).declarableRate).not.toBe(engine(marchWithoutTheLastDay).declarableRate);

    // The annex has something to collapse and something to stamp wrongly.
    expect(new Set(SEED.map((seeded) => seeded.provenance)).size, 'all three provenances').toBe(3);
    expect(new Set(SEED.map((seeded) => seeded.firstRecordedAt)).size, 'distinct stamps').toBe(
      SEED.length,
    );

    const splitDays = SEED.filter((seeded) => seeded.portion === 'AM').map((seeded) => seeded.day);

    for (const day of splitDays) {
      const kinds = SEED.filter((seeded) => seeded.day === day).map((seeded) => seeded.kind);

      expect(new Set(kinds).size, `${day} is split between two kinds`).toBe(2);
    }

    expect(splitDays.length).toBeGreaterThan(0);
  });

  it('R941 (a): every figure the engine produces equals a direct engine call on the seeded rows, exactly', () => {
    const annual = engine(SEED);
    const withoutMissions = engine(SEED.filter((seeded) => !isMission(seeded.kind)));

    // THE MONTHS ARE TWELVE, IN ORDER, before a column is read by index.
    expect(payload.months.map((month) => month.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const figures: Array<[string, unknown, unknown]> = [
      ['tiles.workedDays', payload.tiles.workedDays, annual.totalWorkDays],
      ['zone.declarableRate', payload.zone.declarableRate, annual.declarableRate],
      ['zone.rawRate', payload.zone.rawRate, annual.rawRate],
      ['zone.ratesDiffer', payload.zone.ratesDiffer, annual.declarableRate !== annual.rawRate],
      ['zone.fiscalCeilingDays', payload.zone.fiscalCeilingDays, annual.fiscalCeilingDays],
      ['zone.remainingToFiscal', payload.zone.remainingToFiscal, annual.remainingToFiscal],
      ['zone.remainingToSocial', payload.zone.remainingToSocial, annual.remainingToSocial],
      ['zone.warnings', payload.zone.warnings, annual.warnings],
      ['creditedMissionDays', payload.creditedMissionDays, annual.creditedMissionDays],
      ['rateWithoutMissions', payload.rateWithoutMissions, withoutMissions.declarableRate],
      ...payload.months.map((served, index): [string, unknown, unknown] => {
        const month = index + 1;
        const toDate = SEED.filter((seeded) => monthOf(seeded.day) <= month);

        return [
          `months[${index}].cumulativeDeclarableRate (January to month ${month})`,
          served.cumulativeDeclarableRate,
          engine(toDate).declarableRate,
        ];
      }),
    ];

    // WHAT WAS COMPARED, printed before any assertion so a red run still says
    // what it measured (R184's shape): the figure, the served value, the
    // engine's value.
    console.log(
      `[dossier-engine] ${figures.length} figures, served | engine:\n` +
        figures
          .map(([figure, served, computed]) => `  ${figure}: ${JSON.stringify(served)} | ${JSON.stringify(wire(computed))}`)
          .join('\n'),
    );

    // EXACTLY: the engine's own rounding, compared in the form a client reads.
    // Soft, so a RED lists every figure that moved, each with both numbers.
    for (const [figure, served, computed] of figures) {
      expect.soft(served, figure).toStrictEqual(wire(computed));
    }

    expect(figures).toHaveLength(10 + 12);
  });

  it('R941: the counts the payload states equal this file\'s own count of the seeded rows', () => {
    // NOT engine figures - row counts, compared with rows, never with the
    // engine's taxed-day or credited figures, which mean something else.
    const counts: Array<[string, unknown, unknown]> = [
      ['tiles.swissDays', payload.tiles.swissDays, daysOf(SEED, 'CH')],
      ['tiles.teleworkDays', payload.tiles.teleworkDays, daysOf(SEED, 'HOME')],
      [
        'tiles.missionDays',
        payload.tiles.missionDays,
        daysOf(SEED, 'MISSION_FR') + daysOf(SEED, 'MISSION_THIRD'),
      ],
      ['absenceDays', payload.absenceDays, daysOf(SEED, 'ABSENT')],
      ['recordedEntries', payload.recordedEntries, SEED.length],
      ['employmentRate', payload.employmentRate, PERSON.employmentRate],
      ['period.fraction', payload.period.fraction, 1],
      ['period.startDate', payload.period.startDate, null],
      ...payload.months.flatMap((served, index): Array<[string, unknown, unknown]> => {
        const inMonth = SEED.filter((seeded) => monthOf(seeded.day) === index + 1);

        return [
          [`months[${index}].swissDays`, served.swissDays, daysOf(inMonth, 'CH')],
          [`months[${index}].teleworkDays`, served.teleworkDays, daysOf(inMonth, 'HOME')],
          [`months[${index}].missionDaysFrance`, served.missionDaysFrance, daysOf(inMonth, 'MISSION_FR')],
          [
            `months[${index}].missionDaysThirdState`,
            served.missionDaysThirdState,
            daysOf(inMonth, 'MISSION_THIRD'),
          ],
          [`months[${index}].absenceDays`, served.absenceDays, daysOf(inMonth, 'ABSENT')],
        ];
      }),
    ];

    for (const [figure, served, counted] of counts) {
      expect.soft(served, figure).toStrictEqual(counted);
    }

    expect(counts).toHaveLength(8 + 12 * 5);
  });

  it('R942 (b): the annex holds exactly the seeded rows, none collapsed, and every unlogged weekday', () => {
    const recorded = payload.annex.filter((served) => served.recorded);
    const unrecorded = payload.annex.filter((served) => !served.recorded);

    // Identified by (day, portion) and described by kind and reason, so a row
    // that is collapsed, dropped, duplicated or re-kinded shows up by name.
    const line = (day: string, portion: string | null, kind: string | null, reason: string | null) =>
      `${keyOf(day, portion)} ${kind ?? '-'}${reason === null ? '' : ` ${reason}`}`;

    const served = recorded.map((r) => line(r.dayDate, r.portion, r.kind, r.absenceReason));
    const seeded = SEED.map((s) => line(s.day, s.portion, s.kind, s.absenceReason));

    const missing = seeded.filter((entry) => !served.includes(entry));
    const unexpected = served.filter((entry) => !seeded.includes(entry));

    expect(missing, `seeded rows the annex does not carry: ${missing.join('; ')}`).toEqual([]);
    expect(unexpected, `annex rows nobody seeded: ${unexpected.join('; ')}`).toEqual([]);

    // The count as well as the set: a duplicated row passes a set comparison.
    expect(recorded.length, 'recorded annex rows against seeded rows').toBe(SEED.length);

    // AND NOTHING ELSE: every other row is a weekday nobody logged (SPEC 12
    // item 5), stamped by nothing, because nothing was recorded.
    const seededDays = new Set(SEED.map((s) => s.day));
    const gaps = weekdaysOfYear().filter((day) => !seededDays.has(day));

    expect(unrecorded.map((r) => r.dayDate)).toEqual(gaps);
    expect(unrecorded.filter((r) => r.firstRecordedAt !== null || r.provenance !== null)).toEqual([]);
    expect(payload.annex).toHaveLength(SEED.length + gaps.length);
  });

  it('R942 (c): every recorded row carries its server timestamp and its source, as seeded', () => {
    const byKey = new Map(
      payload.annex.filter((r) => r.recorded).map((r) => [keyOf(r.dayDate, r.portion), r]),
    );

    // PRESENCE FIRST: every seeded row has a served row to read.
    const unread = SEED.filter((s) => !byKey.has(keyOf(s.day, s.portion))).map((s) => keyOf(s.day, s.portion));

    expect(unread, `seeded rows with no annex row to read: ${unread.join('; ')}`).toEqual([]);

    for (const seeded of SEED) {
      const key = keyOf(seeded.day, seeded.portion);
      const served = byKey.get(key);

      // THE TWO R942 NAMES, each required on every row, each against the seed.
      expect.soft(served?.firstRecordedAt, `annex ${key}: firstRecordedAt (the server stamp)`).toBe(
        seeded.firstRecordedAt,
      );
      expect.soft(served?.provenance, `annex ${key}: provenance (the source)`).toBe(seeded.provenance);

      // The rest of SPEC 12 item 5's provenance block, on the same row.
      expect.soft(served?.detectedKind, `annex ${key}: detectedKind`).toBe(seeded.detectedKind);
      expect.soft(served?.clientClaimedAt, `annex ${key}: clientClaimedAt`).toBe(seeded.clientClaimedAt);
      expect.soft(served?.lastModifiedAt, `annex ${key}: lastModifiedAt`).toBe(seeded.lastModifiedAt);
      expect.soft(served?.late, `annex ${key}: late`).toBe(seeded.late);
      expect.soft(served?.note, `annex ${key}: note`).toBe(seeded.note);
    }

    // Both states of every optional field occur in the seed, so a column that
    // was always null, or never null, cannot pass.
    expect(SEED.some((s) => s.late) && SEED.some((s) => !s.late)).toBe(true);
    expect(SEED.some((s) => s.clientClaimedAt !== null)).toBe(true);
    expect(SEED.some((s) => s.lastModifiedAt !== null)).toBe(true);
    expect(SEED.some((s) => s.detectedKind !== null) && SEED.some((s) => s.detectedKind === null)).toBe(true);
  });
});
