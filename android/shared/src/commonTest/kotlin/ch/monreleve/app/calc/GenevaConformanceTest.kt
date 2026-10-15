package ch.monreleve.app.calc

// KMP-0 increment 4 (R370). The Geneva AC1 conformance (SPEC 7.5), now in commonTest with kotlin.test, so the
// day the iOS targets build the six AFC-published cases run on iOS too - the whole point of moving the engine
// into :shared. It reads the SAME fixtures/geneva-cases.json as the TypeScript suite (R206), reaching it as the
// generated FixtureJson constant (R370, no file access) and parsing it with the common JSON reader (org.json
// and kotlinx.serialization are out of scope). It asserts the SAME four published fields the Kotest version in
// :app asserts - declarableRate, swissTaxedDays, frenchTaxedDays, regimeApplies - plus the day-partition
// invariant (SPEC 7.6 #1). Both versions run green side by side until the Kotest one is retired (R373, inc 7).
//
// "If any fails, nothing ships" (SPEC 7.5). No snapshots (SPEC 7.6).

import ch.monreleve.app.shared.fixtures.FixtureJson
import ch.monreleve.app.shared.fixtures.Json
import ch.monreleve.app.shared.fixtures.arr
import ch.monreleve.app.shared.fixtures.asObj
import ch.monreleve.app.shared.fixtures.bool
import ch.monreleve.app.shared.fixtures.double
import ch.monreleve.app.shared.fixtures.int
import ch.monreleve.app.shared.fixtures.obj
import ch.monreleve.app.shared.fixtures.parseJson
import ch.monreleve.app.shared.fixtures.str
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GenevaConformanceTest {
    private data class GenevaCase(
        val id: String,
        val teleworkDays: Double,
        val missionDaysFrance: Double,
        val missionDaysThirdState: Double,
        val expectedSwissTaxedDays: Double,
        val expectedFrenchTaxedDays: Double,
        val expectedDeclarableRate: Double,
        val expectedRegimeApplies: Boolean,
    )

    private fun granularityFor(tag: String): Granularity =
        when (tag) {
            "day" -> Granularity.DAY
            "halfDay" -> Granularity.HALF_DAY
            "hours" -> Granularity.HOURS
            else -> error("unknown granularity tag in fixture: $tag")
        }

    private fun denominatorFor(node: Json.Obj): DenominatorMethod =
        when (val kind = node.str("kind")) {
            "simplified240" -> DenominatorMethod.Simplified240
            "exact" -> DenominatorMethod.Exact(node.int("totalWorkDays"))
            else -> error("unknown denominator kind in fixture: $kind")
        }

    private fun baseInput(commonInput: Json.Obj): TeleworkInput =
        TeleworkInput(
            taxYear = commonInput.int("taxYear"),
            canton = Canton.valueOf(commonInput.str("canton")),
            employmentRate = commonInput.int("employmentRate"),
            periodFraction = commonInput.double("periodFraction"),
            denominator = denominatorFor(commonInput.obj("denominator")),
            granularity = granularityFor(commonInput.str("granularity")),
            teleworkDays = 0.0,
            missionDaysFrance = 0.0,
            missionDaysThirdState = 0.0,
        )

    private fun readCases(root: Json.Obj): List<GenevaCase> =
        root.arr("cases").items.map { element ->
            val case = element.asObj()
            val input = case.obj("input")
            val expected = case.obj("expected")
            GenevaCase(
                id = case.str("id"),
                teleworkDays = input.double("teleworkDays"),
                missionDaysFrance = input.double("missionDaysFrance"),
                missionDaysThirdState = input.double("missionDaysThirdState"),
                expectedSwissTaxedDays = expected.double("swissTaxedDays"),
                expectedFrenchTaxedDays = expected.double("frenchTaxedDays"),
                expectedDeclarableRate = expected.double("declarableRate"),
                expectedRegimeApplies = expected.bool("regimeApplies"),
            )
        }

    @Test
    fun readsAllSixPublishedCasesSoItCannotPassVacuously() {
        val root = parseJson(FixtureJson.GENEVA_CASES_JSON).asObj()
        val ids = readCases(root).map { it.id }
        assertEquals(listOf("a", "b", "c", "d", "e", "special"), ids)
    }

    @Test
    fun everyPublishedCaseProducesTheAfcResult() {
        val root = parseJson(FixtureJson.GENEVA_CASES_JSON).asObj()
        val base = baseInput(root.obj("commonInput"))
        readCases(root).forEach { case ->
            val input =
                base.copy(
                    teleworkDays = case.teleworkDays,
                    missionDaysFrance = case.missionDaysFrance,
                    missionDaysThirdState = case.missionDaysThirdState,
                )
            val result = calculateTelework(input)
            assertTrue(result is CalcResult.Ok, "case ${case.id}: engine returned an error")
            result as CalcResult.Ok
            assertEquals(case.expectedDeclarableRate, result.value.declarableRate, "case ${case.id}: declarableRate")
            assertEquals(case.expectedSwissTaxedDays, result.value.swissTaxedDays, "case ${case.id}: swissTaxedDays")
            assertEquals(case.expectedFrenchTaxedDays, result.value.frenchTaxedDays, "case ${case.id}: frenchTaxedDays")
            assertEquals(case.expectedRegimeApplies, result.value.regimeApplies, "case ${case.id}: regimeApplies")
            // SPEC 7.6 #1: no working day is taxed twice and none goes missing.
            assertEquals(
                result.value.totalWorkDays.toDouble(),
                result.value.swissTaxedDays + result.value.frenchTaxedDays,
                "case ${case.id}: day partition",
            )
        }
    }
}
