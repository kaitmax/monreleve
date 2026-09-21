// web/tests/unit/dossier/monthly.test.ts
//
// The cumulative column. FW24 increment 3.
//
// The trap this file exists for: accumulating percentages instead of asking
// the engine. Every row looks plausible under accumulation, the arithmetic
// looks internally consistent, and only the December figure disagrees with the
// annual one - which is the single assertion that separates them.

import { describe, expect, it } from 'vitest';
import {
  type AggregatableEntry,
  type AggregatableUser,
} from '@/lib/dossier/aggregate';
import { annualResult, monthlyBreakdown } from '@/lib/dossier/monthly';

const USER: AggregatableUser = {
  canton: 'GE',
  employmentRate: 100,
  denominatorKind: 'SIMPLIFIED240',
  exactTotalWorkDays: null,
  granularity: 'DAY',
  activityStartDate: null,
};

function day(iso: string, kind: AggregatableEntry['kind']): AggregatableEntry {
  return { dayDate: new Date(`${iso}T00:00:00.000Z`), portion: 'FULL', kind };
}

/** Telework spread across the year, so the cumulative figure actually moves. */
function spreadYear(): AggregatableEntry[] {
  const entries: AggregatableEntry[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const mm = String(month).padStart(2, '0');

    // Four telework days and six Swiss days a month - a shape that keeps the
    // rate under both thresholds so the test is about the arithmetic rather
    // than about a warning.
    for (let d = 1; d <= 4; d += 1) {
      entries.push(day(`2026-${mm}-${String(d).padStart(2, '0')}`, 'HOME'));
    }

    for (let d = 5; d <= 10; d += 1) {
      entries.push(day(`2026-${mm}-${String(d).padStart(2, '0')}`, 'CH'));
    }
  }

  return entries;
}

describe('the cumulative column is the engine answer, not a running total', () => {
  it('ends the year EXACTLY on the annual figure', () => {
    // THE ASSERTION THAT SEPARATES COMPUTATION FROM ACCUMULATION. Adding twelve
    // truncated percentages drifts in one direction; asking the engine for
    // January-through-December returns the annual answer by construction.
    const rows = monthlyBreakdown(USER, spreadYear(), 2026);
    const annual = annualResult(USER, spreadYear(), 2026);

    expect(rows).toHaveLength(12);
    expect(rows[11]?.cumulativeDeclarableRate).toBe(annual.declarableRate);
  });

  it('is not a sum of the monthly rates, which is what it would be if added', () => {
    // NON-VACUITY FOR THE ABOVE. If every rate were zero, "December equals the
    // annual" would hold for the wrong reason. This asserts the figure is a
    // real, moving rate - and that naively summing twelve of them would
    // overshoot wildly, which is what makes the first test meaningful.
    const rows = monthlyBreakdown(USER, spreadYear(), 2026);
    const december = rows[11]?.cumulativeDeclarableRate ?? 0;

    expect(december).toBeGreaterThan(0);

    const summed = rows.reduce((total, row) => total + row.cumulativeDeclarableRate, 0);

    expect(summed).toBeGreaterThan(december);
  });

  it('rises through the year rather than jumping about', () => {
    // A cumulative figure over a steady year is monotonic. This is the shape
    // check: a column that went up and down would be a per-month rate wearing
    // a cumulative label, which is the other way to get this wrong.
    const rates = monthlyBreakdown(USER, spreadYear(), 2026).map(
      (row) => row.cumulativeDeclarableRate,
    );

    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i] ?? 0).toBeGreaterThanOrEqual(rates[i - 1] ?? 0);
    }
  });

  it('gives every month a row, including months with nothing in them', () => {
    // SPEC 12's annex prints unlogged days rather than skipping them, and a
    // table that omits an empty month makes the same claim by omission.
    const january = [day('2026-01-05', 'HOME'), day('2026-01-06', 'CH')];
    const rows = monthlyBreakdown(USER, january, 2026);

    expect(rows.map((row) => row.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    // And the empty months carry zero DAYS while keeping the rate they
    // inherited - the true statement about a month nobody recorded.
    expect(rows[5]?.teleworkDays).toBe(0);
    expect(rows[5]?.swissDays).toBe(0);
    expect(rows[5]?.cumulativeDeclarableRate).toBe(rows[0]?.cumulativeDeclarableRate);
  });

  it('puts each day in its own month, on a UTC reading', () => {
    // getUTCMonth, because dayDate holds UTC midnight. A local getter would
    // put 1 January into December for anyone west of Greenwich - FW6's defect
    // in a different function, and invisible to anyone testing in Europe.
    const rows = monthlyBreakdown(
      USER,
      [day('2026-01-01', 'HOME'), day('2026-12-31', 'HOME')],
      2026,
    );

    expect(rows[0]?.teleworkDays).toBe(1);
    expect(rows[11]?.teleworkDays).toBe(1);
    expect(rows[1]?.teleworkDays).toBe(0);
  });

  it('keeps absences out of the engine per month too, not only per year', () => {
    // The per-month slice is a second path into the engine, so D28 has to hold
    // on it as well - a filter applied once at the year level would leave this
    // one open.
    const withAbsences = [...spreadYear(), day('2026-03-20', 'ABSENT'), day('2026-03-21', 'ABSENT')];

    const clean = monthlyBreakdown(USER, spreadYear(), 2026).map((r) => r.cumulativeDeclarableRate);
    const dirty = monthlyBreakdown(USER, withAbsences, 2026).map((r) => r.cumulativeDeclarableRate);

    expect(dirty).toEqual(clean);

    // AND THEY ARE STILL COUNTED in the month they fall in.
    expect(monthlyBreakdown(USER, withAbsences, 2026)[2]?.absenceDays).toBe(2);
  });
});

describe('the engine warnings reach the caller, which the dossier depends on', () => {
  // ONLY 2026 HAS A RULE SET. `ruleSetFor` falls back to the latest known one
  // for every other year and does NOT throw - so a dossier for 2019 is computed
  // with 2026's thresholds. The engine is honest about this: it emits a warning
  // naming the year it actually applied.
  //
  // That makes the honesty THIS module's obligation. If the warnings were
  // dropped here, a dossier for an old year would state a rate derived from
  // rules that did not exist then, with nothing on the page saying so - which
  // is the overclaim this product refuses everywhere else.

  it('warns when the requested year has no rules of its own', () => {
    const result = annualResult(USER, [day('2019-04-07', 'HOME')], 2019);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.warnings)).toContain('2026');
  });

  it('does NOT warn for a year that has its own rules', () => {
    // BOTH DIRECTIONS. A module that warned unconditionally would pass the
    // test above and tell every reader their dossier used the wrong rules.
    const result = annualResult(USER, [day('2026-04-07', 'HOME')], 2026);

    expect(result.warnings).toEqual([]);
  });

  it('carries them through the monthly path as well', () => {
    // The cumulative column calls the engine twelve more times. A dossier that
    // showed the annual warning but built its table from calls whose warnings
    // were discarded would be inconsistent with itself.
    const rows = monthlyBreakdown(USER, [day('2019-04-07', 'HOME')], 2019);

    expect(rows).toHaveLength(12);
    expect(rows[11]?.cumulativeDeclarableRate).toBe(
      annualResult(USER, [day('2019-04-07', 'HOME')], 2019).declarableRate,
    );
  });
});
