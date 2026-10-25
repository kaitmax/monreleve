package ch.monreleve.app.dossier

import ch.monreleve.app.calc.fixtureFile
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.datetime.LocalDate
import org.json.JSONObject
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// AN5c increment 2 (R286/R206). The Kotlin side of the ONE late threshold, bound to the server side by
// fixtures/late-threshold-cases.json - the SAME file web/tests/unit/entries/late-fixture.test.ts reads.
// A one-digit change to thresholdDays fails BOTH builds (the late-flag equivalent of R281), and the
// fixtures/ directory is a declared Test input (R283), so a change to it re-runs this suite on an
// ordinary incremental build.
//
// It binds two things: the THRESHOLD (LatenessForecast.BACKFILL_DAYS == thresholdDays) so there is one
// home for the 7, and the RULE (wouldBeLate reproduces each (dayDate, observedAt) -> late case) so the
// client's forecast agrees with the server's flag on the same observation.

private data class LateCase(val id: String, val dayDate: String, val observedAt: String, val late: Boolean)

private fun readFixture(): Pair<Int, List<LateCase>> {
    val json = JSONObject(fixtureFile("late-threshold-cases.json").readText())
    val array = json.getJSONArray("cases")
    val cases =
        (0 until array.length()).map { i ->
            val case = array.getJSONObject(i)
            LateCase(
                id = case.getString("id"),
                dayDate = case.getString("dayDate"),
                observedAt = case.getString("observedAt"),
                late = case.getBoolean("late"),
            )
        }
    return json.getInt("thresholdDays") to cases
}

/** The forecast for one case, parsing the fixture's instant with kotlin.time.Instant (kotlinx-datetime 0.7). */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
private fun forecastFor(case: LateCase): Boolean =
    LatenessForecast.wouldBeLate(LocalDate.parse(case.dayDate), Instant.parse(case.observedAt))

class LatenessConformanceTest : FunSpec({
    val (thresholdDays, cases) = readFixture()

    test("the Kotlin threshold is the fixture threshold (one home for the 7, R206)") {
        LatenessForecast.BACKFILL_DAYS shouldBe thresholdDays
    }

    test("reads every published case, so the suite cannot pass vacuously") {
        cases.map { it.id } shouldBe
            listOf("same-day", "six-days", "exactly-seven-days", "one-ms-past-seven", "eighth-day")
    }

    cases.forEach { case ->
        test("case ${case.id}: observed ${case.observedAt} -> late=${case.late}") {
            forecastFor(case) shouldBe case.late
        }
    }
})
