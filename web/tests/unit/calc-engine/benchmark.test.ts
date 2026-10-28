// web/tests/unit/calc-engine/benchmark.test.ts
//
// tasks/todo.md FW5: "Median calculateTelework execution < 0.1 ms
// (micro-benchmark recorded)."
//
// It MEASURES and REPORTS; it does not assert a duration. A timing assertion
// in a unit suite is a flake waiting for a busy CI runner, and the prompt is
// explicit that the budget is informational at this stage - if it is exceeded,
// report it rather than optimise. What is asserted is only that the
// measurement ran and the engine returned results, so the number in the
// report cannot be stale or fabricated.

import { describe, expect, it } from 'vitest';
import { calculateTelework } from '@/lib/calc-engine';
import type { TeleworkInput } from '@/lib/calc-engine';

const BASE: TeleworkInput = {
  taxYear: 2026,
  canton: 'GE',
  employmentRate: 100,
  periodFraction: 1,
  denominator: { kind: 'simplified240' },
  granularity: 'day',
  teleworkDays: 84,
  missionDaysFrance: 24,
  missionDaysThirdState: 0,
};

/**
 * A representative set rather than one input: the branches differ in cost.
 * The regime-lost branch skips the imputation, the exact method skips the
 * proration, and an invalid input returns before any arithmetic - so timing
 * only the happy path would flatter the median.
 */
const INPUTS: readonly TeleworkInput[] = [
  BASE,
  { ...BASE, teleworkDays: 144, missionDaysFrance: 5 }, // regime lost
  { ...BASE, teleworkDays: 91, missionDaysFrance: 8 }, // headroom binds
  { ...BASE, teleworkDays: 0, missionDaysFrance: 30 }, // missions only
  { ...BASE, denominator: { kind: 'exact', totalWorkDays: 217 } }, // exact method
  { ...BASE, employmentRate: 45, periodFraction: 7 / 12, teleworkDays: 20, missionDaysFrance: 8 },
  { ...BASE, granularity: 'halfDay', teleworkDays: 84.5, missionDaysFrance: 12.5 },
  { ...BASE, canton: 'JU', teleworkDays: 144 }, // 1983 canton, regime lost
  { ...BASE, taxYear: 2027 }, // rule-set fallback
  { ...BASE, employmentRate: 0 }, // invalid: returns before the arithmetic
];

const ITERATIONS = 2_000;

function medianMs(): { median: number; p95: number; mean: number; samples: number } {
  const durations: number[] = [];

  // One warm-up pass, so the first-call JIT cost is not one of the samples.
  for (const input of INPUTS) calculateTelework(input);

  for (let run = 0; run < ITERATIONS; run += 1) {
    const input = INPUTS[run % INPUTS.length];
    if (input === undefined) continue;

    const start = performance.now();
    calculateTelework(input);
    durations.push(performance.now() - start);
  }

  durations.sort((a, b) => a - b);
  const at = (fraction: number) =>
    durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))] ?? 0;

  return {
    median: at(0.5),
    p95: at(0.95),
    mean: durations.reduce((total, value) => total + value, 0) / durations.length,
    samples: durations.length,
  };
}

describe('calculateTelework micro-benchmark', () => {
  it('measures and reports the median, without asserting a duration', () => {
    const { median, p95, mean, samples } = medianMs();

    console.log(
      `\n  calculateTelework over ${samples} calls across ${INPUTS.length} representative inputs:\n` +
        `    median ${median.toFixed(5)} ms\n` +
        `    mean   ${mean.toFixed(5)} ms\n` +
        `    p95    ${p95.toFixed(5)} ms\n` +
        `    budget 0.1 ms (informational at this stage)\n`,
    );

    expect(samples).toBe(ITERATIONS);
    expect(Number.isFinite(median)).toBe(true);
  });

  it('returns a usable result for every representative input except the invalid one', () => {
    const outcomes = INPUTS.map((input) => calculateTelework(input).ok);

    expect(outcomes.filter(Boolean)).toHaveLength(INPUTS.length - 1);
    expect(outcomes.at(-1)).toBe(false);
  });
});
