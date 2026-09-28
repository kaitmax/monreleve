// web/tests/unit/entries/late-fixture.test.ts
//
// AN5c increment 2 (R286/R206). The SERVER side of the ONE late threshold, bound to the Kotlin side by
// fixtures/late-threshold-cases.json. This READS that file and checks lib/entries/late.ts against it -
// late.ts is NOT edited (AN5c does not touch it); the fixture is bound to the server, never the other
// way round. The Kotlin LatenessConformanceTest reads the same file through LatenessForecast.
//
// TWO COPIES OF SEVEN IS R206's DEFECT: a `7` compiled into an APK and a `7` in late.ts are two homes
// for one rule, and the APK is the one that cannot be changed. Binding both to this fixture means a
// one-digit change to thresholdDays fails BOTH builds - the late-flag equivalent of R281.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LATE_BACKFILL_DAYS, isLate } from '@/lib/entries/late';

const FIXTURE = join(process.cwd(), '..', 'fixtures', 'late-threshold-cases.json');

interface LateCase {
  readonly id: string;
  readonly dayDate: string;
  readonly observedAt: string;
  readonly late: boolean;
}

const DATA = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  readonly thresholdDays: number;
  readonly cases: readonly LateCase[];
};

describe('late threshold fixture (R286): lib/entries/late.ts equals the shared fixture', () => {
  it('the server threshold is the fixture threshold (one home for the 7)', () => {
    expect(LATE_BACKFILL_DAYS).toBe(DATA.thresholdDays);
  });

  it('reads every published case, so the suite cannot pass vacuously', () => {
    expect(DATA.cases.map((c) => c.id)).toEqual([
      'same-day',
      'six-days',
      'exactly-seven-days',
      'one-ms-past-seven',
      'eighth-day',
    ]);
  });

  for (const testCase of DATA.cases) {
    it(`case ${testCase.id}: recorded ${testCase.observedAt} -> late=${testCase.late}`, () => {
      expect(isLate(new Date(testCase.dayDate), new Date(testCase.observedAt))).toBe(testCase.late);
    });
  }
});
