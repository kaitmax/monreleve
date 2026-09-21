// web/tests/unit/dossier/aggregate.test.ts
//
// The surface between two verified things. FW24 increment 2.
//
// R175: the engine is proven against its fixtures and the write path against
// its tests, and until this module existed nothing occupied the space between
// them. These tests are that space.

import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import {
  type AggregatableEntry,
  type AggregatableUser,
  countDays,
  toTeleworkInput,
} from '@/lib/dossier/aggregate';

const USER: AggregatableUser = {
  canton: 'GE',
  employmentRate: 100,
  denominatorKind: 'SIMPLIFIED240',
  exactTotalWorkDays: null,
  granularity: 'HALF_DAY',
  activityStartDate: null,
};

function day(iso: string, kind: AggregatableEntry['kind'], portion: AggregatableEntry['portion'] = 'FULL'): AggregatableEntry {
  return { dayDate: new Date(`${iso}T00:00:00.000Z`), portion, kind };
}

describe('counting rows', () => {
  it('counts a FULL day as one and a half-day pair as one between them', () => {
    const counts = countDays([
      day('2026-04-07', 'HOME'),
      day('2026-04-08', 'HOME', 'AM'),
      day('2026-04-08', 'HOME', 'PM'),
    ]);

    // TWO DAYS, not three rows. The unit is the day, and a pair is one.
    expect(counts.teleworkDays).toBe(2);
  });

  it('keeps the four kinds apart', () => {
    const counts = countDays([
      day('2026-04-07', 'CH'),
      day('2026-04-08', 'HOME'),
      day('2026-04-09', 'MISSION_FR'),
      day('2026-04-10', 'MISSION_THIRD'),
      day('2026-04-13', 'ABSENT'),
    ]);

    expect(counts).toEqual({
      swissDays: 1,
      teleworkDays: 1,
      missionDaysFrance: 1,
      missionDaysThirdState: 1,
      absenceDays: 1,
    });
  });

  it('adds halves exactly, which is why they are halves and not thirds', () => {
    // 0.5 is exact in binary. This asserts the sum rather than trusting it,
    // because a count that drifted by a thousandth would round into a
    // different day somewhere in the engine.
    const entries = Array.from({ length: 20 }, (_, index) =>
      day(`2026-04-${String((index % 28) + 1).padStart(2, '0')}`, 'HOME', index % 2 === 0 ? 'AM' : 'PM'),
    );

    expect(countDays(entries).teleworkDays).toBe(10);
  });
});

describe('absences never reach the engine (D28)', () => {
  // THE ASSERTION IS IDENTITY, NOT ABSENCE. "Absences are excluded" is
  // satisfied by code that excludes them from three of four counters. The only
  // claim worth making is that the engine cannot tell the difference.
  const worked: AggregatableEntry[] = [
    day('2026-01-05', 'CH'),
    day('2026-01-06', 'HOME'),
    day('2026-01-07', 'HOME'),
    day('2026-01-08', 'MISSION_FR'),
    day('2026-01-09', 'MISSION_THIRD'),
  ];

  const absences: AggregatableEntry[] = [
    day('2026-02-02', 'ABSENT'),
    day('2026-02-03', 'ABSENT'),
    day('2026-02-04', 'ABSENT', 'AM'),
    day('2026-02-04', 'ABSENT', 'PM'),
    day('2026-02-05', 'ABSENT'),
  ];

  it('produces an IDENTICAL engine input with and without them', () => {
    expect(toTeleworkInput(USER, [...worked, ...absences], 2026)).toEqual(
      toTeleworkInput(USER, worked, 2026),
    );
  });

  it('produces an IDENTICAL engine RESULT with and without them', () => {
    // The input test above would pass if the input were identical and the
    // engine were called with something else. This is the claim that matters
    // to a reader of the dossier.
    const withThem = calculateTelework(toTeleworkInput(USER, [...worked, ...absences], 2026));
    const withoutThem = calculateTelework(toTeleworkInput(USER, worked, 2026));

    expect(withThem).toEqual(withoutThem);
  });

  it('still COUNTS them, because the identification block needs the number', () => {
    // NON-VACUITY. Both assertions above are satisfied by an aggregation that
    // drops absences on the floor and never mentions them - and D28 requires
    // them counted once, for the identification block. So the count is
    // asserted to be non-zero on the same rows.
    expect(countDays([...worked, ...absences]).absenceDays).toBe(4);
  });
});

describe('the engine input is built, never invented', () => {
  it('carries the person settings through unchanged', () => {
    const input = toTeleworkInput(USER, [day('2026-04-07', 'HOME')], 2026);

    expect(input).toMatchObject({
      taxYear: 2026,
      canton: 'GE',
      employmentRate: 100,
      periodFraction: 1,
      denominator: { kind: 'simplified240' },
      granularity: 'halfDay',
    });
  });

  it('maps DAY granularity too, so the mapping is not one-sided', () => {
    const input = toTeleworkInput({ ...USER, granularity: 'DAY' }, [], 2026);

    expect(input.granularity).toBe('day');
  });

  it('passes the exact denominator through when the person chose it', () => {
    const input = toTeleworkInput(
      { ...USER, denominatorKind: 'EXACT', exactTotalWorkDays: 218 },
      [],
      2026,
    );

    expect(input.denominator).toEqual({ kind: 'exact', totalWorkDays: 218 });
  });

  it('REFUSES an EXACT denominator with no figure rather than falling back', () => {
    // FALLING BACK WOULD PRODUCE A DIFFERENT RATE under a method the reader did
    // not choose, and the dossier would not say which one it used. SPEC 8 makes
    // the pair required and a CHECK constraint enforces it, so this state means
    // the row was not written through the application.
    expect(() =>
      toTeleworkInput({ ...USER, denominatorKind: 'EXACT', exactTotalWorkDays: null }, [], 2026),
    ).toThrow(/exactTotalWorkDays is null/u);
  });

  it('REFUSES a missing canton rather than choosing one', () => {
    // SPEC 7 resolves the regime from the canton, and there is no default that
    // is right for everybody - Geneva and Vaud are different regimes.
    expect(() => toTeleworkInput({ ...USER, canton: null }, [], 2026)).toThrow(/needs a canton/u);
  });

  it('derives periodFraction from the start date rather than assuming a full year', () => {
    const input = toTeleworkInput(
      { ...USER, activityStartDate: new Date('2026-07-01T00:00:00.000Z') },
      [],
      2026,
    );

    expect(input.periodFraction).toBeGreaterThan(0);
    expect(input.periodFraction).toBeLessThan(1);
  });
});
