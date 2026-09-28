package ch.monreleve.app.ui.screens.aujourdhui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.DayEntry
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.Fr
import ch.monreleve.app.onboarding.GranularityChoice

// AN5b increment 3. Recording a day (SPEC 11.2): one question, answered in one tap. Stateless - it
// reads an AujourdhuiState and calls onRecord, which the controller turns into a write through
// EntryRepository (D16, fence 5). It speaks the UI vocabulary only (RecordedKind/Slot/AbsenceChoice);
// the wire enums never reach this file (the ui fence forbids it). No success animation, no "bravo":
// the confirmation is the recorded row appearing (DESIGN-SYSTEM section 2). The mode strip names
// "Saisie manuelle" with no Changer link (R282). Buttons use the 48 dp touch-target token pending a
// 56 dp sizing token (PARKAN, report).

@Composable
fun AujourdhuiScreen(
    state: AujourdhuiState,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = Fr.GREETING, style = FrontierType.h2)
        Text(text = AujourdhuiCopy.MODE_MANUAL, style = FrontierType.caption)
        Text(text = AujourdhuiCopy.QUESTION, style = FrontierType.h3)

        if (state.granularity == GranularityChoice.HALF_DAY) {
            Text(text = AujourdhuiCopy.MORNING, style = FrontierType.bodyM)
            RecordSection(Slot.MORNING, state.morning, onRecord)
            Text(text = AujourdhuiCopy.AFTERNOON, style = FrontierType.bodyM)
            RecordSection(Slot.AFTERNOON, state.afternoon, onRecord)
        } else {
            RecordSection(Slot.FULL, state.fullDay, onRecord)
        }
    }
}

@Composable
private fun RecordSection(
    slot: Slot,
    current: DayEntry?,
    onRecord: (RecordedKind, Slot, AbsenceChoice?) -> Unit,
) {
    var missionOpen by remember { mutableStateOf(false) }
    var absenceOpen by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        RecordButton(AujourdhuiCopy.SUISSE, current?.kind == RecordedKind.SUISSE) {
            onRecord(RecordedKind.SUISSE, slot, null)
        }
        RecordButton(AujourdhuiCopy.DOMICILE, current?.kind == RecordedKind.DOMICILE) {
            onRecord(RecordedKind.DOMICILE, slot, null)
        }

        val missionSelected =
            current?.kind == RecordedKind.MISSION_FRANCE || current?.kind == RecordedKind.MISSION_THIRD
        RecordButton(AujourdhuiCopy.MISSION, missionSelected) { missionOpen = !missionOpen }
        if (missionOpen || missionSelected) {
            RecordButton(AujourdhuiCopy.MISSION_FRANCE, current?.kind == RecordedKind.MISSION_FRANCE) {
                onRecord(RecordedKind.MISSION_FRANCE, slot, null)
            }
            RecordButton(AujourdhuiCopy.MISSION_THIRD, current?.kind == RecordedKind.MISSION_THIRD) {
                onRecord(RecordedKind.MISSION_THIRD, slot, null)
            }
        }

        // Tertiary: an absence changes no figure, so it is visibly secondary (D28).
        TextButton(onClick = { absenceOpen = !absenceOpen }, modifier = Modifier.fillMaxWidth()) {
            Text(text = AujourdhuiCopy.ABSENCE)
        }
        if (absenceOpen || current?.kind == RecordedKind.ABSENCE) {
            AbsenceChoice.entries.forEach { choice ->
                val chosen = current?.kind == RecordedKind.ABSENCE && current.absence == choice
                RecordButton(AujourdhuiCopy.absenceLabel(choice.name), chosen) {
                    onRecord(RecordedKind.ABSENCE, slot, choice)
                }
            }
        }

        current?.let { RecordedRow(it) }
    }
}

@Composable
private fun RecordButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radius.buttonLg)
    val sizing = Modifier.fillMaxWidth().heightIn(min = Spacing.space48)
    // Selected renders filled, unselected outlined - the state is visible without colour alone.
    if (selected) {
        Button(onClick = onClick, shape = shape, modifier = sizing) { Text(text = label) }
    } else {
        OutlinedButton(onClick = onClick, shape = shape, modifier = sizing) { Text(text = label) }
    }
}

@Composable
private fun RecordedRow(entry: DayEntry) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = AujourdhuiCopy.recordedLabel(entry.kind.name, entry.absence?.name), style = FrontierType.bodyM)
        if (entry.pending) Text(text = AujourdhuiCopy.PENDING, style = FrontierType.caption)
        Text(text = AujourdhuiCopy.EDIT_HINT, style = FrontierType.caption)
    }
}
