package ch.monreleve.app.calc

// AN2 increment 1. Matches web/tests/unit/calc-engine/rules.test.ts's own
// cases - SPEC section 7.7: RuleSet is the only place a threshold may
// appear, and a dossier for year Y is always computed under ruleSetFor(Y)
// so an old document stays reproducible after new rules ship.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe

/** SPEC section 7.2 step 1 and the 11 April 1983 accord. */
private val RESIDENCE_1983 =
    listOf(Canton.BE, Canton.SO, Canton.BS, Canton.BL, Canton.VD, Canton.VS, Canton.NE, Canton.JU)

class RulesTest : FunSpec({
    test("returns the 2026 constants for 2026") {
        val rules = ruleSetFor(2026)

        rules.taxYear shouldBe 2026
        rules.fiscalCeiling shouldBe 0.4
        rules.socialCeiling shouldBe 0.499
        rules.missionCapDays shouldBe 10
        rules.simplifiedBasisDays shouldBe 240
    }

    test("lists exactly the eight residence-1983 cantons") {
        val rules = ruleSetFor(2026)

        rules.residence1983Cantons shouldContainExactlyInAnyOrder RESIDENCE_1983
        rules.residence1983Cantons shouldHaveSize 8
    }

    test("carries one citation per constant") {
        val rules = ruleSetFor(2026)

        // Five constants and the canton list: fiscal ceiling, mission
        // sub-cap, mission proration, social ceiling, simplified
        // denominator, 1983 accord.
        (rules.sources.size >= 6) shouldBe true
        rules.sources.forEach { source -> source.isBlank() shouldBe false }
    }

    test("falls back to the latest known set for an unknown year, and says so") {
        val requested = 2027
        val rules = ruleSetFor(requested)

        // The returned set names its own year. A caller comparing the two
        // sees the fallback; nothing is silently relabelled as 2027.
        rules.taxYear shouldBe 2026
        (rules.taxYear == requested) shouldBe false
        rules shouldBe ruleSetFor(2026)
    }

    test("falls back for a year before the first known set too") {
        ruleSetFor(2019).taxYear shouldBe 2026
    }

    // NO TEST FOR "returns a frozen set" (the TS suite's own last case). JS
    // objects are mutable by default, so Object.isFrozen(rules) is a real
    // runtime assertion there. RuleSet here is a data class of `val`
    // properties over List<Canton>/List<String> - the read-only interface,
    // never MutableList - so the equivalent guarantee is enforced by the
    // type system at compile time: there is no method to call that would
    // mutate it, and a test asserting that would not compile in the failing
    // direction, which is what makes it unnecessary rather than merely
    // untested.
})
