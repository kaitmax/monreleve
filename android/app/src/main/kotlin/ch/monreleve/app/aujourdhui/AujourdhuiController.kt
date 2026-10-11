package ch.monreleve.app.aujourdhui

import ch.monreleve.app.DayWriter
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.TeleworkResult
import ch.monreleve.app.calc.Warning
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.calendar.CalendarDayUi
import ch.monreleve.app.calendar.MonthSummary
import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.calendar.weekdayCells
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.TallyEntity
import ch.monreleve.app.data.local.deviceClaimNow
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.detection.DayChecks
import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.InMemoryNearBorderNoticeStore
import ch.monreleve.app.detection.NearBorderNoticeStore
import ch.monreleve.app.detection.Proposal
import ch.monreleve.app.detection.afterLastCheckWindow
import ch.monreleve.app.detection.afternoonProposal
import ch.monreleve.app.detection.dayProposal
import ch.monreleve.app.detection.detectionOutcome
import ch.monreleve.app.detection.morningProposal
import ch.monreleve.app.detection.shouldSuggestManualForNearBorder
import ch.monreleve.app.detection.toDayChecks
import ch.monreleve.app.dossier.AggregatableEntry
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.dossier.pendingEntriesForYear
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.LocalDate

// AN5b increment 3. Recording a day (SPEC 11.2). The one question - where are you working today? -
// answered in one tap, which records through AN5's EntryRepository (D16: the tap is the only writer,
// and the mutation id is born at the tap). This controller lives OUTSIDE ui/ (fence 5): it holds the
// repository and the clock, and it OWNS THE MAPPING between the screen's vocabulary and the wire's.
//
// THE UI VOCABULARY IS ITS OWN (R202, the same split DayCell's DayKind makes). RecordedKind, Slot and
// AbsenceChoice are what the screen speaks; EntryKind, Portion and AbsenceReason are what the queue
// and the server speak. The screen never imports the wire enums (the ui fence forbids it); this
// controller translates, once, here.
//
// NO SUCCESS ANIMATION (DESIGN-SYSTEM section 2): the confirmation is the recorded row appearing,
// which observing the repository produces. Pending is a persistent state read from SyncState, never a
// toast. Today is the PARIS day (R28), not the device's.

/** The screen's kinds. Orthogonal to the wire's EntryKind (R202) - two vocabularies, two jobs. */
enum class RecordedKind { SUISSE, DOMICILE, MISSION_FRANCE, MISSION_THIRD, ABSENCE }

/** The screen's portions: a whole day, or a half. */
enum class Slot { FULL, MORNING, AFTERNOON }

/** The screen's absence reasons. Maps 1:1 to the wire's AbsenceReason, but the screen never sees that. */
enum class AbsenceChoice { CONGE, MALADIE, FERIE, AUTRE }

/**
 * The screen's provenance of a recorded day (AN-AUTO, R202/R314). Orthogonal to the wire's Provenance (R202):
 * the screen shows WHO/WHAT produced the record - a manual tap, or a detection the person confirmed or
 * corrected - so the Aujourd'hui confirmed row can carry the provenance line (ETAT C). The ui fence keeps the
 * wire Provenance out of ui/; this controller translates, once, here.
 */
enum class RecordedProvenance { MANUAL, DETECTED_CONFIRMED, DETECTED_CORRECTED }

/**
 * What the Aujourd'hui auto surface shows for TODAY when automatic detection is on and the day is not yet
 * recorded (SPEC 11.2 ETATS A/B). Null on AujourdhuiState means manual mode OR a day already recorded (ETAT C,
 * the recorded row carries the provenance line). Only HIGH proposes (R311); MEDIUM/LOW/no-data withhold.
 */
sealed interface AutoDayState {
    /** ETAT A: the day is still running (or nothing is sampled yet); nothing is proposed. */
    data object Detecting : AutoDayState

    /** ETAT B: a HIGH-tier proposal to confirm or correct (R314). `kind` is the proposed side (SUISSE/DOMICILE). */
    data class ToConfirm(val kind: RecordedKind) : AutoDayState

    /** ETAT B withheld: the day cannot be proposed with confidence; the not-sure message (R312). */
    data object NotSure : AutoDayState
}

/**
 * How close the OLDEST unsynced day is to the late-saisie threshold (R286). A WARNING state, not the
 * record: R216 - the dossier's « saisie tardive » flag is the server's, from its own observation; this
 * only escalates the pending line before the threshold is crossed. NONE while young, APPROACHING as it
 * nears, OVERDUE once it would already be flagged if it synced now.
 */
enum class PendingLateness { NONE, APPROACHING, OVERDUE }

/**
 * How many days before the threshold the pending line starts to escalate (R286). PARKAN-18: the prompt
 * does not set this, so the conservative small look-ahead (two days) is taken - it warns before the
 * crossing without alarming early. Reversible: it is a client-only warning window, no migration.
 */
private const val WARN_WINDOW_DAYS = 2L

/** What one portion slot holds: the recorded kind (screen vocabulary) and its sync state in words. */
data class DayEntry(
    val kind: RecordedKind,
    val absence: AbsenceChoice?,
    val pending: Boolean,
    /** The server refused the client-built payload (R198): held, not retried, and SAID so, never silent. */
    val failed: Boolean,
    /** How the day was recorded (R314): a manual tap, or a detection confirmed/corrected. */
    val provenance: RecordedProvenance = RecordedProvenance.MANUAL,
)

/**
 * The year's position, computed ON THE DEVICE (Room -> the increment-2 aggregation -> the engine).
 * There is NO second arithmetic in the UI (FW12's defect): the engine produces the rate and the
 * remaining days, the screen only maps them to a zone and a badge. Null on AujourdhuiState means the
 * year has no entries yet - shown as such, never as 0 % (AC3).
 */
data class YearPanel(
    val result: TeleworkResult,
    val fiscalCeiling: Double,
    val socialCeiling: Double,
    /** Days included in the rate that the server has not yet acknowledged (AC3: said in words). */
    val unsyncedDays: Int,
    /** How close the oldest unsynced day is to the late threshold (R286). Defaults to NONE. */
    val pendingLateness: PendingLateness = PendingLateness.NONE,
    /** The late threshold, from the shared source (R206), so the copy interpolates it (R153). */
    val lateThresholdDays: Int = LatenessForecast.BACKFILL_DAYS,
    /** periodFraction < 1: the engine used part of the year (FW26 - keyed on the fraction, not the date). */
    val partialYear: Boolean,
    /** Set when the engine fell back to another year's RuleSet (R11 / RULE_SET_FALLBACK). */
    val fallbackYear: Int?,
)

/**
 * Section C « À traiter » (AN-HOME, R328): what the person needs to act on, surfaced ONLY when there is
 * something (null otherwise - the section is absent, never an empty box). A READ-ONLY projection of days
 * the app already holds: nothing here records or sends anything, D16 holds, and it is pure presentation.
 */
data class ToAttendTo(
    /**
     * Past working days THIS MONTH with no entry - the SAME count as the calendar's « Non renseigné » for
     * the current month, from CalendarModel.buildMonthView (R328: one way of counting, FW12's defect). The
     * home and the calendar therefore show the same number for the month the calendar opens on.
     */
    val unrecordedThisMonth: Int,
    /** Days of this year recorded on the phone but not yet sent - the SAME figure as YearPanel.unsyncedDays
     *  (one computation, R206), so the two lines cannot drift. */
    val unsyncedDays: Int,
    /** How close the oldest unsent day is to the late-saisie threshold (R286). */
    val pendingLateness: PendingLateness,
    /** The late threshold, from the shared source (R206/R153), so copy interpolates it rather than typing it. */
    val lateThresholdDays: Int,
)

data class AujourdhuiState(
    val today: String,
    val granularity: GranularityChoice,
    /** AN-HOME section A (PARKAN-50): the holder's name (Settings.name); its first name drives the greeting.
     *  Null when the account has no name yet (AN-ONBOARD-2), greeted « Bonjour » alone. */
    val holderName: String? = null,
    val fullDay: DayEntry? = null,
    val morning: DayEntry? = null,
    val afternoon: DayEntry? = null,
    /** The year's position, or null when the year has no entries (AC3: no rate shown). */
    val year: YearPanel? = null,
    /** Section C (AN-HOME, R328): what to attend to, or null when there is nothing. */
    val attend: ToAttendTo? = null,
    /** Section E (AN-HOME, R328): the current week's Monday-Friday cells, in the grid vocabulary (read-only). */
    val week: List<CalendarDayUi> = emptyList(),
    /** Section F (AN-HOME, R328): this month's recorded-day counts - the SAME MonthSummary the calendar
     *  computes (one way of counting). Null when the settings are unavailable. */
    val month: MonthSummary? = null,
    /** AN-AUTO (R315): which mode records the person's days. MANUAL keeps the existing manual UI. */
    val loggingMode: LoggingMode = LoggingMode.MANUAL,
    /** AN-AUTO (SPEC 11.2): today's auto surface for DAY granularity - null in manual mode, half-day, or recorded. */
    val auto: AutoDayState? = null,
    /** R320: the morning's auto surface for HALF_DAY granularity (checks 1-2); null otherwise or when recorded. */
    val autoMorning: AutoDayState? = null,
    /** R320: the afternoon's auto surface for HALF_DAY granularity (checks 3-4); null otherwise or when recorded. */
    val autoAfternoon: AutoDayState? = null,
    /** AN-AUTO (R313): render the near-border suggestion once (DetectionCopy.NEAR_BORDER). */
    val nearBorderNotice: Boolean = false,
)

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

private fun Provenance.toRecordedProvenance(): RecordedProvenance =
    when (this) {
        Provenance.MANUAL -> RecordedProvenance.MANUAL
        Provenance.DETECTED_CONFIRMED -> RecordedProvenance.DETECTED_CONFIRMED
        Provenance.DETECTED_CORRECTED -> RecordedProvenance.DETECTED_CORRECTED
    }

private fun EntryEntity.toDayEntry(): DayEntry =
    DayEntry(
        kind = kind.toRecordedKind(),
        absence = absenceReason?.toChoice(),
        pending = syncState == SyncState.PENDING,
        failed = syncState == SyncState.FAILED,
        provenance = provenance.toRecordedProvenance(),
    )

// The sync trigger is injected as a lambda (default no-op for JVM tests): the controller lives outside
// ui/ but has no Context, and SyncScheduler.requestSync needs one. MainActivity, the composition root,
// supplies { SyncScheduler.requestSync(applicationContext) }.
// The dependency list is the controller's seams - the write path, the clock, the detection mode/tally/notice
// stores - listed rather than bundled (the standing reasoning across the shell's controllers); the auto-mode
// record/confirm/correct methods take the function count past the default threshold for the same reason.
@Suppress("LongParameterList", "TooManyFunctions")
class AujourdhuiController(
    private val repository: EntryRepository,
    private val settingsStore: SettingsStore,
    private val taxYear: Int,
    private val clock: Clock,
    private val scope: CoroutineScope,
    // R291: a DayWriter, so MainGraphWiringTest enumerates this by type and asserts the app's graph
    // builds it with a real requestSync. Default no-op only for the JVM tests that build it directly.
    override val requestSync: () -> Unit = {},
    // AN-AUTO increment 5 (R311-R315). The device's logging-mode cache (the same store Parametres toggles),
    // the day's tally stream (Room's daily_tally, coordinate-free - SPEC 13.1), and the near-border "told
    // once" flag (R313). All defaulted so the existing JVM tests and MainGraphWiringTest build unchanged;
    // the app injects the SharedPreferences store, the DAO flow and the SharedPreferences notice store.
    private val detectionModeStore: DetectionModeStore = InMemoryDetectionModeStore(),
    detectionTallies: Flow<List<TallyEntity>> = emptyFlow(),
    private val nearBorderNoticeStore: NearBorderNoticeStore = InMemoryNearBorderNoticeStore(),
) : DayWriter {
    // F8 (AN-FIX): "today" and the tax year are RECOMPUTED FROM THE CLOCK at use time, not frozen at
    // construction. They start at the current values and move on refresh() (resume) and at record time, so an
    // Activity held open across midnight - or a tax-year boundary - no longer files a day under the stale date.
    private var today: String = todayInParis(clock)
    private var currentTaxYear: Int = taxYear
    private var lastEntries: List<EntryEntity> = emptyList()
    private var lastTallies: List<TallyEntity> = emptyList()

    // AN-AUTO (R313): once the near-border notice is active for this controller instance it stays shown until a
    // rebuild (never flickers off when the tally stream re-emits); markShown() persists "told once" across
    // relaunches. See computeNearBorder.
    private var nearBorderActive = false
    private val settings: Settings? = settingsStore.load()
    private val granularity: GranularityChoice =
        if (settings?.granularity == "HALF_DAY") GranularityChoice.HALF_DAY else GranularityChoice.DAY

    private val mutableState =
        MutableStateFlow(AujourdhuiState(today = today, granularity = granularity, holderName = settings?.name))
    val state: StateFlow<AujourdhuiState> = mutableState.asStateFlow()

    init {
        // Observing the repository IS the confirmation (DESIGN-SYSTEM section 2): a recorded tap and a
        // completed sync both flow to the UI without a toast or an animation. The year is recomputed
        // on every change - the engine is < 0.1 ms (FW5), so there is no reason to cache a rate.
        scope.launch {
            repository.observeAll().collect { entries ->
                lastEntries = entries
                emitState()
            }
        }
        // AN-AUTO: the day's tally stream (Room's daily_tally). The background sampler (a separate process)
        // writes it; observing it lets ETAT A become ETAT B the moment the evening proposal is available,
        // without a manual refresh. Coordinate-free by construction (SPEC 13.1 / D18).
        scope.launch {
            detectionTallies.collect { tallies ->
                lastTallies = tallies
                emitState()
            }
        }
    }

    /**
     * F8 (AN-FIX): recompute "today" and the tax year FROM THE CLOCK and re-emit. MainActivity calls this on
     * ON_RESUME, so an app held open across midnight (or a tax-year boundary) shows the new day the moment it
     * resumes, rather than the date captured when the Activity was created. There is no repository change at
     * midnight, so this re-emits the LAST entries through the refreshed today/taxYear.
     */
    fun refresh() {
        today = todayInParis(clock)
        currentTaxYear = LocalDate.parse(today).year
        emitState()
    }

    private fun emitState() {
        val todays = lastEntries.filter { it.dayDate == today }
        val mode = detectionModeStore.load()
        val fullDay = todays.firstOrNull { e -> e.portion == Portion.FULL }
        val morning = todays.firstOrNull { e -> e.portion == Portion.AM }
        val afternoon = todays.firstOrNull { e -> e.portion == Portion.PM }
        val autoMode = mode == LoggingMode.AUTO_DETECT
        val halfDay = granularity == GranularityChoice.HALF_DAY
        val checks = (lastTallies.firstOrNull { it.dayDate == today }?.toDayChecks()).orEmpty()
        // R320: nothing is proposed until the day is concluded (after the last window, the evening) - "Votre
        // journée vous sera proposée ce soir." ETAT C (a recorded slot) shows the recorded row, not a re-proposal.
        val concluded = afterLastCheckWindow(clock)
        // DAY granularity drives the single auto surface; HALF_DAY drives the morning and afternoon independently.
        val dayAuto = slotAuto(autoMode && !halfDay && fullDay == null, dayProposal(checks), concluded)
        val amAuto = slotAuto(autoMode && halfDay && morning == null, morningProposal(checks), concluded)
        val pmAuto = slotAuto(autoMode && halfDay && afternoon == null, afternoonProposal(checks), concluded)
        // AN-HOME sections C/E/F (R328). READ-ONLY projections of days the app already holds (D16 intact): the
        // year panel is computed ONCE here so « À traiter » reuses its unsynced/lateness figures rather than a
        // second count (R206), and the month summary + week strip come from CalendarModel - the SAME functions
        // the calendar uses, so the home and the calendar cannot disagree about a count or a day (one way of
        // counting). Everything is null/empty when there are no settings (defensive; validated at onboarding).
        val yearPanel = computeYear(lastEntries)
        val monthSummary = monthSummaryOf(lastEntries)
        val weekCells =
            if (settings == null) emptyList() else weekdayCells(lastEntries, settings, currentTaxYear, today)
        mutableState.update {
            it.copy(
                today = today,
                holderName = settings?.name,
                loggingMode = mode,
                fullDay = fullDay?.toDayEntry(),
                morning = morning?.toDayEntry(),
                afternoon = afternoon?.toDayEntry(),
                year = yearPanel,
                auto = dayAuto,
                autoMorning = amAuto,
                autoAfternoon = pmAuto,
                nearBorderNotice = computeNearBorder(mode),
                attend = computeAttend(monthSummary, yearPanel),
                week = weekCells,
                month = monthSummary,
            )
        }
    }

    /**
     * Section F (AN-HOME, R328): this month's recorded-day counts, from the SAME function the calendar's month
     * tiles use (buildMonthView.summary). « This month » is today's Paris month in the current tax year (both
     * refreshed on resume, F8). Null when settings are unavailable.
     */
    private fun monthSummaryOf(entries: List<EntryEntity>): MonthSummary? {
        val settingsNow = settings ?: return null
        val month = LocalDate.parse(today).monthValue
        return buildMonthView(entries, settingsNow, currentTaxYear, today, month).summary
    }

    /**
     * Section C (AN-HOME, R328): what to attend to, or null when there is nothing (the section is then absent -
     * never an empty box). « Unrecorded this month » is the calendar's own « Non renseigné » for the current
     * month (monthSummary.nonRenseigne - one way of counting); the unsynced count and lateness are the year
     * panel's already-computed figures (R206), so no line here is a second calculation.
     */
    private fun computeAttend(
        monthSummary: MonthSummary?,
        year: YearPanel?,
    ): ToAttendTo? {
        val unrecorded = monthSummary?.nonRenseigne?.toInt() ?: 0
        val unsynced = year?.unsyncedDays ?: 0
        val lateness = year?.pendingLateness ?: PendingLateness.NONE
        if (unrecorded == 0 && unsynced == 0 && lateness == PendingLateness.NONE) return null
        return ToAttendTo(
            unrecordedThisMonth = unrecorded,
            unsyncedDays = unsynced,
            pendingLateness = lateness,
            lateThresholdDays = year?.lateThresholdDays ?: LatenessForecast.BACKFILL_DAYS,
        )
    }

    /** A slot's auto surface when `enabled` (auto mode, the right granularity, and that slot not yet recorded). */
    private fun slotAuto(
        enabled: Boolean,
        proposal: Proposal?,
        concluded: Boolean,
    ): AutoDayState? = if (enabled) autoStateFor(proposal, concluded) else null

    /**
     * SPEC 11.2 ETATS A/B, R320. The auto surface for a slot, from its proposal (the day vote for day granularity,
     * or a half's two checks for half-day). Detecting (A) while the day is still running; once CONCLUDED (after the
     * last window), HIGH -> ToConfirm (R311), else the not-sure message (R312). The coordinate never enters - only
     * the four checks do.
     */
    private fun autoStateFor(
        proposal: Proposal?,
        concluded: Boolean,
    ): AutoDayState {
        if (!concluded) return AutoDayState.Detecting
        return when (val outcome = detectionOutcome(proposal)) {
            is DetectionOutcome.Proposed -> AutoDayState.ToConfirm(outcome.proposal.kind.toRecordedKind())
            DetectionOutcome.NotSure -> AutoDayState.NotSure
        }
    }

    /**
     * R313 (as R320 translates it): tell a near-border resident ONCE, from the day's four checks alone (how many
     * land in the strip). Sticky for the life of this controller (never flickers off as the stream re-emits), and
     * persisted "told once" across relaunches via the notice store. Only in auto mode. No coordinate -
     * shouldSuggestManualForNearBorder reads only check sides.
     */
    private fun computeNearBorder(mode: LoggingMode): Boolean {
        if (mode != LoggingMode.AUTO_DETECT) return false
        if (!nearBorderActive && !nearBorderNoticeStore.hasShown()) {
            if (shouldSuggestManualForNearBorder(lastTallies.map { it.toDayChecks() })) {
                nearBorderActive = true
                nearBorderNoticeStore.markShown()
            }
        }
        return nearBorderActive
    }

    private fun DayChecks?.orEmpty(): DayChecks = this ?: DayChecks(null, null, null, null)

    /**
     * The year's position, on the device: the year's rows -> the increment-2 aggregation -> the
     * engine. Null when the year has no entries (AC3: shown as "no rate yet", never 0 %) or when the
     * engine cannot produce a result (settings were validated at onboarding, so this is defensive).
     */
    @Suppress("ReturnCount")
    private fun computeYear(entries: List<EntryEntity>): YearPanel? {
        val settings = settings ?: return null
        // F8 (AN-FIX): the tax year is the clock's current Paris year (currentTaxYear), refreshed on resume,
        // so a session open across 31 December shows the new year's position after midnight.
        val yearEntries = entries.filter { it.dayDate.startsWith("$currentTaxYear-") }
        if (yearEntries.isEmpty()) return null

        val input =
            toTeleworkInput(
                settings.toAggregatableUser(),
                yearEntries.map { AggregatableEntry(it.dayDate, it.portion, it.kind) },
                currentTaxYear,
            )
        val result = (calculateTelework(input) as? CalcResult.Ok)?.value ?: return null
        val fallback = result.warnings.filterIsInstance<Warning.RuleSetFallback>().firstOrNull()
        val rules = ruleSetFor(currentTaxYear)
        // R206: the one home for "pending days of this year", shared with the releve's R287 line.
        val pending = pendingEntriesForYear(entries, currentTaxYear)

        return YearPanel(
            result = result,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
            unsyncedDays = pending.size,
            pendingLateness = latenessOf(pending.minByOrNull { it.dayDate }?.dayDate),
            // Keyed on the fraction the engine actually used, never on the start date (FW26).
            partialYear = input.periodFraction < 1.0,
            fallbackYear = fallback?.appliedYear,
        )
    }

    /**
     * The escalation state of the OLDEST unsynced day (R286). OVERDUE once it would be flagged if it
     * synced now (the precise, fixture-bound rule); APPROACHING within WARN_WINDOW_DAYS of crossing;
     * NONE otherwise. R216: this only WARNS - the record's flag is the server's. The window is a parked
     * conservative choice (PARKAN-18): a small look-ahead claims less.
     */
    @Suppress("ReturnCount")
    private fun latenessOf(oldestPendingDay: String?): PendingLateness {
        if (oldestPendingDay == null) return PendingLateness.NONE
        val day = LocalDate.parse(oldestPendingDay)
        if (LatenessForecast.wouldBeLate(day, clock.instant())) return PendingLateness.OVERDUE
        val daysUntil = LatenessForecast.daysUntilLate(day, LocalDate.parse(today))
        return if (daysUntil <= WARN_WINDOW_DAYS) PendingLateness.APPROACHING else PendingLateness.NONE
    }

    /** Record today's kind for a slot. One tap, one write to the queue (D16). */
    fun record(
        kind: RecordedKind,
        slot: Slot,
        absence: AbsenceChoice? = null,
    ) {
        scope.launch {
            repository.record(
                RecordCommand(
                    // F8 (AN-FIX): today is read FROM THE CLOCK at the tap, so a day tapped after midnight is
                    // filed under the new date even if the Activity was created the previous day.
                    dayDate = todayInParis(clock),
                    kind = kind.toEntryKind(),
                    portion = slot.toPortion(),
                    absenceReason = absence?.toReason(),
                ),
            )
            // SPEC 13.2: written to Room, then enqueued for replay on connectivity. The drain is
            // network-constrained (SyncScheduler), so this is a no-op cost offline and drains when online.
            requestSync()
        }
    }

    /**
     * R314 / D16: the person CONFIRMED the proposal. One tap records a FULL day with provenance
     * DETECTED_CONFIRMED and the detected kind (R202); detectedAt is the device's clock at the confirming tap.
     * Nothing was recorded before this tap - a proposal is never a record.
     */
    fun confirmDetected(
        proposedKind: RecordedKind,
        slot: Slot = Slot.FULL,
    ) = recordDetected(proposedKind, slot, null, Provenance.DETECTED_CONFIRMED, proposedKind)

    /**
     * R314 / R202 / D16: the person CORRECTED the proposal. The chosen kind (and slot/absence) is recorded with
     * provenance DETECTED_CORRECTED, keeping detectedKind = what detection had proposed - so the releve and PDF
     * can show "Detection corrigee" and an accountant can see the day came from detection and was changed.
     */
    fun correctDetected(
        chosenKind: RecordedKind,
        slot: Slot,
        absence: AbsenceChoice?,
        proposedKind: RecordedKind,
    ) = recordDetected(chosenKind, slot, absence, Provenance.DETECTED_CORRECTED, proposedKind)

    private fun recordDetected(
        kind: RecordedKind,
        slot: Slot,
        absence: AbsenceChoice?,
        provenance: Provenance,
        detectedKind: RecordedKind,
    ) {
        scope.launch {
            repository.record(
                RecordCommand(
                    dayDate = todayInParis(clock),
                    kind = kind.toEntryKind(),
                    portion = slot.toPortion(),
                    absenceReason = absence?.toReason(),
                    provenance = provenance,
                    // R202: what detection proposed, kept alongside a correction. A proposal is only ever a
                    // geographic side (CH/HOME); detectedKind is that side, never a mission or an absence.
                    detectedKind = detectedKind.toEntryKind(),
                    // The device's clock at the confirming/correcting tap, sent verbatim (never trusted as
                    // evidence - the server assigns the recording timestamp).
                    detectedAt = deviceClaimNow(clock),
                ),
            )
            requestSync()
        }
    }
}
