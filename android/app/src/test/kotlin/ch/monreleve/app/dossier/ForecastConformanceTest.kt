package ch.monreleve.app.dossier

import ch.monreleve.app.calc.fixtureFile
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.isoDayNumber
import org.json.JSONObject

// AN-FORECAST (R340, R281). Reads fixtures/forecast-cases.json - the SAME file the web forecast
// (FW-FORECAST) reads - and runs each case through the Kotlin date function (imaginedEntriesToYearEnd)
// and the shared aggregation + engine (forecastResults). Asserts the imagined-day counts AND the
// engine's rates. A one-digit change to the fixture fails this suite (the plant is recorded in the
// report); the web suite reads the same file, so the plant fails there too.
//
// This suite also stands as a per-computation R340 witness: forecastResults is pure - it opens no
// store and holds no clock - so computing a projection here cannot write anything. The store-level
// R340 proof (driving the controller and reading the database back) lives in the instrumented test.

private data class ForecastCase(
    val id: String,
    val note: String,
    val today: LocalDate,
    val rhythm: Map<DayOfWeek, EntryKind>,
    val recorded: List<AggregatableEntry>,
    val expectedImaginedWorkingDays: Int,
    val expectedImaginedTeleworkDays: Int,
    val expectedCurrentRate: Double,
    val expectedDeclarableRate: Double,
)

private fun userFor(json: JSONObject): AggregatableUser =
    AggregatableUser(
        canton = json.getString("canton"),
        employmentRate = json.getInt("employmentRate"),
        denominatorKind = json.getString("denominatorKind"),
        exactTotalWorkDays = if (json.isNull("exactTotalWorkDays")) null else json.getInt("exactTotalWorkDays"),
        granularity = json.getString("granularity"),
        activityStartDate = if (json.isNull("activityStartDate")) null else json.getString("activityStartDate"),
    )

private fun rhythmFor(json: JSONObject): Map<DayOfWeek, EntryKind> {
    val map = mutableMapOf<DayOfWeek, EntryKind>()
    for (key in json.keys()) {
        map[DayOfWeek.valueOf(key)] = EntryKind.valueOf(json.getString(key))
    }
    return map
}

private fun recordedFor(json: JSONObject): List<AggregatableEntry> {
    val array = json.getJSONArray("recorded")
    return (0 until array.length()).map { i ->
        val row = array.getJSONObject(i)
        AggregatableEntry(
            dayDate = row.getString("dayDate"),
            portion = Portion.valueOf(row.getString("portion")),
            kind = EntryKind.valueOf(row.getString("kind")),
        )
    }
}

private fun readFixture(): Pair<AggregatableUser, Pair<Int, List<ForecastCase>>> {
    val json = JSONObject(fixtureFile("forecast-cases.json").readText())
    val user = userFor(json.getJSONObject("commonUser"))
    val taxYear = json.getInt("taxYear")
    val array = json.getJSONArray("cases")
    val cases =
        (0 until array.length()).map { i ->
            val case = array.getJSONObject(i)
            val expected = case.getJSONObject("expected")
            ForecastCase(
                id = case.getString("id"),
                note = case.getString("note"),
                today = LocalDate.parse(case.getString("today")),
                rhythm = rhythmFor(case.getJSONObject("rhythm")),
                recorded = recordedFor(case),
                expectedImaginedWorkingDays = expected.getInt("imaginedWorkingDays"),
                expectedImaginedTeleworkDays = expected.getInt("imaginedTeleworkDays"),
                expectedCurrentRate = expected.getDouble("currentRate"),
                expectedDeclarableRate = expected.getDouble("declarableRate"),
            )
        }
    return user to (taxYear to cases)
}

class ForecastConformanceTest : FunSpec({
    val (user, yearAndCases) = readFixture()
    val (taxYear, cases) = yearAndCases

    test("reads every published forecast case, so the suite cannot pass vacuously") {
        cases.map { it.id } shouldBe
            listOf(
                "rythme-mardi-jeudi-depuis-octobre",
                "rythme-complet-fin-dannee",
                "enregistre-plus-imagine",
                "les-jours-suisses-ne-bougent-pas-le-taux",
                "rythme-partiel-mardi-jeudi",
            )
    }

    cases.forEach { case ->
        test("case ${case.id}: the imagined days and the engine rates match (${case.note.take(44)}...)") {
            val imagined = imaginedEntriesToYearEnd(case.rhythm, case.today, taxYear)
            imagined.size shouldBe case.expectedImaginedWorkingDays
            imagined.count { it.kind == EntryKind.HOME } shouldBe case.expectedImaginedTeleworkDays
            imagined.all { it.portion == Portion.FULL } shouldBe true

            val results = forecastResults(user, case.recorded, case.rhythm, case.today, taxYear)
            checkNotNull(results) { "the engine rejected the forecast input for ${case.id}" }
            results.imagined.size shouldBe case.expectedImaginedWorkingDays
            results.current.declarableRate shouldBe (case.expectedCurrentRate plusOrMinus TOLERANCE)
            results.projected.declarableRate shouldBe (case.expectedDeclarableRate plusOrMinus TOLERANCE)
        }
    }

    test("today is never imagined: an imagined row is always strictly after today, and a weekday") {
        cases.forEach { case ->
            val imagined = imaginedEntriesToYearEnd(case.rhythm, case.today, taxYear)
            imagined.forEach { row ->
                val date = LocalDate.parse(row.dayDate)
                (date > case.today) shouldBe true
                (date.dayOfWeek.isoDayNumber in 1..5) shouldBe true
                (date.year) shouldBe taxYear
            }
        }
    }
})

private const val TOLERANCE = 1e-9
