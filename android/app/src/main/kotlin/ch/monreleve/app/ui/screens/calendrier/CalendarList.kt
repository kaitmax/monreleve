package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import ch.monreleve.app.calendar.CalendarDayUi
import ch.monreleve.app.calendar.MonthView
import ch.monreleve.app.calendar.SelectionState
import ch.monreleve.app.design.DayProvenance
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.LegendCopy
import ch.monreleve.app.fr.format.formatDayLong

// AN10 increment 4 (R271, AC3). Above a measured font scale, seven columns cannot hold 200 % text and no
// cell sizing rescues it, so the grid BECOMES a list: one row per day, each saying the date, the kind,
// the quality and the provenance IN WORDS - the same record the grid carries, laid out so it stays
// legible when the grid cannot. A recordable day's row is tappable and opens the same edit sheet.
//
// AN-CAL2 (section 2): selection works here too - a checkbox per RECORDABLE row, so the large-text reader
// selects the same days the grid reader does. A tap toggles while selecting; a long press starts selection.
//
// Not a DayCell grid, so no legend is needed here (each row states its own words); the grid file keeps
// the legend the fence pairs with it. The words come from the one homes: the kind from LegendCopy, the
// quality from CalendarCopy.qualityWord, the provenance from AujourdhuiCopy (manual product).

@Composable
fun CalendarList(
    monthView: MonthView,
    selection: SelectionState,
    actions: CalendarActions,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        monthView.days.forEachIndexed { index, day ->
            if (index > 0) HorizontalDivider(color = LightColors.borderDefault)
            CalendarListRow(day, selection, actions)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CalendarListRow(
    day: CalendarDayUi,
    selection: SelectionState,
    actions: CalendarActions,
) {
    val selecting = selection.active
    val isSelected = day.isoDate in selection.days
    val interaction =
        if (day.recordable) {
            Modifier.combinedClickable(
                onClick = { if (selecting) actions.onToggleDay(day.isoDate) else actions.onDayClick(day.isoDate) },
                onLongClick = { if (!selecting) actions.onStartSelectionWithDay(day.isoDate) },
            )
        } else {
            Modifier
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(interaction)
                .heightIn(min = Spacing.space48)
                .padding(vertical = Spacing.space8),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        if (selecting && day.recordable) {
            Checkbox(
                checked = isSelected,
                onCheckedChange = { actions.onToggleDay(day.isoDate) },
            )
        }
        DayWords(day, Modifier.weight(1f))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DayWords(
    day: CalendarDayUi,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(
            text = formatDayLong(day.isoDate),
            style = FrontierType.bodyM,
            color = if (day.isToday) LightColors.brand else LightColors.textPrimary,
        )
        // R292: a split half-day names BOTH kinds here too, so the 200 % list reader gets the whole
        // record the grid reader gets - not just the morning kind.
        val kindWord = day.kind?.let { LegendCopy.forKind(it.letter) }
        val secondKindWord = day.secondKind?.let { LegendCopy.forKind(it.letter) }
        val qualityWord = CalendarCopy.qualityWord(day.quality.name)
        // Manual product: the only provenance is « Saisie manuelle » (one home, R206); the detected forms
        // are AN9+, so they show no word here rather than a hint at anything absent (R282).
        val provenanceWord = if (day.provenance == DayProvenance.MANUAL) AujourdhuiCopy.MODE_MANUAL else null
        val words = listOfNotNull(kindWord, secondKindWord, qualityWord, provenanceWord)
        if (words.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                words.forEach { word ->
                    Text(text = word, style = FrontierType.caption, color = LightColors.textSecondary)
                }
            }
        }
    }
}
