package ch.monreleve.app.ui.screens.calendrier

import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.LegendCopy
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-CAL2 defects 1-2 (the month counts row). The row must show ALL of the legend's four kinds plus the
// unrecorded count - five tiles - each reading from the one MonthSummary (R328). The operator's screenshot
// showed Absence with no count: the model counted it (MonthSummary.absent) but the row omitted the tile.

class MonthSummaryTilesTest : FunSpec({
    test("the counts row shows five tiles - Suisse, Domicile, Mission, Absence, Non renseigné (defects 1-2)") {
        val summary =
            MonthSummary(suisse = 3.0, domicile = 2.0, mission = 1.5, nonRenseigne = 4.0, absent = 2.5)

        val tiles = monthSummaryTiles(summary)

        tiles.map { it.label } shouldBe
            listOf(
                LegendCopy.forKind("S"),
                LegendCopy.forKind("D"),
                LegendCopy.forKind("M"),
                LegendCopy.forKind("A"),
                CalendarCopy.NON_RENSEIGNE,
            )
        tiles.map { it.value } shouldBe listOf(3.0, 2.0, 1.5, 2.5, 4.0)
    }

    test("the Absence tile carries the summary's absence count - the count that was missing (defect 2)") {
        val summary =
            MonthSummary(suisse = 0.0, domicile = 0.0, mission = 0.0, nonRenseigne = 0.0, absent = 7.0)

        val tiles = monthSummaryTiles(summary)

        tiles.single { it.label == LegendCopy.forKind("A") }.value shouldBe 7.0
    }
})
