package ch.monreleve.app.ui.screens.calendrier

import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.LegendCopy

// AN-CAL2 defects 1-2. The month counts row, as a PURE list of tiles so the "all four kinds carry a count"
// rule is JVM-testable rather than only visible in a screenshot. Each tile is a short label and the count
// shown under it; the composable (CalendrierScreen.MonthSummaryRow) only lays these out.
//
// ONE WAY OF COUNTING (R328). Every value comes from the ONE MonthSummary buildMonthView.summarise builds;
// this adds no second count. Labels come from the one homes too - the kind names from LegendCopy by the
// enum's letter (the same key the legend uses), « Non renseigné » from CalendarCopy - so a tile label and
// the legend can never drift apart (R206).

/** One tile of the counts row: a short label and the count centred under it. */
data class SummaryTile(
    val label: String,
    val value: Double,
)

/**
 * The month counts, one tile each. Absence (defect 2) is the fifth: the legend names four kinds and the
 * model already counts absences (MonthSummary.absent, AN-HOME), but the calendar's row omitted it, so an
 * absence had no count. All five now read from the one summary.
 */
fun monthSummaryTiles(summary: MonthSummary): List<SummaryTile> =
    listOf(
        SummaryTile(LegendCopy.forKind(DayKind.SUISSE.letter), summary.suisse),
        SummaryTile(LegendCopy.forKind(DayKind.DOMICILE.letter), summary.domicile),
        SummaryTile(LegendCopy.forKind(DayKind.MISSION.letter), summary.mission),
        SummaryTile(LegendCopy.forKind(DayKind.ABSENCE.letter), summary.absent),
        SummaryTile(CalendarCopy.NON_RENSEIGNE, summary.nonRenseigne),
    )
