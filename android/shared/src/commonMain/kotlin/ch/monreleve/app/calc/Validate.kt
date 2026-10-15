package ch.monreleve.app.calc

import kotlin.math.abs
import kotlin.math.round

// AN2 increment 3: ports web/lib/calc-engine/validate.ts.
//
// Invalid input is the expected output of a form (SPEC section 7), so this
// returns a list of errors and never throws. It returns EVERY applicable
// error rather than the first, because a form should show all its problems
// at once. Each ValidationError variant maps one-to-one onto a message in
// the UI layer (SPEC section 7.4).

private const val MIN_EMPLOYMENT_RATE = 1
private const val MAX_EMPLOYMENT_RATE = 100

/** How close a quotient must land to a whole number to count as "on the step". */
private const val GRANULARITY_STEP_TOLERANCE = 1e-9

private const val HALF_DAY_STEP = 0.5
private const val FULL_DAY_STEP = 1.0

/** A value is a legal count under the granularity if it lands on its step. */
private fun isOnGranularityStep(
    value: Double,
    step: Double,
): Boolean {
    val quotient = value / step

    return quotient.isFinite() && abs(quotient - round(quotient)) < GRANULARITY_STEP_TOLERANCE
}

/** RateOutOfRange and PeriodOutOfRange carry no field, unlike the day checks below. */
private fun rangeErrors(input: TeleworkInput): List<ValidationError> {
    val errors = mutableListOf<ValidationError>()

    // employmentRate is Int in this port (see DenominatorMethod.Exact's own
    // note): Kotlin's type system already makes a NaN/Infinity employmentRate
    // unrepresentable, so only the range boundary is checked here - the
    // TypeScript suite's NaN/Infinity sub-cases for this field have no
    // Kotlin equivalent to test, which is a stronger guarantee, not a gap.
    if (input.employmentRate < MIN_EMPLOYMENT_RATE || input.employmentRate > MAX_EMPLOYMENT_RATE) {
        errors.add(ValidationError.RateOutOfRange)
    }

    if (!input.periodFraction.isFinite() || input.periodFraction <= 0 || input.periodFraction > 1) {
        errors.add(ValidationError.PeriodOutOfRange)
    }

    return errors
}

/**
 * The three day-count fields, which share the negative and granularity
 * checks. DAY counts whole days; HALF_DAY counts halves; HOURS was already
 * converted by classifyTeleworkHours and may be any non-negative number.
 */
private fun dayFieldErrors(input: TeleworkInput): List<ValidationError> {
    val errors = mutableListOf<ValidationError>()
    val dayFields =
        listOf(
            InputField.TELEWORK_DAYS to input.teleworkDays,
            InputField.MISSION_DAYS_FRANCE to input.missionDaysFrance,
            InputField.MISSION_DAYS_THIRD_STATE to input.missionDaysThirdState,
        )
    val step =
        when (input.granularity) {
            Granularity.DAY -> FULL_DAY_STEP
            Granularity.HALF_DAY -> HALF_DAY_STEP
            Granularity.HOURS -> null
        }

    for ((field, value) in dayFields) {
        if (!value.isFinite() || value < 0) {
            errors.add(ValidationError.NegativeDays(field))
        } else if (step != null && !isOnGranularityStep(value, step)) {
            errors.add(ValidationError.GranularityMismatch(field))
        }
    }

    return errors
}

fun validateInput(
    input: TeleworkInput,
    rules: RuleSet,
): List<ValidationError> {
    val errors = mutableListOf<ValidationError>()

    errors.addAll(rangeErrors(input))
    errors.addAll(dayFieldErrors(input))

    if (input.denominator is DenominatorMethod.Exact && input.denominator.totalWorkDays < 0) {
        errors.add(ValidationError.NegativeDays(InputField.DENOMINATOR))
    }

    // The denominator is resolved, never divided by, so this is safe even
    // when the rate or the period is already invalid.
    val (totalWorkDays, _) =
        resolveDenominator(input.denominator, input.employmentRate, input.periodFraction, rules)

    if (totalWorkDays <= 0) {
        errors.add(ValidationError.TotalWorkDaysNotPositive)

        // DaysExceedTotal is deliberately not also reported: comparing
        // against a non-positive total is meaningless, and a form would be
        // shown two contradictory messages about the same field.
        return errors
    }

    val claimed = input.teleworkDays + input.missionDaysFrance + input.missionDaysThirdState

    if (claimed.isFinite() && claimed > totalWorkDays) {
        errors.add(ValidationError.DaysExceedTotal)
    }

    return errors
}
