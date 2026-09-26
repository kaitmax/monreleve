package ch.monreleve.app.calc

// AN2 increment 3. Matches web/tests/unit/calc-engine/validate.test.ts's own
// cases, with one documented, deliberate gap: employmentRate is Int here
// (DenominatorMethod.Exact's own note explains why), so the TS suite's
// NaN/Infinity sub-cases for employmentRate specifically have no Kotlin
// equivalent - Int makes that state unrepresentable rather than merely
// validated against, which is a stronger guarantee, not a missing check.
// Every other case, including the range-boundary ones for employmentRate,
// carries over exactly.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe

private val RULES = ruleSetFor(2026)

private val VALID =
    TeleworkInput(
        taxYear = 2026,
        canton = Canton.GE,
        employmentRate = 100,
        periodFraction = 1.0,
        denominator = DenominatorMethod.Simplified240,
        granularity = Granularity.DAY,
        teleworkDays = 84.0,
        missionDaysFrance = 12.0,
        missionDaysThirdState = 12.0,
    )

private fun codesFor(input: TeleworkInput): List<ValidationError> = validateInput(input, RULES)

class ValidateTest : FunSpec({
    test("accepts a valid input") {
        validateInput(VALID, RULES) shouldBe emptyList()
    }

    context("employmentRate, valid 1-100") {
        listOf(0, -1, 101, 1000).forEach { rate ->
            test("rejects $rate with RateOutOfRange") {
                codesFor(VALID.copy(employmentRate = rate)) shouldContain ValidationError.RateOutOfRange
            }
        }

        listOf(1, 50, 80, 100).forEach { rate ->
            test("accepts $rate") {
                codesFor(VALID.copy(employmentRate = rate)) shouldNotContain ValidationError.RateOutOfRange
            }
        }
    }

    context("periodFraction, valid 0 < f <= 1") {
        listOf(0.0, -0.5, 1.0001, 2.0, Double.NaN).forEach { fraction ->
            test("rejects $fraction with PeriodOutOfRange") {
                codesFor(VALID.copy(periodFraction = fraction)) shouldContain ValidationError.PeriodOutOfRange
            }
        }

        listOf(1.0, 0.5, 7.0 / 12, 0.0001).forEach { fraction ->
            test("accepts $fraction") {
                codesFor(VALID.copy(periodFraction = fraction)) shouldNotContain ValidationError.PeriodOutOfRange
            }
        }
    }

    context("negative day counts") {
        listOf(
            InputField.TELEWORK_DAYS to VALID.copy(teleworkDays = -1.0),
            InputField.MISSION_DAYS_FRANCE to VALID.copy(missionDaysFrance = -1.0),
            InputField.MISSION_DAYS_THIRD_STATE to VALID.copy(missionDaysThirdState = -1.0),
        ).forEach { (field, input) ->
            test("rejects a negative $field and names the field") {
                val errors = validateInput(input, RULES)
                val negative = errors.filterIsInstance<ValidationError.NegativeDays>().firstOrNull()

                (negative != null) shouldBe true
                negative?.field shouldBe field
            }
        }

        test("rejects a negative supplied total and names the denominator") {
            val errors =
                validateInput(
                    VALID.copy(
                        denominator = DenominatorMethod.Exact(-5),
                        teleworkDays = 0.0,
                        missionDaysFrance = 0.0,
                        missionDaysThirdState = 0.0,
                    ),
                    RULES,
                )
            val negative = errors.filterIsInstance<ValidationError.NegativeDays>().firstOrNull()

            negative?.field shouldBe InputField.DENOMINATOR
        }
    }

    context("granularity mismatch") {
        listOf(
            InputField.TELEWORK_DAYS to VALID.copy(granularity = Granularity.DAY, teleworkDays = 10.5),
            InputField.MISSION_DAYS_FRANCE to VALID.copy(granularity = Granularity.DAY, missionDaysFrance = 10.5),
            InputField.MISSION_DAYS_THIRD_STATE to
                VALID.copy(granularity = Granularity.DAY, missionDaysThirdState = 10.5),
        ).forEach { (field, input) ->
            test("rejects a half-day $field under granularity DAY") {
                val errors = validateInput(input, RULES)
                val mismatch = errors.filterIsInstance<ValidationError.GranularityMismatch>().firstOrNull()

                mismatch?.field shouldBe field
            }
        }

        test("accepts a half-day value under granularity HALF_DAY") {
            codesFor(VALID.copy(granularity = Granularity.HALF_DAY, teleworkDays = 10.5))
                .shouldNotContainGranularityMismatch()
        }

        test("rejects a quarter-day value under granularity HALF_DAY") {
            codesFor(VALID.copy(granularity = Granularity.HALF_DAY, teleworkDays = 10.3))
                .shouldContainGranularityMismatch()
        }

        test("accepts any non-negative value under granularity HOURS") {
            codesFor(VALID.copy(granularity = Granularity.HOURS, teleworkDays = 10.3))
                .shouldNotContainGranularityMismatch()
        }
    }

    context("the total") {
        listOf(0, -1).forEach { total ->
            test("rejects a supplied total of $total with TotalWorkDaysNotPositive") {
                codesFor(
                    VALID.copy(
                        denominator = DenominatorMethod.Exact(total),
                        teleworkDays = 0.0,
                        missionDaysFrance = 0.0,
                        missionDaysThirdState = 0.0,
                    ),
                ) shouldContain ValidationError.TotalWorkDaysNotPositive
            }
        }

        test("does not report DaysExceedTotal when the total is not positive") {
            // The comparison would be meaningless, and reporting both would
            // send a form two contradictory messages about the same field.
            val codes =
                codesFor(
                    VALID.copy(
                        denominator = DenominatorMethod.Exact(0),
                        teleworkDays = 5.0,
                    ),
                )

            codes shouldContain ValidationError.TotalWorkDaysNotPositive
            codes shouldNotContain ValidationError.DaysExceedTotal
        }

        test("rejects days summing above the total with DaysExceedTotal") {
            // 240 available; 200 + 30 + 30 = 260.
            codesFor(
                VALID.copy(teleworkDays = 200.0, missionDaysFrance = 30.0, missionDaysThirdState = 30.0),
            ) shouldContain ValidationError.DaysExceedTotal
        }

        test("accepts days summing exactly to the total") {
            codesFor(
                VALID.copy(teleworkDays = 200.0, missionDaysFrance = 20.0, missionDaysThirdState = 20.0),
            ) shouldBe emptyList()
        }
    }

    test("returns every applicable error, not just the first") {
        val codes =
            codesFor(
                VALID.copy(
                    employmentRate = 0,
                    periodFraction = 2.0,
                    teleworkDays = -1.0,
                    missionDaysFrance = 10.5,
                    granularity = Granularity.DAY,
                ),
            )

        codes shouldContain ValidationError.RateOutOfRange
        codes shouldContain ValidationError.PeriodOutOfRange
        (codes.filterIsInstance<ValidationError.NegativeDays>().isNotEmpty()) shouldBe true
        (codes.filterIsInstance<ValidationError.GranularityMismatch>().isNotEmpty()) shouldBe true
        (codes.size >= 4) shouldBe true
    }

    test("never throws, whatever it is handed (adapted: NaN only where the type admits it)") {
        // The TS suite hands Number.NaN to every field, including
        // employmentRate and the Exact method's totalWorkDays. Both are Int
        // here (see DenominatorMethod.Exact's own note) and cannot hold NaN
        // at all, so this uses a valid rate and total and puts NaN only
        // where Double fields make it representable - periodFraction and
        // the three day-count fields.
        val nonsense =
            VALID.copy(
                periodFraction = Double.NaN,
                teleworkDays = Double.NaN,
                missionDaysFrance = Double.NaN,
                missionDaysThirdState = Double.NaN,
            )

        val errors = validateInput(nonsense, RULES)

        errors.isNotEmpty() shouldBe true
    }
})

private fun List<ValidationError>.shouldContainGranularityMismatch() {
    (filterIsInstance<ValidationError.GranularityMismatch>().isNotEmpty()) shouldBe true
}

private fun List<ValidationError>.shouldNotContainGranularityMismatch() {
    (filterIsInstance<ValidationError.GranularityMismatch>().isEmpty()) shouldBe true
}
