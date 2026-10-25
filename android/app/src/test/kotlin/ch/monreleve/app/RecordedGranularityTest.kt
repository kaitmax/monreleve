package ch.monreleve.app

import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.calendar.CalendarController
import ch.monreleve.app.calendar.SlotEdit
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.ui.screens.calendrier.provenanceSlots
import io.kotest.core.spec.style.FunSpec
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

// AN-GRANULARITY (R490, R493). A DAY KEEPS THE GRANULARITY IT WAS RECORDED IN - on every screen that writes a day.
//
// The setting decides how NEW days are asked for. A day that already has rows is shown and edited in the granularity
// those rows have: a day held WHOLE, seen in half-day mode, offers one whole-day choice and a sentence saying it was
// recorded as a whole day; a day held in HALVES, seen in whole-day mode, keeps its two halves (PARK-C1, closed by the
// ruling). Each screen is tested through its real controller over the real repository, and every test that says
// something was NOT written also says what WAS (the write list and the stored rows), so a screen that wrote nothing
// at all could not pass.
//
// R490 SUPERSEDES R477's DISPLAY. AN-CALENDAR showed a day held whole, in half-day mode, as two halves answered with
// the FULL row's kind; changing one of them wrote a half beside FULL. WholeDayInHalfDayModeTest pinned that; its
// assertions are re-stated here under R490 (one whole-day choice), and the ones R490 keeps unchanged are kept.

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

/** A recordable past working day under [JUNE_15] (a Wednesday). */
private const val PAST = "2026-06-10"

private class GranularitySetting(private val value: String) : SettingsStore {
    override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, value, null)

    override fun save(settings: Settings) = Unit

    override fun clear() = Unit
}

private val WHOLE_DAYS: SettingsStore = GranularitySetting("DAY")
private val HALF_DAYS: SettingsStore = GranularitySetting("HALF_DAY")

/** Passes every call through and keeps each record() and what it answered - the writes R490 is about. */
private class RecordedWrites(
    private val inner: EntryRepository,
    val dao: FakeEntryDao,
) : EntryRepository {
    val made = mutableListOf<RecordCommand>()
    val answered = mutableListOf<RecordResult>()

    override suspend fun record(command: RecordCommand): RecordResult =
        inner.record(command).also {
            made += command
            answered += it
        }

    override fun observePending(): Flow<List<EntryEntity>> = inner.observePending()

    override fun observeAll(): Flow<List<EntryEntity>> = inner.observeAll()

    /** What the store holds for [day], as (portion, kind). */
    suspend fun day(day: String = PAST): List<Pair<Portion, EntryKind>> =
        dao.all().filter { it.dayDate == day }.map { it.portion to it.kind }
}

/** A repository already holding [rows] - written BEFORE anything observes it, so none of them is counted. */
private suspend fun holding(vararg rows: RecordCommand): RecordedWrites {
    val dao = FakeEntryDao()
    val inner = LocalEntryRepository(dao, JUNE_15)
    rows.forEach { inner.record(it) }
    return RecordedWrites(inner, dao)
}

private fun row(
    portion: Portion,
    kind: EntryKind,
    day: String = PAST,
) = RecordCommand(dayDate = day, kind = kind, portion = portion)

/** One row of [day] as the server holds it and a sync or a download stores it - synced, with its timestamps. */
private fun synced(
    portion: Portion,
    kind: EntryKind,
    day: String = PAST,
    provenance: Provenance = Provenance.MANUAL,
): EntryEntity =
    EntryEntity(
        clientMutationId = "stored-$day-$portion",
        dayDate = day,
        portion = portion,
        kind = kind,
        absenceReason = null,
        note = null,
        provenance = provenance,
        detectedKind = if (provenance == Provenance.MANUAL) null else kind,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$day-$portion",
        firstRecordedAt = "${day}T18:00:00Z",
        lastModifiedAt = "${day}T18:00:00Z",
        syncState = SyncState.SYNCED,
    )

@OptIn(ExperimentalCoroutinesApi::class)
private fun TestScope.sheetOn(
    repo: RecordedWrites,
    settings: SettingsStore,
    day: String = PAST,
): CalendarController =
    CalendarController(repo, settings, 2026, JUNE_15, this).also {
        advanceUntilIdle()
        it.openDay(day)
    }

@OptIn(ExperimentalCoroutinesApi::class)
class RecordedGranularityTest : FunSpec({
    // -------------------------------------------------------------------------------------------------------------
    // The calendar sheet (R493).
    // -------------------------------------------------------------------------------------------------------------

    test("R490 the sheet opens a day held WHOLE, in half-day mode, as ONE whole-day choice - and says why") {
        runTest {
            val sheet = sheetOn(holding(row(Portion.FULL, EntryKind.MISSION_FR)), HALF_DAYS).state.value.editing

            sheet.shouldNotBeNull().slots.map { it.slot to it.kind } shouldBe
                listOf(Slot.FULL to RecordedKind.MISSION_FRANCE)
            sheet.recordedAs shouldBe GranularityChoice.DAY
        }
    }

    test("R490 changing that whole day's kind writes ONE whole-day row, and no half beside it") {
        runTest {
            val repo = holding(row(Portion.FULL, EntryKind.HOME))
            val controller = sheetOn(repo, HALF_DAYS)
            val sheet = controller.state.value.editing.shouldNotBeNull()

            // Exactly what the sheet's Save button emits: every slot, the new kind, an untouched note as "".
            controller.save(PAST, sheet.slots.map { SlotEdit(it.slot, RecordedKind.SUISSE, null, "") })
            advanceUntilIdle()

            repo.made.map { it.portion to it.kind } shouldBe listOf(Portion.FULL to EntryKind.CH)
            repo.answered.all { it is RecordResult.Recorded } shouldBe true
            repo.day() shouldBe listOf(Portion.FULL to EntryKind.CH)
        }
    }

    test("R490 the mirror: a day held in HALVES opens, in whole-day mode, with its two halves - and says why") {
        runTest {
            val repo = holding(row(Portion.AM, EntryKind.CH), row(Portion.PM, EntryKind.HOME))
            val sheet = sheetOn(repo, WHOLE_DAYS).state.value.editing.shouldNotBeNull()

            sheet.slots.map { it.slot to it.kind } shouldBe
                listOf(Slot.MORNING to RecordedKind.SUISSE, Slot.AFTERNOON to RecordedKind.DOMICILE)
            sheet.recordedAs shouldBe GranularityChoice.HALF_DAY
        }
    }

    test("R490 the mirror: changing one half writes that half only - never a whole-day row beside them") {
        runTest {
            val repo = holding(row(Portion.AM, EntryKind.CH), row(Portion.PM, EntryKind.HOME))
            val controller = sheetOn(repo, WHOLE_DAYS)
            val sheet = controller.state.value.editing.shouldNotBeNull()

            // The afternoon becomes Suisse; the morning is saved as it was shown.
            val edits =
                sheet.slots.map { s ->
                    val kind = if (s.slot == Slot.AFTERNOON) RecordedKind.SUISSE else s.kind.shouldNotBeNull()
                    SlotEdit(s.slot, kind, s.absence, s.note.orEmpty())
                }
            controller.save(PAST, edits)
            advanceUntilIdle()

            repo.made.map { it.portion to it.kind } shouldBe listOf(Portion.PM to EntryKind.CH)
            repo.day() shouldBe listOf(Portion.AM to EntryKind.CH, Portion.PM to EntryKind.CH)
        }
    }

    test("R490 (kept from R477) saving that whole-day sheet untouched writes nothing") {
        runTest {
            val repo = holding(row(Portion.FULL, EntryKind.HOME))
            val controller = sheetOn(repo, HALF_DAYS)
            val sheet = controller.state.value.editing.shouldNotBeNull()

            // Exactly what the sheet's Save button emits for untouched drafts (CalendarEditSheet).
            val untouched =
                sheet.slots.mapNotNull { s -> s.kind?.let { SlotEdit(s.slot, it, s.absence, s.note.orEmpty()) } }
            untouched.size shouldBe 1
            controller.save(PAST, untouched)
            advanceUntilIdle()

            repo.made shouldBe emptyList()
            repo.day() shouldBe listOf(Portion.FULL to EntryKind.HOME)
        }
    }

    test("R490 (kept from R477) the sheet states a whole day's provenance once") {
        runTest {
            // Provenance is the SERVER's (firstRecordedAt), so the whole day here is a synced one.
            val dao = FakeEntryDao()
            dao.upsert(synced(Portion.FULL, EntryKind.HOME))
            val sheet = sheetOn(RecordedWrites(LocalEntryRepository(dao, JUNE_15), dao), HALF_DAYS).state.value.editing

            provenanceSlots(sheet.shouldNotBeNull()).size shouldBe 1
        }
    }

    test("R493 no notice for a day the setting describes; an empty day is asked for in the setting's granularity") {
        runTest {
            // Controls: what the setting asks for, where the day does not say otherwise.
            val wholeDay = sheetOn(holding(row(Portion.FULL, EntryKind.HOME)), WHOLE_DAYS).state.value.editing
            wholeDay.shouldNotBeNull().slots.map { it.slot } shouldBe listOf(Slot.FULL)
            wholeDay.recordedAs shouldBe null

            val emptyInHalves = sheetOn(holding(), HALF_DAYS).state.value.editing.shouldNotBeNull()
            emptyInHalves.slots.map { it.slot } shouldBe listOf(Slot.MORNING, Slot.AFTERNOON)
            emptyInHalves.recordedAs shouldBe null

            val emptyWhole = sheetOn(holding(), WHOLE_DAYS).state.value.editing.shouldNotBeNull()
            emptyWhole.slots.map { it.slot } shouldBe listOf(Slot.FULL)
            emptyWhole.recordedAs shouldBe null
        }
    }
})
