package ch.monreleve.app.aujourdhui

import ch.monreleve.app.DayWriter
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.TeleworkResult
import ch.monreleve.app.calc.Warning
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.dossier.AggregatableEntry
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

data class AujourdhuiState(
    val today: String,
    val granularity: GranularityChoice,
    val fullDay: DayEntry? = null,
    val morning: DayEntry? = null,
    val afternoon: DayEntry? = null,
    /** The year's position, or null when the year has no entries (AC3: no rate shown). */
    val year: YearPanel? = null,
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

private fun EntryEntity.toDayEntry(): DayEntry =
    DayEntry(
        kind = kind.toRecordedKind(),
        absence = absenceReason?.toChoice(),
        pending = syncState == SyncState.PENDING,
        failed = syncState == SyncState.FAILED,
    )

// The sync trigger is injected as a lambda (default no-op for JVM tests): the controller lives outside
// ui/ but has no Context, and SyncScheduler.requestSync needs one. MainActivity, the composition root,
// supplies { SyncScheduler.requestSync(applicationContext) }.
class AujourdhuiController(
    private val repository: EntryRepository,
    private val settingsStore: SettingsStore,
    private val taxYear: Int,
    private val clock: Clock,
    private val scope: CoroutineScope,
    // R291: a DayWriter, so MainGraphWiringTest enumerates this by type and asserts the app's graph
    // builds it with a real requestSync. Default no-op only for the JVM tests that build it directly.
    override val requestSync: () -> Unit = {},
) : DayWriter {
    private val today: String = todayInParis(clock)
    private val settings: Settings? = settingsStore.load()
    private val granularity: GranularityChoice =
        if (settings?.granularity == "HALF_DAY") GranularityChoice.HALF_DAY else GranularityChoice.DAY

    private val mutableState = MutableStateFlow(AujourdhuiState(today = today, granularity = granularity))
    val state: StateFlow<AujourdhuiState> = mutableState.asStateFlow()

    init {
        // Observing the repository IS the confirmation (DESIGN-SYSTEM section 2): a recorded tap and a
        // completed sync both flow to the UI without a toast or an animation. The year is recomputed
        // on every change - the engine is < 0.1 ms (FW5), so there is no reason to cache a rate.
        scope.launch {
            repository.observeAll().collect { entries ->
                val todays = entries.filter { it.dayDate == today }
                mutableState.update {
                    it.copy(
                        fullDay = todays.firstOrNull { e -> e.portion == Portion.FULL }?.toDayEntry(),
                        morning = todays.firstOrNull { e -> e.portion == Portion.AM }?.toDayEntry(),
                        afternoon = todays.firstOrNull { e -> e.portion == Portion.PM }?.toDayEntry(),
                        year = computeYear(entries),
                    )
                }
            }
        }
    }

    /**
     * The year's position, on the device: the year's rows -> the increment-2 aggregation -> the
     * engine. Null when the year has no entries (AC3: shown as "no rate yet", never 0 %) or when the
     * engine cannot produce a result (settings were validated at onboarding, so this is defensive).
     */
    @Suppress("ReturnCount")
    private fun computeYear(entries: List<EntryEntity>): YearPanel? {
        val settings = settings ?: return null
        val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
        if (yearEntries.isEmpty()) return null

        val input =
            toTeleworkInput(
                settings.toAggregatableUser(),
                yearEntries.map { AggregatableEntry(it.dayDate, it.portion, it.kind) },
                taxYear,
            )
        val result = (calculateTelework(input) as? CalcResult.Ok)?.value ?: return null
        val fallback = result.warnings.filterIsInstance<Warning.RuleSetFallback>().firstOrNull()
        val rules = ruleSetFor(taxYear)
        val pending = yearEntries.filter { it.syncState == SyncState.PENDING }

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
                    dayDate = today,
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
}
