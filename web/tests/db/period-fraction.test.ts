// web/tests/db/period-fraction.test.ts
//
// FW-PERIOD-FRACTION (R998, R999), web run step W3e: the part-year fraction,
// through GET /api/v1/dossier.
//
// ============================================================================
// THIS FILE PINS THE PRODUCT'S STATED CONVENTION. IT VERIFIES NO REGULATORY RULE.
// ============================================================================
//
// No source states how a part year is measured. The accord amiable of
// 29 April 2026, clause 1(d), adjusts the mission limit proportionally and
// names no basis, and neither does row 3 of docs/regulatory-sources.md. So
// SPEC 7.2 step 2 states the convention the product applies, as the product's
// own and pending expert review (docs/regulatory-sources.md, constants row 9):
//
//   periodFraction is the number of calendar days from the activity start
//   date to 31 December, both included, divided by the number of days in that
//   calendar year.
//
// This file holds the served dossier to THAT sentence and to nothing more. A
// green run says the product does what SPEC says; it says nothing about
// whether SPEC says what the authority means. If the reviewer names another
// rule, SPEC changes first and this file follows it.
//
// ============================================================================
// THE EXPECTATION NEVER PASSES THROUGH THE CODE UNDER TEST
// ============================================================================
//
// The expected fraction is COUNTED here, day by day, from the SPEC sentence.
// remainingYearFraction (lib/ui/core/period.ts) is the code under test and is
// not imported. Every engine figure the payload serves is compared with
// calculateTelework called on that fraction and on inputs this file derives
// from the seeded rows. Nothing is imported from lib/dossier: the discipline of
// dossier-engine.test.ts, whose derivation is repeated here for another person
// rather than shared, because each test's reading of the rows is its assertion
// (tests/support/seeded-year.ts says the same).
//
// ============================================================================
// THE START DATE IS COMPUTED, NOT CHOSEN
// ============================================================================
//
// One day of fraction is worth basis/365 of a work day - 192/365 = 0.53 at
// 80 % - and the engine rounds the prorated basis UP, so at many start dates a
// count one day off still rounds to the same whole day and moves nothing the
// engine serves. A pin at such a date pins nothing. So the start date is the
// FIRST day of the year at which ALL THREE hold:
//
//   (1) a count one day too SHORT (the start day or 31 December left out)
//       moves at least one served engine figure;
//   (2) a count one day too LONG moves at least one served engine figure;
//   (3) the figures differ from a whole year's, so a dossier that ignored the
//       start date altogether moves one too.
//
// Both directions, because an off-by-one is either. (3) because the first day
// at which (1) alone holds serves the WHOLE YEAR's figures - which a route
// ignoring the date would serve as well. A day at which the engine refuses any
// of the fractions (one day too long on 1 January is above 1) is not a
// candidate. The search asks the engine; it never re-types the rounding.
//
// WHAT IS NOT PINNED HERE, stated rather than left to be assumed:
//   - a leap year's denominator: the seeded year is 2026, 365 days. The 366
//     is pinned at unit level only (tests/unit/ui-core/period.test.ts);
//   - the mission cap's proration: at the chosen date the person's missions
//     stay within the prorated cap, so it does not bind. The PRESENCE test
//     asserts that, so the day it stops being true is a red here and not a
//     stale sentence;
//   - starts outside the year: an earlier year gives the whole year, a later
//     one is refused as year_before_activity (dossier-route.test.ts, R580).
//
// THE PERSON is tests/support/seeded-year.ts's PART_YEAR_PERSON: PERSON's
// settings, another address, and SEED's own rows from the start date on.

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
  PART_YEAR_PERSON,
  YEAR,
  rowsFrom,
  seedPartYear,
  type Kind,
  type Portion,
  type SeedRow,
} from '@/tests/support/seeded-year';

const ORIGIN = 'https://monreleve.ch';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The months the dossier breaks the year into, January to December. */
const MONTHS = 12;

/** The engine's vocabulary for the person's stored granularity. */
const ENGINE_GRANULARITY: Readonly<Record<'DAY' | 'HALF_DAY', Granularity>> = {
  DAY: 'day',
  HALF_DAY: 'halfDay',
};

/** SPEC 8: a FULL day is one day, AM and PM half a day each. */
const PORTION_DAYS: Readonly<Record<Portion, number>> = { FULL: 1, AM: 0.5, PM: 0.5 };

// ----------------------------------------------------------------------------
// THE SPEC SENTENCE, COUNTED. Nothing here is imported.
// ----------------------------------------------------------------------------

/** Every calendar day of the seeded year, as ISO days, 1 January to 31 December. */
function calendarDays(): readonly string[] {
  const days: string[] = [];

  for (let t = Date.UTC(YEAR, 0, 1); new Date(t).getUTCFullYear() === YEAR; t += MS_PER_DAY) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }

  return days;
}

const DAYS = calendarDays();

/**
 * SPEC 7.2 step 2: the calendar days from the start date to 31 December, both
 * included. Counted, not subtracted: every day of the year on or after the
 * start, the start day and 31 December among them.
 */
const daysFrom = (startDay: string): number => DAYS.filter((day) => day >= startDay).length;

// ----------------------------------------------------------------------------
// The test's own reading of the rows. Nothing here is imported.
// ----------------------------------------------------------------------------

/** The month of a seeded day, read from the ISO string, never a Date getter. */
const monthOf = (day: string): number => Number(day.slice(5, 7));

const isMission = (kind: Kind): boolean => kind === 'MISSION_FR' || kind === 'MISSION_THIRD';

/** Days of one kind among some rows, halves added as halves. */
function daysOf(rows: readonly SeedRow[], kind: Kind): number {
  return rows
    .filter((seeded) => seeded.kind === kind)
    .reduce((total, seeded) => total + PORTION_DAYS[seeded.portion], 0);
}

/** The engine input for some rows at a given fraction, derived here. */
function engineInput(rows: readonly SeedRow[], periodFraction: number): TeleworkInput {
  return {
    taxYear: YEAR,
    canton: PART_YEAR_PERSON.canton,
    employmentRate: PART_YEAR_PERSON.employmentRate,
    periodFraction,
    denominator: { kind: 'simplified240' },
    granularity: ENGINE_GRANULARITY[PART_YEAR_PERSON.granularity],
    teleworkDays: daysOf(rows, 'HOME'),
    missionDaysFrance: daysOf(rows, 'MISSION_FR'),
    missionDaysThirdState: daysOf(rows, 'MISSION_THIRD'),
  };
}

/** One engine call, or null when the engine refuses the input. */
function engineOrNull(rows: readonly SeedRow[], periodFraction: number): TeleworkResult | null {
  const outcome = calculateTelework(engineInput(rows, periodFraction));

  return outcome.ok ? outcome.value : null;
}

/** A value as it arrives over the wire, so the comparison is with what a client reads. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

/** Figure name -> value, in wire form, in the order the payload is read. */
type Figures = ReadonlyMap<string, unknown>;

/**
 * Every ENGINE figure the dossier serves - the 22 dossier-engine.test.ts
 * compares - as the engine computes them for these rows at this fraction. Null
 * when the engine refuses any of the calls.
 */
function engineFigures(rows: readonly SeedRow[], periodFraction: number): Figures | null {
  const annual = engineOrNull(rows, periodFraction);
  const withoutMissions = engineOrNull(
    rows.filter((seeded) => !isMission(seeded.kind)),
    periodFraction,
  );

  if (annual === null || withoutMissions === null) return null;

  const figures: Array<[string, unknown]> = [
    ['tiles.workedDays', annual.totalWorkDays],
    ['zone.declarableRate', annual.declarableRate],
    ['zone.rawRate', annual.rawRate],
    ['zone.ratesDiffer', annual.declarableRate !== annual.rawRate],
    ['zone.fiscalCeilingDays', annual.fiscalCeilingDays],
    ['zone.remainingToFiscal', annual.remainingToFiscal],
    ['zone.remainingToSocial', annual.remainingToSocial],
    ['zone.warnings', annual.warnings],
    ['creditedMissionDays', annual.creditedMissionDays],
    ['rateWithoutMissions', withoutMissions.declarableRate],
  ];

  for (let month = 1; month <= MONTHS; month += 1) {
    const toDate = engineOrNull(
      rows.filter((seeded) => monthOf(seeded.day) <= month),
      periodFraction,
    );

    if (toDate === null) return null;

    figures.push([`months[${month - 1}].cumulativeDeclarableRate`, toDate.declarableRate]);
  }

  return new Map(figures.map(([name, value]) => [name, wire(value)]));
}

/** The names of the figures whose values differ between two readings. */
function movedBetween(from: Figures, to: Figures): string[] {
  return [...from.keys()].filter(
    (name) => JSON.stringify(from.get(name)) !== JSON.stringify(to.get(name)),
  );
}

/** "name a -> b" for each moved figure, for the printed record. */
function describeMoves(names: readonly string[], from: Figures, to: Figures): string {
  return names
    .map((name) => `${name} ${JSON.stringify(from.get(name))} -> ${JSON.stringify(to.get(name))}`)
    .join('; ');
}

// ----------------------------------------------------------------------------
// The search for the start date.
// ----------------------------------------------------------------------------

interface Choice {
  readonly startDay: string;
  /** The SPEC sentence's numerator, counted. */
  readonly count: number;
  readonly rows: readonly SeedRow[];
  /** The engine's figures at count / days-in-year: the expectation. */
  readonly figures: Figures;
  readonly short: Figures;
  readonly long: Figures;
  readonly wholeYear: Figures;
  readonly shortMoves: readonly string[];
  readonly longMoves: readonly string[];
  readonly wholeYearMoves: readonly string[];
  /** The first earlier day at which an off-by-one moved anything at all, for the record. */
  readonly firstOneSided: string | null;
}

/** The first day of the year satisfying (1), (2) and (3) of the header. */
function chooseStartDay(): Choice {
  let firstOneSided: string | null = null;

  for (const startDay of DAYS) {
    const count = daysFrom(startDay);
    const rows = rowsFrom(startDay);
    const figures = engineFigures(rows, count / DAYS.length);
    const short = engineFigures(rows, (count - 1) / DAYS.length);
    const long = engineFigures(rows, (count + 1) / DAYS.length);
    const wholeYear = engineFigures(rows, 1);

    if (figures === null || short === null || long === null || wholeYear === null) continue;

    const shortMoves = movedBetween(figures, short);
    const longMoves = movedBetween(figures, long);
    const wholeYearMoves = movedBetween(figures, wholeYear);

    if (shortMoves.length > 0 && longMoves.length > 0 && wholeYearMoves.length > 0) {
      return {
        startDay,
        count,
        rows,
        figures,
        short,
        long,
        wholeYear,
        shortMoves,
        longMoves,
        wholeYearMoves,
        firstOneSided,
      };
    }

    if (firstOneSided === null && (shortMoves.length > 0 || longMoves.length > 0)) {
      firstOneSided =
        `${startDay} (${count}/${DAYS.length}: short moves ${shortMoves.length}, ` +
        `long moves ${longMoves.length}, whole year moves ${wholeYearMoves.length})`;
    }
  }

  throw new Error(`no day of ${YEAR} lets both off-by-ones and a whole year move a served figure`);
}

// ----------------------------------------------------------------------------
// The wire shape, as far as this file reads it.
// ----------------------------------------------------------------------------

interface WirePayload {
  readonly taxYear: number;
  readonly period: { readonly fraction: number; readonly startDate: string | null };
  readonly tiles: { readonly workedDays: number };
  readonly zone: {
    readonly declarableRate: number;
    readonly rawRate: number;
    readonly ratesDiffer: boolean;
    readonly fiscalCeilingDays: number;
    readonly remainingToFiscal: number;
    readonly remainingToSocial: number;
    readonly warnings: readonly unknown[];
  };
  readonly months: ReadonlyArray<{ readonly month: number; readonly cumulativeDeclarableRate: number }>;
  readonly recordedEntries: number;
  readonly creditedMissionDays: number;
  readonly rateWithoutMissions: number;
}

/** The same figures, as the payload serves them, under the same names. */
function servedFigures(served: WirePayload): Figures {
  return new Map<string, unknown>([
    ['tiles.workedDays', served.tiles.workedDays],
    ['zone.declarableRate', served.zone.declarableRate],
    ['zone.rawRate', served.zone.rawRate],
    ['zone.ratesDiffer', served.zone.ratesDiffer],
    ['zone.fiscalCeilingDays', served.zone.fiscalCeilingDays],
    ['zone.remainingToFiscal', served.zone.remainingToFiscal],
    ['zone.remainingToSocial', served.zone.remainingToSocial],
    ['zone.warnings', served.zone.warnings],
    ['creditedMissionDays', served.creditedMissionDays],
    ['rateWithoutMissions', served.rateWithoutMissions],
    ...served.months.map((month, index): [string, unknown] => [
      `months[${index}].cumulativeDeclarableRate`,
      month.cumulativeDeclarableRate,
    ]),
  ]);
}

let choice: Choice;
let status = 0;
let payload: WirePayload;
let storedRows = 0;

beforeAll(async () => {
  choice = chooseStartDay();

  await prisma.user.deleteMany();

  const userId = await seedPartYear(choice.startDay);

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

describe('FW-PERIOD-FRACTION: a part year, through GET /api/v1/dossier', () => {
  it('PRESENCE FIRST: the route served the part year, and its start date can tell an off-by-one from the convention', () => {
    // WHAT THE DATE WAS CHOSEN FOR, printed before any assertion so a red run
    // still says what it measured (R184's shape).
    console.log(
      `[period-fraction] start ${choice.startDay}: ${choice.count}/${DAYS.length} days, ` +
        `${choice.rows.length} rows from that day\n` +
        `  one day short (${choice.count - 1}/${DAYS.length}) moves: ` +
        `${describeMoves(choice.shortMoves, choice.figures, choice.short)}\n` +
        `  one day long (${choice.count + 1}/${DAYS.length}) moves: ` +
        `${describeMoves(choice.longMoves, choice.figures, choice.long)}\n` +
        `  a whole year (1) moves: ` +
        `${describeMoves(choice.wholeYearMoves, choice.figures, choice.wholeYear)}\n` +
        `  first earlier day where an off-by-one moved anything: ${choice.firstOneSided ?? 'none'}`,
    );

    // A 500 here is a seed error to fix, not a figure to compare (R169).
    expect(status, JSON.stringify(payload)).toBe(200);
    expect(payload.taxYear).toBe(YEAR);
    expect(choice.rows.length, 'the person has rows to compute a rate over').toBeGreaterThan(0);
    expect(storedRows, 'rows in the database against rows from the seed').toBe(choice.rows.length);
    expect(payload.recordedEntries, 'rows the payload counts').toBe(choice.rows.length);

    // A PART year by the sentence's own count, not the whole of it.
    expect(choice.count).toBeGreaterThan(0);
    expect(choice.count).toBeLessThan(DAYS.length);

    // The three discriminations, re-asserted so a change to the search cannot
    // quietly weaken them.
    expect(choice.shortMoves.length, 'a count one day short moves a served figure').toBeGreaterThan(0);
    expect(choice.longMoves.length, 'a count one day long moves a served figure').toBeGreaterThan(0);
    expect(choice.wholeYearMoves.length, 'ignoring the start date moves a served figure').toBeGreaterThan(0);

    // The rates pinned below are real ones over the prorated basis, not zeros.
    expect(choice.figures.get('zone.declarableRate'), 'a non-zero rate').not.toBe(0);

    // NOT PINNED, AND SAID SO (header): the prorated mission cap does not
    // bind at this date - every logged mission is credited.
    expect(
      choice.figures.get('creditedMissionDays'),
      'the cap does not bind here; if it does, the header is stale',
    ).toBe(daysOf(choice.rows, 'MISSION_FR') + daysOf(choice.rows, 'MISSION_THIRD'));
  });

  it('R998: the served fraction is the SPEC sentence counted, and every served engine figure equals the engine at that fraction, exactly', () => {
    const served = servedFigures(payload);

    // THE MONTHS ARE TWELVE, IN ORDER, before a column is read by index.
    expect(payload.months.map((month) => month.month)).toEqual(
      Array.from({ length: MONTHS }, (_, index) => index + 1),
    );
    expect([...served.keys()], 'the same figures, by name, on both sides').toEqual([
      ...choice.figures.keys(),
    ]);

    // WHAT WAS COMPARED, printed before any assertion (R184's shape).
    console.log(
      `[period-fraction] period.fraction served ${JSON.stringify(payload.period.fraction)} | ` +
        `counted ${choice.count}/${DAYS.length} = ${JSON.stringify(choice.count / DAYS.length)}\n` +
        `[period-fraction] ${choice.figures.size} figures, served | engine:\n` +
        [...choice.figures]
          .map(([name, value]) => `  ${name}: ${JSON.stringify(served.get(name))} | ${JSON.stringify(value)}`)
          .join('\n'),
    );

    // Soft, so a RED lists every figure that moved, each with both numbers.
    expect.soft(payload.period.startDate, 'period.startDate').toBe(choice.startDay);
    expect
      .soft(payload.period.fraction, 'period.fraction: the SPEC 7.2 sentence, counted')
      .toBe(choice.count / DAYS.length);

    for (const [name, value] of choice.figures) {
      expect.soft(served.get(name), name).toStrictEqual(value);
    }

    expect(choice.figures.size).toBe(10 + MONTHS);
  });
});
