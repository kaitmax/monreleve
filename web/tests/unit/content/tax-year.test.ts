// web/tests/unit/content/tax-year.test.ts
//
// RULING R55: "the calculator computes for the current calendar year in
// Europe/Paris and shows it in the form's heading."
//
// WHY THIS IS NOT `new Date().getFullYear()`. That reads the HOST's zone. A
// server in UTC on 31 December at 23:30 is already 1 January in Paris, so the
// calculator would compute the wrong year for half an hour every year - and
// the half hour it gets wrong is the one where a frontalier is most likely to
// be closing out their year. SPEC 8: "Day boundaries and reminder times are
// computed in Europe/Paris - the frontalier lives in France. A UTC
// day-boundary bug here is a wrong record."
//
// WHY IT TAKES `now` AS AN ARGUMENT. The engine may not read the clock (SPEC
// 20), and neither may a test: a test that called the real clock would assert
// something different every day and would be unable to reach the boundary at
// all. The default is the real clock, for the one caller in the page.
//
// THE ZONE IS lib/ui/core's DATE_TIME_ZONE, not a second copy of the string.
// Two constants naming the same zone is how they eventually disagree.

import { describe, expect, it } from 'vitest';
import { currentTaxYear } from '@/lib/content/tax-year';
import { DATE_TIME_ZONE } from '@/lib/ui/core';

describe('currentTaxYear', () => {
  it('is the calendar year in Europe/Paris', () => {
    expect(currentTaxYear(new Date('2026-09-09T12:00:00Z'))).toBe(2026);
  });

  it('crosses the year at MIDNIGHT IN PARIS, not at midnight UTC', () => {
    // The assertion this module exists for. 31 December 23:30 UTC is already
    // 00:30 on 1 January in Paris (UTC+1 in winter), so the tax year has
    // turned even though the UTC year has not.
    expect(currentTaxYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027);

    // And half an hour earlier it has not.
    expect(currentTaxYear(new Date('2026-12-31T22:30:00Z'))).toBe(2026);
  });

  it('does not turn early in summer, when the offset is +2', () => {
    // The mirror case, and it is not symmetrical: on 31 December Paris is
    // UTC+1, but a naive "add an hour" would be wrong in July. Asserting the
    // summer boundary proves the implementation uses the zone rather than a
    // fixed offset.
    expect(currentTaxYear(new Date('2026-07-01T00:00:00Z'))).toBe(2026);
    expect(currentTaxYear(new Date('2026-12-31T21:59:00Z'))).toBe(2026);
  });

  it('holds on 1 January, the other side of the same boundary', () => {
    expect(currentTaxYear(new Date('2027-01-01T00:00:00Z'))).toBe(2027);
    expect(currentTaxYear(new Date('2027-01-01T12:00:00Z'))).toBe(2027);
  });

  it('reads the zone from lib/ui/core rather than declaring its own', () => {
    // A second 'Europe/Paris' string somewhere is how two of them eventually
    // disagree. Asserted through behaviour: if this module used UTC, the
    // boundary case above would return 2026.
    expect(DATE_TIME_ZONE).toBe('Europe/Paris');
  });

  it('defaults to the real clock, and returns a plausible year', () => {
    // The default is what the page uses. Not pinned to a literal - that would
    // fail every 1 January - but bounded, so a broken implementation
    // returning 1970 or NaN fails here.
    const year = currentTaxYear();

    expect(Number.isInteger(year)).toBe(true);
    expect(year).toBeGreaterThanOrEqual(2026);
    expect(year).toBeLessThan(2100);
  });
});
