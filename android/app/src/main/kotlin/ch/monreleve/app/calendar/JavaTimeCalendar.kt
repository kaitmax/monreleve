package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.EntryEntity
import kotlin.time.ExperimentalTime
import kotlin.time.toKotlinInstant
import java.time.Instant as JavaInstant

// IOS-2c R787. :app's HALF OF THE CALENDAR'S DATES, and it decides nothing - KMP-4's JavaTimeCalendarDay shape.
//
// bulkConfirmation takes a kotlin.time Instant. BulkConfirmationTest still holds a java.time.Instant, so this
// overload keeps every one of its calls unedited by converting the TYPE and nothing else, with the standard
// library's own toKotlinInstant (R553) - exactly the conversion the function made on its first line before.
// Named for what it holds, so its JVM facade class cannot collide with BulkConfirmation.kt's.

/** The bulk confirmation, from a java.time.Instant: :app's call into the kotlin.time version. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time's java.time converter - on the allowlist.
fun bulkConfirmation(
    selectedDays: Set<String>,
    entries: List<EntryEntity>,
    kind: RecordedKind,
    absence: AbsenceChoice?,
    now: JavaInstant,
): BulkConfirmation = bulkConfirmation(selectedDays, entries, kind, absence, now.toKotlinInstant())
