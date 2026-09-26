package ch.monreleve.app.calc

// AN2 increment 4, AC4. fixtures/rate-cases.json's own "contract" field:
// "BOTH the TypeScript engine and the Kotlin engine MUST consume this
// file." Not named in tasks/todo.md's own AN2 description, but in scope by
// the fixture's own words rather than by omission (relay/AN2.txt's own
// PRE-STEP note). All 72 cases exist ONLY because of binary floating
// point - a rule declarableRateFor and this file's own $comment both name
// as the reason this fixture is shared rather than TypeScript-only.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

private data class RateCase(
    val id: String,
    val numerator: Int,
    val denominator: Int,
    val expectedDeclarableRate: Double,
)

private fun readRateCases(): List<RateCase> {
    val json = JSONObject(fixtureFile("rate-cases.json").readText())
    val array = json.getJSONArray("cases")

    return (0 until array.length()).map { i ->
        val case = array.getJSONObject(i)

        RateCase(
            id = case.getString("id"),
            numerator = case.getInt("numerator"),
            denominator = case.getInt("denominator"),
            expectedDeclarableRate = case.getDouble("expectedDeclarableRate"),
        )
    }
}

class RateConformanceTest : FunSpec({
    val cases = readRateCases()

    test("reads all 72 published cases, so the suite cannot pass vacuously") {
        cases.size shouldBe 72
    }

    cases.forEach { case ->
        test("${case.id}: ${case.numerator}/${case.denominator} gives ${case.expectedDeclarableRate}%") {
            declarableRateFor(case.numerator.toDouble(), case.denominator) shouldBe case.expectedDeclarableRate
        }
    }
})
