package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.LocalDate

// AN10. The calendar screen's controller (SPEC 11.3). It lives OUTSIDE ui/ (fence 5): it holds the
// repository, the settings and the clock, and it OWNS the translation between the stored rows and the
// grid's own vocabulary - the pure work is in CalendarModel, this is the thin observing shell.
//
// Observing the repository IS the update (the DayCell pattern AN5b established): a day recorded here or
// on Aujourd'hui, and a sync that clears a pending row, both flow to the grid without a refresh. The
// month is recomputed on every change - the model is pure arithmetic over one year's rows.
//
// R28: "today" and the tax year are Europe/Paris, read once from the clock here (the one place a clock
// is allowed), and passed to the pure model as strings; the model never touches a clock.
//
// THE EDIT SHEET (increment 2). Tapping a recordable day opens it prefilled from that day's rows; a tap
// on the Save button - and only that tap (D16) - records through the SAME EntryRepository Aujourd'hui
// uses, the mutation id born at the tap, then enqueues the drain (SPEC 13.2). A future or out-of-period
// day is not recordable, so openDay refuses it and no sheet opens.

private const val LAST_MONTH = 12

/** One editable portion of a day, prefilled from its current row (null = nothing recorded there yet). */
data class EditableSlot(
    val slot: Slot,
    val kind: RecordedKind?,
    val absence: AbsenceChoice?,
    val note: String?,
    /** SYNCED and its firstRecordedAt more than the threshold after the day: the server flagged it late. */
    val late: Boolean,
    /** SYNCED with a lastModifiedAt that differs from firstRecordedAt: edited after first recording. */
    val modifiedAt: String?,
    /** The server's immutable first-recording timestamp, once synced (SPEC 8); null while pending. */
    val firstRecordedAt: String?,
)

/**
 * The day the edit sheet is open on. Built from the current rows; the sheet writes only on Save (D16).
 * The title is not held here: the sheet derives it from isoDate (formatDayLong), so the surface produces
 * the displayed text rather than the controller (R238's reachability model).
 *
 * The late signals are R216-split: `alreadyLate` is the SERVER'S fact (a synced row flagged late);
 * `wouldBeLate` is the PREDICTION that recording this backdated day now would be flagged. The threshold
 * is carried so the sheet interpolates it (R153/R181), never a typed 7.
 */
data class EditableDay(
    val isoDate: String,
    val granularity: GranularityChoice,
    val slots: List<EditableSlot>,
    val alreadyLate: Boolean,
    val wouldBeLate: Boolean,
    val lateThresholdDays: Int,
)

/** One Save-tap edit: a slot and what to record there (screen vocabulary; the controller maps to wire). */
data class SlotEdit(
    val slot: Slot,
    val kind: RecordedKind,
    val absence: AbsenceChoice?,
    val note: String?,
)

data class CalendarState(
    /** The visible month, or null before settings exist (the calendar is unreachable until onboarded). */
    val monthView: MonthView? = null,
    /** The day the edit sheet is open on, or null when it is closed. */
    val editing: EditableDay? = null,
)

class CalendarController(
    private val repository: EntryRepository,
    settingsStore: SettingsStore,
    private val taxYear: Int,
    private val clock: Clock,
    private val scope: CoroutineScope,
    private val requestSync: () -> Unit = {},
) {
    private val today: String = todayInParis(clock)
    private val settings: Settings? = settingsStore.load()
    private val granularity: GranularityChoice =
        if (settings?.granularity == "HALF_DAY") GranularityChoice.HALF_DAY else GranularityChoice.DAY
    private var entries: List<EntryEntity> = emptyList()
    private var visibleMonth: Int = initialMonth()

    private val mutableState = MutableStateFlow(CalendarState())
    val state: StateFlow<CalendarState> = mutableState.asStateFlow()

    init {
        scope.launch {
            repository.observeAll().collect { all ->
                entries = all
                recompute()
            }
        }
    }

    /** Open on the current month, clamped into the navigable range (a partial year starts mid-year). */
    private fun initialMonth(): Int {
        val loaded = settings ?: return LocalDate.parse(today).monthValue
        val first = firstNavMonth(loaded, taxYear)
        val parsed = LocalDate.parse(today)
        val current = if (parsed.year == taxYear) parsed.monthValue else first
        return current.coerceIn(first, LAST_MONTH)
    }

    fun goPreviousMonth() {
        if (mutableState.value.monthView?.canGoPrev == true) {
            visibleMonth -= 1
            recompute()
        }
    }

    fun goNextMonth() {
        if (mutableState.value.monthView?.canGoNext == true) {
            visibleMonth += 1
            recompute()
        }
    }

    /** Open the edit sheet on a day, prefilled. Refused for a day that is not recordable (AC1: future). */
    fun openDay(isoDate: String) {
        val day = mutableState.value.monthView?.days?.firstOrNull { it.isoDate == isoDate } ?: return
        if (!day.recordable) return
        mutableState.update { it.copy(editing = editableDay(isoDate)) }
    }

    fun closeSheet() {
        mutableState.update { it.copy(editing = null) }
    }

    /** Record the sheet's edits: one mutation per slot through the queue (D16 - the Save tap is the writer). */
    fun save(
        isoDate: String,
        edits: List<SlotEdit>,
    ) {
        scope.launch {
            for (edit in edits) {
                repository.record(
                    RecordCommand(
                        dayDate = isoDate,
                        kind = edit.kind.toEntryKind(),
                        portion = edit.slot.toPortion(),
                        absenceReason = edit.absence?.toReason(),
                        note = edit.note?.takeIf { it.isNotBlank() },
                    ),
                )
            }
            // SPEC 13.2: written to Room, then enqueued; WorkManager replays on connectivity.
            requestSync()
        }
        closeSheet()
    }

    private fun editableDay(isoDate: String): EditableDay {
        val rows = entries.filter { it.dayDate == isoDate }
        val slots =
            if (granularity == GranularityChoice.HALF_DAY) {
                listOf(editableSlot(Slot.MORNING, rows), editableSlot(Slot.AFTERNOON, rows))
            } else {
                listOf(editableSlot(Slot.FULL, rows))
            }
        return EditableDay(
            isoDate = isoDate,
            granularity = granularity,
            slots = slots,
            alreadyLate = slots.any { it.late },
            // The prediction (R216): would recording this backdated day now cross the threshold? True of
            // the day's age, whether or not a row exists yet - so the warning shows before the first save.
            wouldBeLate = LatenessForecast.wouldBeLate(LocalDate.parse(isoDate), clock.instant()),
            lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
        )
    }

    private fun editableSlot(
        slot: Slot,
        rows: List<EntryEntity>,
    ): EditableSlot {
        val row = rows.firstOrNull { it.portion == slot.toPortion() }
        return EditableSlot(
            slot = slot,
            kind = row?.kind?.toRecordedKind(),
            absence = row?.absenceReason?.toChoice(),
            note = row?.note,
            late = row?.let { serverLate(it) } ?: false,
            modifiedAt = row?.lastModifiedAt?.takeIf { it != row.firstRecordedAt },
            firstRecordedAt = row?.firstRecordedAt,
        )
    }

    private fun recompute() {
        val loaded = settings ?: return
        val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
        mutableState.update {
            it.copy(monthView = buildMonthView(yearEntries, loaded, taxYear, today, visibleMonth))
        }
    }
}

// The wire<->screen enum mappings, mirroring AujourdhuiController's (which keeps them private). Enum
// whens the compiler checks exhaustively, never French copy, so this is not the duplication R206 forbids.
private fun EntryKind.toRecordedKind(): RecordedKind =
    when (this) {
        EntryKind.CH -> RecordedKind.SUISSE
        EntryKind.HOME -> RecordedKind.DOMICILE
        EntryKind.MISSION_FR -> RecordedKind.MISSION_FRANCE
        EntryKind.MISSION_THIRD -> RecordedKind.MISSION_THIRD
        EntryKind.ABSENT -> RecordedKind.ABSENCE
    }

private fun RecordedKind.toEntryKind(): EntryKind =
    when (this) {
        RecordedKind.SUISSE -> EntryKind.CH
        RecordedKind.DOMICILE -> EntryKind.HOME
        RecordedKind.MISSION_FRANCE -> EntryKind.MISSION_FR
        RecordedKind.MISSION_THIRD -> EntryKind.MISSION_THIRD
        RecordedKind.ABSENCE -> EntryKind.ABSENT
    }

private fun AbsenceReason.toChoice(): AbsenceChoice =
    when (this) {
        AbsenceReason.CONGE -> AbsenceChoice.CONGE
        AbsenceReason.MALADIE -> AbsenceChoice.MALADIE
        AbsenceReason.FERIE -> AbsenceChoice.FERIE
        AbsenceReason.AUTRE -> AbsenceChoice.AUTRE
    }

private fun AbsenceChoice.toReason(): AbsenceReason =
    when (this) {
        AbsenceChoice.CONGE -> AbsenceReason.CONGE
        AbsenceChoice.MALADIE -> AbsenceReason.MALADIE
        AbsenceChoice.FERIE -> AbsenceReason.FERIE
        AbsenceChoice.AUTRE -> AbsenceReason.AUTRE
    }

private fun Slot.toPortion(): Portion =
    when (this) {
        Slot.FULL -> Portion.FULL
        Slot.MORNING -> Portion.AM
        Slot.AFTERNOON -> Portion.PM
    }
