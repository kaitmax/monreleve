package ch.monreleve.app.calc

// AN2 increment 5: ports web/lib/calc-engine/calculate.ts.
//
// The engine's entry point (SPEC 7.4). Invalid input is the expected output
// of a form, so this returns a CalcResult and never throws.
//
// The pipeline, in the spec's order:
//
//   validate -> ruleSet -> denominator -> waterfall -> rates -> headroom
//            -> warnings
//
// Granularity does not appear as a step because it cannot: TeleworkInput
// carries day counts, and classifyTeleworkHours (SPEC 7.2 step 3) is the
// helper a CONSUMER calls to turn hours into those counts before building
// the input. What this pipeline does about granularity is enforce it -
// validation rejects a half-day value declared under DAY with
// GranularityMismatch.
//
// Every arithmetic decision lives in its own file, and each names its own
// rounding rule at its own site, because SPEC 7.3 requires the rules to be
// separated so they cannot be accidentally unified:
//
//   Denominator.kt      ceil                     the basis and the cap
//   Waterfall.kt        no rounding              days only
//   DeclarableRate.kt   truncate to 2 dp         the AFC filing
//   RawRate.kt          round up to 1 dp         display
//   Headroom.kt         floor to the half-day    advisory

fun calculateTelework(input: TeleworkInput): CalcResult<TeleworkResult, List<ValidationError>> {
    val rules = ruleSetFor(input.taxYear)

    val errors = validateInput(input, rules)

    if (errors.isNotEmpty()) return CalcResult.Err(errors)

    val denominator =
        resolveDenominator(input.denominator, input.employmentRate, input.periodFraction, rules)
    val totalWorkDays = denominator.totalWorkDays

    // ceil - favours the user (SPEC 7.2 step 4). Prorates by both
    // employmentRate and periodFraction under both denominator methods (accord
    // amiable FR-CH of 29 April 2026, clause 1(d)). Computed here rather than
    // inside the waterfall so the waterfall stays pure day arithmetic with no
    // rounding of its own.
    val missionCap = missionCapFor(input.denominator, input.employmentRate, input.periodFraction, rules)

    val waterfall =
        runWaterfall(
            WaterfallInput(
                totalWorkDays = totalWorkDays,
                missionCap = missionCap,
                teleworkDays = input.teleworkDays,
                missionDaysFrance = input.missionDaysFrance,
                missionDaysThirdState = input.missionDaysThirdState,
            ),
            rules,
        )

    val missionDaysTotal = input.missionDaysFrance + input.missionDaysThirdState
    val headroom = headroomFor(waterfall.daysCountedAgainstCeiling, totalWorkDays, rules)
    val regime = regimeFor(input.canton)

    val result =
        TeleworkResult(
            regime = regime,
            regimeApplies = waterfall.regimeApplies,
            totalWorkDays = totalWorkDays,
            missionCap = missionCap,
            fiscalCeilingDays = waterfall.fiscalCeilingDays,
            declarableRate = declarableRateFor(waterfall.daysCountedAgainstCeiling, totalWorkDays),
            // Days actually spent outside Switzerland, which is a different
            // quantity from the declarable numerator and legitimately
            // larger (SPEC 7.4: Geneva case c is 45.0 raw against 39.16
            // declarable).
            rawRate = rawRateFor(input.teleworkDays + missionDaysTotal, totalWorkDays),
            swissTaxedDays = waterfall.swissTaxedDays,
            frenchTaxedDays = waterfall.frenchTaxedDays,
            creditedMissionDays = waterfall.creditedMissionDays,
            remainingToFiscal = headroom.remainingToFiscal,
            remainingToSocial = headroom.remainingToSocial,
            warnings =
                warningsFor(
                    WarningContext(
                        regime = regime,
                        regimeApplies = waterfall.regimeApplies,
                        daysCountedAgainstCeiling = waterfall.daysCountedAgainstCeiling,
                        // The input's own telework days, not the
                        // waterfall's counted total: A1Required asks about
                        // work in the state of residence, which excludes
                        // credited mission days. See Warnings.kt.
                        teleworkDays = input.teleworkDays,
                        headroomDays = waterfall.headroomDays,
                        missionDaysTotal = missionDaysTotal,
                        missionCap = missionCap,
                        totalWorkDays = totalWorkDays,
                        requestedTaxYear = input.taxYear,
                        denominatorWarnings = denominator.warnings,
                    ),
                    rules,
                ),
        )

    return CalcResult.Ok(result)
}
