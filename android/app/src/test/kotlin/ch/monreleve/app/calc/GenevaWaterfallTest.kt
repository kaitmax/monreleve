package ch.monreleve.app.calc

// AN2 increment 3, AC1's FIRST pass. Reads fixtures/geneva-cases.json - the
// SAME file the TypeScript suite reads (R206) - and checks swissTaxedDays,
// frenchTaxedDays and regimeApplies against the real denominator + waterfall
// pipeline. declarableRate is NOT checked here: it needs declarableRateFor's
// truncation rule (increment 4) and the full calculateTelework assembly
// (increment 5) - see GenevaConformanceTest.kt there for the complete AC1
// pass, including 39.16% and 4.16%. This is a genuine partial pass, not a
// placeholder: everything it CAN check with what exists so far, it does.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

private val RULES = ruleSetFor(2026)

private data class GenevaCase(
    val id: String,
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
    val expectedSwissTaxedDays: Double,
    val expectedFrenchTaxedDays: Double,
    val expectedRegimeApplies: Boolean,
)

private fun readGenevaCases(): List<GenevaCase> {
    val json = JSONObject(fixtureFile("geneva-cases.json").readText())
    val array = json.getJSONArray("cases")

    return (0 until array.length()).map { i ->
        val case = array.getJSONObject(i)
        val input = case.getJSONObject("input")
        val expected = case.getJSONObject("expected")

        GenevaCase(
            id = case.getString("id"),
            teleworkDays = input.getDouble("teleworkDays"),
            missionDaysFrance = input.getDouble("missionDaysFrance"),
            missionDaysThirdState = input.getDouble("missionDaysThirdState"),
            expectedSwissTaxedDays = expected.getDouble("swissTaxedDays"),
            expectedFrenchTaxedDays = expected.getDouble("frenchTaxedDays"),
            expectedRegimeApplies = expected.getBoolean("regimeApplies"),
        )
    }
}

class GenevaWaterfallTest : FunSpec({
    val cases = readGenevaCases()

    test("reads all six published cases, so the suite cannot pass vacuously") {
        cases.map { it.id } shouldBe listOf("a", "b", "c", "d", "e", "special")
    }

    // All six cases share commonInput: GE, full-time, full-year, Simplified240
    // -> totalWorkDays 240, missionCap 10 (SPEC 7.1's own worked examples).
    val totalWorkDays =
        resolveDenominator(DenominatorMethod.Simplified240, 100, 1.0, RULES).totalWorkDays
    val missionCap = missionCapFor(DenominatorMethod.Simplified240, 100, 1.0, RULES)

    cases.forEach { case ->
        test("case ${case.id}: swissTaxedDays, frenchTaxedDays, regimeApplies") {
            val outcome =
                runWaterfall(
                    WaterfallInput(
                        totalWorkDays = totalWorkDays,
                        missionCap = missionCap,
                        teleworkDays = case.teleworkDays,
                        missionDaysFrance = case.missionDaysFrance,
                        missionDaysThirdState = case.missionDaysThirdState,
                    ),
                    RULES,
                )

            outcome.swissTaxedDays shouldBe case.expectedSwissTaxedDays
            outcome.frenchTaxedDays shouldBe case.expectedFrenchTaxedDays
            outcome.regimeApplies shouldBe case.expectedRegimeApplies
        }

        test("case ${case.id}: accounts for every working day") {
            // Invariant 1 of SPEC 7.6, checked on the published cases: no
            // day is taxed twice and none goes missing.
            val outcome =
                runWaterfall(
                    WaterfallInput(
                        totalWorkDays = totalWorkDays,
                        missionCap = missionCap,
                        teleworkDays = case.teleworkDays,
                        missionDaysFrance = case.missionDaysFrance,
                        missionDaysThirdState = case.missionDaysThirdState,
                    ),
                    RULES,
                )

            (outcome.swissTaxedDays + outcome.frenchTaxedDays) shouldBe totalWorkDays.toDouble()
        }
    }
})
