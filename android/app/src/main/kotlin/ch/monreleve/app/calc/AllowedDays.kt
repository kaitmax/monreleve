package ch.monreleve.app.calc

// AN2 increment 5: ports web/lib/calc-engine/allowed-days.ts.
//
// SPEC section 7.4. "How much room is there?", answerable before the user
// has entered a single day, so the calculator can show the allowance up
// front.
//
// atFiscal and atSocial FLOOR to the half-day, per ruling R12: this
// function answers "how many days may I take", so it is advisory and must
// never overstate, the same rule as headroom. The exact unrounded ceiling
// stays available as fiscalCeilingDays on TeleworkResult.
//
// missionCap still rounds UP - SPEC 7.2 step 4, the one rule that favours
// the user (amicable agreement of 30 June 2023).
//
// Three rounding behaviours therefore meet in this file's neighbourhood,
// and each names its own rule at its own site: floor-to-the-half-day here
// (via Headroom.kt), ceil in Denominator.kt, truncate in DeclarableRate.kt.

fun allowedTeleworkDays(input: AllowedTeleworkDaysInput): CalcResult<AllowedTeleworkDays, List<ValidationError>> {
    val rules = ruleSetFor(input.taxYear)

    // Validation is shared with calculateTelework rather than duplicated.
    // The day fields are zero here, which passes the negative,
    // granularity and total-exceeded checks, so only the rate, period and
    // total errors can surface - exactly the ones that apply to this
    // question.
    val errors =
        validateInput(
            TeleworkInput(
                taxYear = input.taxYear,
                canton = input.canton,
                employmentRate = input.employmentRate,
                periodFraction = input.periodFraction,
                denominator = input.denominator,
                granularity = input.granularity,
                teleworkDays = 0.0,
                missionDaysFrance = 0.0,
                missionDaysThirdState = 0.0,
            ),
            rules,
        )

    if (errors.isNotEmpty()) return CalcResult.Err(errors)

    val totalWorkDays =
        resolveDenominator(input.denominator, input.employmentRate, input.periodFraction, rules).totalWorkDays

    return CalcResult.Ok(
        AllowedTeleworkDays(
            // floor to the half-day - advisory, never overstate (R12)
            atFiscal = floorToHalfDay(totalWorkDays * rules.fiscalCeiling),
            atSocial = floorToHalfDay(totalWorkDays * rules.socialCeiling),
            // ceil - favours the user (SPEC 7.2 step 4); period-only under
            // the exact method (PROVISIONAL, ruling R19)
            missionCap = missionCapFor(input.denominator, input.employmentRate, input.periodFraction, rules),
        ),
    )
}
