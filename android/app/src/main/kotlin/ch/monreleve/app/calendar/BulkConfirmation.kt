package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.dossier.LatenessForecast
import java.time.Instant
import java.time.LocalDate

// AN-CAL2 (section 2, D16). The ONE confirmation shown before a bulk write. Pure: it takes the chosen days,
// the rows already stored, the choice and the current instant, and computes the confirmation's two CONDITIONAL
// lines - how many chosen days already hold a value (and so will be MODIFIED), and how many are old enough that
// the server will flag them « saisie tardive » if recorded now. The late rule is LatenessForecast (R286/R153),
// the SAME rule the single-day sheet and the server use - never a 7 typed here. Pure (now is passed, not read),
// so BulkConfirmationTest proves both lines fire exactly when they apply.

data class BulkConfirmation(
    val days: List<String>,
    val kind: RecordedKind,
    val absence: AbsenceChoice?,
    val alreadyRecordedCount: Int,
    val lateCount: Int,
    val lateThresholdDays: Int,
)

fun bulkConfirmation(
    selectedDays: Set<String>,
    entries: List<EntryEntity>,
    kind: RecordedKind,
    absence: AbsenceChoice?,
    now: Instant,
): BulkConfirmation {
    val days = selectedDays.sorted()
    val recordedDays = entries.map { it.dayDate }.toSet()
    return BulkConfirmation(
        days = days,
        kind = kind,
        absence = absence,
        alreadyRecordedCount = days.count { it in recordedDays },
        lateCount = days.count { LatenessForecast.wouldBeLate(LocalDate.parse(it), now) },
        lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
    )
}
