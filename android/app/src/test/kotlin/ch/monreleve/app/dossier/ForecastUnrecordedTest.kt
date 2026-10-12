package ch.monreleve.app.dossier

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate

// AN-FORECAST (section 2). unrecordedPastWorkdays - the figure the forecast screen states in words so a
// reader does not read the projection as if the days they forgot to record were already counted. Weekdays
// only, holidays not deducted, bounded by the activity start and by today.

class ForecastUnrecordedTest : FunSpec({
    test("counts weekdays in range with no entry") {
        // Mon 8 .. Fri 12 June 2026 = five weekdays; Tue and Thu are recorded, so three remain unrecorded.
        unrecordedPastWorkdays(
            recordedDays = setOf("2026-06-09", "2026-06-11"),
            today = LocalDate.parse("2026-06-12"),
            taxYear = 2026,
            activityStartIso = "2026-06-08",
        ) shouldBe 3
    }

    test("excludes weekends and stops at today") {
        // Sun 14 is today; the weekend (Sat 13, Sun 14) is never counted, so [Mon 8 .. Fri 12] = five weekdays.
        unrecordedPastWorkdays(
            recordedDays = emptySet(),
            today = LocalDate.parse("2026-06-14"),
            taxYear = 2026,
            activityStartIso = "2026-06-08",
        ) shouldBe 5
    }

    test("every day recorded leaves none") {
        unrecordedPastWorkdays(
            recordedDays = setOf("2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"),
            today = LocalDate.parse("2026-06-12"),
            taxYear = 2026,
            activityStartIso = "2026-06-08",
        ) shouldBe 0
    }

    test("an activity start after today counts nothing") {
        unrecordedPastWorkdays(
            recordedDays = emptySet(),
            today = LocalDate.parse("2026-06-15"),
            taxYear = 2026,
            activityStartIso = "2026-07-01",
        ) shouldBe 0
    }
})
