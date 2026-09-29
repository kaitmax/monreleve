package ch.monreleve.app.releve

import ch.monreleve.app.dossier.DossierMonth
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN11 increment 1. The ONE device-side arithmetic on the Releve screen: the mobile table merges the two
// mission columns. This asserts it sums the server's two fields, and a plant (change + to - in
// mergedMissionDays) turns it RED - proof the test bites, since every other figure on the screen is read
// straight from the payload.

private fun month(
    france: Double,
    third: Double,
): DossierMonth =
    DossierMonth(
        month = 6,
        swissDays = 8.0,
        teleworkDays = 4.0,
        missionDaysFrance = france,
        missionDaysThirdState = third,
        absenceDays = 0.0,
        cumulativeDeclarableRate = 18.33,
    )

class ReleveViewTest : FunSpec({
    test("merged missions is Mission FR + Mission tiers, from the server's own fields") {
        mergedMissionDays(month(france = 1.0, third = 2.0)) shouldBe 3.0
    }

    test("a half-day mission on each side sums to one, not two") {
        mergedMissionDays(month(france = 0.5, third = 0.5)) shouldBe 1.0
    }

    test("no missions is zero, never a stray addend") {
        mergedMissionDays(month(france = 0.0, third = 0.0)) shouldBe 0.0
    }
})
