// web/tests/unit/calc-engine/mission-cap.test.ts
//
// Ruling R19, PROVISIONAL. The 10-day mission sub-cap prorates for part-time
// and partial years, rounded up (SPEC 7.2 step 4). What the sources do not
// say is how it prorates when the employer supplies an EXACT annual total.
//
// The interim interpretation: an exact total already embodies the working-time
// rate - it is the actual number of days worked - so prorating the cap by
// employmentRate as well would count the same reduction twice. Under 'exact'
// the cap therefore prorates by periodFraction ONLY; under 'simplified240' it
// prorates by both, because the 240-day basis is a full-time figure that has
// not yet been reduced.
//
// This is an interpretation, not a source. It goes to the reviewer at
// Checkpoint A, EXACT_METHOD_UNVERIFIED already fires on this path, and the
// site carries a PROVISIONAL marker.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { missionCapFor } from '@/lib/calc-engine/denominator';
import { ruleSetFor } from '@/lib/calc-engine';
import type { DenominatorMethod } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);

interface CapFixture {
  readonly missionCapNote: string;
  readonly missionCapCases: readonly {
    readonly id: string;
    readonly denominatorKind: 'simplified240' | 'exact';
    readonly suppliedTotalWorkDays?: number;
    readonly employmentRate: number;
    readonly periodFractionRatio: readonly [number, number];
    readonly expectedMissionCap: number;
    readonly note: string;
  }[];
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'fixtures', 'denominator-cases.json'), 'utf8'),
) as CapFixture;

describe('mission cap conformance suite (ruling R19, shared)', () => {
  it('records that the interpretation is provisional', () => {
    expect(fixture.missionCapNote).toContain('PROVISIONAL');
  });

  for (const testCase of fixture.missionCapCases) {
    it(`${testCase.id} gives ${testCase.expectedMissionCap}`, () => {
      const [numerator, divisor] = testCase.periodFractionRatio;
      const method: DenominatorMethod =
        testCase.denominatorKind === 'exact'
          ? { kind: 'exact', totalWorkDays: testCase.suppliedTotalWorkDays ?? 0 }
          : { kind: 'simplified240' };

      expect(missionCapFor(method, testCase.employmentRate, numerator / divisor, RULES)).toBe(
        testCase.expectedMissionCap,
      );
    });
  }
});

describe('missionCapFor under simplified240 - prorates by BOTH factors', () => {
  it.each([
    [1, 1, 1], // ceil(10 * 0.01) = 1
    [50, 1, 5],
    [80, 1, 8],
    [100, 1, 10],
    [45, 1, 5], // ceil(4.5), rounds up
  ])('rate %i over period %f gives %i', (employmentRate, periodFraction, expected) => {
    expect(
      missionCapFor({ kind: 'simplified240' }, employmentRate, periodFraction, RULES),
    ).toBe(expected);
  });

  it('prorates by the period as well', () => {
    expect(missionCapFor({ kind: 'simplified240' }, 100, 0.5, RULES)).toBe(5);
    expect(missionCapFor({ kind: 'simplified240' }, 45, 7 / 12, RULES)).toBe(3); // ceil(2.625)
  });
});

describe('missionCapFor under exact - prorates by the PERIOD ONLY (R19)', () => {
  it('ignores employmentRate, because the supplied total already reflects it', () => {
    // The change R19 makes. Before the ruling this returned 5, double-counting
    // the part-time reduction that the employer's own 200-day total already
    // embodies.
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 200 }, 50, 1, RULES)).toBe(10);
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 120 }, 45, 1, RULES)).toBe(10);
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 24 }, 1, 1, RULES)).toBe(10);
  });

  it('still prorates by the period, which the total does not embody', () => {
    // A mid-year start is a fact about the calendar, not about the working
    // rate, so an annual total for a half year still gets half the cap.
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 100 }, 100, 0.5, RULES)).toBe(5);
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 100 }, 50, 0.5, RULES)).toBe(5);
  });

  it('rounds up, as under the simplified basis', () => {
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 100 }, 100, 7 / 12, RULES)).toBe(6); // ceil(5.833)
  });

  it('agrees with simplified240 at full time and full year', () => {
    // The two readings only diverge for a part-timer, which is why this went
    // unnoticed until the interpretation was put in writing.
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 240 }, 100, 1, RULES)).toBe(
      missionCapFor({ kind: 'simplified240' }, 100, 1, RULES),
    );
  });
});
