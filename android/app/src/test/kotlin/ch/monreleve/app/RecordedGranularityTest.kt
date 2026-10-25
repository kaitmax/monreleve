package ch.monreleve.app

import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.aujourdhui.AujourdhuiState
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

/** Today, in Paris, under [JUNE_15]. */
private const val TODAY = "2026-06-15"

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
private fun TestScope.todayOn(
    repo: RecordedWrites,
    settings: SettingsStore,
): AujourdhuiController = AujourdhuiController(repo, settings, 2026, JUNE_15, this).also { advanceUntilIdle() }

/**
 * The slots Aujourd'hui's manual card offers for [state] - ChoiceCard's own dispatch, read off the state the
 * controller emits: DAY is DayChoiceCard (RecordSection on Slot.FULL), HALF_DAY is HalfDayChoiceCard (one
 * RecordSection per half). A tap after « Modifier » records through one of these.
 */
private fun slotsTheCardOffers(state: AujourdhuiState): List<Slot> =
    when (state.granularity) {
        GranularityChoice.DAY -> listOf(Slot.FULL)
        GranularityChoice.HALF_DAY -> listOf(Slot.MORNING, Slot.AFTERNOON)
    }

/** A repository whose store holds [rows] exactly as stored - how a day already mixed reaches the phone (R494). */
private suspend fun stored(vararg rows: EntryEntity): RecordedWrites {
    val dao = FakeEntryDao()
    rows.forEach { dao.upsert(it) }
    return RecordedWrites(LocalEntryRepository(dao, JUNE_15), dao)
}

/** The bulk selection's three days, a working Monday to Wednesday before [TODAY]. */
private const val MONDAY = "2026-06-08"
private const val TUESDAY = "2026-06-09"
private const val WEDNESDAY = "2026-06-10"

/**
 * R493 / R496 step 3: a selection holding a day recorded WHOLE (Monday), a day recorded in HALVES (Tuesday) and an
 * EMPTY day (Wednesday), confirmed as « Mission en France » through the real controller under [settings]. Returns
 * what the repository WROTE, in order - and asserts every write landed, that nothing was refused, and that each day's
 * stored rows are exactly the writes (so a day left as it was, or a refusal, could not pass as "its granularity").
 */
@OptIn(ExperimentalCoroutinesApi::class)
private suspend fun TestScope.bulkOver(settings: SettingsStore): List<Triple<String, Portion, EntryKind>> {
    val repo =
        holding(
            row(Portion.FULL, EntryKind.HOME, MONDAY),
            row(Portion.AM, EntryKind.CH, TUESDAY),
            row(Portion.PM, EntryKind.HOME, TUESDAY),
        )
    var syncs = 0
    val controller = CalendarController(repo, settings, 2026, JUNE_15, this, requestSync = { syncs++ })
    advanceUntilIdle()

    controller.startSelection()
    controller.tapDay(MONDAY)
    controller.tapDay(WEDNESDAY)
    controller.state.value.selection.days shouldBe setOf(MONDAY, TUESDAY, WEDNESDAY)
    controller.chooseBulk(RecordedKind.MISSION_FRANCE, null)
    controller.confirmBulk()
    advanceUntilIdle()

    repo.answered.filterNot { it is RecordResult.Recorded } shouldBe emptyList()
    syncs shouldBe 1
    val writes = repo.made.map { Triple(it.dayDate, it.portion, it.kind) }
    for (day in listOf(MONDAY, TUESDAY, WEDNESDAY)) {
        repo.day(day) shouldBe writes.filter { it.first == day }.map { it.second to it.third }
    }
    return writes
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
    // -------------------------------------------------------------------------------------------------------------
    // Aujourd'hui, its choice and its « Modifier » (R493; AN-CALENDAR Q4).
    // -------------------------------------------------------------------------------------------------------------

    test("R490 Aujourd'hui: today held WHOLE, in half-day mode, is ONE whole-day answer - and says why") {
        runTest {
            val state = todayOn(holding(row(Portion.FULL, EntryKind.HOME, TODAY)), HALF_DAYS).state.value

            state.granularity shouldBe GranularityChoice.DAY
            state.fullDay.shouldNotBeNull().kind shouldBe RecordedKind.DOMICILE
            state.morning shouldBe null
            state.afternoon shouldBe null
            state.recordedAs shouldBe GranularityChoice.DAY
        }
    }

    test("R490 Aujourd'hui: « Modifier » on that day writes ONE whole-day row - never half-day controls writing FULL") {
        runTest {
            val repo = holding(row(Portion.FULL, EntryKind.HOME, TODAY))
            val controller = todayOn(repo, HALF_DAYS)

            // « Modifier », then « En Suisse », on the first slot the card offers.
            controller.record(RecordedKind.SUISSE, slotsTheCardOffers(controller.state.value).first())
            advanceUntilIdle()

            repo.made.map { it.portion to it.kind } shouldBe listOf(Portion.FULL to EntryKind.CH)
            repo.day(TODAY) shouldBe listOf(Portion.FULL to EntryKind.CH)
        }
    }

    test("R490 Aujourd'hui, the mirror: today held in HALVES, in whole-day mode, keeps its halves - and says why") {
        runTest {
            val repo = holding(row(Portion.AM, EntryKind.CH, TODAY), row(Portion.PM, EntryKind.HOME, TODAY))
            val state = todayOn(repo, WHOLE_DAYS).state.value

            state.granularity shouldBe GranularityChoice.HALF_DAY
            state.morning.shouldNotBeNull().kind shouldBe RecordedKind.SUISSE
            state.afternoon.shouldNotBeNull().kind shouldBe RecordedKind.DOMICILE
            state.fullDay shouldBe null
            state.recordedAs shouldBe GranularityChoice.HALF_DAY
        }
    }

    test("R490 Aujourd'hui, the mirror: « Modifier » on the afternoon writes that half only - never a FULL row") {
        runTest {
            val repo = holding(row(Portion.AM, EntryKind.CH, TODAY), row(Portion.PM, EntryKind.HOME, TODAY))
            val controller = todayOn(repo, WHOLE_DAYS)

            controller.record(RecordedKind.SUISSE, slotsTheCardOffers(controller.state.value).last())
            advanceUntilIdle()

            repo.made.map { it.portion to it.kind } shouldBe listOf(Portion.PM to EntryKind.CH)
            repo.day(TODAY) shouldBe listOf(Portion.AM to EntryKind.CH, Portion.PM to EntryKind.CH)
        }
    }

    test("R493 Aujourd'hui: an empty today is asked for in the setting's granularity, with no notice") {
        runTest {
            val halves = todayOn(holding(), HALF_DAYS).state.value
            halves.granularity shouldBe GranularityChoice.HALF_DAY
            halves.recordedAs shouldBe null

            val whole = todayOn(holding(), WHOLE_DAYS).state.value
            whole.granularity shouldBe GranularityChoice.DAY
            whole.recordedAs shouldBe null
        }
    }
    // -------------------------------------------------------------------------------------------------------------
    // Bulk confirmation over a selection (R493).
    // -------------------------------------------------------------------------------------------------------------

    test("R493 bulk, half-day mode: a whole day stays whole, a day in halves stays in halves, an empty day is halved") {
        runTest {
            val writes = bulkOver(HALF_DAYS)

            writes shouldBe
                listOf(
                    Triple(MONDAY, Portion.FULL, EntryKind.MISSION_FR),
                    Triple(TUESDAY, Portion.AM, EntryKind.MISSION_FR),
                    Triple(TUESDAY, Portion.PM, EntryKind.MISSION_FR),
                    Triple(WEDNESDAY, Portion.AM, EntryKind.MISSION_FR),
                    Triple(WEDNESDAY, Portion.PM, EntryKind.MISSION_FR),
                )
        }
    }

    test("R493 bulk, whole-day mode: a day in halves keeps its halves; the whole day and the empty day are whole") {
        runTest {
            val writes = bulkOver(WHOLE_DAYS)

            writes shouldBe
                listOf(
                    Triple(MONDAY, Portion.FULL, EntryKind.MISSION_FR),
                    Triple(TUESDAY, Portion.AM, EntryKind.MISSION_FR),
                    Triple(TUESDAY, Portion.PM, EntryKind.MISSION_FR),
                    Triple(WEDNESDAY, Portion.FULL, EntryKind.MISSION_FR),
                )
        }
    }
    // -------------------------------------------------------------------------------------------------------------
    // Days ALREADY mixed (R494): shown as their rows say, never repaired, never grown.
    // -------------------------------------------------------------------------------------------------------------

    test("R494 the sheet shows a day already mixed as its rows say - each row editable, none added") {
        runTest {
            val repo = stored(synced(Portion.FULL, EntryKind.HOME), synced(Portion.AM, EntryKind.CH))
            val controller = sheetOn(repo, HALF_DAYS)
            val sheet = controller.state.value.editing.shouldNotBeNull()

            sheet.slots.map { it.slot to it.kind } shouldBe
                listOf(Slot.FULL to RecordedKind.DOMICILE, Slot.MORNING to RecordedKind.SUISSE)
            sheet.recordedAs shouldBe null

            // Editing an existing row's kind is allowed (the whole-day row becomes Suisse); the morning is untouched.
            controller.save(
                PAST,
                sheet.slots.map { s ->
                    val kind = if (s.slot == Slot.FULL) RecordedKind.SUISSE else s.kind.shouldNotBeNull()
                    SlotEdit(s.slot, kind, s.absence, s.note.orEmpty())
                },
            )
            advanceUntilIdle()

            repo.made.map { it.portion to it.kind } shouldBe listOf(Portion.FULL to EntryKind.CH)
            repo.day() shouldBe listOf(Portion.FULL to EntryKind.CH, Portion.AM to EntryKind.CH)
        }
    }

    test("R494 Aujourd'hui shows a mixed today as its rows say, and offers nothing that would add a row") {
        runTest {
            val repo = stored(synced(Portion.FULL, EntryKind.HOME, TODAY), synced(Portion.PM, EntryKind.CH, TODAY))
            val state = todayOn(repo, WHOLE_DAYS).state.value

            state.mixedToday shouldBe true
            state.fullDay.shouldNotBeNull().kind shouldBe RecordedKind.DOMICILE
            state.afternoon.shouldNotBeNull().kind shouldBe RecordedKind.SUISSE
            // The morning has no row, and none is asked for: answering it would add AM beside FULL.
            state.morning shouldBe null
            state.recordedAs shouldBe null
            repo.made shouldBe emptyList()
        }
    }

    test("R494 bulk over a day already mixed rewrites the rows it holds and adds none") {
        runTest {
            val repo = stored(synced(Portion.FULL, EntryKind.HOME, MONDAY), synced(Portion.AM, EntryKind.CH, MONDAY))
            var syncs = 0
            val controller = CalendarController(repo, WHOLE_DAYS, 2026, JUNE_15, this, requestSync = { syncs++ })
            advanceUntilIdle()

            controller.startSelection(MONDAY)
            controller.chooseBulk(RecordedKind.DOMICILE, null)
            controller.confirmBulk()
            advanceUntilIdle()

            repo.made.map { it.portion to it.kind } shouldBe
                listOf(Portion.FULL to EntryKind.HOME, Portion.AM to EntryKind.HOME)
            repo.answered.filterNot { it is RecordResult.Recorded } shouldBe emptyList()
            repo.day(MONDAY) shouldBe listOf(Portion.FULL to EntryKind.HOME, Portion.AM to EntryKind.HOME)
            syncs shouldBe 1
        }
    }

    test("R494 showing a mixed day writes nothing and deletes nothing - an untouched save is no change") {
        runTest {
            val repo = stored(synced(Portion.FULL, EntryKind.HOME), synced(Portion.AM, EntryKind.CH))
            val controller = sheetOn(repo, WHOLE_DAYS)
            val sheet = controller.state.value.editing.shouldNotBeNull()

            controller.save(PAST, sheet.slots.map { s -> SlotEdit(s.slot, s.kind.shouldNotBeNull(), s.absence, "") })
            advanceUntilIdle()

            repo.made shouldBe emptyList()
            repo.day() shouldBe listOf(Portion.FULL to EntryKind.HOME, Portion.AM to EntryKind.CH)
        }
    }
})
