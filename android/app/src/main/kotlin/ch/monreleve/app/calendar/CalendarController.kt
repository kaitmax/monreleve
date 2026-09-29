package ch.monreleve.app.calendar

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.EntryRepository
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

// AN10 increment 1. The calendar screen's controller (SPEC 11.3). It lives OUTSIDE ui/ (fence 5): it
// holds the repository, the settings and the clock, and it OWNS the translation between the stored rows
// and the grid's own vocabulary - the pure work is in CalendarModel, this is the thin observing shell.
//
// Observing the repository IS the update (the DayCell pattern AN5b established): a day recorded here or
// on Aujourd'hui, and a sync that clears a pending row, both flow to the grid without a refresh. The
// month is recomputed on every change - the model is pure arithmetic over one year's rows.
//
// R28: "today" and the tax year are Europe/Paris, read once from the clock here (the one place a clock
// is allowed), and passed to the pure model as strings; the model never touches a clock.

private const val LAST_MONTH = 12

data class CalendarState(
    /** The visible month, or null before settings exist (the calendar is unreachable until onboarded). */
    val monthView: MonthView? = null,
)

class CalendarController(
    private val repository: EntryRepository,
    settingsStore: SettingsStore,
    private val taxYear: Int,
    clock: Clock,
    private val scope: CoroutineScope,
) {
    private val today: String = todayInParis(clock)
    private val settings: Settings? = settingsStore.load()
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

    private fun recompute() {
        val loaded = settings ?: return
        val yearEntries = entries.filter { it.dayDate.startsWith("$taxYear-") }
        mutableState.update {
            it.copy(
                monthView = buildMonthView(yearEntries, loaded, taxYear, today, visibleMonth),
            )
        }
    }
}
