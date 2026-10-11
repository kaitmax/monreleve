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
import { calculateTelework, ruleSetFor } from '@/lib/calc-engine';
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
  it('records that the accord settles the proration and only the combined case stays a reading', () => {
    // The cap proration is now SETTLED by the accord 1(d); what remains
    // PROVISIONAL (Mon Releve's reading) is the combined part-time + partial
    // year case. The note must carry both, so neither reads as the whole truth.
    expect(fixture.missionCapNote).toContain('1(d)');
    expect(fixture.missionCapNote).toContain('PROVISIONAL');
    expect(fixture.missionCapNote).toContain('COMBINED');
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

describe('missionCapFor under exact - prorates by BOTH factors (accord 1d)', () => {
  // The change the accord makes. These three expectations were 10 under the old
  // PROVISIONAL R19 reading (prorate by period only under exact, on the
  // rationale that an employer-supplied total already embodies the rate). The
  // accord amiable FR-CH of 29 April 2026, clause 1(d), prorates the 10-day
  // LIMIT itself for a part-timer with NO condition on the denominator method,
  // so the exact method now prorates by employmentRate like the simplified one.
  // Operator ruling 2026-10-11.
  it('prorates by employmentRate, now that the accord settles the question', () => {
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 200 }, 50, 1, RULES)).toBe(5); // was 10
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 120 }, 45, 1, RULES)).toBe(5); // ceil(4.5), was 10
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 24 }, 1, 1, RULES)).toBe(1); // ceil(0.1), was 10
  });

  it('prorates by the period too', () => {
    // A mid-year start is a fact about the calendar, so an annual total for a
    // half year still gets half the cap - this never depended on the method.
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 100 }, 100, 0.5, RULES)).toBe(5);
  });

  it('prorates by BOTH factors when both bind - the combined case (see note below)', () => {
    // 1(d) names part-time and partial-year SEPARATELY; applying both factors at
    // once is Mon Releve's reading, carried on /sources and in the fixture note.
    // It matches what simplified240 already does when both bind.
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 100 }, 50, 0.5, RULES)).toBe(3); // ceil(2.5), was 5
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 120 }, 45, 7 / 12, RULES)).toBe(3); // ceil(2.625)
  });

  it('rounds up, as under the simplified basis', () => {
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 100 }, 100, 7 / 12, RULES)).toBe(6); // ceil(5.833)
  });

  it('agrees with simplified240 everywhere now, not only at full time', () => {
    // The two readings used to diverge for a part-timer; after the accord they
    // agree on every input, which is the whole point of the correction.
    for (const [rate, period] of [
      [100, 1],
      [50, 1],
      [80, 1],
      [45, 7 / 12],
      [1, 1],
    ] as const) {
      expect(missionCapFor({ kind: 'exact', totalWorkDays: 240 }, rate, period, RULES)).toBe(
        missionCapFor({ kind: 'simplified240' }, rate, period, RULES),
      );
    }
  });
});

describe('the accord amiable FR-CH of 29 April 2026, clause 1(d)', () => {
  // 1(d): "pour les salaries qui exercent leur activite pendant une periode
  // inferieure a l'annee civile et ceux qui exercent un emploi a temps partiel
  // pendant l'annee entiere, la limite annuelle de 10 jours est ajustee
  // proportionnellement et arrondie a l'unite superieure." It adjusts the
  // 10-day LIMIT itself and sets NO condition on how the working days are
  // counted, so the exact method must prorate the cap by employmentRate too.
  // Operator ruling 2026-10-11: drop the exact-method FULL_RATE carve-out.
  it('prorates the cap by employmentRate under the exact method: 80% gives 8', () => {
    expect(missionCapFor({ kind: 'exact', totalWorkDays: 192 }, 80, 1, RULES)).toBe(8);
  });

  it('flows through calculateTelework: an 80% exact part-timer credits 8 mission days, not 10', () => {
    const result = calculateTelework({
      taxYear: 2026,
      canton: 'GE',
      employmentRate: 80,
      periodFraction: 1,
      denominator: { kind: 'exact', totalWorkDays: 192 },
      granularity: 'day',
      teleworkDays: 0,
      missionDaysFrance: 12,
      missionDaysThirdState: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.missionCap).toBe(8); // ceil(10 * 0.80)
    expect(result.value.creditedMissionDays).toBe(8); // 12 France missions, capped at 8
  });
});
