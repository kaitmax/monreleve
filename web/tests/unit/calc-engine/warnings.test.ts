// web/tests/unit/calc-engine/warnings.test.ts
//
// SPEC 7.4's Warning union, plus RULE_SET_FALLBACK from ruling R11. Eight
// codes. A warning is not an error: the result is still computed and returned.

import { describe, expect, it } from 'vitest';
import { warningsFor } from '@/lib/calc-engine/warnings';
import { ruleSetFor } from '@/lib/calc-engine';
import type { Warning } from '@/lib/calc-engine';

const RULES = ruleSetFor(2026);

const codes = (warnings: readonly Warning[]) => warnings.map((warning) => warning.code);

/** Geneva shape: 240 days, a 96-day ceiling, a 10-day mission cap. */
const at = (overrides: {
  regime?: 'source' | 'residence-1983';
  regimeApplies?: boolean;
  daysCountedAgainstCeiling?: number;
  headroomDays?: number;
  missionDaysTotal?: number;
  missionCap?: number;
  totalWorkDays?: number;
  requestedTaxYear?: number;
  denominatorWarnings?: readonly Warning[];
}) =>
  warningsFor(
    {
      regime: overrides.regime ?? 'source',
      regimeApplies: overrides.regimeApplies ?? true,
      daysCountedAgainstCeiling: overrides.daysCountedAgainstCeiling ?? 72,
      headroomDays: overrides.headroomDays ?? 24,
      missionDaysTotal: overrides.missionDaysTotal ?? 0,
      missionCap: overrides.missionCap ?? 10,
      totalWorkDays: overrides.totalWorkDays ?? 240,
      requestedTaxYear: overrides.requestedTaxYear ?? 2026,
      denominatorWarnings: overrides.denominatorWarnings ?? [],
    },
    RULES,
  );

describe('warningsFor - the fiscal ceiling', () => {
  it('warns when the regime is lost, and carries the regime', () => {
    const warnings = at({ regimeApplies: false, daysCountedAgainstCeiling: 144 });
    const fiscal = warnings.find((warning) => warning.code === 'FISCAL_CEILING_EXCEEDED');

    expect(fiscal).toBeDefined();
    expect(fiscal && 'regime' in fiscal ? fiscal.regime : null).toBe('source');
  });

  it('stays quiet while the regime applies', () => {
    expect(codes(at({}))).not.toContain('FISCAL_CEILING_EXCEEDED');
  });
});

describe('warningsFor - FRONTALIER_STATUS_AT_RISK is residence-1983 only', () => {
  it('fires for a 1983 canton that has lost the regime', () => {
    const warnings = at({
      regime: 'residence-1983',
      regimeApplies: false,
      daysCountedAgainstCeiling: 144,
    });

    expect(codes(warnings)).toContain('FRONTALIER_STATUS_AT_RISK');
  });

  it('does NOT fire for a source canton that has lost the regime', () => {
    // Under 'source' the consequence is French tax on the excess days. The
    // status itself is only at risk under the 1983 accord, and telling a
    // Geneva frontalier their status is at risk would be false.
    const warnings = at({ regimeApplies: false, daysCountedAgainstCeiling: 144 });

    expect(codes(warnings)).not.toContain('FRONTALIER_STATUS_AT_RISK');
  });

  it('does NOT fire for a 1983 canton inside the ceiling', () => {
    const warnings = at({ regime: 'residence-1983' });

    expect(codes(warnings)).not.toContain('FRONTALIER_STATUS_AT_RISK');
  });
});

describe('warningsFor - the mission cap and headroom', () => {
  it('reports the cap and the excess when missions exceed the cap', () => {
    const warnings = at({ missionDaysTotal: 24, headroomDays: 12 });
    const cap = warnings.find((warning) => warning.code === 'MISSION_CAP_EXCEEDED');

    expect(cap).toBeDefined();
    expect(cap && 'cap' in cap ? cap.cap : null).toBe(10);
    expect(cap && 'excess' in cap ? cap.excess : null).toBe(14); // 24 - 10
  });

  it('reports the excess when headroom, not the cap, is the constraint', () => {
    // Geneva case d: 2 days of room against a 10-day cap and 12 mission days.
    const warnings = at({ missionDaysTotal: 12, headroomDays: 2 });
    const headroom = warnings.find((warning) => warning.code === 'MISSIONS_EXCEED_HEADROOM');

    expect(headroom).toBeDefined();
    expect(headroom && 'excess' in headroom ? headroom.excess : null).toBe(10); // 12 - 2
  });

  it('reports both when both bind', () => {
    // 12 missions, cap 10, headroom 2: over the cap by 2 and over the room
    // by 10. They are different facts and a user needs both.
    expect(codes(at({ missionDaysTotal: 12, headroomDays: 2 }))).toEqual(
      expect.arrayContaining(['MISSION_CAP_EXCEEDED', 'MISSIONS_EXCEED_HEADROOM']),
    );
  });

  it('stays quiet when every mission day is credited', () => {
    const warnings = codes(at({ missionDaysTotal: 3, headroomDays: 24 }));

    expect(warnings).not.toContain('MISSION_CAP_EXCEEDED');
    expect(warnings).not.toContain('MISSIONS_EXCEED_HEADROOM');
  });

  it('does not report a headroom excess once the regime is already lost', () => {
    // There is no headroom to exceed: the ceiling is already breached and
    // FISCAL_CEILING_EXCEEDED is the fact that matters.
    const warnings = codes(
      at({ regimeApplies: false, daysCountedAgainstCeiling: 144, missionDaysTotal: 5 }),
    );

    expect(warnings).not.toContain('MISSIONS_EXCEED_HEADROOM');
  });
});

describe('warningsFor - the social ceiling', () => {
  it('fires above 49.9 % of the denominator', () => {
    // 120 of 240 is 50 %, past 119.76.
    expect(codes(at({ daysCountedAgainstCeiling: 120, regimeApplies: false }))).toContain(
      'SOCIAL_CEILING_EXCEEDED',
    );
  });

  it('stays quiet just below', () => {
    expect(codes(at({ daysCountedAgainstCeiling: 119, regimeApplies: false }))).not.toContain(
      'SOCIAL_CEILING_EXCEEDED',
    );
  });
});

describe('warningsFor - pass-through and fallback', () => {
  it('passes the denominator warnings through', () => {
    const warnings = at({ denominatorWarnings: [{ code: 'EXACT_METHOD_UNVERIFIED' }] });

    expect(codes(warnings)).toContain('EXACT_METHOD_UNVERIFIED');
  });

  it('emits RULE_SET_FALLBACK with both years when they differ (R11)', () => {
    const warnings = at({ requestedTaxYear: 2027 });
    const fallback = warnings.find((warning) => warning.code === 'RULE_SET_FALLBACK');

    expect(fallback).toBeDefined();
    expect(fallback && 'requestedYear' in fallback ? fallback.requestedYear : null).toBe(2027);
    expect(fallback && 'appliedYear' in fallback ? fallback.appliedYear : null).toBe(2026);
  });

  it('stays quiet when the requested year has its own rule set', () => {
    expect(codes(at({ requestedTaxYear: 2026 }))).not.toContain('RULE_SET_FALLBACK');
  });
});

describe('warningsFor - A1_REQUIRED', () => {
  it('fires whenever any day is counted against the ceiling', () => {
    expect(codes(at({ daysCountedAgainstCeiling: 1 }))).toContain('A1_REQUIRED');
  });

  it('stays quiet when nothing is counted', () => {
    expect(codes(at({ daysCountedAgainstCeiling: 0 }))).not.toContain('A1_REQUIRED');
  });
});
