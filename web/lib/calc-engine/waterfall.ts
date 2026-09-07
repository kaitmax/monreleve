// web/lib/calc-engine/waterfall.ts
//
// SPEC 7.2 step 5, "the core; not a threshold test". Written in the spec's
// order, with the spec's names, so it can be read against the published
// pseudocode line by line:
//
//   fiscalCeiling = totalWorkDays x 0.40
//
//   if teleworkDays > fiscalCeiling:
//       -- regime does not apply --
//       declarableRate  = teleworkDays / totalWorkDays
//       swissTaxedDays  = totalWorkDays - teleworkDays - missionDaysTotal
//       frenchTaxedDays = teleworkDays + missionDaysTotal
//       regimeApplies   = false
//   else:
//       headroom = fiscalCeiling - teleworkDays
//       budget   = min(missionCap, headroom)
//       creditedFrance     = min(missionDaysFrance, budget)
//       creditedThirdState = min(missionDaysThirdState, budget - creditedFrance)
//       creditedMissions   = creditedFrance + creditedThirdState
//       declarableRate  = (teleworkDays + creditedMissions) / totalWorkDays
//       swissTaxedDays  = totalWorkDays - missionDaysTotal + creditedMissions
//       frenchTaxedDays = missionDaysTotal - creditedMissions
//       regimeApplies   = true
//
// This module deals in DAYS. It returns daysCountedAgainstCeiling - the
// numerator the spec divides by totalWorkDays - and does not compute the rate
// itself, because SPEC 7.3 requires the two rounding rules to live in
// separate files so they cannot be accidentally unified. declarable-rate.ts
// turns the numerator into a rate.
//
// Two details the spec calls out as easy to get wrong, both preserved here:
//
//   1. When telework ALONE exceeds the ceiling, mission days are excluded
//      from the declared numerator. Geneva is explicit that the regime does
//      not apply, so missions must not be folded into the rate filed with the
//      AFC even though they are taxed in France.
//   2. France missions are imputed BEFORE third-state missions. The order
//      changes who pays how: excess France missions are collected by French
//      withholding via the Swiss employer, excess third-state missions are
//      declared and paid by the employee directly. That is why mission days
//      are two input fields and never one.

import type { RuleSet } from './types';

export interface WaterfallInput {
  readonly totalWorkDays: number;
  readonly missionCap: number;
  readonly teleworkDays: number;
  readonly missionDaysFrance: number;
  readonly missionDaysThirdState: number;
}

export interface WaterfallOutcome {
  readonly regimeApplies: boolean;
  readonly fiscalCeilingDays: number;
  /** fiscalCeiling - teleworkDays. Zero in the regime-lost branch. */
  readonly headroomDays: number;
  readonly creditedFranceDays: number;
  readonly creditedThirdStateDays: number;
  readonly creditedMissionDays: number;
  /** The numerator of declarableRate. Excludes missions when the regime is lost. */
  readonly daysCountedAgainstCeiling: number;
  readonly swissTaxedDays: number;
  readonly frenchTaxedDays: number;
}

export function runWaterfall(input: WaterfallInput, rules: RuleSet): WaterfallOutcome {
  const { totalWorkDays, missionCap, teleworkDays, missionDaysFrance, missionDaysThirdState } =
    input;

  const missionDaysTotal = missionDaysFrance + missionDaysThirdState;
  const fiscalCeiling = totalWorkDays * rules.fiscalCeiling;

  if (teleworkDays > fiscalCeiling) {
    // -- regime does not apply --
    return {
      regimeApplies: false,
      fiscalCeilingDays: fiscalCeiling,
      headroomDays: 0,
      creditedFranceDays: 0,
      creditedThirdStateDays: 0,
      creditedMissionDays: 0,
      daysCountedAgainstCeiling: teleworkDays,
      swissTaxedDays: totalWorkDays - teleworkDays - missionDaysTotal,
      frenchTaxedDays: teleworkDays + missionDaysTotal,
    };
  }

  const headroom = fiscalCeiling - teleworkDays;
  const budget = Math.min(missionCap, headroom);

  // France before third state.
  const creditedFrance = Math.min(missionDaysFrance, budget);
  const creditedThirdState = Math.min(missionDaysThirdState, budget - creditedFrance);
  const creditedMissions = creditedFrance + creditedThirdState;

  return {
    regimeApplies: true,
    fiscalCeilingDays: fiscalCeiling,
    headroomDays: headroom,
    creditedFranceDays: creditedFrance,
    creditedThirdStateDays: creditedThirdState,
    creditedMissionDays: creditedMissions,
    daysCountedAgainstCeiling: teleworkDays + creditedMissions,
    swissTaxedDays: totalWorkDays - missionDaysTotal + creditedMissions,
    frenchTaxedDays: missionDaysTotal - creditedMissions,
  };
}
