package ch.monreleve.app.forecast

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.forecastResults
import ch.monreleve.app.dossier.unrecordedPastWorkdays
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

// AN-FORECAST (R340, R341, R281, R28, R310). The one place a forecast is RUN - it drives the pure engine path
// (dossier.forecastResults) and holds no UI. R340 - A PROJECTION IS NEVER A RECORD: computing a projection
// writes NOTHING. The only write this controller makes is SETTING the rhythm (setDay -> rhythmRepo.save), a
// local planning preference (R341), which is not a day record. The engine run that produces the projection
// never touches a store.
//
// R310: the rhythm is SEEDED ONCE from Room and then held in memory, persisted on each edit - so a tab switch
// keeps it (the controller lives), a process death re-seeds it from Room (where setDay persisted it), and no
// Serializable snapshot is needed (Room IS the restore store). Seeding once, rather than collecting the rhythm
// Flow forever, avoids a Room re-emission racing an in-flight edit back to an older value.
//
// R28: the clock is the one seam for "today"; the dossier layer stays clock-free (today is a parameter).

class ForecastController(
    private val rhythmRepo: RhythmRepository,
    private val entryRepo: EntryRepository,
    // AN-CALENDAR (R475): the store is held and read at every emission - never a value read once here and kept, which
    // left the projection on the old employment rate, canton or method until the app was restarted.
    private val settingsStore: SettingsStore,
    taxYear: Int,
    // IOS-2d R813: the clock seam is kotlin.time.Clock (an instant source; today is the Paris day of it, R28), IOS-2c
    // R787's CalendarController shape. :app's java.time callers reach this through JavaTimeForecast.kt's factory.
    @OptIn(ExperimentalTime::class) // KMP-DT R590: the kotlin.time.Clock seam - on the allowlist.
    private val clock: Clock,
    private val scope: CoroutineScope,
) {
    @OptIn(ExperimentalTime::class) // KMP-DT R590: reads the kotlin.time.Clock seam - on the allowlist.
    private var today: LocalDate = LocalDate.parse(todayInParis(clock))
    private var currentTaxYear: Int = taxYear
    private var rhythm: WeeklyRhythm = WeeklyRhythm()
    private var entries: List<EntryEntity> = emptyList()

    private val mutableState = MutableStateFlow(ForecastState())
    val state: StateFlow<ForecastState> = mutableState.asStateFlow()

    init {
        scope.launch {
            rhythm = rhythmRepo.observe().first()
            emitState()
        }
        scope.launch {
            entryRepo.observeAll().collect { list ->
                entries = list
                emitState()
            }
        }
    }

    /** Set a weekday's kind. R341: persisted to Room (a planning preference, not a record - D16 is untouched). */
    fun setDay(
        day: DayOfWeek,
        choice: RhythmChoice,
    ) {
        rhythm = rhythm.withDay(day, choice.toKind())
        emitState()
        scope.launch { rhythmRepo.save(rhythm) }
    }

    /** F8 (as Aujourd'hui does): recompute today and the tax year from the clock on resume. */
    @OptIn(ExperimentalTime::class) // KMP-DT R590: reads the kotlin.time.Clock seam - on the allowlist.
    fun refresh() {
        today = LocalDate.parse(todayInParis(clock))
        currentTaxYear = today.year
        emitState()
    }

    private fun emitState() {
        mutableState.value =
            ForecastState(rhythmDays = rhythm.toChoiceMap(), projection = settingsStore.load()?.let(::projectionOf))
    }

    // Null when the rhythm is empty (the invitation) or the engine rejects the settings - the screen then
    // invites a rhythm rather than drawing an empty projection. Every figure comes from the engine (R340/FW12).
    @Suppress("ReturnCount")
    private fun projectionOf(settings: Settings): Projection? {
        if (rhythm.isEmpty) return null
        val recorded =
            entries
                .filter { it.dayDate.startsWith("$currentTaxYear-") }
                .map { it.toAggregatable() }
        val results =
            forecastResults(
                settings.toAggregatableUser(),
                recorded,
                rhythm.toEntryKindMap(),
                today,
                currentTaxYear,
            ) ?: return null
        val rules = ruleSetFor(currentTaxYear)
        return Projection(
            currentRate = results.current.declarableRate,
            projectedRate = results.projected.declarableRate,
            projected = results.projected,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
            imaginedWorkingDays = results.imagined.size,
            totalWorkDays = results.projected.totalWorkDays,
            domicileDays = rhythm.domicileIndices(),
            denominatorKind = settings.denominatorKind,
            unrecordedPastDays =
                unrecordedPastWorkdays(
                    recorded.map { it.dayDate }.toSet(),
                    today,
                    currentTaxYear,
                    settings.activityStartDate,
                ),
        )
    }
}

// IOS-2d R813: withDay and toChoiceMap moved unchanged to ForecastDays.kt, the RhythmChoice mapping to RhythmChoice.kt.

private fun WeeklyRhythm.domicileIndices(): List<Int> {
    val days = listOf(monday, tuesday, wednesday, thursday, friday)
    return days.indices.filter { days[it] == RhythmKind.DOMICILE }
}
