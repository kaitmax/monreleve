// web/tests/unit/calc-engine/rate-fixtures.test.ts
//
// Ruling R16. The declarable rate is computed on the integral numerator and
// denominator, never on a pre-computed percentage, because truncation rounds
// toward zero: the error is biased downward and never cancels, on the number
// filed with the AFC.
//
// The cases are READ from fixtures/rate-cases.json, never transcribed, because
// the Kotlin engine at AN2 consumes the same file and a divergence must fail
// both builds.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarableRateFor } from '@/lib/calc-engine/declarable-rate';

const FIXTURE = join(process.cwd(), '..', 'fixtures', 'rate-cases.json');

interface RateFixture {
  readonly contract: string;
  readonly caseCount: number;
  readonly cases: readonly {
    readonly id: string;
    readonly numerator: number;
    readonly denominator: number;
    readonly expectedDeclarableRate: number;
    readonly floatFormWouldGive: number;
    readonly why: string;
  }[];
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as RateFixture;

/**
 * THE ANTI-EXAMPLES. Kept deliberately, as the prompt permits, so the RED run
 * is reproducible and so a future reader can see exactly what shapes of code
 * this fixture exists to forbid. Neither is ever called by shipped code.
 *
 * The lesson is that NO float form is safe, not that one of them is. Measured
 * over every numerator against every denominator up to 500 (125 750 pairs):
 *
 *   multiply-first  wrong in  72   the better attempt - it is what R10's
 *                                  hygiene rule prescribes for the proration,
 *                                  and it is still wrong here
 *   divide-first    wrong in 172   the more natural way to write it
 *   either one      wrong in 201
 *
 * fixtures/rate-cases.json records the multiply-first value, because a
 * fixture should pin the best wrong answer rather than the worst.
 */
function declarableRateViaFloatMultiplyFirst(numerator: number, denominator: number): number {
  const percentage = (numerator * 100) / denominator;

  return Math.trunc(percentage * 100) / 100;
}

function declarableRateViaFloatDivideFirst(numerator: number, denominator: number): number {
  const percentage = (numerator / denominator) * 100;

  return Math.trunc(percentage * 100) / 100;
}

describe('rate conformance suite (ruling R16)', () => {
  it('reads every case, so the suite cannot pass vacuously', () => {
    expect(fixture.cases).toHaveLength(fixture.caseCount);
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it('states the shared contract with the Kotlin engine', () => {
    expect(fixture.contract).toContain('Kotlin');
  });

  for (const testCase of fixture.cases) {
    it(`${testCase.id}: ${testCase.numerator}/${testCase.denominator} is ${testCase.expectedDeclarableRate}`, () => {
      expect(declarableRateFor(testCase.numerator, testCase.denominator)).toBe(
        testCase.expectedDeclarableRate,
      );
    });
  }
});

describe('the float forms these cases exist to forbid', () => {
  it('the multiply-first form gets every single case wrong', () => {
    // This is the RED, made permanent. If this test ever passes, either the
    // fixture has been emptied or floating point has changed.
    for (const testCase of fixture.cases) {
      const got = declarableRateViaFloatMultiplyFirst(testCase.numerator, testCase.denominator);

      expect(got).toBe(testCase.floatFormWouldGive);
      expect(got).not.toBe(testCase.expectedDeclarableRate);
    }
  });

  it('the divide-first form is wrong on a different and larger set', () => {
    // Recorded so nobody concludes the fix is "multiply before dividing".
    // That rule is right for the proration and insufficient here.
    const divideFirstFailures = fixture.cases.filter(
      (testCase) =>
        declarableRateViaFloatDivideFirst(testCase.numerator, testCase.denominator) !==
        testCase.expectedDeclarableRate,
    );

    expect(divideFirstFailures.length).toBeGreaterThan(0);
  });

  it('understates rather than overstates, every time', () => {
    // The direction is what makes this dangerous rather than merely wrong: a
    // rate filed 0.01 too low is an understatement to a tax authority.
    for (const testCase of fixture.cases) {
      expect(testCase.floatFormWouldGive).toBeLessThan(testCase.expectedDeclarableRate);
    }
  });

  it('is wrong by exactly one hundredth in every case', () => {
    for (const testCase of fixture.cases) {
      const gap = testCase.expectedDeclarableRate - testCase.floatFormWouldGive;

      expect(gap).toBeCloseTo(0.01, 10);
    }
  });
});
