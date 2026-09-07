// web/lib/calc-engine/warnings.ts
//
// SPEC 7.4's Warning union, plus RULE_SET_FALLBACK from ruling R11. A warning
// is not an error: the result is still computed and returned. Each code maps
// onto copy in lib/fr.
//
// Where the spec states the trigger, the trigger is the spec's. Where it does
// not, the reading is recorded at the site and, for A1_REQUIRED, raised as a
// question in REPORT-FW4.txt - see the comment there.

import type { Regime, RuleSet, Warning } from './types';

export interface WarningContext {
  readonly regime: Regime;
  readonly regimeApplies: boolean;
  readonly daysCountedAgainstCeiling: number;
  /** fiscalCeiling - teleworkDays. Zero when the regime is already lost. */
  readonly headroomDays: number;
  readonly missionDaysTotal: number;
  readonly missionCap: number;
  readonly totalWorkDays: number;
  /** input.taxYear, which may differ from the rule set actually applied. */
  readonly requestedTaxYear: number;
  /** Warnings the denominator produced, e.g. EXACT_METHOD_UNVERIFIED. */
  readonly denominatorWarnings: readonly Warning[];
}

export function warningsFor(context: WarningContext, rules: RuleSet): readonly Warning[] {
  const warnings: Warning[] = [...context.denominatorWarnings];

  // Ruling R11: the substitution reaches the user rather than being implied
  // by a taxYear a caller has to think to compare.
  if (context.requestedTaxYear !== rules.taxYear) {
    warnings.push({
      code: 'RULE_SET_FALLBACK',
      requestedYear: context.requestedTaxYear,
      appliedYear: rules.taxYear,
    });
  }

  if (!context.regimeApplies) {
    // SPEC 7.2 step 1: the ceiling is the same under both regimes, the
    // consequence is not, so the warning carries which one applies.
    warnings.push({ code: 'FISCAL_CEILING_EXCEEDED', regime: context.regime });

    // Only under the 1983 accord is the status itself at risk. Telling a
    // Geneva frontalier their status is at risk would simply be false.
    if (context.regime === 'residence-1983') {
      warnings.push({ code: 'FRONTALIER_STATUS_AT_RISK' });
    }
  }

  if (context.missionDaysTotal > context.missionCap) {
    warnings.push({
      code: 'MISSION_CAP_EXCEEDED',
      cap: context.missionCap,
      excess: context.missionDaysTotal - context.missionCap,
    });
  }

  // A distinct fact from the cap: the cap says how many mission days may ever
  // be credited, headroom says how many fit under the ceiling this year. Both
  // can bind at once and a user needs to be told which is biting.
  //
  // Not reported once the regime is lost: there is no headroom left to
  // exceed, and FISCAL_CEILING_EXCEEDED is the fact that matters then.
  if (context.regimeApplies && context.missionDaysTotal > context.headroomDays) {
    warnings.push({
      code: 'MISSIONS_EXCEED_HEADROOM',
      excess: context.missionDaysTotal - context.headroomDays,
    });
  }

  if (context.daysCountedAgainstCeiling > context.totalWorkDays * rules.socialCeiling) {
    warnings.push({ code: 'SOCIAL_CEILING_EXCEEDED' });
  }

  // PROVISIONAL TRIGGER - see REPORT-FW4.txt, QUESTIONS.
  //
  // SPEC 7.1 says only that the 49.9 % social ceiling is "conditional on a
  // valid A1", and 7.4 lists the code without a condition. The whole regime
  // the engine models presupposes an A1, so this fires whenever any day is
  // counted against the ceiling: a standing obligation the product should
  // state rather than a threshold it should detect. The alternative readings
  // - only above the fiscal ceiling, or only near the social one - would
  // leave a user who is comfortably under 40 % unaware of a document they
  // are nonetheless required to hold. The operator's ruling replaces this.
  if (context.daysCountedAgainstCeiling > 0) {
    warnings.push({ code: 'A1_REQUIRED' });
  }

  return warnings;
}
