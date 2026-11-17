// web/tests/unit/rappel/window.test.ts
//
// FW-DELAI-RAPPEL, R916: the fourteen days, as calendar days. The cases are the
// ones milliseconds get wrong (a change of clock inside the fourteen days), the
// ones a calendar gets wrong (a month end, a leap day), and the boundary the
// conservative choice draws: offered up to and including the due day, never
// after it.

import { describe, expect, it } from 'vitest';
import {
  DAYS_BEFORE,
  MAX_MONTHS_AHEAD,
  isIsoDay,
  latestDeadline,
  localDay,
  reminderDay,
  reminderOffered,
  reminderWindow,
  shiftDays,
  shiftMonths,
} from '@/lib/rappel/window';

describe('the due day is DAYS_BEFORE calendar days before the date', () => {
  it('is fourteen days', () => {
    expect(DAYS_BEFORE).toBe(14);
  });

  it.each([
    ['2027-02-28', '2027-02-14'],
    // Across the spring change of clock (28 March 2027): still a calendar day.
    ['2027-04-05', '2027-03-22'],
    // Across a month end, and into the previous year.
    ['2027-01-10', '2026-12-27'],
    // From a leap day.
    ['2028-02-29', '2028-02-15'],
    // Onto a leap day.
    ['2028-03-14', '2028-02-29'],
  ])('%s is due on %s', (deadline, due) => {
    expect(reminderDay(deadline)).toBe(due);
  });

  it('refuses a day the calendar does not have', () => {
    expect(reminderDay('2027-02-30')).toBeUndefined();
    expect(reminderDay('2027-13-01')).toBeUndefined();
    expect(reminderDay('28/02/2027')).toBeUndefined();
    expect(reminderDay('')).toBeUndefined();
  });
});

describe('a reminder is offered only while its due day has not passed (R916)', () => {
  const deadline = '2027-02-28';

  it('is offered well before', () => {
    expect(reminderOffered(deadline, '2026-11-12')).toBe(true);
  });

  it('is offered ON the due day - the next pass sends it', () => {
    expect(reminderOffered(deadline, '2027-02-14')).toBe(true);
  });

  it('is NOT offered the day after the due day: fewer than fourteen days remain', () => {
    expect(reminderOffered(deadline, '2027-02-15')).toBe(false);
  });

  it('is not offered on or after the date itself', () => {
    expect(reminderOffered(deadline, '2027-02-28')).toBe(false);
    expect(reminderOffered(deadline, '2027-03-01')).toBe(false);
  });

  it('is not offered for a malformed date or a malformed today', () => {
    expect(reminderOffered('2027-02-30', '2026-11-12')).toBe(false);
    expect(reminderOffered(deadline, 'aujourd’hui')).toBe(false);
  });
});

describe(`R1004: a date more than MAX_MONTHS_AHEAD (${MAX_MONTHS_AHEAD}) calendar months away is refused`, () => {
  it('is twelve months', () => {
    expect(MAX_MONTHS_AHEAD).toBe(12);
  });

  it.each([
    ['2026-11-12', '2027-11-12'],
    // A leap day has no twin a year on: the month's end, as PostgreSQL's
    // date + interval '12 months' gives it - the database's bound.
    ['2028-02-29', '2029-02-28'],
    ['2027-01-31', '2028-01-31'],
  ])('on %s the latest date is %s', (today, latest) => {
    expect(latestDeadline(today)).toBe(latest);
  });

  it('offers the latest date itself, and refuses the day after it as too far', () => {
    expect(reminderWindow('2027-11-12', '2026-11-12')).toBe('offered');
    expect(reminderWindow('2027-11-13', '2026-11-12')).toBe('too-far');
    expect(reminderOffered('2027-11-13', '2026-11-12')).toBe(false);
  });

  it('names the two refusals apart: too close and too far are different sentences', () => {
    expect(reminderWindow('2027-02-28', '2027-02-15')).toBe('too-close');
    expect(reminderWindow('2029-02-28', '2027-02-15')).toBe('too-far');
    expect(reminderWindow('2027-02-30', '2026-11-12')).toBe('invalid');
    expect(reminderWindow('2027-02-28', 'demain')).toBe('invalid');
  });

  it('moves by calendar months in both directions, clamped to the month end', () => {
    expect(shiftMonths('2027-03-31', -1)).toBe('2027-02-28');
    expect(shiftMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(shiftMonths('2027-11-30', 3)).toBe('2028-02-29');
    expect(shiftMonths('2027-02-30', 1)).toBeUndefined();
  });
});

describe('the helpers it is built from', () => {
  it('reads real ISO days only, and refuses the two-digit years Date.UTC rewrites', () => {
    expect(isIsoDay('2027-02-28')).toBe(true);
    expect(isIsoDay('0099-01-01')).toBe(false);
    expect(isIsoDay('2027-2-28')).toBe(false);
  });

  it('shifts by calendar days in both directions', () => {
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it("gives the reader's own calendar day, from their clock", () => {
    // 23:30 local on 12 November is still the 12th wherever the test runs.
    expect(localDay(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-12');
  });
});
