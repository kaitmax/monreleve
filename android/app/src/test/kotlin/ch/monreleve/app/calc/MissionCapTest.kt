package ch.monreleve.app.calc

// AN2 increment 2, CORRECTED at ENGINE-PARITY. Matches
// web/tests/unit/calc-engine/mission-cap.test.ts. The 10-day mission sub-cap
// prorates for part-time AND partial years, rounded up (SPEC 7.2 step 4), under
// BOTH denominator methods. SETTLED by the accord amiable FR-CH of 29 April
// 2026, clause 1(d): for a part-time employee over the whole year, or an
// employee over less than a full calendar year, the 10-day annual limit is
// adjusted proportionally and rounded up, with NO condition on how the working
// days are counted.
//
// This REPLACES the former reading (ruling R19) that, under the exact method,
// prorated by periodFraction ONLY on the rationale that an employer-supplied
// total already embodies the working-time rate; the accord prorates the LIMIT
// regardless. Authorised by the operator ruling of 2026-10-11 ("fix the engine
// then apply the copy"). What REMAINS Mon Releve's reading (PROVISIONAL) is the
// COMBINED part-time AND partial-year case, which 1(d) names as two separate
// situations. EXACT_METHOD_UNVERIFIED still fires on the exact path.

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
    context("mission cap conformance suite (accord 1d, shared)") {
        val (note, cases) = readMissionCapCases()

        test("records that the accord settles the proration and only the combined case stays a reading") {
            // The cap proration is now SETTLED by the accord 1(d); what remains
            // PROVISIONAL (Mon Releve's reading) is the COMBINED part-time +
            // partial year case. The note must carry all three, so neither reads
            // as the whole truth - this mirrors the web suite's assertion.
            note shouldContain "1(d)"
            note shouldContain "PROVISIONAL"
            note shouldContain "COMBINED"
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

    context("missionCapFor under Exact - prorates by BOTH factors (accord 1d)") {
        test("prorates by employmentRate, now that the accord settles the question") {
            // The change the accord makes. These three expectations were 10
            // under the old PROVISIONAL R19 reading (prorate by period only
            // under exact). The accord prorates the 10-day LIMIT for a
            // part-timer with NO condition on the denominator method, so the
            // exact method now prorates by employmentRate like the simplified
            // one. Operator ruling 2026-10-11.
            missionCapFor(DenominatorMethod.Exact(200), 50, 1.0, RULES) shouldBe 5 // was 10
            missionCapFor(DenominatorMethod.Exact(120), 45, 1.0, RULES) shouldBe 5 // ceil(4.5), was 10
            missionCapFor(DenominatorMethod.Exact(24), 1, 1.0, RULES) shouldBe 1 // ceil(0.1), was 10
        }

        test("prorates by the period too, which never depended on the method") {
            // A mid-year start is a fact about the calendar, so an annual total
            // for a half year still gets half the cap.
            missionCapFor(DenominatorMethod.Exact(100), 100, 0.5, RULES) shouldBe 5
        }

        test("prorates by BOTH factors when both bind - the combined case (see the fixture note)") {
            // 1(d) names part-time and partial-year SEPARATELY; applying both
            // factors at once is Mon Releve's reading, carried in the fixture
            // note. It matches what Simplified240 already does when both bind.
            missionCapFor(DenominatorMethod.Exact(100), 50, 0.5, RULES) shouldBe 3 // ceil(2.5), was 5
            missionCapFor(DenominatorMethod.Exact(120), 45, 7.0 / 12, RULES) shouldBe 3 // ceil(2.625)
        }

        test("rounds up, as under the simplified basis") {
            missionCapFor(DenominatorMethod.Exact(100), 100, 7.0 / 12, RULES) shouldBe 6 // ceil(5.833)
        }

        test("agrees with Simplified240 everywhere now, not only at full time") {
            // The two readings used to diverge for a part-timer; after the
            // accord they agree on every input, which is the whole point of the
            // correction.
            listOf(
                100 to 1.0,
                50 to 1.0,
                80 to 1.0,
                45 to 7.0 / 12,
                1 to 1.0,
            ).forEach { (rate, period) ->
                missionCapFor(DenominatorMethod.Exact(240), rate, period, RULES) shouldBe
                    missionCapFor(DenominatorMethod.Simplified240, rate, period, RULES)
            }
        }
    }

    context("the accord amiable FR-CH of 29 April 2026, clause 1(d)") {
        test("prorates the cap by employmentRate under the exact method: 80% gives 8") {
            missionCapFor(DenominatorMethod.Exact(192), 80, 1.0, RULES) shouldBe 8
        }

        test("flows through calculateTelework: an 80% exact part-timer credits 8 mission days, not 10") {
            val result =
                calculateTelework(
                    TeleworkInput(
                        taxYear = 2026,
                        canton = Canton.GE,
                        employmentRate = 80,
                        periodFraction = 1.0,
                        denominator = DenominatorMethod.Exact(192),
                        granularity = Granularity.DAY,
                        teleworkDays = 0.0,
                        missionDaysFrance = 12.0,
                        missionDaysThirdState = 0.0,
                    ),
                )

            (result is CalcResult.Ok) shouldBe true
            if (result is CalcResult.Ok) {
                result.value.missionCap shouldBe 8 // ceil(10 * 0.80)
                result.value.creditedMissionDays shouldBe 8.0 // 12 France missions, capped at 8
            }
        }
    }
})
