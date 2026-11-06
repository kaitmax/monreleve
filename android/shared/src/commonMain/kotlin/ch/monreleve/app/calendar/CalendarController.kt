package ch.monreleve.app.calendar

import ch.monreleve.app.DayWriter
import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.RecordedProvenance
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.aujourdhui.toRecordedProvenance
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.repo.dayGranularityOf
import ch.monreleve.app.data.repo.portionsToOffer
import ch.monreleve.app.data.repo.recordedInOtherGranularity
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.toChoice
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.shared.PlatformSerializable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

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
    /**
     * AN-GRANULARITY (R519): WHO recorded this portion, as its row says - a manual entry, or a detection the person
     * confirmed or corrected. The sheet states it from here, never from a constant. Null for a portion with no row.
     */
    val provenance: RecordedProvenance? = null,
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
    /**
     * AN-GRANULARITY (R490, R493): the granularity this day was RECORDED in, when it is not the setting's - a day held
     * whole seen in half-day mode, or a day held in halves seen in whole-day mode. The sheet then offers the day in
     * its own granularity and says so in one sentence. Null when the two agree, for an empty day (asked for in the
     * setting's) and for a day already mixed (R494: shown as its rows say).
     */
    val recordedAs: GranularityChoice? = null,
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
    /** AN-CAL2: the multi-day selection (off until « Sélectionner plusieurs jours » or a long press starts it). */
    val selection: SelectionState = SelectionState(),
    /**
     * AN-CAL2: the ONE confirmation shown before a bulk write (D16), or null when none is open. Transient - a
     * rebuild closes it, with the selection restored beneath it (R310), so re-opening it is a single tap and its
     * counts are re-derived rather than stored (R181).
     */
    val bulkConfirmation: BulkConfirmation? = null,
)

/**
 * AN-CAL2 (section 2). The state of a multi-day selection. `active` is the selection MODE (the grid toggles
 * instead of opening the sheet, the action panel shows); `days` are the chosen days, a Set so a day can never
 * be in it twice (C3); `anchor` is the last singly-added day, so the next tap on another day fills the range
 * between them (« a holiday week is two taps »). Future and out-of-period days are never added - whatever
 * single-day editing cannot record, selection cannot either.
 */
data class SelectionState(
    val active: Boolean = false,
    val days: Set<String> = emptySet(),
    val anchor: String? = null,
)

/**
 * AN-STATE (R310): the calendar's restorable state across a rebuild - the visible month and the ISO date of an
 * open edit sheet. A plain data class (no compose); the composition root holds it in rememberSaveable so it
 * survives rotation, a text-size change, a dark-mode switch AND a background kill. The sheet's HALF-ENTERED
 * picks (kind/absence/note not yet saved) live in the sheet composable's own rememberSaveable, not here - this
 * only reopens the sheet on the right day; the prefill is re-derived from the recorded rows (R181).
 */
data class CalendarSnapshot(
    val month: Int? = null,
    val editingDay: String? = null,
    /** AN-CAL2 (R310): the multi-day selection, or null when not selecting. */
    val selection: SelectionSnapshot? = null,
)

/**
 * AN-CAL2 (R310): the restorable multi-day selection. Serializable, so the composition root's rememberSaveable
 * stores it in the saved-instance-state Bundle, which survives a config change AND a background kill (C2).
 * Null means "not selecting"; a present snapshot means selection mode is on, with these days and this anchor.
 * The confirmation's two conditional lines are NOT stored - they are re-derived from the days on restore (R181).
 *
 * IOS-2c R788: the supertype is PlatformSerializable - on Android an actual typealias of java.io.Serializable, so the
 * same class with the same computed serialVersionUID (measured equal before and after the move) and the same Bundle
 * bytes; on iOS an empty marker (an iOS host restores the selection its own way, or not at all).
 */
data class SelectionSnapshot(
    val days: List<String>,
    val anchor: String?,
) : PlatformSerializable

// AN-STATE: the restore seed is a seventh constructor parameter, over detekt's list threshold. These ARE the
// controller's dependencies plus the one restorable seed; bundling them into a holder would only move the list
// (the same reasoning MainGraph and ParametresController carry).
// AN-CAL2: TooManyFunctions suppressed - this is the calendar's ONE cohesive state holder (navigation, the edit
// sheet AND now multi-day selection + the bulk confirmation), the same reason CalendarModel.kt suppresses it at
// file level; splitting it would scatter the single source the screen observes (R328, one way of counting).
@Suppress("LongParameterList", "TooManyFunctions")
class CalendarController(
    private val repository: EntryRepository,
    // AN-CALENDAR (R475): the STORE is held, never a value read from it. The settings were read once here, in the
    // constructor, and kept - so after Parametres switched to half-days the sheet still offered one whole-day slot
    // until the app was restarted (REPORT-KMP-4 NOTICED 1). Every use below asks the store at that moment.
    private val settingsStore: SettingsStore,
    private val taxYear: Int,
    // IOS-2c R787: the clock seam is kotlin.time.Clock (an instant source; the Paris day is computed from it, not from
    // a device zone). :app's java.time callers reach this through JavaTimeCalendar.kt's factory, named like the class.
    @OptIn(ExperimentalTime::class) // KMP-DT R590: the kotlin.time.Clock seam - on the allowlist.
    private val clock: Clock,
    private val scope: CoroutineScope,
    // R291: a DayWriter, so MainGraphWiringTest enumerates this by type and asserts the app's graph
    // builds it with a real requestSync. Default no-op only for the JVM tests that build it directly.
    override val requestSync: () -> Unit = {},
    // AN-STATE (R310): the state to restore after a rebuild (null = a fresh open). Seeds the visible month and,
    // via pendingEditingDay, reopens the edit sheet on the day it was open on - once the rows have loaded.
    restored: CalendarSnapshot? = null,
) : DayWriter {
    @OptIn(ExperimentalTime::class) // KMP-DT R590: reads the kotlin.time.Clock seam - on the allowlist.
    private val today: String = todayInParis(clock)
    private var entries: List<EntryEntity> = emptyList()

    // AN-STATE: a restored month is clamped into the navigable range the same way initialMonth() is (a partial
    // year starts mid-year), so a stale saved month can never land outside the year's bounds.
    private var visibleMonth: Int = restored?.month?.let(::clampMonth) ?: initialMonth()

    // AN-STATE: the day an edit sheet was open on, reopened once the rows load (recompute). Cleared after the
    // first reopen so a later month change or save does not re-open it.
    private var pendingEditingDay: String? = restored?.editingDay

    // AN-CAL2 (R310): the multi-day selection restored after a rebuild, or empty for a fresh open.
    private val initialSelection: SelectionState =
        restored?.selection?.let {
            SelectionState(active = true, days = it.days.toSet(), anchor = it.anchor)
        } ?: SelectionState()

    private val mutableState = MutableStateFlow(CalendarState(selection = initialSelection))
    val state: StateFlow<CalendarState> = mutableState.asStateFlow()

    init {
        scope.launch {
            repository.observeAll().collect { all ->
                entries = all
                recompute()
            }
        }
    }

    // AN-STATE: a restored month, clamped into the navigable range (the same bounds initialMonth uses).
    private fun clampMonth(month: Int): Int {
        val loaded = settingsStore.load() ?: return month.coerceIn(1, LAST_MONTH)
        return month.coerceIn(firstNavMonth(loaded, taxYear), LAST_MONTH)
    }

    // IOS-2c R787: the date work is CalendarDates.openingMonth, extracted from here unchanged.

    /** Open on the current month, clamped into the navigable range (a partial year starts mid-year). */
    private fun initialMonth(): Int =
        openingMonth(today, taxYear, settingsStore.load()?.let { firstNavMonth(it, taxYear) })

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

    // ----------------------------------------------------------------------------------------------
    // AN-CAL2: multi-day selection (section 2). D16 holds - nothing here writes; selection only chooses.
    // ----------------------------------------------------------------------------------------------

    /**
     * Enter selection mode. A long press may pass the pressed day so it is chosen at once; the button passes none.
     */
    fun startSelection(day: String? = null) {
        val seed = day?.let { iso -> selectableDay(iso)?.isoDate }
        mutableState.update {
            it.copy(
                selection =
                    SelectionState(
                        active = true,
                        days = seed?.let { d -> setOf(d) } ?: emptySet(),
                        anchor = seed,
                    ),
            )
        }
    }

    /** Leave selection mode, discarding the selection. « Annuler » writes nothing (D16). */
    fun cancelSelection() {
        mutableState.update { it.copy(selection = SelectionState()) }
    }

    /**
     * A tap on a day while selecting. Already selected -> removed (toggle off). Not selected with no anchor ->
     * added as the anchor. Not selected with an anchor -> the recordable range between the anchor and this day
     * is added (« a holiday week is two taps »), and the anchor clears so the next tap starts fresh. A day that
     * single-day editing could not record (future, out of period) is refused, exactly as openDay refuses it.
     */
    fun tapDay(iso: String) {
        val day = selectableDay(iso) ?: return
        val sel = mutableState.value.selection
        val next =
            when {
                day.isoDate in sel.days -> sel.copy(days = sel.days - day.isoDate, anchor = null)
                sel.anchor == null -> sel.copy(days = sel.days + day.isoDate, anchor = day.isoDate)
                else -> sel.copy(days = sel.days + recordableRange(sel.anchor, day.isoDate), anchor = null)
            }
        mutableState.update { it.copy(selection = next.copy(active = true)) }
    }

    /**
     * The action panel's choice was made: compute the ONE confirmation (D16) from the chosen days, the rows
     * already stored and the clock (the late count follows R286). Nothing is written yet - confirmBulk does that.
     * Absent carries its reason, chosen once for all the days.
     */
    @OptIn(ExperimentalTime::class) // KMP-DT R590: reads the kotlin.time.Clock seam - on the allowlist.
    fun chooseBulk(
        kind: RecordedKind,
        absence: AbsenceChoice?,
    ) {
        val sel = mutableState.value.selection
        if (!sel.active || sel.days.isEmpty()) return
        val confirmation = bulkConfirmation(sel.days, entries, kind, absence, clock.now())
        mutableState.update { it.copy(bulkConfirmation = confirmation) }
    }

    /** Dismiss the confirmation back to the action panel, the selection intact. */
    fun cancelBulkConfirmation() {
        mutableState.update { it.copy(bulkConfirmation = null) }
    }

    /**
     * Confirm the bulk write (D16 - this tap is the writer). ONE mutation PER DAY through the SAME repository
     * single-day editing uses: each gets its own clientMutationId (born here), the account's tag (R303) and
     * clientClaimedAt = this confirmation tap (R275) - a bulk entry is exactly the same rows as entering the days
     * one by one, nothing says « bulk ». Then one requestSync; SyncEngine batches within MAX_BATCH_ITEMS and, as
     * each (day, portion) is recorded once, never carries a key twice (R296 isolation still applies per item).
     *
     * AN-GRANULARITY (R493): EACH DAY IN ITS OWN GRANULARITY. This wrote every chosen day as one FULL row - so a day
     * held in halves gained a whole-day row beside them, counted twice. Now each day gets the portions the record
     * path's rule offers it (DayGranularity.portionsToOffer): a day held whole its FULL row, a day held in halves
     * both halves, an EMPTY day the setting's granularity (a morning and an afternoon in half-day mode), a day already
     * mixed exactly the rows it holds (R494) - each set to the chosen kind, the same rows entering it by hand makes.
     */
    fun confirmBulk() {
        val confirmation = mutableState.value.bulkConfirmation ?: return
        // R475: the setting as it is NOW, read at the confirming tap; it decides only the days with no rows.
        val setting = dayGranularityOf(settingsStore.load())
        val held = entries.groupBy({ it.dayDate }, { it.portion })
        scope.launch {
            var written = 0
            for (iso in confirmation.days) {
                for (portion in portionsToOffer(held[iso].orEmpty(), setting)) {
                    val result =
                        repository.record(
                            RecordCommand(
                                dayDate = iso,
                                kind = confirmation.kind.toEntryKind(),
                                portion = portion,
                                absenceReason = confirmation.absence?.toReason(),
                            ),
                        )
                    if (result is RecordResult.Recorded) written++
                }
            }
            if (written > 0) requestSync()
        }
        mutableState.update { it.copy(selection = SelectionState(), bulkConfirmation = null) }
    }

    /** A recordable day of the visible month by its ISO date, or null if it is absent, future or out of period. */
    private fun selectableDay(iso: String): CalendarDayUi? =
        mutableState.value.monthView?.days?.firstOrNull { it.isoDate == iso && it.recordable }

    /** Every recordable day of the visible month between two ISO dates, inclusive (ISO strings sort by date). */
    private fun recordableRange(
        a: String,
        b: String,
    ): Set<String> {
        val lo = minOf(a, b)
        val hi = maxOf(a, b)
        return mutableState.value.monthView?.days
            ?.filter { it.recordable && it.isoDate in lo..hi }
            ?.map { it.isoDate }
            ?.toSet()
            ?: emptySet()
    }

    /**
     * Record the sheet's edits (D16 - the Save tap is the writer), and ONLY the portions whose value changed.
     *
     * AN-CALENDAR (R473). Each edit is compared with what is stored for its portion - the kind, the absence
     * reason and the note, every field the sheet edits - and written only if one of them differs. A save that
     * changes nothing writes nothing and asks for no sync. Before this, every slot holding a kind was recorded
     * on every save: changing a morning re-recorded the afternoon as well, a new mutation id for the same value,
     * and the server's append-only trail gained a MODIFIED event for something nobody did (REPORT-KMP-4 NOTICED 6).
     *
     * THE COMPARISON IS ON WHAT WOULD BE WRITTEN, not on what was typed: the note is normalised exactly as the
     * write normalises it (blank -> null) on both sides, because the sheet seeds an absent note as "" and a
     * comparison of "" with null would call an untouched half "changed" - the defect again, one layer down.
     */
    fun save(
        isoDate: String,
        edits: List<SlotEdit>,
    ) {
        val stored = entries.filter { it.dayDate == isoDate }
        // Each edit is compared with its OWN portion's row - since R490 the sheet offers exactly the portions the day
        // is held in (or, empty, the setting's), so every slot it shows is a row or nothing.
        val changed =
            edits
                .map { it.toCommand(isoDate) }
                .filter { command -> command.changes(stored.firstOrNull { it.portion == command.portion }) }
        if (changed.isNotEmpty()) {
            scope.launch {
                // R492: a write the repository refused wrote nothing, so it asks for no sync either.
                val written = changed.count { command -> repository.record(command) is RecordResult.Recorded }
                // SPEC 13.2: written to Room, then enqueued; WorkManager replays on connectivity.
                if (written > 0) requestSync()
            }
        }
        closeSheet()
    }

    @OptIn(ExperimentalTime::class) // KMP-DT R590: reads the kotlin.time.Clock seam - on the allowlist.
    private fun editableDay(isoDate: String): EditableDay {
        val rows = entries.filter { it.dayDate == isoDate }
        val held = rows.map { it.portion }
        // AN-CALENDAR (R475): the setting AS IT IS NOW, read when a sheet is opened - so a switch made in Parametres is
        // offered by the next sheet without a restart. AN-GRANULARITY (R490): it decides only a day with no rows; a
        // recorded day is offered in the granularity its rows have (DayGranularity.kt, the record path's one rule).
        val setting = dayGranularityOf(settingsStore.load())
        val slots = portionsToOffer(held, setting).map { portion -> editableSlot(portion.toSlot(), rows) }
        return EditableDay(
            isoDate = isoDate,
            granularity = if (slots.any { it.slot == Slot.FULL }) GranularityChoice.DAY else GranularityChoice.HALF_DAY,
            recordedAs = recordedInOtherGranularity(held, setting)?.toChoice(),
            slots = slots,
            alreadyLate = slots.any { it.late },
            // The prediction (R216): would recording this backdated day now cross the threshold? True of
            // the day's age, whether or not a row exists yet - so the warning shows before the first save.
            // IOS-2c R787: CalendarDates.wouldBeLateOn - this line extracted unchanged, shared with bulkConfirmation.
            wouldBeLate = wouldBeLateOn(isoDate, clock.now()),
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
            provenance = row?.provenance?.toRecordedProvenance(),
        )
    }

    /**
     * AN-CALENDAR (R475): re-read the settings and redraw the month - the shell calls this when the calendar's tab is
     * selected, the way it refreshes Aujourd'hui, so a change of activity start made in Parametres is shown at once.
     */
    fun refresh() = recompute()

    private fun recompute() {
        val loaded = settingsStore.load() ?: return
        val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
        // AN-STATE (R310): reopen a sheet that was open before a rebuild, once the rows have loaded so the
        // prefill is the recorded day's (R181), not an empty one. Cleared after the first reopen so a later
        // month change or save does not re-raise it.
        val reopened = pendingEditingDay?.let { day -> editableDay(day).also { pendingEditingDay = null } }
        mutableState.update {
            it.copy(
                monthView = buildMonthView(yearEntries, loaded, taxYear, today, visibleMonth),
                editing = reopened ?: it.editing,
            )
        }
    }
}

// AN-GRANULARITY (R490) REPLACED AN-CALENDAR's R477 DISPLAY. A day held WHOLE, seen in half-day mode, used to be shown
// as two halves answered with the FULL row's kind (`shownFor`), and changing one of them wrote a half beside the FULL
// row. The operator ruled instead that a day keeps the granularity it was recorded in: such a day is offered as ONE
// whole-day slot (portionsToOffer), so every slot the sheet shows is its own portion's row, or nothing yet.

private fun Portion.toSlot(): Slot =
    when (this) {
        Portion.FULL -> Slot.FULL
        Portion.AM -> Slot.MORNING
        Portion.PM -> Slot.AFTERNOON
    }

// AN-CALENDAR (R473): the note as the write stores it - a blank note is no note. One home, used on BOTH sides of
// the comparison and by the write itself, so the three cannot disagree about what "the same note" means.
private fun String?.normalisedNote(): String? = this?.takeIf { it.isNotBlank() }

/** One edit as the write it would make. */
private fun SlotEdit.toCommand(isoDate: String): RecordCommand =
    RecordCommand(
        dayDate = isoDate,
        kind = kind.toEntryKind(),
        portion = slot.toPortion(),
        absenceReason = absence?.toReason(),
        note = note.normalisedNote(),
    )

/**
 * R473: would writing this command change what is stored for its portion? Every field the sheet edits is
 * compared - kind, absence reason, note - and a portion with no row is always a change (R474: a half answered
 * for the first time must never be judged unchanged).
 */
private fun RecordCommand.changes(stored: EntryEntity?): Boolean =
    stored == null ||
        stored.kind != kind ||
        stored.absenceReason != absenceReason ||
        stored.note.normalisedNote() != note

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
