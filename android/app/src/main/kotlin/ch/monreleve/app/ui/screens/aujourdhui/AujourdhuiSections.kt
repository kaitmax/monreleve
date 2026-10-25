package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.aujourdhui.ToAttendTo
import ch.monreleve.app.calendar.CalendarDayUi
import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.design.DayCell
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.design.DayKindLegend
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.RecordQualityLegend
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.LegendCopy
import ch.monreleve.app.fr.format.formatDayLong
import ch.monreleve.app.fr.format.formatDays
import ch.monreleve.app.ui.screens.calendrier.LIST_FONT_SCALE_THRESHOLD
import ch.monreleve.app.ui.screens.calendrier.dayWords

// AN-HOME sections C/E/F (R328). The stateless section composables Aujourd'hui renders below the choice card
// and the year hero, kept in their own file so neither this nor AujourdhuiScreen.kt passes the file's function
// threshold (the calendar does the same with CalendarList.kt). Fence 5: no literal, no wire enum, no write -
// these are READ-ONLY projections (built in AujourdhuiController) rendered through the existing DayCell and
// legend components. All copy comes from fr/ (R238); counts come from CalendarModel (R328, one way of counting).

// Section E (AN-HOME): Monday to Friday - the five weekday-header letters above the week strip.
private const val WEEKDAYS = 5

// A white card with a 1 px border and no shadow (DESIGN-SYSTEM) - the container sections C, E and F share,
// matching the choice card (AN-HOME section 1) and the year hero (section D). One home for the look.
@Composable
private fun SectionCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.lg))
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
        content = content,
    )
}

// Section C « À traiter » (AN-HOME, R328): what to act on, shown ONLY when there is something (null -> the
// section is absent, never an empty box). Most urgent first: the oldest unsent day (which may be nearing the
// late-saisie threshold, R286) before the month's unrecorded gaps. A READ-ONLY projection; tapping the
// « Voir le calendrier » link opens the calendar (D16: nothing here records or sends).
@Composable
internal fun AttendSection(
    attend: ToAttendTo?,
    onNavigateToCalendrier: () -> Unit,
) {
    if (attend == null) return
    SectionCard {
        Text(text = AujourdhuiCopy.ATTEND_HEADING, style = FrontierType.h3)
        if (attend.unsyncedDays > 0) {
            Text(
                text =
                    AujourdhuiCopy.attendUnsent(
                        attend.unsyncedDays,
                        attend.pendingLateness.name,
                        attend.lateThresholdDays,
                    ),
                style = FrontierType.body,
            )
        }
        if (attend.unrecordedThisMonth > 0) {
            Text(text = AujourdhuiCopy.attendUnrecorded(attend.unrecordedThisMonth), style = FrontierType.body)
            TextButton(onClick = onNavigateToCalendrier) { Text(text = AujourdhuiCopy.ATTEND_SEE_CALENDAR) }
        }
    }
}

// Section E « Cette semaine » (AN-HOME, R328): Monday-Friday as five of the existing DayCells, with the kind
// and quality legends the grid always carries (R119). Tapping a day opens the calendar. At and above the
// calendar's measured font scale (R271) the five-column grid cannot stay legible, so it becomes a list - the
// SAME rule the calendar follows (LIST_FONT_SCALE_THRESHOLD, one home).
@Composable
internal fun WeekSection(
    week: List<CalendarDayUi>,
    onNavigateToCalendrier: () -> Unit,
) {
    if (week.isEmpty()) return
    val asList = LocalDensity.current.fontScale >= LIST_FONT_SCALE_THRESHOLD
    SectionCard {
        Text(text = AujourdhuiCopy.WEEK_HEADING, style = FrontierType.h3)
        if (asList) {
            week.forEachIndexed { index, day ->
                if (index > 0) HorizontalDivider(color = LightColors.borderDefault)
                WeekListRow(day, onNavigateToCalendrier)
            }
        } else {
            WeekdayHeaderRow()
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space4), modifier = Modifier.fillMaxWidth()) {
                week.forEach { day -> WeekCell(day, onNavigateToCalendrier) }
            }
        }
        // R119: letters need a key, so the legend sits with the grid (and, at high scale, with the list).
        DayKindLegend(modifier = Modifier.padding(top = Spacing.space4))
        RecordQualityLegend()
    }
}

// L M M J V - the five weekday letters above the week cells, read from the calendar's one home (R206).
@Composable
private fun WeekdayHeaderRow() {
    Row(modifier = Modifier.fillMaxWidth()) {
        CalendarCopy.WEEKDAY_HEADERS.take(WEEKDAYS).forEach { label ->
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
private fun RowScope.WeekCell(
    day: CalendarDayUi,
    onNavigateToCalendrier: () -> Unit,
) {
    Box(
        modifier = Modifier.weight(1f).heightIn(min = Spacing.space48).clickable { onNavigateToCalendrier() },
        contentAlignment = Alignment.Center,
    ) {
        DayCell(
            dayOfMonth = day.dayOfMonth,
            kind = day.kind,
            quality = day.quality,
            corrected = day.corrected,
            isToday = day.isToday,
            provenance = day.provenance,
            secondProvenance = day.secondProvenance,
            secondKind = day.secondKind,
        )
    }
}

// The high-scale list row (R271): the day in words - the kind, the quality and who recorded it - from the ONE
// home the calendar's list reads too (dayWords, R206), so the two lists cannot name a day differently (R519). A
// split half-day names BOTH kinds (R292). Tapping opens the calendar. Each word is its own Text in a FlowRow (the
// calendar list's shape), so there is no separator literal in ui/.
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WeekListRow(
    day: CalendarDayUi,
    onNavigateToCalendrier: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onNavigateToCalendrier() }
                .heightIn(min = Spacing.space48)
                .padding(vertical = Spacing.space8),
        verticalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        Text(
            text = formatDayLong(day.isoDate),
            style = FrontierType.bodyM,
            color = if (day.isToday) LightColors.brand else LightColors.textPrimary,
        )
        val words = dayWords(day)
        if (words.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                words.forEach { word ->
                    Text(text = word, style = FrontierType.caption, color = LightColors.textSecondary)
                }
            }
        }
    }
}

// Section F « Ce mois » (AN-HOME, R328): the month's recorded days by kind - Suisse, Domicile, Mission,
// Absence - counts of what the person has recorded, labelled as such (never a forecast). The three working
// counts come from the SAME MonthSummary the calendar's tiles use (one way of counting); the absence count
// is the same function's absence tally (D28: not a working figure, shown only as a recorded count). Labels
// read from LegendCopy, the same home the calendar names its kinds from (R206).
@Composable
internal fun MonthSection(month: MonthSummary?) {
    if (month == null) return
    SectionCard {
        Text(text = AujourdhuiCopy.MONTH_HEADING, style = FrontierType.h3)
        Row(modifier = Modifier.fillMaxWidth()) {
            MonthItem(LegendCopy.forKind(DayKind.SUISSE.letter), month.suisse)
            MonthItem(LegendCopy.forKind(DayKind.DOMICILE.letter), month.domicile)
            MonthItem(LegendCopy.forKind(DayKind.MISSION.letter), month.mission)
            MonthItem(LegendCopy.forKind(DayKind.ABSENCE.letter), month.absent)
        }
    }
}

@Composable
private fun RowScope.MonthItem(
    label: String,
    value: Double,
) {
    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
        Text(text = formatDays(value), style = FrontierType.h3)
    }
}
