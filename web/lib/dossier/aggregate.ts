// web/lib/dossier/aggregate.ts
//
// Database rows become a TeleworkInput. FW24 increment 2.
//
// ============================================================================
// THIS IS WHERE THE ENGINE MEETS REAL ROWS FOR THE FIRST TIME
// ============================================================================
//
// `calculateTelework` has been fed fixtures written by hand since FW3. Every
// one of them was a TeleworkInput somebody typed. This module is the first
// thing that BUILDS one, from entries a person actually recorded - and it sits
// between two verified things, which is exactly the position R175 warns about:
// the engine is proven against its fixtures, the write path is proven against
// its tests, and the space between them was unexamined until now.
//
// ============================================================================
// IT COUNTS. IT DOES NOT CALCULATE.
// ============================================================================
//
// Nothing here divides, rounds, or compares against a threshold. It turns rows
// into four numbers and hands them over. FW12's tile defect was a panel
// recomputing a value the engine had already produced, and it passed every
// test because every fixture agreed with it - the two only diverge on inputs
// nobody wrote down. The way to not have that defect is to have no second
// implementation, not to have a careful one.
//
// ============================================================================
// ABSENCES NEVER REACH THE ENGINE
// ============================================================================
//
// D28: an absence is counted once in the identification block and appears in no
// other figure. A jour de conge is not a worked day in Switzerland, not
// telework, and not a mission - it is a day that is not part of the
// calculation at all. Passing one to the engine as anything would move a rate.
//
// So they are filtered here, and a test asserts the engine's output is
// IDENTICAL with and without them rather than merely plausible. An assertion
// that absences "are excluded" is satisfied by code that excludes them from
// three of four counters.

import type {
  DenominatorMethod,
  Granularity,
  TeleworkInput,
} from '@/lib/calc-engine';
import { remainingYearFraction } from '@/lib/ui/core/period';

/** Exactly the entry columns this module reads. */
export interface AggregatableEntry {
  readonly dayDate: Date;
  readonly portion: 'FULL' | 'AM' | 'PM';
  readonly kind: 'CH' | 'HOME' | 'MISSION_FR' | 'MISSION_THIRD' | 'ABSENT';
}

/** Exactly the user columns this module reads. */
export interface AggregatableUser {
  readonly canton: string | null;
  readonly employmentRate: number;
  readonly denominatorKind: 'SIMPLIFIED240' | 'EXACT';
  readonly exactTotalWorkDays: number | null;
  readonly granularity: 'DAY' | 'HALF_DAY';
  readonly activityStartDate: Date | null;
}

/**
 * What one entry contributes to a count.
 *
 * A FULL day is one day; AM and PM are half each, so a half-day pair sums to
 * exactly one. Written as a lookup rather than as `portion === 'FULL' ? 1 :
 * 0.5` so that a fourth portion added to the schema is a missing key here
 * rather than a silent 0.5.
 */
const PORTION_DAYS: Readonly<Record<AggregatableEntry['portion'], number>> = {
  FULL: 1,
  AM: 0.5,
  PM: 0.5,
};

/**
 * The kinds that are days away from Switzerland, and what they count towards.
 *
 * CH IS ABSENT FROM THIS MAP ON PURPOSE, and so is ABSENT. The engine derives
 * days in Switzerland from the denominator rather than from a count, so a CH
 * row contributes to nothing here - and saying that in a map is better than
 * saying it in a comment beside an `if`.
 */
const COUNTS_TOWARDS: Readonly<
  Partial<Record<AggregatableEntry['kind'], 'telework' | 'france' | 'third'>>
> = {
  HOME: 'telework',
  MISSION_FR: 'france',
  MISSION_THIRD: 'third',
};

/** The four numbers the engine is given, before anything is calculated. */
export interface DayCounts {
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
  /** Not an engine input. Reported so a reader can check the arithmetic. */
  readonly swissDays: number;
  /** Not an engine input either. D28: counted once, and nowhere else. */
  readonly absenceDays: number;
}

/**
 * Count the rows.
 *
 * FLOATING POINT IS AVOIDED BY COUNTING HALVES. 0.5 is exact in binary, so
 * summing halves is safe for any count this product can hold - but the sum is
 * built by adding and never by repeated multiplication, and the ceiling is
 * 1098 rows, so no accumulation error can reach a tenth of a day.
 */
export function countDays(entries: readonly AggregatableEntry[]): DayCounts {
  let teleworkDays = 0;
  let missionDaysFrance = 0;
  let missionDaysThirdState = 0;
  let swissDays = 0;
  let absenceDays = 0;

  for (const entry of entries) {
    const days = PORTION_DAYS[entry.portion];

    if (entry.kind === 'ABSENT') {
      // D28, AND IT STOPS HERE. Counted once, for the identification block,
      // and added to nothing the engine will see.
      absenceDays += days;
      continue;
    }

    if (entry.kind === 'CH') {
      swissDays += days;
      continue;
    }

    const bucket = COUNTS_TOWARDS[entry.kind];

    if (bucket === 'telework') teleworkDays += days;
    else if (bucket === 'france') missionDaysFrance += days;
    else if (bucket === 'third') missionDaysThirdState += days;
  }

  return { teleworkDays, missionDaysFrance, missionDaysThirdState, swissDays, absenceDays };
}

/** The user's logging granularity in the engine's vocabulary. */
function granularityOf(user: AggregatableUser): Granularity {
  return user.granularity === 'HALF_DAY' ? 'halfDay' : 'day';
}

/**
 * The denominator the engine should use.
 *
 * SPEC 8 makes `exactTotalWorkDays` required iff the kind is EXACT, enforced by
 * a CHECK constraint (R196) - so a null here with kind EXACT is a database that
 * has been written around, not a case to paper over. It throws rather than
 * falling back to the simplified basis, because falling back would produce a
 * DIFFERENT RATE under a method the reader did not choose, and the dossier
 * would not say which one it used.
 */
function denominatorOf(user: AggregatableUser): DenominatorMethod {
  if (user.denominatorKind === 'EXACT') {
    if (user.exactTotalWorkDays === null) {
      throw new Error(
        'denominatorKind is EXACT but exactTotalWorkDays is null. SPEC 8 requires ' +
          'the pair, and a CHECK constraint enforces it - this row was not written ' +
          'through the application.',
      );
    }

    return { kind: 'exact', totalWorkDays: user.exactTotalWorkDays };
  }

  return { kind: 'simplified240' };
}

/**
 * The fraction of the year the person was active.
 *
 * DERIVED FROM THE STORED DAY, never from a clock. `remainingYearFraction`
 * exists already and is R28-clean; using it rather than writing the arithmetic
 * again is the whole of R181 in one line. A person with no start date recorded
 * worked the whole year, which is 1.
 */
function periodFractionOf(user: AggregatableUser, taxYear: number): number {
  if (user.activityStartDate === null) return 1;

  return remainingYearFraction(user.activityStartDate.toISOString().slice(0, 10), taxYear);
}

/**
 * Build the engine's input from a person and their year.
 *
 * THE ENTRIES ARE NOT FILTERED BY YEAR HERE. The caller selects the year, and
 * doing it twice would give two places to be wrong about which year a day
 * belongs to - a question `dayDate` already answers and `toStoredDay` already
 * decided (R28). The caller passes the rows it means.
 */
export function toTeleworkInput(
  user: AggregatableUser,
  entries: readonly AggregatableEntry[],
  taxYear: number,
): TeleworkInput {
  const counts = countDays(entries);

  if (user.canton === null) {
    throw new Error(
      'the dossier needs a canton: SPEC 7 resolves the regime from it, and there ' +
        'is no default that is right for everybody.',
    );
  }

  return {
    taxYear,
    canton: user.canton as TeleworkInput['canton'],
    employmentRate: user.employmentRate,
    periodFraction: periodFractionOf(user, taxYear),
    denominator: denominatorOf(user),
    granularity: granularityOf(user),
    teleworkDays: counts.teleworkDays,
    missionDaysFrance: counts.missionDaysFrance,
    missionDaysThirdState: counts.missionDaysThirdState,
  };
}
