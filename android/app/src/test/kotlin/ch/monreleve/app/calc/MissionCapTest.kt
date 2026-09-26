package ch.monreleve.app.calc

// AN2 increment 2. Matches web/tests/unit/calc-engine/mission-cap.test.ts's
// own cases - ruling R19, PROVISIONAL. The 10-day mission sub-cap prorates
// for part-time and partial years, rounded up (SPEC 7.2 step 4). What the
// sources do not say is how it prorates when the employer supplies an EXACT
// annual total - the interim interpretation is that under Exact the cap
// prorates by periodFraction ONLY, and under Simplified240 by both, because
// the 240-day basis is a full-time figure not yet reduced.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.json.JSONObject

private val RULES = ruleSetFor(2026)

private data class MissionCapCase(
    val id: String,
    val method: DenominatorMethod,
    val employmentRate: Int,
    val periodFraction: Double,
    val expectedMissionCap: Int,
)

private fun readMissionCapCases(): Pair<String, List<MissionCapCase>> {
    val json = JSONObject(fixtureFile("denominator-cases.json").readText())
    val note = json.getString("missionCapNote")
    val array = json.getJSONArray("missionCapCases")

    val cases =
        (0 until array.length()).map { i ->
            val case = array.getJSONObject(i)
            val ratio = case.getJSONArray("periodFractionRatio")
            val method =
                if (case.getString("denominatorKind") == "exact") {
                    DenominatorMethod.Exact(case.optInt("suppliedTotalWorkDays", 0))
                } else {
                    DenominatorMethod.Simplified240
                }

            MissionCapCase(
                id = case.getString("id"),
                method = method,
                employmentRate = case.getInt("employmentRate"),
                periodFraction = ratio.getDouble(0) / ratio.getDouble(1),
                expectedMissionCap = case.getInt("expectedMissionCap"),
            )
        }

    return note to cases
}

class MissionCapTest : FunSpec({
    context("mission cap conformance suite (ruling R19, shared)") {
        val (note, cases) = readMissionCapCases()

        test("records that the interpretation is provisional") {
            note shouldContain "PROVISIONAL"
        }

        test("reads every case, so the suite cannot pass vacuously") {
            (cases.isNotEmpty()) shouldBe true
        }

        cases.forEach { case ->
            test("${case.id} gives ${case.expectedMissionCap}") {
                missionCapFor(case.method, case.employmentRate, case.periodFraction, RULES) shouldBe
                    case.expectedMissionCap
            }
        }
    }

    context("missionCapFor under Simplified240 - prorates by BOTH factors") {
        // Triple(1, 1.0, 1) is ceil(10 * 0.01) = 1. Triple(45, 1.0, 5) is ceil(4.5), rounds up.
        listOf(
            Triple(1, 1.0, 1),
            Triple(50, 1.0, 5),
            Triple(80, 1.0, 8),
            Triple(100, 1.0, 10),
            Triple(45, 1.0, 5),
        ).forEach { (rate, fraction, expected) ->
            test("rate $rate over period $fraction gives $expected") {
                missionCapFor(DenominatorMethod.Simplified240, rate, fraction, RULES) shouldBe expected
            }
        }

        test("prorates by the period as well") {
            missionCapFor(DenominatorMethod.Simplified240, 100, 0.5, RULES) shouldBe 5
            missionCapFor(DenominatorMethod.Simplified240, 45, 7.0 / 12, RULES) shouldBe 3 // ceil(2.625)
        }
    }

    context("missionCapFor under Exact - prorates by the PERIOD ONLY (R19)") {
        test("ignores employmentRate, because the supplied total already reflects it") {
            // The change R19 makes. Before the ruling this returned 5,
            // double-counting the part-time reduction that the employer's
            // own 200-day total already embodies.
            missionCapFor(DenominatorMethod.Exact(200), 50, 1.0, RULES) shouldBe 10
            missionCapFor(DenominatorMethod.Exact(120), 45, 1.0, RULES) shouldBe 10
            missionCapFor(DenominatorMethod.Exact(24), 1, 1.0, RULES) shouldBe 10
        }

        test("still prorates by the period, which the total does not embody") {
            // A mid-year start is a fact about the calendar, not about the
            // working rate, so an annual total for a half year still gets
            // half the cap.
            missionCapFor(DenominatorMethod.Exact(100), 100, 0.5, RULES) shouldBe 5
            missionCapFor(DenominatorMethod.Exact(100), 50, 0.5, RULES) shouldBe 5
        }

        test("rounds up, as under the simplified basis") {
            missionCapFor(DenominatorMethod.Exact(100), 100, 7.0 / 12, RULES) shouldBe 6 // ceil(5.833)
        }

        test("agrees with Simplified240 at full time and full year") {
            // The two readings only diverge for a part-timer, which is why
            // this went unnoticed until the interpretation was put in
            // writing.
            missionCapFor(DenominatorMethod.Exact(240), 100, 1.0, RULES) shouldBe
                missionCapFor(DenominatorMethod.Simplified240, 100, 1.0, RULES)
        }
    }
})
