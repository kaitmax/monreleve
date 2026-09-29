package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.calendar.CalendarState
import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.calendar.MonthView
import ch.monreleve.app.design.DayCell
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.design.DayKindLegend
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.LegendCopy
import ch.monreleve.app.fr.format.formatDays
import ch.monreleve.app.fr.format.formatMonthYear

// AN10 increment 1. The calendar screen (SPEC 11.3, FD6): the month grid of DayCells inside a white
// card, the mandatory kind legend directly under it (R119: letters need a key), and the four-count
// month summary. Month navigation is a chevron each side, bounded to the tax year and narrowed to the
// engine's period for a partial year (Aujourd'hui's start date).
//
// Stateless: it reads a CalendarState and calls the navigation callbacks; the controller (calendar/,
// outside ui/) owns the record and the clock. It speaks the grid vocabulary only (DayKind/RecordQuality
// via DayCell) - the wire enums never reach ui/ (the fence forbids it). The card is white on the grey
// canvas by contrast rather than a drawn 1 px border: the Android components use contrast throughout,
// and a 1 dp hairline has no token (FD6's border is named in the report AGAINST THE RULINGS).

private const val WEEK_LENGTH = 7

@Composable
fun CalendrierScreen(
    state: CalendarState,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val monthView = state.monthView ?: return
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        MonthHeader(monthView, onPreviousMonth, onNextMonth)
        CalendarCard(monthView)
        MonthSummaryRow(monthView.summary)
    }
}

@Composable
private fun MonthHeader(
    monthView: MonthView,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onPreviousMonth, enabled = monthView.canGoPrev) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = CalendarCopy.PREVIOUS_MONTH,
            )
        }
        Text(
            text = formatMonthYear(monthView.year, monthView.month),
            style = FrontierType.h3,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onNextMonth, enabled = monthView.canGoNext) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = CalendarCopy.NEXT_MONTH,
            )
        }
    }
}

@Composable
private fun CalendarCard(monthView: MonthView) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .padding(Spacing.space12),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        WeekdayHeaderRow()
        MonthGrid(monthView)
        // R119: the legend sits with the grid, in the same file the fence scans.
        DayKindLegend(modifier = Modifier.padding(top = Spacing.space4))
    }
}

@Composable
private fun WeekdayHeaderRow() {
    Row(modifier = Modifier.fillMaxWidth()) {
        CalendarCopy.WEEKDAY_HEADERS.forEach { label ->
            Text(
                text = label,
                style = FrontierType.caption,
                color = LightColors.textTertiary,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MonthGrid(monthView: MonthView) {
    // Leading empty cells align day 1 to its weekday (Monday-first); pad the last week to a full row.
    val slots: List<Int?> = List(monthView.leadingBlanks) { null } + monthView.days.map { it.dayOfMonth }
    val weeks = slots.chunked(WEEK_LENGTH).map { it + List(WEEK_LENGTH - it.size) { null } }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        weeks.forEach { week ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space4), modifier = Modifier.fillMaxWidth()) {
                week.forEach { dayOfMonth ->
                    Box(
                        modifier = Modifier.weight(1f).heightIn(min = Spacing.space48),
                        contentAlignment = Alignment.Center,
                    ) {
                        val day = dayOfMonth?.let { d -> monthView.days.first { it.dayOfMonth == d } }
                        if (day != null) {
                            DayCell(
                                dayOfMonth = day.dayOfMonth,
                                kind = day.kind,
                                quality = day.quality,
                                corrected = day.corrected,
                                isToday = day.isToday,
                                provenance = day.provenance,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MonthSummaryRow(summary: MonthSummary) {
    // The kind labels read from LegendCopy by the enum's own letter (never a string literal in ui/,
    // and never a second copy of the names): the summary label and the legend key share one home.
    Row(modifier = Modifier.fillMaxWidth()) {
        SummaryItem(LegendCopy.forKind(DayKind.SUISSE.letter), summary.suisse)
        SummaryItem(LegendCopy.forKind(DayKind.DOMICILE.letter), summary.domicile)
        SummaryItem(LegendCopy.forKind(DayKind.MISSION.letter), summary.mission)
        SummaryItem(CalendarCopy.NON_RENSEIGNE, summary.nonRenseigne)
    }
}

@Composable
private fun RowScope.SummaryItem(
    label: String,
    value: Double,
) {
    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
        Text(text = formatDays(value), style = FrontierType.h3)
    }
}
