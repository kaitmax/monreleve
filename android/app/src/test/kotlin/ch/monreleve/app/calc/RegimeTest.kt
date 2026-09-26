package ch.monreleve.app.calc

// AN2 increment 2. Matches web/tests/unit/calc-engine/regime.test.ts's own
// cases - SPEC section 7.2 step 1. Every canton is written out with its
// expected regime, deliberately: looping over the implementation's own list
// would assert only that the list equals itself, and the eight-canton list
// is a regulatory fact worth spelling out where a reviewer can read it
// against the 1983 accord.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

private val CASES =
    listOf(
        Canton.AG to Regime.SOURCE,
        Canton.AI to Regime.SOURCE,
        Canton.AR to Regime.SOURCE,
        Canton.BE to Regime.RESIDENCE_1983,
        Canton.BL to Regime.RESIDENCE_1983,
        Canton.BS to Regime.RESIDENCE_1983,
        Canton.FR to Regime.SOURCE,
        Canton.GE to Regime.SOURCE,
        Canton.GL to Regime.SOURCE,
        Canton.GR to Regime.SOURCE,
        Canton.JU to Regime.RESIDENCE_1983,
        Canton.LU to Regime.SOURCE,
        Canton.NE to Regime.RESIDENCE_1983,
        Canton.NW to Regime.SOURCE,
        Canton.OW to Regime.SOURCE,
        Canton.SG to Regime.SOURCE,
        Canton.SH to Regime.SOURCE,
        Canton.SO to Regime.RESIDENCE_1983,
        Canton.SZ to Regime.SOURCE,
        Canton.TG to Regime.SOURCE,
        Canton.TI to Regime.SOURCE,
        Canton.UR to Regime.SOURCE,
        Canton.VD to Regime.RESIDENCE_1983,
        Canton.VS to Regime.RESIDENCE_1983,
        Canton.ZG to Regime.SOURCE,
        Canton.ZH to Regime.SOURCE,
    )

class RegimeTest : FunSpec({
    CASES.forEach { (canton, expected) ->
        test("$canton is $expected") {
            regimeFor(canton) shouldBe expected
        }
    }

    test("covers all 26 cantons, so no canton is silently untested") {
        CASES.size shouldBe 26
        CASES.map { it.first }.toSet().size shouldBe 26
    }

    test("classifies exactly eight cantons as residence-1983") {
        val residence = CASES.filter { it.second == Regime.RESIDENCE_1983 }

        residence.size shouldBe 8
        residence.map { it.first.name }.sorted() shouldBe
            listOf("BE", "BL", "BS", "JU", "NE", "SO", "VD", "VS")
    }

    test("GE is source - Geneva is where the worked examples come from") {
        // Worth its own case: the canton every fixture uses is NOT a 1983
        // canton, so a bug that inverted the test would still pass the
        // Geneva fixtures.
        regimeFor(Canton.GE) shouldBe Regime.SOURCE
    }
})
