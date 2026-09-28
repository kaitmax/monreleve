// web/tests/unit/dossier/aggregation-fixture.test.ts
//
// AN5b increment 2 (R281, AC2). The TypeScript side of the ONE aggregation, bound to the Kotlin
// side by fixtures/aggregation-cases.json. This test READS that file and runs each case through
// lib/dossier/aggregate.ts's toTeleworkInput - the module the dossier route already uses,
// UNCHANGED. The Kotlin conformance suite reads the same file through its own toTeleworkInput.
//
// A divergence between the two derivations of a TeleworkInput must fail BOTH builds, which is the
// whole point of R281: FW12's tile defect was a second derivation of a figure the first had already
// produced, invisible because every hand-written fixture agreed with it. A one-digit change here
// fails this suite and the Kotlin one together (captured in REPORT-AN5b.txt).
//
// The fixture stores dayDate and activityStartDate as ISO strings (language-neutral); this side
// converts them to Date at the boundary only, because aggregate.ts's AggregatableEntry/User take
// Date - the same types the Prisma rows arrive as.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toTeleworkInput } from '@/lib/dossier/aggregate';
import type { AggregatableEntry, AggregatableUser } from '@/lib/dossier/aggregate';
import type { DenominatorMethod, Granularity, TeleworkInput } from '@/lib/calc-engine';

const FIXTURE = join(process.cwd(), '..', 'fixtures', 'aggregation-cases.json');

interface FixtureUser {
  readonly canton: string | null;
  readonly employmentRate: number;
  readonly denominatorKind: 'SIMPLIFIED240' | 'EXACT';
  readonly exactTotalWorkDays: number | null;
  readonly granularity: 'DAY' | 'HALF_DAY';
  readonly activityStartDate: string | null;
}

interface FixtureEntry {
  readonly dayDate: string;
  readonly portion: 'FULL' | 'AM' | 'PM';
  readonly kind: 'CH' | 'HOME' | 'MISSION_FR' | 'MISSION_THIRD' | 'ABSENT';
}

interface FixtureExpected {
  readonly taxYear: number;
  readonly canton: string;
  readonly employmentRate: number;
  readonly periodFraction: number;
  readonly denominator: DenominatorMethod;
  readonly granularity: Granularity;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
}

interface FixtureCase {
  readonly id: string;
  readonly note: string;
  readonly user: FixtureUser;
  readonly entries: readonly FixtureEntry[];
  readonly taxYear: number;
  readonly expected: FixtureExpected;
}

const CASES = (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { cases: readonly FixtureCase[] }).cases;

/** Convert a fixture case's person into aggregate.ts's AggregatableUser (Dates at the boundary). */
function userOf(fixture: FixtureUser): AggregatableUser {
  return {
    canton: fixture.canton,
    employmentRate: fixture.employmentRate,
    denominatorKind: fixture.denominatorKind,
    exactTotalWorkDays: fixture.exactTotalWorkDays,
    granularity: fixture.granularity,
    activityStartDate: fixture.activityStartDate === null ? null : new Date(fixture.activityStartDate),
  };
}

function entriesOf(fixture: readonly FixtureEntry[]): AggregatableEntry[] {
  return fixture.map((entry) => ({
    dayDate: new Date(entry.dayDate),
    portion: entry.portion,
    kind: entry.kind,
  }));
}

describe('aggregation fixture (R281): rows become the expected TeleworkInput', () => {
  it('reads every published case, so the suite cannot pass vacuously', () => {
    expect(CASES.map((c) => c.id)).toEqual([
      'full-days-simple',
      'half-day-pair',
      'absences-of-each-reason-excluded',
      'missions-france-and-third-state',
      'partial-year-midyear-start',
      'r120-rows-versus-portions-disagree',
      'exact-denominator',
    ]);
  });

  for (const testCase of CASES) {
    it(`case ${testCase.id}: ${testCase.note.slice(0, 50)}...`, () => {
      const input: TeleworkInput = toTeleworkInput(
        userOf(testCase.user),
        entriesOf(testCase.entries),
        testCase.taxYear,
      );

      expect(input.taxYear).toBe(testCase.expected.taxYear);
      expect(input.canton).toBe(testCase.expected.canton);
      expect(input.employmentRate).toBe(testCase.expected.employmentRate);
      expect(input.periodFraction).toBe(testCase.expected.periodFraction);
      expect(input.denominator).toEqual(testCase.expected.denominator);
      expect(input.granularity).toBe(testCase.expected.granularity);
      expect(input.teleworkDays).toBe(testCase.expected.teleworkDays);
      expect(input.missionDaysFrance).toBe(testCase.expected.missionDaysFrance);
      expect(input.missionDaysThirdState).toBe(testCase.expected.missionDaysThirdState);
    });
  }

  it('absences change no engine figure (D28): dropping them leaves the input identical', () => {
    const absenceCase = CASES.find((c) => c.id === 'absences-of-each-reason-excluded');
    expect(absenceCase).toBeDefined();
    if (absenceCase === undefined) return;

    const withAbsences = toTeleworkInput(userOf(absenceCase.user), entriesOf(absenceCase.entries), absenceCase.taxYear);
    const withoutAbsences = toTeleworkInput(
      userOf(absenceCase.user),
      entriesOf(absenceCase.entries.filter((e) => e.kind !== 'ABSENT')),
      absenceCase.taxYear,
    );
    expect(withAbsences).toEqual(withoutAbsences);
  });
});
