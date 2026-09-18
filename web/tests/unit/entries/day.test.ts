// web/tests/unit/entries/day.test.ts
//
// A DAY SURVIVES THE ROUND TRIP, WHATEVER THE SERVER'S CLOCK IS SET TO.
//
// SPEC 8: "Day boundaries and reminder times are computed in Europe/Paris -
// the frontalier lives in France. A UTC day-boundary bug here is a wrong
// record."
//
// THE BUG THIS FILE EXISTS TO PREVENT, concretely. The client sends the string
// "2026-04-07". The column is `@db.Date`. Somewhere between the two, a naive
// conversion goes through a local-midnight `Date`:
//
//   new Date('2026-04-07')            -> 2026-04-07T00:00:00Z  (UTC midnight)
//   new Date(2026, 3, 7)              -> 2026-04-06T22:00:00Z  in Paris summer
//
// and the second one, read back as a UTC date, is THE SIXTH. A person's day in
// Switzerland becomes the day before, one row at a time, and nothing looks
// wrong until a dossier is short a day or the 40 % ratio moves.
//
// IT IS A TWICE-A-YEAR DEFECT. Any conversion that assumes a day is 24 hours
// long is correct for 363 days and wrong on the two DST transitions - which is
// exactly the kind of bug that ships, because nobody tests in late March.
//
// So the rule here is simple and absolute: THE DAY IS A STRING AND STAYS A
// STRING. It is converted once, at the database boundary, to the only instant
// that reads back as the same calendar day - UTC midnight - and never to a
// local midnight.

import { describe, expect, it } from 'vitest';
import { PARIS, endOfParisDay, startOfParisDay, toStoredDay, fromStoredDay } from '@/lib/entries/day';

/** The 2026 European transitions: last Sunday of March, last Sunday of October. */
const SPRING_FORWARD = '2026-03-29';
const FALL_BACK = '2026-10-25';

describe('the stored value reads back as the day that was sent', () => {
  it.each([
    ['2026-01-01', 'new year'],
    ['2026-04-07', 'an ordinary summer day'],
    ['2026-12-31', 'new year eve'],
    [SPRING_FORWARD, 'the 23-hour day'],
    [FALL_BACK, 'the 25-hour day'],
    ['2026-03-28', 'the day before spring forward'],
    ['2026-03-30', 'the day after spring forward'],
    ['2026-10-24', 'the day before fall back'],
    ['2026-10-26', 'the day after fall back'],
    ['2024-02-29', 'a leap day'],
  ])('%s round-trips (%s)', (day) => {
    expect(fromStoredDay(toStoredDay(day))).toBe(day);
  });

  it('round-trips EVERY day of 2026, which is the assertion that matters', () => {
    // THE EXHAUSTIVE ONE. Ten named cases prove the cases somebody thought of;
    // 365 prove there is no day where the conversion slips. It costs
    // milliseconds and it is the only version that covers a transition rule
    // changing.
    const failures: string[] = [];

    for (let cursor = new Date('2026-01-01T00:00:00.000Z'); cursor.getUTCFullYear() === 2026; ) {
      const day = cursor.toISOString().slice(0, 10);

      if (fromStoredDay(toStoredDay(day)) !== day) {
        failures.push(day);
      }

      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    expect(failures).toEqual([]);
  });

  it('stores UTC midnight, never a local one', () => {
    // The mechanism, asserted directly rather than inferred from the round
    // trip: a local midnight in Paris is 22:00 or 23:00 the previous day in
    // UTC, and that is the value that reads back as yesterday.
    const stored = toStoredDay('2026-04-07');

    expect(stored.toISOString()).toBe('2026-04-07T00:00:00.000Z');
  });
});

describe('the Paris day has the length the calendar says', () => {
  // THIS IS WHERE Europe/Paris ACTUALLY MATTERS. The stored day is a bare
  // calendar day, but anything that asks "when did this day begin and end" -
  // the late flag, the dossier, a reminder - is asking in the reader's zone,
  // and two days a year are not 24 hours long.

  const hours = (day: string): number =>
    (endOfParisDay(day).getTime() - startOfParisDay(day).getTime()) / 3_600_000;

  it('is 24 hours on an ordinary day', () => {
    expect(hours('2026-04-07')).toBe(24);
    expect(hours('2026-01-15')).toBe(24);
  });

  it('is 23 hours on the spring-forward day', () => {
    // 02:00 becomes 03:00; the day loses an hour. A function assuming 24 puts
    // the boundary an hour into the next day.
    expect(hours(SPRING_FORWARD)).toBe(23);
  });

  it('is 25 hours on the fall-back day', () => {
    // 03:00 becomes 02:00; the day gains one. A function assuming 24 ends the
    // day an hour early, and an entry recorded in that hour lands on the wrong
    // side.
    expect(hours(FALL_BACK)).toBe(25);
  });

  it('starts at the right UTC instant on each side of the transitions', () => {
    // Winter is UTC+1, summer UTC+2, so a Paris day begins at 23:00 or 22:00
    // the previous day. Naming the instants pins the direction: getting the
    // sign wrong produces a day that is still 24 hours long and starts in the
    // wrong place, which the length assertions above cannot see.
    expect(startOfParisDay('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(startOfParisDay('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');

    // The transition days themselves: both still begin in the OLD offset.
    expect(startOfParisDay(SPRING_FORWARD).toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(startOfParisDay(FALL_BACK).toISOString()).toBe('2026-10-24T22:00:00.000Z');
  });

  it('ends where the next day begins, with no gap and no overlap', () => {
    // A boundary defined twice is a boundary that can disagree with itself.
    for (const day of [SPRING_FORWARD, FALL_BACK, '2026-04-07', '2026-12-31']) {
      const next = new Date(`${day}T00:00:00.000Z`);

      next.setUTCDate(next.getUTCDate() + 1);

      expect(endOfParisDay(day).toISOString()).toBe(
        startOfParisDay(next.toISOString().slice(0, 10)).toISOString(),
      );
    }
  });
});

describe('the zone is named once, and it is the one SPEC names', () => {
  it('is Europe/Paris', () => {
    // R171: the constant is read, never restated. SPEC 8 gives the reason -
    // "the frontalier lives in France" - so this is Paris rather than Zurich
    // even though the work is in Switzerland, and that asymmetry is exactly
    // the sort of thing a later reader would "fix".
    expect(PARIS).toBe('Europe/Paris');
  });
});
