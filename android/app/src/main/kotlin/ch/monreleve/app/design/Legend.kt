package ch.monreleve.app.design

// AN3 increment 4. No direct web component to port from - built from the
// relay's own requirement: "a test asserts a legend exists wherever a
// DayCell grid does - letters need a key (R119's shape)." R119's own
// point carried across: a specified-once element (here, a legend) is
// asserted by PRESENCE wherever its grid is, not assumed to follow from
// the grid existing.
//
// AN4 increment 0 (R271, PARK-18's legend half). The outer layout was a
// single Row, so at 200% text scale the fourth entry ("A Absence") was
// handed a near-zero remaining width and wrapped one character per line,
// cascading down the right edge. FlowRow wraps WHOLE entries onto the next
// line instead. The fix is proven by the 200% emulator screenshot, not by a
// test (a Row and a FlowRow are indistinguishable at 100%). FlowRow is
// @ExperimentalLayoutApi at compose-bom 2024.09; the opt-in is authorised by
// instruction (the relay names FlowRow), and the tension with R261 (prefer
// stable Compose) is recorded in REPORT-AN4.txt.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.LegendCopy

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DayKindLegend(modifier: Modifier = Modifier) {
    FlowRow(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        DayKind.entries.forEach { kind ->
            Row(modifier = Modifier.padding(end = Spacing.space12)) {
                Text(text = kind.letter, style = FrontierType.micro)
                Text(
                    text = LegendCopy.forKind(kind.letter),
                    style = FrontierType.micro,
                    modifier = Modifier.padding(start = Spacing.space4),
                )
            }
        }
    }
}

// AN10 increment 3 (AC2). The record-quality legend: the three bottom-bar colours named in words, so a
// cell's quality is never carried by colour alone (SPEC 966, FD6 section 3). Sits beside DayKindLegend
// under the grid. No « détection corrigée » entry: the manual product has no detection, so a cell can
// never carry the corner mark, and a legend line for a feature the product lacks is what R282 forbids.
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RecordQualityLegend(modifier: Modifier = Modifier) {
    FlowRow(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        QualityEntry(LightColors.success, CalendarCopy.QUALITY_ON_TIME)
        QualityEntry(LightColors.warning, CalendarCopy.QUALITY_LATE)
        QualityEntry(LightColors.borderStrong, CalendarCopy.NON_RENSEIGNE)
    }
}

@Composable
private fun QualityEntry(
    colour: Color,
    label: String,
) {
    Row(modifier = Modifier.padding(end = Spacing.space12), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier =
                Modifier
                    .width(Spacing.space16)
                    .height(Spacing.space4)
                    .clip(RoundedCornerShape(Radius.pill))
                    .background(colour),
        )
        Text(text = label, style = FrontierType.micro, modifier = Modifier.padding(start = Spacing.space4))
    }
}
