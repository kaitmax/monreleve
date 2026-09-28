package ch.monreleve.app.dossier

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.fixtureFile
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

// AN5b increment 2 (R281, AC2). Reads fixtures/aggregation-cases.json - the SAME file the
// TypeScript suite reads through web/lib/dossier/aggregate.ts (R206, one home) - and runs each
// case through the Kotlin toTeleworkInput, asserting every field of the produced TeleworkInput.
// If the two sides disagree, the shared fixture catches it: a one-digit change to the fixture
// fails BOTH this suite and the TypeScript one (captured in REPORT-AN5b.txt).
//
// The expected block uses the ENGINE's tags (day/halfDay, simplified240/exact); the helpers below
// map them to the Kotlin types, the same shape as GenevaConformanceTest.

private data class AggregationCase(
    val id: String,
    val note: String,
    val user: AggregatableUser,
    val entries: List<AggregatableEntry>,
    val taxYear: Int,
    val expected: ExpectedInput,
)

private data class ExpectedInput(
    val taxYear: Int,
    val canton: Canton,
    val employmentRate: Int,
    val periodFraction: Double,
    val denominator: DenominatorMethod,
    val granularity: Granularity,
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
)

private fun granularityFor(tag: String): Granularity =
    when (tag) {
        "day" -> Granularity.DAY
        "halfDay" -> Granularity.HALF_DAY
        "hours" -> Granularity.HOURS
        else -> error("unknown granularity tag in fixture: $tag")
    }

private fun denominatorFor(json: JSONObject): DenominatorMethod =
    when (val kind = json.getString("kind")) {
        "simplified240" -> DenominatorMethod.Simplified240
        "exact" -> DenominatorMethod.Exact(json.getInt("totalWorkDays"))
        else -> error("unknown denominator kind in fixture: $kind")
    }

private fun nullableInt(
    json: JSONObject,
    key: String,
): Int? = if (json.isNull(key)) null else json.getInt(key)

private fun nullableString(
    json: JSONObject,
    key: String,
): String? = if (json.isNull(key)) null else json.getString(key)

private fun userFor(json: JSONObject): AggregatableUser =
    AggregatableUser(
        canton = nullableString(json, "canton"),
        employmentRate = json.getInt("employmentRate"),
        denominatorKind = json.getString("denominatorKind"),
        exactTotalWorkDays = nullableInt(json, "exactTotalWorkDays"),
        granularity = json.getString("granularity"),
        activityStartDate = nullableString(json, "activityStartDate"),
    )

private fun entriesFor(json: JSONObject): List<AggregatableEntry> {
    val array = json.getJSONArray("entries")
    return (0 until array.length()).map { i ->
        val row = array.getJSONObject(i)
        AggregatableEntry(
            dayDate = row.getString("dayDate"),
            portion = Portion.valueOf(row.getString("portion")),
            kind = EntryKind.valueOf(row.getString("kind")),
        )
    }
}

private fun expectedFor(json: JSONObject): ExpectedInput =
    ExpectedInput(
        taxYear = json.getInt("taxYear"),
        canton = Canton.valueOf(json.getString("canton")),
        employmentRate = json.getInt("employmentRate"),
        periodFraction = json.getDouble("periodFraction"),
        denominator = denominatorFor(json.getJSONObject("denominator")),
        granularity = granularityFor(json.getString("granularity")),
        teleworkDays = json.getDouble("teleworkDays"),
        missionDaysFrance = json.getDouble("missionDaysFrance"),
        missionDaysThirdState = json.getDouble("missionDaysThirdState"),
    )

private fun readCases(): List<AggregationCase> {
    val json = JSONObject(fixtureFile("aggregation-cases.json").readText())
    val array = json.getJSONArray("cases")
    return (0 until array.length()).map { i ->
        val case = array.getJSONObject(i)
        AggregationCase(
            id = case.getString("id"),
            note = case.getString("note"),
            user = userFor(case.getJSONObject("user")),
            entries = entriesFor(case),
            taxYear = case.getInt("taxYear"),
            expected = expectedFor(case.getJSONObject("expected")),
        )
    }
}

class AggregationConformanceTest : FunSpec({
    val cases = readCases()

    test("reads every published aggregation case, so the suite cannot pass vacuously") {
        cases.map { it.id } shouldBe
            listOf(
                "full-days-simple",
                "half-day-pair",
                "absences-of-each-reason-excluded",
                "missions-france-and-third-state",
                "partial-year-midyear-start",
                "r120-rows-versus-portions-disagree",
                "exact-denominator",
            )
    }

    cases.forEach { case ->
        test("case ${case.id}: rows become the expected TeleworkInput (${case.note.take(50)}...)") {
            val input = toTeleworkInput(case.user, case.entries, case.taxYear)

            input.taxYear shouldBe case.expected.taxYear
            input.canton shouldBe case.expected.canton
            input.employmentRate shouldBe case.expected.employmentRate
            input.periodFraction shouldBe case.expected.periodFraction
            input.denominator shouldBe case.expected.denominator
            input.granularity shouldBe case.expected.granularity
            input.teleworkDays shouldBe case.expected.teleworkDays
            input.missionDaysFrance shouldBe case.expected.missionDaysFrance
            input.missionDaysThirdState shouldBe case.expected.missionDaysThirdState
        }
    }

    test("absences change no engine figure (D28): dropping them leaves the input identical") {
        // The exclusion asserted directly, not merely trusted: the absence case's engine input is
        // identical whether or not its ABSENT rows are present.
        val absenceCase = cases.first { it.id == "absences-of-each-reason-excluded" }
        val withAbsences = toTeleworkInput(absenceCase.user, absenceCase.entries, absenceCase.taxYear)
        val withoutAbsences =
            toTeleworkInput(
                absenceCase.user,
                absenceCase.entries.filter { it.kind != EntryKind.ABSENT },
                absenceCase.taxYear,
            )
        withAbsences shouldBe withoutAbsences
    }
})
