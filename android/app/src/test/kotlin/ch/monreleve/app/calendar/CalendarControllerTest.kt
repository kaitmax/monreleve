package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN10 increment 1. The calendar controller. Its own job over the pure model: derive the Paris `today`
// and tax year from the clock (R28), open on the right month, and move between months within the year's
// navigable bounds. The store and clock are the AujourdhuiControllerTest fakes; the write path is the
// real repository so nothing about "today" is mocked away.

private const val TAX_YEAR = 2026

private fun storeWith(activityStartDate: String? = null): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", activityStartDate)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarControllerTest : FunSpec({
    test("today is the Paris day, not the device's UTC day (R28)") {
        runTest {
            // 22:30 UTC on 15 June is 00:30 on 16 June in Paris (UTC+2 in summer). The Paris day is the
            // 16th; a device reading UTC would mark the 15th - so the 16th being today proves the pin.
            val clock = Clock.fixed(Instant.parse("2026-06-15T22:30:00Z"), ZoneId.of("Europe/Paris"))
            val repo = LocalEntryRepository(FakeEntryDao(), clock)
            val controller = CalendarController(repo, storeWith(), TAX_YEAR, clock, this)
            advanceUntilIdle()
            val view = controller.state.value.monthView
            view.shouldNotBeNull()
            view.month shouldBe 6
            view.days.first { it.dayOfMonth == 16 }.isToday shouldBe true
            view.days.first { it.dayOfMonth == 15 }.isToday shouldBe false
        }
    }

    test("navigation moves month by month and stops at the year's ends") {
        runTest {
            val clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
            val repo = LocalEntryRepository(FakeEntryDao(), clock)
            val controller = CalendarController(repo, storeWith(), TAX_YEAR, clock, this)
            advanceUntilIdle()

            controller.state.value.monthView?.month shouldBe 6
            controller.goPreviousMonth()
            controller.state.value.monthView?.month shouldBe 5

            repeat(12) { controller.goPreviousMonth() }
            val atStart = controller.state.value.monthView
            atStart?.month shouldBe 1
            atStart?.canGoPrev shouldBe false

            repeat(12) { controller.goNextMonth() }
            val atEnd = controller.state.value.monthView
            atEnd?.month shouldBe 12
            atEnd?.canGoNext shouldBe false
        }
    }

    test("a mid-year start opens on the period's first month and cannot page before it") {
        runTest {
            // today is 15 June but activity starts 1 July: the calendar opens on July, the first
            // in-period month, and the previous chevron is disabled there.
            val clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
            val repo = LocalEntryRepository(FakeEntryDao(), clock)
            val controller = CalendarController(repo, storeWith("2026-07-01"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            val view = controller.state.value.monthView
            view.shouldNotBeNull()
            view.month shouldBe 7
            view.canGoPrev shouldBe false
        }
    }

    val june15 = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

    test("tapping a recordable past day opens the edit sheet, prefilled from its row") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), june15)
            repo.record(RecordCommand(dayDate = "2026-06-11", kind = EntryKind.HOME))
            val controller = CalendarController(repo, storeWith(), TAX_YEAR, june15, this)
            advanceUntilIdle()
            controller.openDay("2026-06-11")
            val editing = controller.state.value.editing
            editing.shouldNotBeNull()
            editing.slots.first().kind shouldBe RecordedKind.DOMICILE
        }
    }

    test("a future day does not open the sheet - future days cannot be recorded (AC1)") {
        runTest {
            val repo = LocalEntryRepository(FakeEntryDao(), june15)
            val controller = CalendarController(repo, storeWith(), TAX_YEAR, june15, this)
            advanceUntilIdle()
            controller.openDay("2026-06-20")
            controller.state.value.editing.shouldBeNull()
        }
    }

    test("saving records the day through the queue and requests a sync (D16, SPEC 13.2)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, june15)
            var syncRequests = 0
            val controller =
                CalendarController(repo, storeWith(), TAX_YEAR, june15, this, requestSync = { syncRequests += 1 })
            advanceUntilIdle()
            controller.openDay("2026-06-10")
            controller.save("2026-06-10", listOf(SlotEdit(Slot.FULL, RecordedKind.SUISSE, null, "reunion")))
            advanceUntilIdle()
            val row = dao.byDayPortion("2026-06-10", Portion.FULL)
            row?.kind shouldBe EntryKind.CH
            row?.note shouldBe "reunion"
            row?.syncState shouldBe SyncState.PENDING
            syncRequests shouldBe 1
            // The sheet closes on save (no success animation; the cell updates by observation).
            controller.state.value.editing.shouldBeNull()
        }
    }
})
