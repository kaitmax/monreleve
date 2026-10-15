package ch.monreleve.app.calc

// AN2 increment 5. Matches web/tests/unit/calc-engine/warnings.test.ts's own
// cases - SPEC 7.4's Warning union plus RuleSetFallback from ruling R11.
// Eight variants. A warning is not an error: the result is still computed
// and returned.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import java.io.File

private val RULES = ruleSetFor(2026)

/**
 * Geneva shape: 240 days, a 96-day ceiling, a 10-day mission cap.
 * teleworkDays defaults to the same 72 as daysCountedAgainstCeiling, which
 * is 30% of the 240-day default and therefore inside the framework
 * agreement's band - that keeps A1Required firing for every case that does
 * not care about it, exactly as it did under the old standing-obligation
 * trigger.
 */
private val DEFAULT_CONTEXT =
    WarningContext(
        regime = Regime.SOURCE,
        regimeApplies = true,
        daysCountedAgainstCeiling = 72.0,
        teleworkDays = 72.0,
        headroomDays = 24.0,
        missionDaysTotal = 0.0,
        missionCap = 10,
        totalWorkDays = 240,
        requestedTaxYear = 2026,
        denominatorWarnings = emptyList(),
    )

/** Applies overrides to DEFAULT_CONTEXT via .copy(), avoiding a long parameter list. */
private fun at(overrides: WarningContext.() -> WarningContext = { this }): List<Warning> {
    return warningsFor(DEFAULT_CONTEXT.overrides(), RULES)
}

class WarningsTest : FunSpec({
    context("warningsFor - the fiscal ceiling") {
        test("warns when the regime is lost, and carries the regime") {
            val warnings = at { copy(regimeApplies = false, daysCountedAgainstCeiling = 144.0) }
            val fiscal = warnings.filterIsInstance<Warning.FiscalCeilingExceeded>().firstOrNull()

            fiscal?.regime shouldBe Regime.SOURCE
        }

        test("stays quiet while the regime applies") {
            at().filterIsInstance<Warning.FiscalCeilingExceeded>() shouldBe emptyList()
        }
    }

    context("warningsFor - FrontalierStatusAtRisk is residence-1983 only") {
        test("fires for a 1983 canton that has lost the regime") {
            val warnings =
                at { copy(regime = Regime.RESIDENCE_1983, regimeApplies = false, daysCountedAgainstCeiling = 144.0) }

            warnings shouldContain Warning.FrontalierStatusAtRisk
        }

        test("does NOT fire for a source canton that has lost the regime") {
            // Under SOURCE the consequence is French tax on the excess
            // days. The status itself is only at risk under the 1983
            // accord, and telling a Geneva frontalier their status is at
            // risk would be false.
            val warnings = at { copy(regimeApplies = false, daysCountedAgainstCeiling = 144.0) }

            warnings shouldNotContain Warning.FrontalierStatusAtRisk
        }

        test("does NOT fire for a 1983 canton inside the ceiling") {
            at { copy(regime = Regime.RESIDENCE_1983) } shouldNotContain Warning.FrontalierStatusAtRisk
        }
    }

    context("warningsFor - the mission cap and headroom") {
        test("reports the cap and the excess when missions exceed the cap") {
            val warnings = at { copy(missionDaysTotal = 24.0, headroomDays = 12.0) }
            val cap = warnings.filterIsInstance<Warning.MissionCapExceeded>().firstOrNull()

            cap?.cap shouldBe 10
            cap?.excess shouldBe 14.0 // 24 - 10
        }

        test("reports the excess when headroom, not the cap, is the constraint") {
            // Geneva case d: 2 days of room against a 10-day cap and 12
            // mission days.
            val warnings = at { copy(missionDaysTotal = 12.0, headroomDays = 2.0) }
            val headroom = warnings.filterIsInstance<Warning.MissionsExceedHeadroom>().firstOrNull()

            headroom?.excess shouldBe 10.0 // 12 - 2
        }

        test("reports both when both bind") {
            // 12 missions, cap 10, headroom 2: over the cap by 2 and over
            // the room by 10. They are different facts and a user needs
            // both.
            val warnings = at { copy(missionDaysTotal = 12.0, headroomDays = 2.0) }

            warnings.any { it is Warning.MissionCapExceeded } shouldBe true
            warnings.any { it is Warning.MissionsExceedHeadroom } shouldBe true
        }

        test("stays quiet when every mission day is credited") {
            val warnings = at { copy(missionDaysTotal = 3.0, headroomDays = 24.0) }

            warnings.any { it is Warning.MissionCapExceeded } shouldBe false
            warnings.any { it is Warning.MissionsExceedHeadroom } shouldBe false
        }

        test("does not report a headroom excess once the regime is already lost") {
            // There is no headroom to exceed: the ceiling is already
            // breached and FiscalCeilingExceeded is the fact that matters.
            val warnings =
                at { copy(regimeApplies = false, daysCountedAgainstCeiling = 144.0, missionDaysTotal = 5.0) }

            warnings.any { it is Warning.MissionsExceedHeadroom } shouldBe false
        }
    }

    context("warningsFor - the social ceiling") {
        test("fires above 49.9% of the denominator") {
            // 120 of 240 is 50%, past 119.76.
            at { copy(daysCountedAgainstCeiling = 120.0, regimeApplies = false) } shouldContain
                Warning.SocialCeilingExceeded
        }

        test("stays quiet just below") {
            at { copy(daysCountedAgainstCeiling = 119.0, regimeApplies = false) } shouldNotContain
                Warning.SocialCeilingExceeded
        }
    }

    context("warningsFor - pass-through and fallback") {
        test("passes the denominator warnings through") {
            val warnings = at { copy(denominatorWarnings = listOf(Warning.ExactMethodUnverified)) }

            warnings shouldContain Warning.ExactMethodUnverified
        }

        test("emits RuleSetFallback with both years when they differ (R11)") {
            val warnings = at { copy(requestedTaxYear = 2027) }
            val fallback = warnings.filterIsInstance<Warning.RuleSetFallback>().firstOrNull()

            fallback?.requestedYear shouldBe 2027
            fallback?.appliedYear shouldBe 2026
        }

        test("stays quiet when the requested year has its own rule set") {
            at { copy(requestedTaxYear = 2026) }.any { it is Warning.RuleSetFallback } shouldBe false
        }
    }

    context("warningsFor - A1Required, at the 25% threshold") {
        // CHECKPOINT A REPLACED THIS TRIGGER, and the old one was a reading
        // rather than a rule. THE RULE: the EU framework agreement on
        // cross-border telework applies from 25% telework in the state of
        // residence up to (but not including) 50%. Below 25%, article 13
        // of regulation (EC) 883/2004 governs instead.
        //
        // TELEWORK DAYS, NOT DAYS COUNTED AGAINST THE CEILING. The fiscal
        // ceiling counts telework PLUS credited mission days; the
        // framework agreement is about work performed in the state of
        // RESIDENCE. A mission day in a third state is neither.

        test("fires at exactly 25%, the bottom of the band") {
            // The boundary is INCLUSIVE: the agreement applies "from 25%".
            at { copy(teleworkDays = 60.0, totalWorkDays = 240) } shouldContain Warning.A1Required
        }

        test("stays quiet just below 25%") {
            // 59.5/240 is 24.79%. Article 13 governs here, not the
            // framework agreement.
            at { copy(teleworkDays = 59.5, totalWorkDays = 240) } shouldNotContain Warning.A1Required
        }

        test("fires well inside the band") {
            at { copy(teleworkDays = 94.0, totalWorkDays = 240) } shouldContain Warning.A1Required
        }

        test("stays quiet when there is no telework at all") {
            at { copy(teleworkDays = 0.0, totalWorkDays = 240) } shouldNotContain Warning.A1Required
        }

        test("ignores mission days, which the agreement does not address") {
            // 24 telework days of 240 is 10%, below the threshold. Adding
            // 40 mission days would push days-counted-against-the-ceiling
            // to 26.7% and the OLD trigger would have fired. Work in a
            // third state is not telework in the state of residence.
            val warnings =
                at {
                    copy(
                        teleworkDays = 24.0,
                        missionDaysTotal = 40.0,
                        daysCountedAgainstCeiling = 64.0,
                        totalWorkDays = 240,
                    )
                }

            warnings shouldNotContain Warning.A1Required
        }

        test("reads the threshold from the RuleSet rather than a literal") {
            // SPEC 7.7: "RuleSet is the only place a threshold may appear."
            // A bare 0.25 in Warnings.kt would be a review rejection like a
            // bare 0.4.
            ruleSetFor(2026).a1ThresholdRate shouldBe 0.25
        }

        test("is no longer marked PROVISIONAL in the Kotlin source either") {
            // The marker came off at Checkpoint A on the TypeScript side.
            // If either source still calls this a provisional trigger, the
            // comment is a claim the code no longer makes true (R154's
            // shape).
            val source =
                File(repoRoot(), "android/shared/src/commonMain/kotlin/ch/monreleve/app/calc/Warnings.kt")
                    .readText()
            val a1Block = source.substring(maxOf(0, source.indexOf("A1Required") - 1800))

            (a1Block.contains("PROVISIONAL TRIGGER")) shouldBe false
            (a1Block.contains("a1ThresholdRate")) shouldBe true
        }
    }
})
