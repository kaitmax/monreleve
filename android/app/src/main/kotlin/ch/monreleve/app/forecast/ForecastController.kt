package ch.monreleve.app.forecast

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.AggregatableEntry
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
import java.time.Clock
import java.time.DayOfWeek
import java.time.LocalDate

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
    settingsStore: SettingsStore,
    taxYear: Int,
    private val clock: Clock,
    private val scope: CoroutineScope,
) {
    private val settings: Settings? = settingsStore.load()
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
    fun refresh() {
        today = LocalDate.parse(todayInParis(clock))
        currentTaxYear = today.year
        emitState()
    }

    private fun emitState() {
        mutableState.value =
            ForecastState(rhythmDays = rhythm.toChoiceMap(), projection = settings?.let(::projectionOf))
    }

    // Null when the rhythm is empty (the invitation) or the engine rejects the settings - the screen then
    // invites a rhythm rather than drawing an empty projection. Every figure comes from the engine (R340/FW12).
    @Suppress("ReturnCount")
    private fun projectionOf(settings: Settings): Projection? {
        if (rhythm.isEmpty) return null
        val recorded =
            entries
                .filter { it.dayDate.startsWith("$currentTaxYear-") }
                .map { AggregatableEntry(it.dayDate, it.portion, it.kind) }
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

private fun RhythmChoice.toKind(): RhythmKind =
    when (this) {
        RhythmChoice.SUISSE -> RhythmKind.SUISSE
        RhythmChoice.DOMICILE -> RhythmKind.DOMICILE
    }

private fun RhythmKind.toChoice(): RhythmChoice =
    when (this) {
        RhythmKind.SUISSE -> RhythmChoice.SUISSE
        RhythmKind.DOMICILE -> RhythmChoice.DOMICILE
    }

private fun WeeklyRhythm.withDay(
    day: DayOfWeek,
    kind: RhythmKind,
): WeeklyRhythm =
    when (day) {
        DayOfWeek.MONDAY -> copy(monday = kind)
        DayOfWeek.TUESDAY -> copy(tuesday = kind)
        DayOfWeek.WEDNESDAY -> copy(wednesday = kind)
        DayOfWeek.THURSDAY -> copy(thursday = kind)
        DayOfWeek.FRIDAY -> copy(friday = kind)
        else -> this
    }

private fun WeeklyRhythm.toChoiceMap(): Map<DayOfWeek, RhythmChoice> =
    buildMap {
        monday?.let { put(DayOfWeek.MONDAY, it.toChoice()) }
        tuesday?.let { put(DayOfWeek.TUESDAY, it.toChoice()) }
        wednesday?.let { put(DayOfWeek.WEDNESDAY, it.toChoice()) }
        thursday?.let { put(DayOfWeek.THURSDAY, it.toChoice()) }
        friday?.let { put(DayOfWeek.FRIDAY, it.toChoice()) }
    }

private fun WeeklyRhythm.domicileIndices(): List<Int> {
    val days = listOf(monday, tuesday, wednesday, thursday, friday)
    return days.indices.filter { days[it] == RhythmKind.DOMICILE }
}
