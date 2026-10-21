package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CALENDAR (R473, R474). A SAVE WRITES EXACTLY WHAT CHANGED.
//
// WHAT THIS EXISTS TO STOP, stated as the thing that happened. KMP-4 changed only 15 October's morning in the
// calendar sheet and the server's append-only trail gained TWO events: the morning's, and a MODIFIED for the
// afternoon with the same kind (HOME -> HOME) under a new mutation id (REPORT-KMP-4 NOTICED 6). Every event in
// EntryEvent claims to be something the person did; that one was not. The save path did not know what changed -
// it recorded every slot that had a kind, and asked for a sync even when nothing had moved.
//
// WHAT THE SHEET SENDS IS WHAT THESE TESTS SEND. An untouched slot arrives at save() exactly as the sheet emits it:
// its seeded kind and absence, and its note as the sheet seeds it - `initial.note.orEmpty()`, so a stored null note
// arrives as "" (CalendarEditSheet, rememberSlotDraft and the Save button's mapNotNull). [untouched] builds that
// list from the controller's own prefill, so a test that passed on a null note could not hide a comparison the
// real sheet would fail.
//
// R474 IS THE OTHER DIRECTION, and it is the half that keeps the first one honest. A comparison that judged a real
// change "unchanged" would drop it silently - the trail would be clean and the record wrong. Every field the sheet
// edits is changed ALONE below and must produce exactly one write for exactly that portion.

private const val TAX_YEAR = 2026

/** A past working day (a Wednesday) relative to [JUNE_15]: recordable, so openDay opens the sheet on it. */
private const val DAY = "2026-06-10"

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private fun storeFor(granularity: String): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, granularity, null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

/** Passes every call through and keeps each record() - the writes R473 is about. */
private class CountingRepository(private val inner: EntryRepository) : EntryRepository {
    val written = mutableListOf<RecordCommand>()

    override suspend fun record(command: RecordCommand): EntryEntity {
        written += command
        return inner.record(command)
    }

    override fun observePending(): Flow<List<EntryEntity>> = inner.observePending()

    override fun observeAll(): Flow<List<EntryEntity>> = inner.observeAll()
}

/** What the sheet's Save button emits for drafts nobody touched: CalendarEditSheet's own seeding and mapping. */
private fun untouched(day: EditableDay): List<SlotEdit> =
    day.slots.mapNotNull { slot -> slot.kind?.let { SlotEdit(slot.slot, it, slot.absence, slot.note.orEmpty()) } }

private fun List<SlotEdit>.changing(
    slot: Slot,
    change: (SlotEdit) -> SlotEdit,
): List<SlotEdit> = map { if (it.slot == slot) change(it) else it }

/** One calendar over a day seeded with [seed] (written BEFORE the controller exists, so none of it is counted). */
private class Rig(
    scope: TestScope,
    granularity: String,
    seed: List<RecordCommand>,
) {
    private val dao = FakeEntryDao()
    private val inner = LocalEntryRepository(dao, JUNE_15)
    val repo = CountingRepository(inner)
    var syncRequests = 0
    val controller: CalendarController

    init {
        kotlinx.coroutines.runBlocking { seed.forEach { inner.record(it) } }
        val settings = storeFor(granularity)
        controller = CalendarController(repo, settings, TAX_YEAR, JUNE_15, scope, requestSync = { syncRequests += 1 })
    }

    fun openSheet(): EditableDay {
        controller.openDay(DAY)
        return controller.state.value.editing.shouldNotBeNull()
    }
}

private fun halfDay(
    kind: EntryKind,
    portion: Portion,
    note: String? = null,
    absence: AbsenceReason? = null,
) = RecordCommand(dayDate = DAY, kind = kind, portion = portion, absenceReason = absence, note = note)

/** A day recorded in halves: [morning] then [afternoon], no notes. */
private fun halves(
    morning: EntryKind,
    afternoon: EntryKind,
) = listOf(halfDay(morning, Portion.AM), halfDay(afternoon, Portion.PM))

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarSaveWritesWhatChangedTest : FunSpec({
    // ------------------------------------------------------------------------------------------------
    // R473 - the four cases the ruling names. The fourth, "change and change back before saving", is a
    // property of the SHEET'S DRAFT, not of save(): by the time the controller is called, a change undone
    // is indistinguishable from no change. It is driven through the real sheet in
    // CalendarSheetSaveInstrumentedTest, where the draft lives, rather than restated here as a copy of the
    // "change nothing" case.
    // ------------------------------------------------------------------------------------------------

    test("R473 changing only the morning writes one row, for the morning") {
        runTest {
            val rig = Rig(this, "HALF_DAY", halves(EntryKind.HOME, EntryKind.HOME))
            advanceUntilIdle()
            val sheet = rig.openSheet()

            rig.controller.save(DAY, untouched(sheet).changing(Slot.MORNING) { it.copy(kind = RecordedKind.SUISSE) })
            advanceUntilIdle()

            rig.repo.written.map { it.portion to it.kind } shouldBe listOf(Portion.AM to EntryKind.CH)
            rig.syncRequests shouldBe 1
        }
    }

    test("R473 saving without changing anything writes nothing and asks for no sync - half days") {
        runTest {
            val rig = Rig(this, "HALF_DAY", halves(EntryKind.HOME, EntryKind.CH))
            advanceUntilIdle()
            val sheet = rig.openSheet()

            rig.controller.save(DAY, untouched(sheet))
            advanceUntilIdle()

            rig.repo.written.shouldBeEmpty()
            rig.syncRequests shouldBe 0
            // The sheet still closes: an empty save is a save, it just has nothing to say.
            rig.controller.state.value.editing.shouldBeNull()
        }
    }

    test("R473 saving without changing anything writes nothing and asks for no sync - a whole day") {
        runTest {
            val rig = Rig(this, "DAY", listOf(halfDay(EntryKind.MISSION_FR, Portion.FULL, note = "Lyon")))
            advanceUntilIdle()
            val sheet = rig.openSheet()

            rig.controller.save(DAY, untouched(sheet))
            advanceUntilIdle()

            rig.repo.written.shouldBeEmpty()
            rig.syncRequests shouldBe 0
        }
    }

    test("R473 changing only the note writes one row, for that half") {
        runTest {
            val rig = Rig(this, "HALF_DAY", halves(EntryKind.HOME, EntryKind.HOME))
            advanceUntilIdle()
            val sheet = rig.openSheet()

            rig.controller.save(DAY, untouched(sheet).changing(Slot.MORNING) { it.copy(note = "reunion") })
            advanceUntilIdle()

            rig.repo.written.map { Triple(it.portion, it.kind, it.note) } shouldBe
                listOf(Triple(Portion.AM, EntryKind.HOME, "reunion"))
            rig.syncRequests shouldBe 1
        }
    }

    // ------------------------------------------------------------------------------------------------
    // R474 - A GENUINE CHANGE IS NEVER DROPPED. Each field the sheet edits, changed alone, is one write for
    // exactly that portion carrying the new value. These pass on main (main wrote everything); they exist so
    // the comparison R473 adds cannot fail the other way without going red.
    // ------------------------------------------------------------------------------------------------

    data class Genuine(
        val name: String,
        val seed: List<RecordCommand>,
        val granularity: String,
        val slot: Slot,
        val change: (SlotEdit?) -> SlotEdit,
        val expect: RecordCommand,
    )

    val genuine =
        listOf(
            Genuine(
                "the kind",
                listOf(halfDay(EntryKind.HOME, Portion.AM), halfDay(EntryKind.HOME, Portion.PM)),
                "HALF_DAY",
                Slot.AFTERNOON,
                { it!!.copy(kind = RecordedKind.MISSION_THIRD) },
                halfDay(EntryKind.MISSION_THIRD, Portion.PM),
            ),
            Genuine(
                "the absence reason alone (same kind, ABSENT)",
                listOf(halfDay(EntryKind.ABSENT, Portion.FULL, absence = AbsenceReason.CONGE)),
                "DAY",
                Slot.FULL,
                { it!!.copy(absence = AbsenceChoice.MALADIE) },
                halfDay(EntryKind.ABSENT, Portion.FULL, absence = AbsenceReason.MALADIE),
            ),
            Genuine(
                "a note removed",
                listOf(halfDay(EntryKind.HOME, Portion.AM, note = "dentiste"), halfDay(EntryKind.HOME, Portion.PM)),
                "HALF_DAY",
                Slot.MORNING,
                { it!!.copy(note = "") },
                halfDay(EntryKind.HOME, Portion.AM, note = null),
            ),
            Genuine(
                "a note edited",
                listOf(halfDay(EntryKind.CH, Portion.FULL, note = "Lausanne")),
                "DAY",
                Slot.FULL,
                { it!!.copy(note = "Lausanne puis Geneve") },
                halfDay(EntryKind.CH, Portion.FULL, note = "Lausanne puis Geneve"),
            ),
            Genuine(
                "a half answered for the first time",
                listOf(halfDay(EntryKind.HOME, Portion.AM)),
                "HALF_DAY",
                Slot.AFTERNOON,
                { SlotEdit(Slot.AFTERNOON, RecordedKind.SUISSE, null, "") },
                halfDay(EntryKind.CH, Portion.PM),
            ),
        )

    genuine.forEach { case ->
        test("R474 a genuine change is never dropped - ${case.name}") {
            runTest {
                val rig = Rig(this, case.granularity, case.seed)
                advanceUntilIdle()
                val sheet = rig.openSheet()
                val before = untouched(sheet)
                val changed = case.change(before.firstOrNull { it.slot == case.slot })
                val edits = before.filter { it.slot != case.slot } + changed

                rig.controller.save(DAY, edits)
                advanceUntilIdle()

                rig.repo.written shouldBe listOf(case.expect)
                rig.syncRequests shouldBe 1
            }
        }
    }
})
