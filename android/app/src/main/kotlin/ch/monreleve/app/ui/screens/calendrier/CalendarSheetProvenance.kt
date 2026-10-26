package ch.monreleve.app.ui.screens.calendrier

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import ch.monreleve.app.aujourdhui.RecordedProvenance
import ch.monreleve.app.calendar.EditableDay
import ch.monreleve.app.calendar.EditableSlot
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.DayCellCopy
import ch.monreleve.app.fr.text.formatDateTime

// AN-GRANULARITY (R519). The day sheet's provenance block - who recorded the day and when - split from
// CalendarEditSheet.kt to keep that file within detekt's per-file function budget (the ReleveSections /
// PrevisionRail split idiom). The sheet renders ProvenanceBlock; provenanceLines is what it prints, line by line.

/**
 * The slots whose provenance the sheet states: those the server has recorded (a firstRecordedAt exists). Since R490
 * every slot is its own portion's row (a day held whole is one FULL slot), so no row is ever stated twice.
 */
internal fun provenanceSlots(day: EditableDay): List<EditableSlot> = day.slots.filter { it.firstRecordedAt != null }

/**
 * The provenance block's lines, in order - exactly what ProvenanceBlock renders, one Text per line (R225: the words
 * are asserted where the sheet takes them from).
 *
 * AN-GRANULARITY (R519): WHO recorded the day is what its rows say - a manual entry, or a detection the person
 * confirmed or corrected - read from each portion's own provenance through the one home (DayCellCopy.provenanceLabel),
 * never a constant. It used to print « Saisie manuelle » for every recorded day (the manual product's line), which
 * misnamed every day detection had recorded once AN-PULL brought them down. When the portions agree the word is
 * stated once, as before; when the halves were recorded differently each half states its own, under its name.
 */
internal fun provenanceLines(day: EditableDay): List<String> {
    val recorded = provenanceSlots(day)
    if (recorded.isEmpty()) return emptyList()
    val agree = recorded.map { it.provenance }.distinct().size == 1
    val body =
        if (agree) {
            listOfNotNull(recorded.first().provenance?.let(::whoRecorded)) + recorded.flatMap(::timestampLines)
        } else {
            recorded.flatMap { slot ->
                listOfNotNull(slot.provenance?.let { AujourdhuiCopy.halfLabel(slotName(slot.slot), whoRecorded(it)) }) +
                    timestampLines(slot)
            }
        }
    return listOf(CalendarCopy.PROVENANCE_HEADING) + body
}

/** The name of who recorded a portion, from its one home. Every RecordedProvenance has one. */
private fun whoRecorded(provenance: RecordedProvenance): String = DayCellCopy.provenanceLabel(provenance.name).orEmpty()

/** When one recorded portion was first recorded and, if it changed after that, when - the SERVER's own (R216). */
private fun timestampLines(slot: EditableSlot): List<String> =
    listOfNotNull(
        slot.firstRecordedAt?.let { CalendarCopy.firstRecordedLine(formatDateTime(it)) },
        slot.modifiedAt?.let { CalendarCopy.modifiedLine(formatDateTime(it)) },
    )

// The provenance block (SPEC 11.3, FD6 A2): who recorded the day, when it was first recorded, and - if
// it was changed after that - when. Only for a day the server has recorded (a firstRecordedAt exists);
// a not-yet-synced day has no server timestamp to show. The timestamps are the SERVER'S own (R216), read
// Paris-side by formatDateTime.
@Composable
internal fun ProvenanceBlock(day: EditableDay) {
    val lines = provenanceLines(day)
    if (lines.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        lines.forEach { line ->
            Text(text = line, style = FrontierType.caption, color = LightColors.textSecondary)
        }
    }
}
