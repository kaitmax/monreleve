// web/tests/unit/lamal/deadline.test.ts
//
// FW-CALCS-A2, R748: the end of the three-month option period, as the
// helper shows it.
//
// S3 IS NOT FOUND (docs/sources/primes-lamal/sources-2026-11.md, NOT FOUND
// item 1): no text says whether the three months run from the event's day or
// the next, nor whether they end on the same date or at a month's end. So
// the page shows an INDICATIVE date with "environ" and a warning, computed
// one way and stated: the event's date plus three calendar months, clamped to
// the last day of the target month (30 November -> 28 or 29 February).
//
// The shown date must never be LATER than the computed end - a reader told a
// later date could miss a deadline that does not move.

import { describe, expect, it } from 'vitest';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { OPTION_PERIOD_MONTHS, optionPeriodEnd } from '@/lib/lamal/deadline';

describe('optionPeriodEnd', () => {
  it('adds three calendar months, same day', () => {
    expect(optionPeriodEnd('2026-11-02')).toBe('2027-02-02');
    expect(optionPeriodEnd('2026-12-15')).toBe('2027-03-15');
    expect(optionPeriodEnd('2026-10-31')).toBe('2027-01-31');
  });

  it('clamps a month end to the last day of the target month', () => {
    expect(optionPeriodEnd('2026-11-30')).toBe('2027-02-28');
    expect(optionPeriodEnd('2027-01-31')).toBe('2027-04-30');
  });

  it('knows a leap year', () => {
    expect(optionPeriodEnd('2027-11-30')).toBe('2028-02-29');
    expect(optionPeriodEnd('2027-11-29')).toBe('2028-02-29');
    expect(optionPeriodEnd('2028-11-30')).toBe('2029-02-28');
  });

  it('refuses what is not a real ISO day', () => {
    for (const text of ['', '2026-02-30', '30.11.2026', '2026-13-01']) {
      expect(optionPeriodEnd(text)).toBeUndefined();
    }
  });

  it('is three months, not a typed figure', () => {
    expect(OPTION_PERIOD_MONTHS).toBe(3);
  });

  it('never shows a date later than the end it computed, over three whole years', () => {
    const toIso = (time: number): string => new Date(time).toISOString().slice(0, 10);

    for (let time = Date.UTC(2026, 0, 1); time <= Date.UTC(2028, 11, 31); time += 86_400_000) {
      const event = toIso(time);
      const end = optionPeriodEnd(event);

      expect(end, event).toBeDefined();
      if (end === undefined) continue;

      // The end falls in the third month after the event's, on or before its day.
      const [ey, em, ed] = event.split('-').map(Number) as [number, number, number];
      const [y, m, d] = end.split('-').map(Number) as [number, number, number];

      expect((y - ey) * 12 + (m - em), event).toBe(OPTION_PERIOD_MONTHS);
      expect(d, event).toBeLessThanOrEqual(ed);

      // What the reader sees is that same day - its number, its month, its
      // year - and so never a later one.
      const shown = LAMAL_COPY.deadline.longDate(end);

      expect(Number.parseInt(shown, 10), `${event} -> ${shown}`).toBe(d);
      expect(shown, event).toContain(LAMAL_COPY.deadline.months[m - 1]);
      expect(shown.endsWith(String(y)), `${event} -> ${shown}`).toBe(true);
    }
  });
});
