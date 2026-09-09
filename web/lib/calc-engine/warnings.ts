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
  /**
   * input.teleworkDays. Distinct from daysCountedAgainstCeiling, which also
   * carries credited mission days: the framework agreement behind A1_REQUIRED
   * is about work performed in the state of RESIDENCE, and a mission day in a
   * third state is not that.
   */
  readonly teleworkDays: number;
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

  // THE A1 THRESHOLD, settled at Checkpoint A on 09.09.2026. The marker that
  // stood here said PROVISIONAL and it was: SPEC 7.1 stated only that the
  // 49.9 % social ceiling is "conditional on a valid A1" and named no
  // condition, so this fired whenever ANY day was counted against the ceiling
  // - a standing obligation the product announced rather than a threshold it
  // detected.
  //
  // The verification pass answered it from bsv.admin.ch: the EU framework
  // agreement on cross-border telework applies FROM 25 % telework in the
  // state of residence up to (but not including) 50 %. Below 25 %, article 13
  // of regulation (EC) 883/2004 governs and the framework agreement's A1 is
  // not the instrument in question - so the old trigger named the wrong
  // document for every user under a quarter telework.
  //
  // TELEWORK DAYS, NOT daysCountedAgainstCeiling. The fiscal ceiling counts
  // telework plus credited missions; this is about work in the state of
  // residence, and a mission day in a third state is neither. The social
  // ceiling check above still uses daysCountedAgainstCeiling, which is a
  // different question and unchanged.
  //
  // INCLUSIVE at 25 %: the agreement applies "from" 25 %. totalWorkDays is
  // guaranteed positive by validation (TOTAL_WORK_DAYS_NOT_POSITIVE), so the
  // division is safe here.
  if (context.teleworkDays / context.totalWorkDays >= rules.a1ThresholdRate) {
    warnings.push({ code: 'A1_REQUIRED' });
  }

  return warnings;
}
