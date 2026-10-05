package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy

// AN-CAL2 (section 2). The action panel, in the space the « à compléter » card otherwise holds. It states how
// many days are selected (a polite live region, so TalkBack announces the count as it changes), offers the
// record choices and « Annuler ». The choices reuse Aujourd'hui's vocabulary EXACTLY as the edit sheet does
// (R206, one record surface): Mission nests into En France / Pays tiers, and Absent into its reasons - chosen
// ONCE for all the days. A leaf choice opens the one confirmation (D16); nothing is written here.

@Composable
fun SelectionActionPanel(
    selectedCount: Int,
    actions: CalendarActions,
    modifier: Modifier = Modifier,
) {
    var missionOpen by rememberSaveable { mutableStateOf(false) }
    var absenceOpen by rememberSaveable { mutableStateOf(false) }
    val enabled = selectedCount > 0
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        Text(
            text = CalendarCopy.selectedCount(selectedCount),
            style = FrontierType.bodyM,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        PanelOption(AujourdhuiCopy.SUISSE, enabled) { actions.onChooseBulk(RecordedKind.SUISSE, null) }
        PanelOption(AujourdhuiCopy.DOMICILE, enabled) { actions.onChooseBulk(RecordedKind.DOMICILE, null) }
        PanelOption(AujourdhuiCopy.MISSION, enabled) {
            missionOpen = !missionOpen
            absenceOpen = false
        }
        if (missionOpen) {
            PanelOption(AujourdhuiCopy.MISSION_FRANCE, enabled) {
                actions.onChooseBulk(RecordedKind.MISSION_FRANCE, null)
            }
            PanelOption(AujourdhuiCopy.MISSION_THIRD, enabled) {
                actions.onChooseBulk(RecordedKind.MISSION_THIRD, null)
            }
        }
        PanelOption(AujourdhuiCopy.ABSENCE, enabled) {
            absenceOpen = !absenceOpen
            missionOpen = false
        }
        if (absenceOpen) {
            AbsenceChoice.entries.forEach { choice ->
                PanelOption(AujourdhuiCopy.absenceLabel(choice.name), enabled) {
                    actions.onChooseBulk(RecordedKind.ABSENCE, choice)
                }
            }
        }
        OutlinedButton(onClick = actions.onCancelSelection, modifier = Modifier.fillMaxWidth()) {
            Text(text = CalendarCopy.SHEET_CANCEL)
        }
    }
}

@Composable
private fun PanelOption(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(Radius.md),
        modifier = Modifier.fillMaxWidth().heightIn(min = Spacing.space48),
    ) {
        Text(text = label)
    }
}
