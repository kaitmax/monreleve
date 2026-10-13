// web/tests/unit/forecast/project.test.ts
//
// THE TWO ROUTES TO ONE NUMBER, ASSERTED TO AGREE.
//
// The shared fixture walks entry ROWS - recorded plus imagined, through
// toTeleworkInput, into the engine - because a dossier has rows. The
// CALCULATOR has none: a reader typed a day count into a form, and the web
// side never knew which days those were. So the page adds the imagined
// telework days to the count it was given.
//
// Two routes to one figure is precisely the shape that becomes two engines the
// moment nobody checks it (FW12's defect, R340's rule). This file is the
// check: every case in fixtures/forecast-cases.json is driven through BOTH,
// and the day they disagree is a failing test rather than a wrong percentage
// on a page nobody is looking at.
//
// IT IS NOT A RESTATEMENT OF imagined-fixture.test.ts. That file asserts the
// ROW path reproduces the fixture's published numbers. This one asserts the
// COUNT path reproduces the row path - a different claim, and the only one
// that covers the code the result page actually runs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toTeleworkInput, type AggregatableEntry } from '@/lib/dossier/aggregate';
import { imaginedEntriesToYearEnd, type Rhythm } from '@/lib/forecast/imagined';
import { project, projectedInput } from '@/lib/forecast/project';

interface FixtureEntry {
  readonly dayDate: string;
  readonly portion: 'FULL' | 'AM' | 'PM';
  readonly kind: 'CH' | 'HOME' | 'MISSION_FR' | 'MISSION_THIRD' | 'ABSENT';
}

interface Fixture {
  readonly commonUser: {
    readonly canton: string;
    readonly employmentRate: number;
    readonly denominatorKind: 'SIMPLIFIED240' | 'EXACT';
    readonly exactTotalWorkDays: number | null;
    readonly granularity: 'DAY' | 'HALF_DAY';
    readonly activityStartDate: string | null;
  };
  readonly taxYear: number;
  readonly cases: ReadonlyArray<{
    readonly id: string;
    readonly today: string;
    readonly rhythm: Rhythm;
    readonly recorded: readonly FixtureEntry[];
    readonly expected: {
      readonly imaginedWorkingDays: number;
      readonly imaginedTeleworkDays: number;
      readonly currentRate: number;
      readonly declarableRate: number;
    };
  }>;
}

const FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'fixtures', 'forecast-cases.json'), 'utf8'),
) as Fixture;

const user = {
  canton: FIXTURE.commonUser.canton,
  employmentRate: FIXTURE.commonUser.employmentRate,
  denominatorKind: FIXTURE.commonUser.denominatorKind,
  exactTotalWorkDays: FIXTURE.commonUser.exactTotalWorkDays,
  granularity: FIXTURE.commonUser.granularity,
  activityStartDate:
    FIXTURE.commonUser.activityStartDate === null
      ? null
      : new Date(FIXTURE.commonUser.activityStartDate),
};

const entriesOf = (rows: readonly FixtureEntry[]): readonly AggregatableEntry[] =>
  rows.map((row) => ({
    dayDate: new Date(row.dayDate),
    portion: row.portion,
    kind: row.kind,
  }));

describe('the count path agrees with the row path, case for case', () => {
  it('has cases to compare, so nothing below passes vacuously', () => {
    expect(FIXTURE.cases.length).toBeGreaterThanOrEqual(5);
  });

  for (const testCase of FIXTURE.cases) {
    it(testCase.id, () => {
      const today = new Date(testCase.today);

      // THE ROW PATH: what a dossier would do.
      const recorded = entriesOf(testCase.recorded);
      const rowInput = toTeleworkInput(user, recorded, FIXTURE.taxYear);
      const rowAhead = toTeleworkInput(
        user,
        [...recorded, ...imaginedEntriesToYearEnd(testCase.rhythm, today, FIXTURE.taxYear)],
        FIXTURE.taxYear,
      );

      // THE COUNT PATH: what the calculator does, starting from the SAME
      // TeleworkInput the row path produced for the recorded days alone.
      const counted = projectedInput(rowInput, testCase.rhythm, today);

      // The inputs must match field for field, not merely produce equal
      // rates: two different inputs can round to the same percentage, and
      // then the first scenario that does not is a defect in production.
      expect(counted.input).toEqual(rowAhead);
      expect(counted.working).toBe(testCase.expected.imaginedWorkingDays);
      expect(counted.telework).toBe(testCase.expected.imaginedTeleworkDays);
    });
  }
});

describe('project() is what the page renders, and it answers the fixture', () => {
  for (const testCase of FIXTURE.cases) {
    it(testCase.id, () => {
      const today = new Date(testCase.today);
      const input = toTeleworkInput(user, entriesOf(testCase.recorded), FIXTURE.taxYear);
      const projection = project(input, testCase.rhythm, today);

      expect(projection, 'every fixture case carries a rhythm').not.toBeNull();
      expect(projection?.current.declarableRate).toBe(testCase.expected.currentRate);
      expect(projection?.projected.declarableRate).toBe(testCase.expected.declarableRate);
      expect(projection?.imaginedWorkingDays).toBe(testCase.expected.imaginedWorkingDays);
      expect(projection?.imaginedTeleworkDays).toBe(testCase.expected.imaginedTeleworkDays);
    });
  }
});

describe('no rhythm is no projection, never a projection of zero', () => {
  it('returns null for an empty rhythm', () => {
    // The prompt: "with none checked, the calculator shows today's position
    // only, as now." A projection equal to the current figure would be a
    // claim about the rest of the year that nobody made.
    const input = toTeleworkInput(user, [], FIXTURE.taxYear);

    expect(project(input, {}, new Date('2026-10-09'))).toBeNull();
  });

  it('returns a projection for a rhythm with a single day', () => {
    // R133: the assertion above passes for a function that always returns
    // null, which would delete the feature and keep this file green.
    const input = toTeleworkInput(user, [], FIXTURE.taxYear);

    expect(project(input, { TUESDAY: 'HOME' }, new Date('2026-10-09'))).not.toBeNull();
  });
});
