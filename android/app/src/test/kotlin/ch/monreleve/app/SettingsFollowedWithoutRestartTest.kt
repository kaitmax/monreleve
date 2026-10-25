package ch.monreleve.app

import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.forecast.ForecastController
import ch.monreleve.app.forecast.SimulationController
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CALENDAR (R475). A SETTING IS READ WHEN IT IS USED, so a controller that outlives a change follows it.
//
// WHAT THIS EXISTS TO STOP, stated as the thing that happened. KMP-4 switched Parametres to Demi-journees (PATCH /me
// 200, the Parametres row updated) and the calendar's edit sheet still offered one whole-day slot until the app was
// restarted (REPORT-KMP-4 NOTICED 1, Q2). CalendarController read the settings ONCE, in its constructor, and kept
// the answer - the shape AN-ACCOUNT-TAG found for the account tag (R423), one store over. The controllers are built
// once per shell and live as long as it does (ShellState: rememberMainControllers), so "once at construction" means
// "until the process is restarted".
//
// THE SAME CAPTURE WAS IN FOUR CONTROLLERS (the census is in REPORT-AN-CALENDAR, ITEM 2). Each is driven below the
// same way: build it under one setting, change the store underneath it, use it again WITHOUT rebuilding it.
// For the calendar the use is opening the sheet; for the others it is the refresh the shell already calls on
// returning to a screen (Aujourd'hui's tab, AN-AUTO's precedent) - the re-read is what makes that refresh enough.

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

/** A recordable past working day (a Wednesday) relative to [JUNE_15]. */
private const val DAY = "2026-06-10"

/** A recordable past working day with no rows - asked for in whatever the setting says (R490). */
private const val EMPTY_DAY = "2026-06-11"

/** The device's settings, switchable underneath a controller that already exists - what Parametres does. */
private class SwitchableSettings(var current: Settings) : SettingsStore {
    override fun load(): Settings = current

    override fun save(settings: Settings) {
        current = settings
    }

    override fun clear() = Unit
}

private fun settings(
    granularity: String = "DAY",
    employmentRate: Int = 100,
) = Settings("GE", employmentRate, "SIMPLIFIED240", null, granularity, null)

private class FixedRhythm(private val rhythm: WeeklyRhythm) : RhythmRepository {
    override fun observe(): Flow<WeeklyRhythm> = flowOf(rhythm)

    override suspend fun save(rhythm: WeeklyRhythm) = Unit

    override suspend fun clear() = Unit
}

private val TWO_DAYS_HOME = WeeklyRhythm(tuesday = RhythmKind.DOMICILE, thursday = RhythmKind.DOMICILE)

/** One day of telework recorded this year, so every screen has a rate to compute. */
private suspend fun recordedYear(): LocalEntryRepository {
    val repo = LocalEntryRepository(FakeEntryDao(), JUNE_15)
    repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME))
    return repo
}

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsFollowedWithoutRestartTest : FunSpec({
    test("R475 the calendar's sheet offers the new granularity at once, each way, without a rebuild") {
        runTest {
            // AN-GRANULARITY (R490): the setting decides how NEW days are asked for, so the day opened here is one with
            // no rows. A day already recorded keeps its own granularity whatever the setting (RecordedGranularityTest).
            val store = SwitchableSettings(settings(granularity = "DAY"))
            val controller = CalendarController(recordedYear(), store, 2026, JUNE_15, this)
            advanceUntilIdle()

            controller.openDay(EMPTY_DAY)
            controller.state.value.editing.shouldNotBeNull().slots.map { it.slot } shouldBe listOf(Slot.FULL)
            controller.closeSheet()

            store.current = store.current.copy(granularity = "HALF_DAY")
            controller.openDay(EMPTY_DAY)
            val halves = controller.state.value.editing.shouldNotBeNull()
            halves.granularity shouldBe GranularityChoice.HALF_DAY
            halves.slots.map { it.slot } shouldBe listOf(Slot.MORNING, Slot.AFTERNOON)
            controller.closeSheet()

            store.current = store.current.copy(granularity = "DAY")
            controller.openDay(EMPTY_DAY)
            controller.state.value.editing.shouldNotBeNull().slots.map { it.slot } shouldBe listOf(Slot.FULL)
        }
    }

    test("R475 Aujourd'hui follows the granularity on its refresh, without a rebuild") {
        runTest {
            val store = SwitchableSettings(settings(granularity = "DAY"))
            val controller = AujourdhuiController(recordedYear(), store, 2026, JUNE_15, this)
            advanceUntilIdle()
            controller.state.value.granularity shouldBe GranularityChoice.DAY

            store.current = store.current.copy(granularity = "HALF_DAY")
            controller.refresh()
            controller.state.value.granularity shouldBe GranularityChoice.HALF_DAY
        }
    }

    test("R475 Aujourd'hui's year follows a calculation setting on its refresh, without a rebuild") {
        runTest {
            val store = SwitchableSettings(settings(employmentRate = 100))
            val controller = AujourdhuiController(recordedYear(), store, 2026, JUNE_15, this)
            advanceUntilIdle()
            controller.state.value.year.shouldNotBeNull().result.totalWorkDays shouldBe 240

            store.current = store.current.copy(employmentRate = 50)
            controller.refresh()
            controller.state.value.year.shouldNotBeNull().result.totalWorkDays shouldBe 120
        }
    }

    test("R475 the forecast follows a calculation setting on its refresh, without a rebuild") {
        runTest {
            val store = SwitchableSettings(settings(employmentRate = 100))
            val controller = ForecastController(FixedRhythm(TWO_DAYS_HOME), recordedYear(), store, 2026, JUNE_15, this)
            advanceUntilIdle()
            controller.state.value.projection.shouldNotBeNull().totalWorkDays shouldBe 240

            store.current = store.current.copy(employmentRate = 50)
            controller.refresh()
            controller.state.value.projection.shouldNotBeNull().totalWorkDays shouldBe 120
        }
    }

    test("R475 the simulator follows a calculation setting on its refresh, without a rebuild") {
        runTest {
            val store = SwitchableSettings(settings(employmentRate = 100))
            val controller =
                SimulationController(FixedRhythm(TWO_DAYS_HOME), recordedYear(), store, 2026, JUNE_15, this)
            advanceUntilIdle()
            controller.state.value.view.shouldNotBeNull().simulated.totalWorkDays shouldBe 240

            store.current = store.current.copy(employmentRate = 50)
            controller.refresh()
            controller.state.value.view.shouldNotBeNull().simulated.totalWorkDays shouldBe 120
        }
    }
})
