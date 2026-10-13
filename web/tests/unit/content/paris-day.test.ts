// web/tests/unit/content/paris-day.test.ts
//
// R28 / R55, EXTENDED FROM THE YEAR TO THE DAY (FW-FORECAST).
//
// currentTaxYear already pins the YEAR to Europe/Paris, for a reason its own
// header states: a server in UTC on 31 December at 23:30 is already 1 January
// in Paris. The projection needs the same answer one unit down, because the
// imagined year starts the day AFTER today - so a day resolved in the host's
// zone costs the reader a whole working day of projection for the one to two
// hours a day the two zones disagree.
//
// EVERY CASE HERE IS A FIXED INSTANT. A test that called the function with no
// argument would assert something different every day it ran, and would be
// unable to ask about the boundary at all - which is the only interesting
// input.

import { describe, expect, it } from 'vitest';
import { currentDayInParis } from '@/lib/content/tax-year';

/** The day as ISO, which is how every other date in this product is written. */
const dayOf = (now: string): string => currentDayInParis(new Date(now)).toISOString().slice(0, 10);

describe('the product day is the Paris day, not the host day', () => {
  it('is the same day when the zones agree', () => {
    expect(dayOf('2026-10-09T12:00:00Z')).toBe('2026-10-09');
  });

  it('is already tomorrow in Paris late on a winter evening', () => {
    // 23:30 UTC in winter is 00:30 the next day in Paris (UTC+1). A host
    // reading its own clock would still say the 8th.
    expect(dayOf('2026-01-08T23:30:00Z')).toBe('2026-01-09');
  });

  it('is already tomorrow in Paris at 22:30 UTC in summer', () => {
    // Paris is UTC+2 in summer, so the boundary moves an hour and a half
    // earlier. An implementation that added a fixed hour would pass the
    // winter case above and fail this one - which is the bug that survives
    // every test written in January.
    expect(dayOf('2026-07-08T22:30:00Z')).toBe('2026-07-09');
  });

  it('is still today in Paris just before the boundary, in both seasons', () => {
    // R196's shape: a function that always answered "tomorrow" would pass
    // both cases above perfectly.
    expect(dayOf('2026-01-08T22:30:00Z')).toBe('2026-01-08');
    expect(dayOf('2026-07-08T21:30:00Z')).toBe('2026-07-08');
  });

  it('crosses the new year in Paris while the host is still in December', () => {
    // currentTaxYear's own worked example, asserted one unit down - and the
    // two must agree about which year it is.
    expect(dayOf('2026-12-31T23:30:00Z')).toBe('2027-01-01');
  });

  it('returns UTC midnight of that day, so nothing downstream shifts it', () => {
    // The imagined-days walk, the codec and the fixture all do their
    // arithmetic in UTC. Handing back a Paris-local instant would put the
    // boundary back exactly where this function removes it.
    const day = currentDayInParis(new Date('2026-07-08T22:30:00Z'));

    expect(day.getUTCHours()).toBe(0);
    expect(day.getUTCMinutes()).toBe(0);
    expect(day.getUTCSeconds()).toBe(0);
    expect(day.getUTCMilliseconds()).toBe(0);
  });
});
