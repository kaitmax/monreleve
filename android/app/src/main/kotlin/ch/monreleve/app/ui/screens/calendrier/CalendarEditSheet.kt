package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.background
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.calendar.EditableDay
import ch.monreleve.app.calendar.EditableSlot
import ch.monreleve.app.calendar.SlotEdit
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.format.formatDateTime
import ch.monreleve.app.fr.format.formatDayLong

// AN10 increment 2. The day edit sheet's CONTENT (SPEC 11.3, FD6 A2), a standalone composable so a
// Paparazzi baseline photographs it directly (a ModalBottomSheet's own scaffolding does not render
// reliably under Layoutlib). The screen wraps this in the ModalBottomSheet.
//
// D16 - NOTHING IS WRITTEN WITHOUT THE SAVE TAP. The rows only change local selection; onSave fires on
// « Enregistrer » alone, and the controller's record() is the one writer (the mutation id born there).
// No success animation (DESIGN-SYSTEM section 2): the sheet closes and the cell updates by observation.
//
// ONE RECORD VOCABULARY. The kind chooser reuses AujourdhuiCopy - the same « En Suisse / Domicile /
// Mission / Déclarer une absence » a person taps on Aujourd'hui - so the two record surfaces read the
// same (R206: the copy has one home). Only the sheet's own chrome (note, save, cancel) is CalendarCopy.

/** One slot's live edit state, seeded from its current row; mutated by the rows until Save (D16). */
private class SlotDraft(initial: EditableSlot) {
    val slot: Slot = initial.slot
    var kind by mutableStateOf(initial.kind)
    var absence by mutableStateOf(initial.absence)
    var note by mutableStateOf(initial.note.orEmpty())
}

@Composable
fun CalendarEditSheetContent(
    day: EditableDay,
    onSave: (List<SlotEdit>) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val drafts = remember(day) { day.slots.map { SlotDraft(it) } }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = formatDayLong(day.isoDate), style = FrontierType.h3)
        Text(text = CalendarCopy.SHEET_QUESTION, style = FrontierType.bodyM)
        drafts.forEach { draft ->
            SlotEditor(draft)
        }
        LateNotice(day)
        ProvenanceBlock(day)
        Button(
            onClick = {
                onSave(drafts.mapNotNull { d -> d.kind?.let { SlotEdit(d.slot, it, d.absence, d.note) } })
            },
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = CalendarCopy.SHEET_SAVE)
        }
        OutlinedButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) {
            Text(text = CalendarCopy.SHEET_CANCEL)
        }
    }
}

@Composable
private fun SlotEditor(draft: SlotDraft) {
    val missionInitiallyOpen = draft.kind == RecordedKind.MISSION_FRANCE || draft.kind == RecordedKind.MISSION_THIRD
    var missionOpen by remember { mutableStateOf(missionInitiallyOpen) }
    var absenceOpen by remember { mutableStateOf(draft.kind == RecordedKind.ABSENCE) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        if (draft.slot != Slot.FULL) {
            val label = if (draft.slot == Slot.MORNING) AujourdhuiCopy.MORNING else AujourdhuiCopy.AFTERNOON
            Text(text = label, style = FrontierType.bodyM)
        }
        Option(AujourdhuiCopy.SUISSE, draft.kind == RecordedKind.SUISSE) {
            draft.kind = RecordedKind.SUISSE
            draft.absence = null
            missionOpen = false
            absenceOpen = false
        }
        Option(AujourdhuiCopy.DOMICILE, draft.kind == RecordedKind.DOMICILE) {
            draft.kind = RecordedKind.DOMICILE
            draft.absence = null
            missionOpen = false
            absenceOpen = false
        }

        val missionSelected = draft.kind == RecordedKind.MISSION_FRANCE || draft.kind == RecordedKind.MISSION_THIRD
        Option(AujourdhuiCopy.MISSION, missionSelected) { missionOpen = !missionOpen }
        if (missionOpen || missionSelected) {
            Option(AujourdhuiCopy.MISSION_FRANCE, draft.kind == RecordedKind.MISSION_FRANCE) {
                draft.kind = RecordedKind.MISSION_FRANCE
                draft.absence = null
                absenceOpen = false
            }
            Option(AujourdhuiCopy.MISSION_THIRD, draft.kind == RecordedKind.MISSION_THIRD) {
                draft.kind = RecordedKind.MISSION_THIRD
                draft.absence = null
                absenceOpen = false
            }
        }

        Option(AujourdhuiCopy.ABSENCE, draft.kind == RecordedKind.ABSENCE) { absenceOpen = !absenceOpen }
        if (absenceOpen || draft.kind == RecordedKind.ABSENCE) {
            AbsenceChoice.entries.forEach { choice ->
                val chosen = draft.kind == RecordedKind.ABSENCE && draft.absence == choice
                Option(AujourdhuiCopy.absenceLabel(choice.name), chosen) {
                    draft.kind = RecordedKind.ABSENCE
                    draft.absence = choice
                    missionOpen = false
                }
            }
        }

        OutlinedTextField(
            value = draft.note,
            onValueChange = { draft.note = it },
            label = { Text(text = CalendarCopy.SHEET_NOTE_LABEL) },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// The late notice (SPEC 11.3, R216-split): a synced day states the FACT that the flag is in the dossier;
// a still-unrecorded backdated day PREDICTS the flag. In a warning-soft box so the words are not the
// only signal, but the words carry it (« Saisie tardive »), never colour alone (SPEC 966).
@Composable
private fun LateNotice(day: EditableDay) {
    val text =
        when {
            day.alreadyLate -> CalendarCopy.lateNotice(day.lateThresholdDays)
            day.wouldBeLate -> CalendarCopy.lateForecast(day.lateThresholdDays)
            else -> return
        }
    Text(
        text = text,
        style = FrontierType.body,
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.warningBg)
                .padding(Spacing.space12),
    )
}

// The provenance block (SPEC 11.3, FD6 A2): who recorded the day, when it was first recorded, and - if
// it was changed after that - when. Only for a day the server has recorded (a firstRecordedAt exists);
// a not-yet-synced day has no server timestamp to show. Every entry is « Saisie manuelle » (manual
// product); the timestamps are the SERVER'S own (R216), read Paris-side by formatDateTime.
@Composable
private fun ProvenanceBlock(day: EditableDay) {
    val recorded = day.slots.filter { it.firstRecordedAt != null }
    if (recorded.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = CalendarCopy.PROVENANCE_HEADING, style = FrontierType.caption, color = LightColors.textSecondary)
        // « Saisie manuelle » has one home (R206): AujourdhuiCopy.MODE_MANUAL, the same phrase the
        // Aujourd'hui mode strip shows - the manual product's provenance and its mode are one word.
        Text(text = AujourdhuiCopy.MODE_MANUAL, style = FrontierType.caption, color = LightColors.textSecondary)
        recorded.forEach { slot ->
            slot.firstRecordedAt?.let {
                Text(
                    text = CalendarCopy.firstRecordedLine(formatDateTime(it)),
                    style = FrontierType.caption,
                    color = LightColors.textSecondary,
                )
            }
            slot.modifiedAt?.let {
                Text(
                    text = CalendarCopy.modifiedLine(formatDateTime(it)),
                    style = FrontierType.caption,
                    color = LightColors.textSecondary,
                )
            }
        }
    }
}

@Composable
private fun Option(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radius.md)
    val sizing = Modifier.fillMaxWidth().heightIn(min = Spacing.space48)
    if (selected) {
        Button(onClick = onClick, shape = shape, modifier = sizing) { Text(text = label) }
    } else {
        OutlinedButton(onClick = onClick, shape = shape, modifier = sizing) { Text(text = label) }
    }
}
