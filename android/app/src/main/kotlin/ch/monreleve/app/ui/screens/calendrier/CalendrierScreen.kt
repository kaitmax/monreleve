package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.calendar.CalendarDayUi
import ch.monreleve.app.calendar.CalendarState
import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.calendar.MonthView
import ch.monreleve.app.calendar.SelectionState
import ch.monreleve.app.design.DayCell
import ch.monreleve.app.design.DayKindLegend
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.RecordQualityLegend
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.text.formatDays
import ch.monreleve.app.fr.text.formatMonthYear

// AN10 increments 1-2. The calendar screen (SPEC 11.3, FD6): the month grid of DayCells inside a white
// card, the mandatory kind legend directly under it (R119: letters need a key), the four-count month
// summary, and the day edit sheet a tap on a RECORDABLE day opens. Month navigation is a chevron each
// side, bounded to the tax year and narrowed to the engine's period for a partial year.
//
// Stateless: it reads a CalendarState and calls CalendarActions; the controller (calendar/, outside
// ui/) owns the record, the clock and the sheet's prefill. It speaks the grid vocabulary only
// (DayKind/RecordQuality via DayCell) - the wire enums never reach ui/ (the fence forbids it). The card
// is white on the grey canvas by contrast rather than a drawn 1 px border: the Android components use
// contrast throughout, and a 1 dp hairline has no token (FD6's border is named AGAINST THE RULINGS).

private const val WEEK_LENGTH = 7

// R271, AC3: the font scale at and above which the seven-column grid stops being legible and the screen
// becomes a list. MEASURED on the device, not chosen: at 1.5x the two-digit day number and the letter
// already crowd a ~45 dp column, and at 2.0x they overlap; 1.3x still reads. The figure and how it was
// measured are recorded in REPORT-AN10.txt. A behavioural constant, not a design token (not a radius,
// colour or spacing value), so it lives here rather than in Tokens.kt.
// AN-HOME (R328/R206): the home's « Cette semaine » strip follows the SAME rule, so it reads this one home
// (the relay: "it follows the calendar's rule and becomes a list") rather than a second 1.5f.
internal const val LIST_FONT_SCALE_THRESHOLD = 1.5f

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendrierScreen(
    state: CalendarState,
    actions: CalendarActions,
    modifier: Modifier = Modifier,
) {
    val monthView = state.monthView ?: return
    val selection = state.selection
    val asList = LocalDensity.current.fontScale >= LIST_FONT_SCALE_THRESHOLD
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        MonthHeader(monthView, actions)
        if (asList) {
            // R271: above the measured scale the grid cannot stay legible - one row per day instead.
            CardSurface { CalendarList(monthView, selection, actions) }
        } else {
            CalendarCard(monthView, selection, actions)
        }
        MonthSummaryRow(monthView.summary)
        // AN-CAL2 (section 2-3): the bottom space holds the action panel while selecting, otherwise the
        // « à compléter » card when the month has gaps - and nothing when it is complete (never an empty box).
        if (selection.active) {
            SelectionActionPanel(selectedCount = selection.days.size, actions = actions)
        } else if (monthView.summary.nonRenseigne > 0) {
            CompleteCard(
                month = monthView.month,
                unrecorded = monthView.summary.nonRenseigne.toInt(),
                onStartSelection = actions.onStartSelection,
            )
        }
    }

    // Single-day editing is UNCHANGED, and it never opens while selecting (the grid toggles instead).
    val editing = state.editing
    if (editing != null && !selection.active) {
        ModalBottomSheet(
            onDismissRequest = actions.onDismissSheet,
            sheetState = rememberModalBottomSheetState(),
            shape = RoundedCornerShape(topStart = Radius.xxl, topEnd = Radius.xxl),
        ) {
            CalendarEditSheetContent(
                day = editing,
                onSave = { edits -> actions.onSave(editing.isoDate, edits) },
                onCancel = actions.onDismissSheet,
            )
        }
    }

    // AN-CAL2 (section 2, D16): the one confirmation before any bulk write.
    state.bulkConfirmation?.let { confirmation ->
        BulkConfirmationDialog(confirmation = confirmation, actions = actions)
    }
}

@Composable
private fun MonthHeader(
    monthView: MonthView,
    actions: CalendarActions,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = actions.onPreviousMonth, enabled = monthView.canGoPrev) {
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
        IconButton(onClick = actions.onNextMonth, enabled = monthView.canGoNext) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = CalendarCopy.NEXT_MONTH,
            )
        }
    }
}

// The white card both the grid and the high-scale list sit in: contrast on the grey canvas, no drawn
// 1 px border (the Android components use contrast throughout; a 1 dp hairline has no token).
@Composable
private fun CardSurface(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .padding(Spacing.space12),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
        content = content,
    )
}

@Composable
private fun CalendarCard(
    monthView: MonthView,
    selection: SelectionState,
    actions: CalendarActions,
) {
    CardSurface {
        WeekdayHeaderRow()
        MonthGrid(monthView, selection, actions)
        // R119: the kind legend sits with the grid, in the same file the fence scans. The quality legend
        // (AC2) names the bar colours in words, so quality is never carried by colour alone.
        DayKindLegend(modifier = Modifier.padding(top = Spacing.space4))
        RecordQualityLegend()
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
private fun MonthGrid(
    monthView: MonthView,
    selection: SelectionState,
    actions: CalendarActions,
) {
    // Leading empty cells align day 1 to its weekday (Monday-first); pad the last week to a full row.
    val slots: List<Int?> = List(monthView.leadingBlanks) { null } + monthView.days.map { it.dayOfMonth }
    val weeks = slots.chunked(WEEK_LENGTH).map { it + List(WEEK_LENGTH - it.size) { null } }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        weeks.forEach { week ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space4), modifier = Modifier.fillMaxWidth()) {
                week.forEach { dayOfMonth ->
                    val day = dayOfMonth?.let { d -> monthView.days.first { it.dayOfMonth == d } }
                    GridCell(day, selection, actions)
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RowScope.GridCell(
    day: CalendarDayUi?,
    selection: SelectionState,
    actions: CalendarActions,
) {
    // A recordable day is interactive (its 48 dp slot is the touch target); an empty, future or out-of-period
    // cell is inert (AC1: future days cannot be recorded, so they cannot be selected either). Not selecting: a
    // tap opens the edit sheet and a long press STARTS selection on that day (section 2). Selecting: a tap
    // toggles the day (or fills a range, controller side).
    val selecting = selection.active
    val isSelected = day != null && day.isoDate in selection.days
    val interaction =
        if (day != null && day.recordable) {
            Modifier.combinedClickable(
                onClick = { if (selecting) actions.onToggleDay(day.isoDate) else actions.onDayClick(day.isoDate) },
                onLongClick = { if (!selecting) actions.onStartSelectionWithDay(day.isoDate) },
            )
        } else {
            Modifier
        }
    Box(
        modifier = Modifier.weight(1f).heightIn(min = Spacing.space48).then(interaction),
        contentAlignment = Alignment.Center,
    ) {
        if (day != null) {
            DayCell(
                dayOfMonth = day.dayOfMonth,
                kind = day.kind,
                quality = day.quality,
                corrected = day.corrected,
                isToday = day.isToday,
                provenance = day.provenance,
                secondProvenance = day.secondProvenance,
                secondKind = day.secondKind,
                selected = isSelected,
            )
        }
    }
}

// AN-CAL2 defects 1-2. Five EQUAL tiles - Suisse, Domicile, Mission, Absence, Non renseigné - each number
// centred UNDER its label, every tile reading from the one MonthSummary (monthSummaryTiles, R328). The
// labels reserve two lines (minLines) so « Non renseigné » - which cannot fit one line in a fifth of a
// 320 dp row at a legible size - wraps WITHOUT pushing its number lower than the others: every number sits
// at the same baseline (the operator's « its number sits lower and further right » defect). At the list
// font scale (200 %) the tiles WRAP onto a second row (maxItemsInEachRow drops) rather than squeezing.
private const val SUMMARY_TILES_PER_ROW_LARGE = 3
private const val SUMMARY_LABEL_LINES = 2

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MonthSummaryRow(summary: MonthSummary) {
    val tiles = monthSummaryTiles(summary)
    val perRow =
        if (LocalDensity.current.fontScale >= LIST_FONT_SCALE_THRESHOLD) SUMMARY_TILES_PER_ROW_LARGE else tiles.size
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
        maxItemsInEachRow = perRow,
    ) {
        tiles.forEach { tile -> SummaryItem(tile) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowScope.SummaryItem(tile: SummaryTile) {
    Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = tile.label,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
            textAlign = TextAlign.Center,
            minLines = SUMMARY_LABEL_LINES,
            maxLines = SUMMARY_LABEL_LINES,
        )
        Text(text = formatDays(tile.value), style = FrontierType.h3, textAlign = TextAlign.Center)
    }
}
