package ch.monreleve.app.calendar

import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CAL2 (section 2). Multi-day selection, on the controller, JVM-proven: individual taps, a range in two
// taps, future days refused, no day twice, and the selection restored across a rebuild (R310, C2). The write
// path is the real repository, but these tests never write - selection only chooses; the write is increment 3.

private const val SELECTION_TAX_YEAR = 2026

private fun selectionStore(): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarSelectionTest : FunSpec({
    // Today is 15 June 2026 (a Monday-first June: the 1st is a Monday). Days 1..15 are recordable; 16..30 future.
    val june15 = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

    fun controller(scope: kotlinx.coroutines.CoroutineScope): CalendarController =
        CalendarController(
            LocalEntryRepository(FakeEntryDao(), june15),
            selectionStore(),
            SELECTION_TAX_YEAR,
            june15,
            scope,
        )

    test("the button starts selection mode with nothing chosen") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.state.value.selection.active shouldBe false
            c.startSelection()
            c.state.value.selection.active shouldBe true
            c.state.value.selection.days shouldBe emptySet()
        }
    }

    test("a tap selects an individual recordable day; tapping it again removes it (toggle)") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection()
            c.tapDay("2026-06-10")
            c.state.value.selection.days shouldBe setOf("2026-06-10")
            c.tapDay("2026-06-10")
            c.state.value.selection.days shouldBe emptySet()
        }
    }

    test("tapping a first day then a last day selects the whole range between - a week in two taps (C2)") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection()
            c.tapDay("2026-06-01")
            c.tapDay("2026-06-05")
            c.state.value.selection.days shouldBe
                setOf("2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05")
        }
    }

    test("a range reads the same whichever end is tapped first") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection()
            c.tapDay("2026-06-05")
            c.tapDay("2026-06-01")
            c.state.value.selection.days shouldBe
                setOf("2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05")
        }
    }

    test("a future day cannot be selected - whatever single-day editing cannot record, selection cannot (C2)") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection()
            c.tapDay("2026-06-20")
            c.state.value.selection.days shouldBe emptySet()
        }
    }

    test("a day is never in the selection twice - an overlapping range does not duplicate it (C3)") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection()
            c.tapDay("2026-06-03")
            c.tapDay("2026-06-04") // range 03..04
            c.tapDay("2026-06-06") // single add (anchor cleared after a range), anchor 06
            c.tapDay("2026-06-01") // range 01..06, re-covering 03, 04 and 06 without duplicating them
            val days = c.state.value.selection.days
            days shouldBe
                setOf("2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06")
            days.size shouldBe days.toList().distinct().size
        }
    }

    test("Annuler leaves selection mode and discards the selection (nothing is written)") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection()
            c.tapDay("2026-06-03")
            c.cancelSelection()
            c.state.value.selection.active shouldBe false
            c.state.value.selection.days shouldBe emptySet()
        }
    }

    test("a long press starts selection with the pressed day already chosen") {
        runTest {
            val c = controller(this)
            advanceUntilIdle()
            c.startSelection("2026-06-09")
            c.state.value.selection.active shouldBe true
            c.state.value.selection.days shouldBe setOf("2026-06-09")
        }
    }

    // R310 / C2: the selection survives a rebuild (rotation, a background kill). The SavedStateHandle-shaped
    // half, on the JVM: a controller built with a SelectionSnapshot restores the mode, the days and the anchor.
    test("a restored selection is active with its chosen days and anchor (R310)") {
        runTest {
            val restored =
                CalendarSnapshot(
                    month = 6,
                    selection = SelectionSnapshot(days = listOf("2026-06-02", "2026-06-03"), anchor = "2026-06-03"),
                )
            val c =
                CalendarController(
                    LocalEntryRepository(FakeEntryDao(), june15),
                    selectionStore(),
                    SELECTION_TAX_YEAR,
                    june15,
                    this,
                    restored = restored,
                )
            advanceUntilIdle()
            c.state.value.selection.active shouldBe true
            c.state.value.selection.days shouldBe setOf("2026-06-02", "2026-06-03")
            c.state.value.selection.anchor shouldBe "2026-06-03"
        }
    }
})
