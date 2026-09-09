// web/tests/unit/content/provisional.test.ts
//
// RULING R110: the provisional notice is INPUT-SPECIFIC, never global.
//
// WHY THAT DISTINCTION IS THE WHOLE RULING. docs/regulatory-sources.md carries
// three readings that are still awaiting expert review, and the calculator is
// indexed. A banner on every calculation would be true and useless: most users
// never touch any of the three, and a caveat that is always on screen is read
// as boilerplate within a week. One that appears exactly when the user's own
// numbers depend on a pending reading is information.
//
// THE TWO TRIGGERS R110 NAMES, verbatim:
//
//   P1  missionDaysFrance > 0 AND missionDaysThirdState > 0
//       The order in which mission days are imputed - France before third
//       state - decides how much of the cap each consumes. With days in only
//       one place the order cannot matter, which is why BOTH must be positive.
//
//   P3  denominator.kind = 'exact' AND (employmentRate < 100 OR
//       periodFraction < 1)
//       Whether the mission cap is prorated under the exact method, and by
//       which factors. With a full-time full-year contract there is nothing to
//       prorate, so the reading cannot change the answer.
//
// P2 HAS NO TRIGGER and that is deliberate on R110's part: the 49,9 versus
// under-50 edge under two-decimal truncation is a property of the threshold
// band rather than of an input combination. It is published on /sources
// instead - which is FW20's route and does not exist yet, carried as a
// question rather than built here.

import { describe, expect, it } from 'vitest';
import type { TeleworkInput } from '@/lib/calc-engine';
import { PROVISIONAL_IDS, provisionalFor } from '@/lib/content/provisional';

/** A full-time, full-year, simplified-basis input: the common path. */
const BASE: TeleworkInput = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'halfDay',
  teleworkDays: 84,
  missionDaysFrance: 0,
  missionDaysThirdState: 0,
};

describe('the common path touches nothing provisional', () => {
  it('is silent for a full-time year on the simplified basis', () => {
    expect(provisionalFor(BASE)).toEqual([]);
  });

  it('is silent for Geneva case (c), which has missions in ONE place only', () => {
    // The fixture the whole engine is verified against: 24 mission days in
    // France, none in a third state. The imputation ORDER cannot matter when
    // there is only one place to impute from, so P1 must not fire on the
    // product's own reference case.
    expect(provisionalFor({ ...BASE, missionDaysFrance: 24 })).toEqual([]);
  });

  it('is silent for part time on the SIMPLIFIED basis', () => {
    // P3 is about the exact method. Proration under the simplified basis is
    // not one of the three pending readings.
    expect(provisionalFor({ ...BASE, employmentRate: 60 })).toEqual([]);
  });
});

describe('P1 - the imputation order', () => {
  it('fires when mission days exist in both places', () => {
    expect(
      provisionalFor({ ...BASE, missionDaysFrance: 6, missionDaysThirdState: 4 }),
    ).toContain('P1');
  });

  it('does not fire on third-state days alone', () => {
    expect(provisionalFor({ ...BASE, missionDaysThirdState: 4 })).toEqual([]);
  });

  it('does not fire when one of the two is zero', () => {
    // Both halves of the boundary, because "> 0 AND > 0" is exactly the kind
    // of condition that gets written as an OR by accident.
    expect(provisionalFor({ ...BASE, missionDaysFrance: 6, missionDaysThirdState: 0 })).toEqual(
      [],
    );
    expect(provisionalFor({ ...BASE, missionDaysFrance: 0, missionDaysThirdState: 4 })).toEqual(
      [],
    );
  });

  it('fires on a half day in each, not only on whole days', () => {
    expect(
      provisionalFor({ ...BASE, missionDaysFrance: 0.5, missionDaysThirdState: 0.5 }),
    ).toContain('P1');
  });
});

describe('P3 - the exact method cap proration', () => {
  const EXACT: TeleworkInput = {
    ...BASE,
    denominator: { kind: 'exact', totalWorkDays: 220 },
  };

  it('fires for the exact method at part time', () => {
    expect(provisionalFor({ ...EXACT, employmentRate: 80 })).toContain('P3');
  });

  it('fires for the exact method on an incomplete year', () => {
    expect(provisionalFor({ ...EXACT, periodFraction: 0.5 })).toContain('P3');
  });

  it('does not fire for the exact method at full time over a full year', () => {
    // Nothing to prorate, so the pending reading cannot change the answer.
    expect(provisionalFor(EXACT)).toEqual([]);
  });

  it('does not fire at part time under the simplified basis', () => {
    expect(provisionalFor({ ...BASE, employmentRate: 80 })).toEqual([]);
  });
});

describe('both at once', () => {
  it('reports each independently, in a stable order', () => {
    const both = provisionalFor({
      ...BASE,
      denominator: { kind: 'exact', totalWorkDays: 220 },
      employmentRate: 80,
      missionDaysFrance: 6,
      missionDaysThirdState: 4,
    });

    expect(both).toEqual(['P1', 'P3']);
  });
});

describe('the id list', () => {
  it('names exactly the ids that have a trigger', () => {
    // Non-vacuity for every loop above, and the place a fourth pending
    // reading would have to be added deliberately.
    expect([...PROVISIONAL_IDS]).toEqual(['P1', 'P3']);
  });
});
