package ch.monreleve.app.calc

// AN2 increment 2. Matches the "denominator conformance suite (ruling R10)"
// block in web/tests/unit/calc-engine/fixtures.test.ts - these cases exist
// ONLY because of binary floating point (fixtures/denominator-cases.json's
// own $comment), and are shared rather than TypeScript-only because the
// Kotlin port shares the exact same defect class and must share the guard.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import org.json.JSONObject

private val RULES = ruleSetFor(2026)

private data class DenominatorCase(
    val id: String,
    val employmentRate: Int,
    val periodFraction: Double,
    val simplifiedBasisDays: Int,
    val expectedTotalWorkDays: Int,
)

private fun readDenominatorCases(): List<DenominatorCase> {
    val json = JSONObject(fixtureFile("denominator-cases.json").readText())
    val array = json.getJSONArray("cases")

    return (0 until array.length()).map { i ->
        val case = array.getJSONObject(i)
        val ratio = case.getJSONArray("periodFractionRatio")

        DenominatorCase(
            id = case.getString("id"),
            employmentRate = case.getInt("employmentRate"),
            // The ratio is divided here, never transcribed as a decimal:
            // 7/12 written out parses to a different double than 7/12
            // computed, which would not reproduce the defect this fixture
            // exists to pin.
            periodFraction = ratio.getDouble(0) / ratio.getDouble(1),
            simplifiedBasisDays = case.getInt("simplifiedBasisDays"),
            expectedTotalWorkDays = case.getInt("expectedTotalWorkDays"),
        )
    }
}

class DenominatorConformanceTest : FunSpec({
    val cases = readDenominatorCases()

    test("reads every case, so the suite cannot pass vacuously") {
        (cases.size >= 5) shouldBe true
    }

    cases.forEach { case ->
        test("${case.id} gives ${case.expectedTotalWorkDays} days") {
            val outcome =
                resolveDenominator(
                    DenominatorMethod.Simplified240,
                    case.employmentRate,
                    case.periodFraction,
                    RULES,
                )

            outcome.totalWorkDays shouldBe case.expectedTotalWorkDays
        }
    }

    test("uses the basis the fixture states, so a drift in RuleSet is caught") {
        cases.forEach { case ->
            case.simplifiedBasisDays shouldBe RULES.simplifiedBasisDays
        }
    }
})
