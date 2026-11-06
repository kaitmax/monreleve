package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.toKotlinClock
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlin.time.ExperimentalTime
import kotlin.time.toKotlinInstant
import java.time.Clock as JavaClock
import java.time.Instant as JavaInstant

// IOS-2c R787. :app's HALF OF THE CALENDAR'S DATES, and it decides nothing - KMP-4's JavaTimeCalendarDay shape and
// IOS-1b-A R602d's JavaTimeAujourdhui shape.
//
// The calendar's date work is kotlinx-datetime and its clock is a kotlin.time Clock. The composition root (MainGraph),
// the controller's Kotest specs and the instrumented sheet test still hold a java.time Clock or Instant, so these two
// keep every one of those call sites unedited by converting TYPES and nothing else, with the standard library's own
// converters (R553): a java.time Clock's instant source becomes the kotlin.time Clock (its zone is not used - the
// calendar's day is always the Paris day), and a java.time Instant becomes the kotlin.time Instant - exactly the
// conversion bulkConfirmation made on its first line before. Named for what it holds, so its JVM facade class cannot
// collide with a file of :shared's.

/** The bulk confirmation, from a java.time.Instant: :app's call into the kotlin.time version. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time's java.time converter - on the allowlist.
fun bulkConfirmation(
    selectedDays: Set<String>,
    entries: List<EntryEntity>,
    kind: RecordedKind,
    absence: AbsenceChoice?,
    now: JavaInstant,
): BulkConfirmation = bulkConfirmation(selectedDays, entries, kind, absence, now.toKotlinInstant())

/** The CalendarController, built from a java.time.Clock (its instant source). The same parameters, the same order. */
@Suppress("LongParameterList", "FunctionNaming", "ktlint:standard:function-naming")
@OptIn(ExperimentalTime::class) // KMP-DT R590: hands the kotlin.time.Clock seam over - on the allowlist.
fun CalendarController(
    repository: EntryRepository,
    settingsStore: SettingsStore,
    taxYear: Int,
    clock: JavaClock,
    scope: CoroutineScope,
    requestSync: () -> Unit = {},
    restored: CalendarSnapshot? = null,
): CalendarController =
    CalendarController(
        repository = repository,
        settingsStore = settingsStore,
        taxYear = taxYear,
        clock = clock.toKotlinClock(),
        scope = scope,
        requestSync = requestSync,
        restored = restored,
    )
