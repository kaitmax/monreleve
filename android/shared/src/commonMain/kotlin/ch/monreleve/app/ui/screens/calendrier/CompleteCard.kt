package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.text.formatMonthNameLower

// AN-CAL2 (section 3). When the month has unrecorded past working days, this card says how many and offers the
// explicit « Sélectionner plusieurs jours » entry point. It is shown ONLY when there is something to complete
// (unrecorded > 0) - never an empty box; the screen hides it the moment the month is complete. A long press on
// a day is the other way in (section 2), so a complete month is still reachable for a bulk CHANGE.

@Composable
fun CompleteCard(
    month: Int,
    unrecorded: Int,
    onStartSelection: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.lg))
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        Text(
            text = CalendarCopy.daysToComplete(unrecorded, formatMonthNameLower(month)),
            style = FrontierType.bodyM,
            color = LightColors.textPrimary,
        )
        Button(onClick = onStartSelection, modifier = Modifier.fillMaxWidth()) {
            Text(text = CalendarCopy.SELECT_MULTIPLE)
        }
    }
}
