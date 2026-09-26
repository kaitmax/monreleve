package ch.monreleve.app.calc

// AN2 increment 2. Matches web/tests/unit/calc-engine/granularity.test.ts's
// own cases - SPEC section 7.2 step 3, sourced to circular no. 45 point
// 7.5.1. The boundaries are the point of this test: SPEC 7.6 names 1.9h, 2h,
// 4h and 4.1h specifically, because "2-4h" has to be read as inclusive at
// both ends and "over 4h" as strictly greater.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

/** hours -> expected value, per granularity: (hours, day, halfDay, hours). */
private val TABLE =
    listOf(
        listOf(0.0, 0.0, 0.0, 0.0),
        listOf(1.9, 0.0, 0.0, 1.9),
        listOf(2.0, 0.0, 0.5, 2.0),
        listOf(2.5, 0.0, 0.5, 2.5),
        listOf(4.0, 0.0, 0.5, 4.0),
        listOf(4.1, 1.0, 1.0, 4.1),
        listOf(8.0, 1.0, 1.0, 8.0),
    )

class GranularityTest : FunSpec({
    TABLE.forEach { row ->
        val hours = row[0]
        val day = row[1]
        val halfDay = row[2]
        val hoursExpected = row[3]

        test("$hours h under 'DAY' counts $day") {
            classifyTeleworkHours(hours, Granularity.DAY) shouldBe day
        }
        test("$hours h under 'HALF_DAY' counts $halfDay") {
            classifyTeleworkHours(hours, Granularity.HALF_DAY) shouldBe halfDay
        }
        test("$hours h under 'HOURS' counts $hoursExpected") {
            classifyTeleworkHours(hours, Granularity.HOURS) shouldBe hoursExpected
        }
    }

    test("treats 4h as a half day, not a full one, under HALF_DAY") {
        // "over 4h" is strictly greater. Exactly 4h is the top of the 2-4
        // band.
        classifyTeleworkHours(4.0, Granularity.HALF_DAY) shouldBe 0.5
        classifyTeleworkHours(4.0001, Granularity.HALF_DAY) shouldBe 1.0
    }

    test("treats exactly 2h as a half day, not zero, under HALF_DAY") {
        // "2-4h" is inclusive at the bottom too.
        classifyTeleworkHours(2.0, Granularity.HALF_DAY) shouldBe 0.5
        classifyTeleworkHours(1.9999, Granularity.HALF_DAY) shouldBe 0.0
    }

    test("counts nothing below 4h under DAY, however close") {
        classifyTeleworkHours(3.9999, Granularity.DAY) shouldBe 0.0
        classifyTeleworkHours(4.0, Granularity.DAY) shouldBe 0.0
    }

    test("is total for negative input and returns 0 rather than throwing") {
        // SPEC 7.4 types this function as returning a number, so it has no
        // channel for a ValidationError. Negative day counts are rejected
        // upstream by the validation pass with NegativeDays; this stays
        // total because the engine never throws.
        Granularity.entries.forEach { granularity ->
            classifyTeleworkHours(-1.0, granularity) shouldBe 0.0
        }
    }
})
