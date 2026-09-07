// web/tests/unit/calc-engine/arbitraries.ts
//
// Generators for the property suites. Not a test file - no assertions here.
//
// The design goal is that a generated input is VALID BY CONSTRUCTION, because
// calculateTelework returns errors for invalid input and an invariant about
// the result cannot be asserted on an error. Building valid inputs directly
// beats generating freely and discarding, which would spend most of the 10 000
// runs on inputs the engine refuses.
//
// AC1 requires the generators to cover part-time, mid-year periods, the exact
// method and all three granularities. Each is a dimension below.

import fc from 'fast-check';
import { ruleSetFor } from '@/lib/calc-engine';
import { resolveDenominator } from '@/lib/calc-engine/denominator';
import type { Canton, Granularity, TeleworkInput } from '@/lib/calc-engine';

export const RULES = ruleSetFor(2026);

const ALL_CANTONS: readonly Canton[] = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR',
  'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG',
  'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
];

/**
 * The smallest day increment a granularity permits. Every value is a binary
 * fraction, so the arithmetic below is exact and a generated input can never
 * fail DAYS_EXCEED_TOTAL through representation error alone.
 *
 * 'hours' uses a quarter day rather than a tenth for that reason: 0.1 is not
 * representable, and a sum of tenths can exceed the total by 1e-13 and be
 * rejected for a reason that has nothing to do with the property under test.
 */
function stepFor(granularity: Granularity): number {
  switch (granularity) {
    case 'day':
      return 1;
    case 'halfDay':
      return 0.5;
    case 'hours':
      return 0.25;
  }
}

/** Splits a whole number of steps into three parts that cannot exceed it. */
function splitSteps(
  maxSteps: number,
  weights: readonly [number, number, number],
): readonly [number, number, number] {
  const bounded = weights.map((weight) => weight % (maxSteps + 1)) as [number, number, number];
  const sum = bounded[0] + bounded[1] + bounded[2];

  if (sum <= maxSteps) return bounded;

  // Scale down and floor: the sum of floors of a partition can only shrink.
  return [
    Math.floor((bounded[0] * maxSteps) / sum),
    Math.floor((bounded[1] * maxSteps) / sum),
    Math.floor((bounded[2] * maxSteps) / sum),
  ];
}

export const validInputArb: fc.Arbitrary<TeleworkInput> = fc
  .record({
    canton: fc.constantFrom(...ALL_CANTONS),
    granularity: fc.constantFrom<Granularity>('day', 'halfDay', 'hours'),
    // Part-time across the whole legal range, 1 % to 100 %.
    employmentRate: fc.integer({ min: 1, max: 100 }),
    // Mid-year starts as twelfths, which is how a real period arrives, plus
    // the full year at 12/12.
    periodMonths: fc.integer({ min: 1, max: 12 }),
    useExactMethod: fc.boolean(),
    // An employer-supplied total, including the 125-multiples that expose the
    // rate float defect.
    exactTotal: fc.oneof(
      fc.integer({ min: 1, max: 400 }),
      fc.constantFrom(125, 250, 375, 500),
    ),
    // Both a known rule set and an unknown one, so the fallback path is
    // exercised too (ruling R11).
    taxYear: fc.constantFrom(2026, 2027),
    weights: fc.tuple(fc.nat({ max: 2000 }), fc.nat({ max: 2000 }), fc.nat({ max: 2000 })),
  })
  .map((seed): TeleworkInput => {
    const periodFraction = seed.periodMonths / 12;
    const denominator = seed.useExactMethod
      ? ({ kind: 'exact', totalWorkDays: seed.exactTotal } as const)
      : ({ kind: 'simplified240' } as const);

    const { totalWorkDays } = resolveDenominator(
      denominator,
      seed.employmentRate,
      periodFraction,
      RULES,
    );

    const step = stepFor(seed.granularity);
    const maxSteps = Math.floor(totalWorkDays / step);
    const [telework, france, thirdState] = splitSteps(maxSteps, seed.weights);

    return {
      taxYear: seed.taxYear,
      canton: seed.canton,
      employmentRate: seed.employmentRate,
      periodFraction,
      denominator,
      granularity: seed.granularity,
      teleworkDays: telework * step,
      missionDaysFrance: france * step,
      missionDaysThirdState: thirdState * step,
    };
  });

/**
 * The blocking path: 10 000 cases at a FIXED seed (ruling R24).
 *
 * Reproducibility is the point. A rotating seed on a blocking check goes red
 * at 3 a.m. on a case nobody can reproduce, which trains people to re-run
 * rather than read. The rotating sweep lives in its own weekly workflow,
 * reports, and never blocks; anything it falsifies is promoted to a fixed
 * regression test in the next task.
 *
 * Both values are overridable by environment variable so that one suite
 * serves both paths - there is no second copy of the properties to drift.
 */
const FIXED_SEED = 20260907;
const FIXED_RUNS = 10_000;

function fromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);

  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export const PROPERTY_RUNS = fromEnv('PROPERTY_RUNS', FIXED_RUNS);
export const PROPERTY_SEED = fromEnv('PROPERTY_SEED', FIXED_SEED);
export const IS_ROTATING_SWEEP =
  PROPERTY_SEED !== FIXED_SEED || PROPERTY_RUNS !== FIXED_RUNS;

export const RUN_CONFIG = { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED } as const;

/**
 * Fewer runs, for the deliberately-broken variants that must be falsified.
 * Deliberately NOT scaled by the sweep: these must fail fast, and running a
 * known-broken variant 100 000 times proves nothing the first failure did not.
 */
export const FALSIFY_CONFIG = { numRuns: 2_000, seed: FIXED_SEED } as const;
