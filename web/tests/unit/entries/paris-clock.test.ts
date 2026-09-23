// web/tests/unit/entries/paris-clock.test.ts
//
// FW27: the two Paris accessors the reminder job needs.
//
// THE CASES ARE THE DST BOUNDARIES AND MIDNIGHT, because those are the only
// ones where a UTC answer and a Paris answer differ - and they are exactly the
// nights a reminder would be sent twice or not at all.

import { describe, expect, it } from 'vitest';
import { parisDayOf, parisTimeOf } from '@/lib/entries/day';

describe('parisDayOf', () => {
  it('reports the PARIS day, not the UTC one, just after midnight in summer', () => {
    // 2026-07-06T23:30Z is 2026-07-07 01:30 in Paris. A job reading UTC would
    // call this the 6th and send a second reminder for a day it had covered.
    expect(parisDayOf(new Date('2026-07-06T23:30:00.000Z'))).toBe('2026-07-07');
  });

  it('reports the PARIS day just after midnight in winter', () => {
    expect(parisDayOf(new Date('2026-01-06T23:30:00.000Z'))).toBe('2026-01-07');
  });

  it('agrees with UTC in the middle of the day, so it is not simply shifting', () => {
    // R196's shape: a function that always added a day would pass both tests
    // above.
    expect(parisDayOf(new Date('2026-07-07T12:00:00.000Z'))).toBe('2026-07-07');
  });

  it('handles the spring forward, when Paris loses an hour', () => {
    // 2026-03-29 is the last Sunday in March.
    expect(parisDayOf(new Date('2026-03-29T01:30:00.000Z'))).toBe('2026-03-29');
  });

  it('handles the autumn fall back, when an hour happens twice', () => {
    expect(parisDayOf(new Date('2026-10-25T00:30:00.000Z'))).toBe('2026-10-25');
  });
});

describe('parisTimeOf', () => {
  it('reports the wall clock in Paris, in the shape reminderTime is stored in', () => {
    // Summer: UTC+2.
    expect(parisTimeOf(new Date('2026-07-07T15:30:00.000Z'))).toBe('17:30');
  });

  it('reports it in winter, when the offset is different', () => {
    // Winter: UTC+1. The SAME wall-clock time from a different instant, which
    // is the whole reason reminderTime is a string rather than an instant.
    expect(parisTimeOf(new Date('2026-01-07T16:30:00.000Z'))).toBe('17:30');
  });

  it('pads to two digits, so a string comparison with reminderTime is valid', () => {
    // "9:05" would sort after "17:30". The comparison the job makes is
    // lexicographic, and it is only correct because both sides are padded.
    expect(parisTimeOf(new Date('2026-01-07T08:05:00.000Z'))).toBe('09:05');
  });
});
