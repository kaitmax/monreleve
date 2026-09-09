// web/tests/unit/calc-engine/warnings.test.ts
//
// SPEC 7.4's Warning union, plus RULE_SET_FALLBACK from ruling R11. Eight
// codes. A warning is not an error: the result is still computed and returned.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  teleworkDays?: number;
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
      // Defaulted to the same 72 as the ceiling count, which is 30 % of the
      // 240-day default and therefore inside the framework agreement's band.
      // That keeps A1_REQUIRED firing for every case that does not care about
      // it, exactly as it did under the old standing-obligation trigger.
      teleworkDays: overrides.teleworkDays ?? 72,
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

describe('warningsFor - A1_REQUIRED, at the 25 % threshold', () => {
  // CHECKPOINT A REPLACED THIS TRIGGER, and the old one was a reading rather
  // than a rule. It fired whenever ANY day was counted against the ceiling -
  // a standing obligation the product stated rather than a threshold it
  // detected - because SPEC 7.1 said only that the social ceiling is
  // "conditional on a valid A1" and named no condition. REPORT-FW4.txt raised
  // it; R18 carried it as a standing obligation; the verification pass of
  // 09.09.2026 answered it from the source.
  //
  // THE RULE: the EU framework agreement on cross-border telework applies
  // from 25 % telework in the state of residence up to (but not including)
  // 50 %. Below 25 %, article 13 of regulation (EC) 883/2004 governs instead
  // and the framework agreement's A1 is not the instrument in question.
  //
  // TELEWORK DAYS, NOT DAYS COUNTED AGAINST THE CEILING, and the difference
  // is substantive rather than pedantic. The fiscal ceiling counts telework
  // PLUS credited mission days; the framework agreement is about work
  // performed in the state of RESIDENCE. A mission day in a third state is
  // neither, so including it would fire the warning on facts the agreement
  // does not address. The social ceiling check above still uses
  // daysCountedAgainstCeiling - that is a different question and unchanged.

  it('fires at exactly 25 %, the bottom of the band', () => {
    // The boundary is INCLUSIVE: the agreement applies "from 25 %".
    expect(codes(at({ teleworkDays: 60, totalWorkDays: 240 }))).toContain('A1_REQUIRED');
  });

  it('stays quiet just below 25 %', () => {
    // 59,5/240 is 24,79 %. Article 13 governs here, not the framework
    // agreement, so naming the A1 would point at the wrong instrument.
    expect(codes(at({ teleworkDays: 59.5, totalWorkDays: 240 }))).not.toContain('A1_REQUIRED');
  });

  it('fires well inside the band', () => {
    expect(codes(at({ teleworkDays: 94, totalWorkDays: 240 }))).toContain('A1_REQUIRED');
  });

  it('stays quiet when there is no telework at all', () => {
    expect(codes(at({ teleworkDays: 0, totalWorkDays: 240 }))).not.toContain('A1_REQUIRED');
  });

  it('ignores mission days, which the agreement does not address', () => {
    // 24 telework days of 240 is 10 %, below the threshold. Adding 40 mission
    // days would push days-counted-against-the-ceiling to 26,7 % and the OLD
    // trigger would have fired. Work in a third state is not telework in the
    // state of residence.
    const codesWith = codes(
      at({ teleworkDays: 24, missionDaysTotal: 40, daysCountedAgainstCeiling: 64, totalWorkDays: 240 }),
    );

    expect(codesWith).not.toContain('A1_REQUIRED');
  });

  it('reads the threshold from the RuleSet rather than a literal', () => {
    // SPEC 7.7: "RuleSet is the only place a threshold may appear." A bare
    // 0.25 in warnings.ts would be a review rejection like a bare 0.4.
    const rules = ruleSetFor(2026);

    expect(rules.a1ThresholdRate).toBe(0.25);
  });

  it('is no longer marked PROVISIONAL', () => {
    // The marker came off at Checkpoint A. If it is still in the source, the
    // trigger is still a reading and this test is a lie.
    const source = readFileSync(join(process.cwd(), 'lib', 'calc-engine', 'warnings.ts'), 'utf8');
    const a1Block = source.slice(source.indexOf('A1_REQUIRED') - 1800);

    expect(a1Block).not.toContain('PROVISIONAL TRIGGER');
    expect(a1Block).toContain('a1ThresholdRate');
  });
});
