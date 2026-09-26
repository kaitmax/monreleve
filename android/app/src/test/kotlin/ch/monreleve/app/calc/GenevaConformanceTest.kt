package ch.monreleve.app.calc

// AN2 increment 5. The complete AC1 pass (SPEC 7.5): reads
// fixtures/geneva-cases.json - the SAME file the TypeScript suite reads
// (R206) - and runs it through the full calculateTelework pipeline,
// checking all four published fields for each of the six cases:
// declarableRate, swissTaxedDays, frenchTaxedDays, regimeApplies - plus
// the day-partition invariant (SPEC 7.6 #1) as a cross-check on the
// published cases themselves.
//
// "If any fails, nothing ships" (SPEC 7.5). No snapshots (SPEC 7.6): a
// snapshot records what the code did, not what the AFC published.
//
// FOLDED FROM GenevaWaterfallTest.kt (R268, close-out review). That file
// was increment 3's own partial pass, written before DeclarableRate.kt
// (increment 4) and the full calculateTelework assembly (increment 5)
// existed, so it could only check swissTaxedDays/frenchTaxedDays/
// regimeApplies against the waterfall alone. Once this file existed and
// subsumed every one of those checks plus declarableRate, keeping both
// stopped documenting history and started being a reader's trap: two
// files asserting the same fixture at different coverage levels means
// the next person changing a Geneva expectation can update one and
// leave the other green on its narrower assertion. Deleted rather than
// left as a historical pair.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

private data class GenevaFullCase(
    val id: String,
    val note: String,
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
    val expectedSwissTaxedDays: Double,
    val expectedFrenchTaxedDays: Double,
    val expectedDeclarableRate: Double,
    val expectedRegimeApplies: Boolean,
)

/** commonInput's granularity is the JSON tag ("day"), not the enum constant name ("DAY"). */
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

private fun readGenevaFixture(): Pair<TeleworkInput, List<GenevaFullCase>> {
    val json = JSONObject(fixtureFile("geneva-cases.json").readText())
    val commonInput = json.getJSONObject("commonInput")

    val base =
        TeleworkInput(
            taxYear = commonInput.getInt("taxYear"),
            canton = Canton.valueOf(commonInput.getString("canton")),
            employmentRate = commonInput.getInt("employmentRate"),
            periodFraction = commonInput.getDouble("periodFraction"),
            denominator = denominatorFor(commonInput.getJSONObject("denominator")),
            granularity = granularityFor(commonInput.getString("granularity")),
            teleworkDays = 0.0,
            missionDaysFrance = 0.0,
            missionDaysThirdState = 0.0,
        )

    val array = json.getJSONArray("cases")
    val cases =
        (0 until array.length()).map { i ->
            val case = array.getJSONObject(i)
            val input = case.getJSONObject("input")
            val expected = case.getJSONObject("expected")

            GenevaFullCase(
                id = case.getString("id"),
                note = case.getString("note"),
                teleworkDays = input.getDouble("teleworkDays"),
                missionDaysFrance = input.getDouble("missionDaysFrance"),
                missionDaysThirdState = input.getDouble("missionDaysThirdState"),
                expectedSwissTaxedDays = expected.getDouble("swissTaxedDays"),
                expectedFrenchTaxedDays = expected.getDouble("frenchTaxedDays"),
                expectedDeclarableRate = expected.getDouble("declarableRate"),
                expectedRegimeApplies = expected.getBoolean("regimeApplies"),
            )
        }

    return base to cases
}

class GenevaConformanceTest : FunSpec({
    val (commonInput, cases) = readGenevaFixture()

    test("reads all six published cases, so the suite cannot pass vacuously") {
        cases.map { it.id } shouldBe listOf("a", "b", "c", "d", "e", "special")
    }

    cases.forEach { case ->
        val input =
            commonInput.copy(
                teleworkDays = case.teleworkDays,
                missionDaysFrance = case.missionDaysFrance,
                missionDaysThirdState = case.missionDaysThirdState,
            )

        test("case ${case.id}: produces the published result (${case.note.take(60)}...)") {
            val result = calculateTelework(input)

            // Asserted first and separately: an engine that cannot produce
            // a result at all should say so plainly rather than fail four
            // field comparisons with confusing messages.
            (result is CalcResult.Ok) shouldBe true
            if (result is CalcResult.Ok) {
                result.value.declarableRate shouldBe case.expectedDeclarableRate
                result.value.swissTaxedDays shouldBe case.expectedSwissTaxedDays
                result.value.frenchTaxedDays shouldBe case.expectedFrenchTaxedDays
                result.value.regimeApplies shouldBe case.expectedRegimeApplies
            }
        }

        test("case ${case.id}: accounts for every working day") {
            // Invariant 1 of SPEC 7.6, checked on the published cases: no
            // day is taxed twice and none goes missing.
            val result = calculateTelework(input)

            (result is CalcResult.Ok) shouldBe true
            if (result is CalcResult.Ok) {
                (result.value.swissTaxedDays + result.value.frenchTaxedDays) shouldBe
                    result.value.totalWorkDays.toDouble()
            }
        }
    }
})
