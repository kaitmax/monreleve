package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.calendar.BulkConfirmation
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.text.formatDate

// AN-CAL2 (section 2, D16). The ONE confirmation before any write. It states the choice and the count, LISTS
// the days, and shows the two conditional lines EXACTLY when they apply (C4): « déjà renseignés » when some
// chosen days already hold a value, « saisie tardive » when some are older than the threshold (the number
// interpolated from the shared value, R286). Confirmer writes; Annuler writes nothing. The counts are computed
// by the controller from BulkConfirmation (R181), never typed here.

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BulkConfirmationDialog(
    confirmation: BulkConfirmation,
    actions: CalendarActions,
) {
    AlertDialog(
        onDismissRequest = actions.onCancelConfirmation,
        title = { Text(text = CalendarCopy.CONFIRM_HEADING) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Spacing.space12),
            ) {
                Text(
                    text =
                        CalendarCopy.bulkSummary(
                            confirmation.days.size,
                            AujourdhuiCopy.kindLabel(confirmation.kind.name, confirmation.absence?.name),
                        ),
                    style = FrontierType.bodyM,
                )
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
                    verticalArrangement = Arrangement.spacedBy(Spacing.space4),
                ) {
                    confirmation.days.forEach { iso ->
                        Text(text = formatDate(iso), style = FrontierType.caption, color = LightColors.textSecondary)
                    }
                }
                if (confirmation.alreadyRecordedCount > 0) {
                    Text(
                        text = CalendarCopy.alreadyRecordedNotice(confirmation.alreadyRecordedCount),
                        style = FrontierType.caption,
                        color = LightColors.textSecondary,
                    )
                }
                if (confirmation.lateCount > 0) {
                    Text(
                        text = CalendarCopy.bulkLateNotice(confirmation.lateCount, confirmation.lateThresholdDays),
                        style = FrontierType.caption,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Radius.md))
                                .background(LightColors.warningBg)
                                .padding(Spacing.space12),
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = actions.onConfirmBulk) { Text(text = CalendarCopy.SHEET_SAVE) }
        },
        dismissButton = {
            TextButton(onClick = actions.onCancelConfirmation) { Text(text = CalendarCopy.SHEET_CANCEL) }
        },
    )
}
