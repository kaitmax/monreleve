// web/tests/unit/calc-engine/fixtures.test.ts
//
// The Geneva conformance suite. SPEC 7.5: "If any fails, nothing ships."
//
// This test READS fixtures/geneva-cases.json and fixtures/denominator-cases.json
// from the repository root. It never copies their contents into TypeScript,
// because the same two files are consumed by the Kotlin engine at AN2 and a
// divergence on any case must fail both builds (D20). A TypeScript transcript
// of the expected values would let the two drift apart silently.
//
// No snapshots here, ever (SPEC 7.6): a snapshot records what the code did,
// not what the rule requires, and would bless a wrong reading of the 40 % rule
// and then defend it against correction.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import { resolveDenominator } from '@/lib/calc-engine/denominator';
import { ruleSetFor } from '@/lib/calc-engine';
import type { Canton, DenominatorMethod, Granularity, TeleworkInput } from '@/lib/calc-engine';

const FIXTURE_DIR = join(process.cwd(), '..', 'fixtures');

interface GenevaFixture {
  readonly commonInput: {
    readonly taxYear: number;
    readonly canton: Canton;
    readonly employmentRate: number;
    readonly periodFraction: number;
    readonly denominator: DenominatorMethod;
    readonly granularity: Granularity;
  };
  readonly cases: readonly {
    readonly id: string;
    readonly note: string;
    readonly input: {
      readonly teleworkDays: number;
      readonly missionDaysFrance: number;
      readonly missionDaysThirdState: number;
    };
    readonly expected: {
      readonly swissTaxedDays: number;
      readonly frenchTaxedDays: number;
      readonly declarableRate: number;
      readonly regimeApplies: boolean;
    };
  }[];
}

interface DenominatorFixture {
  readonly cases: readonly {
    readonly id: string;
    readonly simplifiedBasisDays: number;
    readonly employmentRate: number;
    readonly periodFractionRatio: readonly [number, number];
    readonly expectedTotalWorkDays: number;
  }[];
}

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as T;

const geneva = readFixture<GenevaFixture>('geneva-cases.json');
const denominators = readFixture<DenominatorFixture>('denominator-cases.json');

describe('Geneva conformance suite (SPEC 7.5)', () => {
  it('reads all six published cases, so the suite cannot pass vacuously', () => {
    expect(geneva.cases).toHaveLength(6);
    expect(geneva.cases.map((testCase) => testCase.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'special',
    ]);
  });

  for (const testCase of geneva.cases) {
    describe(`case ${testCase.id}`, () => {
      const input: TeleworkInput = { ...geneva.commonInput, ...testCase.input };

      it(`produces the published result: ${testCase.note.slice(0, 60)}...`, () => {
        const result = calculateTelework(input);

        // Asserted first and separately: an engine that cannot produce a
        // result at all should say so plainly rather than fail four field
        // comparisons with confusing messages.
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.declarableRate).toBe(testCase.expected.declarableRate);
        expect(result.value.swissTaxedDays).toBe(testCase.expected.swissTaxedDays);
        expect(result.value.frenchTaxedDays).toBe(testCase.expected.frenchTaxedDays);
        expect(result.value.regimeApplies).toBe(testCase.expected.regimeApplies);
      });

      it('accounts for every working day', () => {
        // Invariant 1 of SPEC 7.6, checked on the published cases: no day is
        // taxed twice and none goes missing.
        const result = calculateTelework(input);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.swissTaxedDays + result.value.frenchTaxedDays).toBe(
          result.value.totalWorkDays,
        );
      });
    });
  }
});

describe('denominator conformance suite (ruling R10)', () => {
  it('reads every case, so the suite cannot pass vacuously', () => {
    expect(denominators.cases.length).toBeGreaterThanOrEqual(5);
  });

  for (const testCase of denominators.cases) {
    it(`${testCase.id} gives ${testCase.expectedTotalWorkDays} days`, () => {
      const [numerator, divisor] = testCase.periodFractionRatio;

      // The ratio is divided here, never transcribed as a decimal: 7/12
      // written out parses to a different double and would not reproduce the
      // defect this fixture exists to pin.
      const outcome = resolveDenominator(
        { kind: 'simplified240' },
        testCase.employmentRate,
        numerator / divisor,
        ruleSetFor(2026),
      );

      expect(outcome.totalWorkDays).toBe(testCase.expectedTotalWorkDays);
    });
  }

  it('uses the basis the fixture states, so a drift in RuleSet is caught', () => {
    for (const testCase of denominators.cases) {
      expect(testCase.simplifiedBasisDays).toBe(ruleSetFor(2026).simplifiedBasisDays);
    }
  });
});
