// web/lib/calc-engine/calculate.ts
//
// The engine's entry point (SPEC 7.4). Invalid input is the expected output
// of a form, so this returns a Result and never throws.
//
// The pipeline, in the spec's order:
//
//   validate -> ruleSet -> denominator -> waterfall -> rates -> headroom
//            -> warnings
//
// Granularity does not appear as a step because it cannot: TeleworkInput
// carries day counts, and classifyTeleworkHours (SPEC 7.2 step 3) is the
// helper a CONSUMER calls to turn hours into those counts before building the
// input. What this pipeline does about granularity is enforce it - validation
// rejects a half-day value declared under 'day' with GRANULARITY_MISMATCH.
//
// Every arithmetic decision lives in its own module, and each names its own
// rounding rule at its own site, because SPEC 7.3 requires the rules to be
// separated so they cannot be accidentally unified:
//
//   denominator.ts       ceil                     the basis and the cap
//   waterfall.ts         no rounding              days only
//   declarable-rate.ts   truncate to 2 dp         the AFC filing
//   raw-rate.ts          round up to 1 dp         display
//   headroom.ts          floor to the half-day    advisory

import { missionCapFor, resolveDenominator } from './denominator';
import { declarableRateFor } from './declarable-rate';
import { headroomFor } from './headroom';
import { rawRateFor } from './raw-rate';
import { regimeFor } from './regime';
import { ruleSetFor } from './rules';
import { validateInput } from './validate';
import { runWaterfall } from './waterfall';
import { warningsFor } from './warnings';
import type { Result, TeleworkInput, TeleworkResult, ValidationError } from './types';

export function calculateTelework(
  input: TeleworkInput,
): Result<TeleworkResult, readonly ValidationError[]> {
  const rules = ruleSetFor(input.taxYear);

  const errors = validateInput(input, rules);
  if (errors.length > 0) return { ok: false, error: errors };

  const denominator = resolveDenominator(
    input.denominator,
    input.employmentRate,
    input.periodFraction,
    rules,
  );
  const { totalWorkDays } = denominator;

  // ceil - favours the user (SPEC 7.2 step 4). Prorates by both factors under
  // the simplified basis and by the period only under the exact method
  // (PROVISIONAL, ruling R19). Computed here rather than inside the waterfall
  // so the waterfall stays pure day arithmetic with no rounding of its own.
  const missionCap = missionCapFor(
    input.denominator,
    input.employmentRate,
    input.periodFraction,
    rules,
  );

  const waterfall = runWaterfall(
    {
      totalWorkDays,
      missionCap,
      teleworkDays: input.teleworkDays,
      missionDaysFrance: input.missionDaysFrance,
      missionDaysThirdState: input.missionDaysThirdState,
    },
    rules,
  );

  const missionDaysTotal = input.missionDaysFrance + input.missionDaysThirdState;
  const headroom = headroomFor(waterfall.daysCountedAgainstCeiling, totalWorkDays, rules);
  const regime = regimeFor(input.canton);

  return {
    ok: true,
    value: {
      regime,
      regimeApplies: waterfall.regimeApplies,
      totalWorkDays,
      missionCap,
      fiscalCeilingDays: waterfall.fiscalCeilingDays,
      declarableRate: declarableRateFor(waterfall.daysCountedAgainstCeiling, totalWorkDays),
      // Days actually spent outside Switzerland, which is a different
      // quantity from the declarable numerator and legitimately larger
      // (SPEC 7.4: Geneva case c is 45.0 raw against 39.16 declarable).
      rawRate: rawRateFor(input.teleworkDays + missionDaysTotal, totalWorkDays),
      swissTaxedDays: waterfall.swissTaxedDays,
      frenchTaxedDays: waterfall.frenchTaxedDays,
      creditedMissionDays: waterfall.creditedMissionDays,
      remainingToFiscal: headroom.remainingToFiscal,
      remainingToSocial: headroom.remainingToSocial,
      warnings: warningsFor(
        {
          regime,
          regimeApplies: waterfall.regimeApplies,
          daysCountedAgainstCeiling: waterfall.daysCountedAgainstCeiling,
          // The input's own telework days, not the waterfall's counted total:
          // A1_REQUIRED asks about work in the state of residence, which
          // excludes credited mission days. See warnings.ts.
          teleworkDays: input.teleworkDays,
          headroomDays: waterfall.headroomDays,
          missionDaysTotal,
          missionCap,
          totalWorkDays,
          requestedTaxYear: input.taxYear,
          denominatorWarnings: denominator.warnings,
        },
        rules,
      ),
    },
  };
}

