package ch.monreleve.app.aujourdhui

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Clock

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

/** What one portion slot holds: the recorded kind (screen vocabulary) and whether it is still pending sync. */
data class DayEntry(
    val kind: RecordedKind,
    val absence: AbsenceChoice?,
    val pending: Boolean,
)

data class AujourdhuiState(
    val today: String,
    val granularity: GranularityChoice,
    val fullDay: DayEntry? = null,
    val morning: DayEntry? = null,
    val afternoon: DayEntry? = null,
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
    )

class AujourdhuiController(
    private val repository: EntryRepository,
    settingsStore: SettingsStore,
    private val clock: Clock,
    private val scope: CoroutineScope,
) {
    private val today: String = todayInParis(clock)
    private val granularity: GranularityChoice =
        if (settingsStore.load()?.granularity == "HALF_DAY") GranularityChoice.HALF_DAY else GranularityChoice.DAY

    private val mutableState = MutableStateFlow(AujourdhuiState(today = today, granularity = granularity))
    val state: StateFlow<AujourdhuiState> = mutableState.asStateFlow()

    init {
        // Observing the repository IS the confirmation (DESIGN-SYSTEM section 2): a recorded tap and a
        // completed sync both flow to the UI without a toast or an animation.
        scope.launch {
            repository.observeAll().collect { entries ->
                val todays = entries.filter { it.dayDate == today }
                mutableState.update {
                    it.copy(
                        fullDay = todays.firstOrNull { e -> e.portion == Portion.FULL }?.toDayEntry(),
                        morning = todays.firstOrNull { e -> e.portion == Portion.AM }?.toDayEntry(),
                        afternoon = todays.firstOrNull { e -> e.portion == Portion.PM }?.toDayEntry(),
                    )
                }
            }
        }
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
        }
    }
}
