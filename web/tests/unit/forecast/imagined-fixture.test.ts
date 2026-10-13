// web/tests/unit/forecast/imagined-fixture.test.ts
//
// FW-FORECAST: THE ONE FORECAST CONTRACT, READ FROM THE FILE BOTH SIDES READ.
//
// fixtures/forecast-cases.json is AN-FORECAST's, and its header names this
// side as a consumer: "the Kotlin side reads this file through
// ch.monreleve.app.dossier.imaginedEntriesToYearEnd + toTeleworkInput +
// calculateTelework; the web side (FW-FORECAST) reads the SAME file through
// its own date function and engine."
//
// CONSUMED, NEVER FORKED (R281, and the prompt says it twice). The file is not
// copied, not re-expressed as a TypeScript constant, and not trimmed to the
// cases this side finds convenient. A one-digit change in it fails this suite
// AND the Android one, which is the whole point of there being one file.
//
// THE PATH IS THE SAME PATH, step for step, which is what makes the two sides
// comparable at all:
//
//     imagined days  ->  concatenated with the recorded rows
//                    ->  toTeleworkInput (lib/dossier/aggregate.ts, R281)
//                    ->  calculateTelework
//
// Only the first step is new here. If this suite went green against a
// hand-rolled rate instead of the engine's, it would be asserting that two
// pieces of arithmetic agree rather than that the product computes the
// contract - FW12's defect, and R340's rule that no component does maths.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import { toTeleworkInput, type AggregatableEntry } from '@/lib/dossier/aggregate';
import { imaginedEntriesToYearEnd, type Rhythm } from '@/lib/forecast/imagined';

/**
 * The fixture as it is on disk. Dates are ISO strings there because the file
 * is language-neutral; this side turns them into Dates, exactly as
 * tests/unit/dossier/aggregation-fixture.test.ts already does for its own
 * fixture (R206 - one idiom, not two).
 */
interface FixtureEntry {
  readonly dayDate: string;
  readonly portion: 'FULL' | 'AM' | 'PM';
  readonly kind: 'CH' | 'HOME' | 'MISSION_FR' | 'MISSION_THIRD' | 'ABSENT';
}

interface FixtureCase {
  readonly id: string;
  readonly note: string;
  readonly today: string;
  readonly rhythm: Rhythm;
  readonly recorded: readonly FixtureEntry[];
  readonly expected: {
    readonly imaginedWorkingDays: number;
    readonly imaginedTeleworkDays: number;
    readonly currentRate: number;
    readonly declarableRate: number;
  };
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
  readonly cases: readonly FixtureCase[];
}

const FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'fixtures', 'forecast-cases.json'), 'utf8'),
) as Fixture;

const entriesOf = (rows: readonly FixtureEntry[]): readonly AggregatableEntry[] =>
  rows.map((row) => ({
    dayDate: new Date(row.dayDate),
    portion: row.portion,
    kind: row.kind,
  }));

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

/** The engine's declarable rate for a set of entries, as the fixture means it. */
const rateOf = (entries: readonly AggregatableEntry[]): number => {
  const outcome = calculateTelework(toTeleworkInput(user, entries, FIXTURE.taxYear));

  if (!outcome.ok) {
    throw new Error(
      `the engine refused a fixture scenario: ${outcome.error.map((e) => e.code).join(', ')}`,
    );
  }

  return outcome.value.declarableRate;
};

describe('the shared forecast fixture, read by both engines', () => {
  it('has the cases it is supposed to have, so nothing below passes vacuously', () => {
    // R133. Every assertion in this file is inside a loop over `cases`; an
    // empty array satisfies all of them perfectly, and a file that failed to
    // parse would be the quietest possible way to lose this contract.
    expect(FIXTURE.cases.length).toBeGreaterThanOrEqual(5);
    expect(FIXTURE.taxYear).toBe(2026);
  });

  for (const testCase of FIXTURE.cases) {
    describe(testCase.id, () => {
      const imagined = () =>
        imaginedEntriesToYearEnd(testCase.rhythm, new Date(testCase.today), FIXTURE.taxYear);

      it('imagines the working days the contract says, and no others', () => {
        expect(imagined().length).toBe(testCase.expected.imaginedWorkingDays);
      });

      it('imagines the telework days among them', () => {
        const home = imagined().filter((entry) => entry.kind === 'HOME');

        expect(home.length).toBe(testCase.expected.imaginedTeleworkDays);
      });

      it('never imagines today itself, nor any day before it', () => {
        // The contract's own words: "the imagined set is every working day
        // STRICTLY AFTER today to 31 December; today itself is never imagined
        // (it is recorded or it is not)."
        const today = new Date(testCase.today);

        for (const entry of imagined()) {
          expect(entry.dayDate.getTime(), entry.dayDate.toISOString()).toBeGreaterThan(
            today.getTime(),
          );
        }
      });

      it('never imagines a day outside the tax year', () => {
        for (const entry of imagined()) {
          expect(entry.dayDate.getUTCFullYear(), entry.dayDate.toISOString()).toBe(FIXTURE.taxYear);
        }
      });

      it("reproduces today's rate from the recorded days alone", () => {
        expect(rateOf(entriesOf(testCase.recorded))).toBe(testCase.expected.currentRate);
      });

      it('reproduces the projected rate from the recorded days plus the imagined ones', () => {
        const all = [...entriesOf(testCase.recorded), ...imagined()];

        expect(rateOf(all)).toBe(testCase.expected.declarableRate);
      });
    });
  }
});
