package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2c R788. THE CALENDAR CONTROLLER'S PIN, written and run green in :app against the controller as it stood
// (on kotlinx-datetime and the kotlin.time Clock seam since R787), BEFORE it moved to :shared - then moved to
// commonTest by `git mv`, unedited (R768's shape). kotlin.test + kotlinx-coroutines-test only, over an in-memory
// repository that RECORDS every command in order, so "the same requests in the same order" is asserted, not assumed.
// The controller's Kotest specs (CalendarControllerTest, CalendarBulkWriteTest, CalendarSaveWritesWhatChangedTest,
// CalendarSelectionTest, BulkConfirmationTest) stay in :app, unedited, through :app's java.time factory.
//
// Pinned: the month it opens on and today's cell from the clock (a month end, the spring DST day, the year end, a
// partial year); navigation bounds; the edit sheet's prefill, its refusals and its late prediction; a save writing
// only what changed, then one sync; a save changing nothing writing nothing; the multi-day selection (anchor, range,
// toggle, refusal); the bulk confirmation and its one write per day; the restore seed; a setting followed at once.
@OptIn(ExperimentalCoroutinesApi::class)
class CalendarControllerPinTest {
    private class RecordingRepository(seed: List<EntryEntity>) : EntryRepository {
        val rows = MutableStateFlow(seed)
        val recorded = mutableListOf<RecordCommand>()

        override suspend fun record(command: RecordCommand): RecordResult {
            recorded += command
            val row =
                EntryEntity(
                    clientMutationId = "m${recorded.size}",
                    dayDate = command.dayDate,
                    portion = command.portion,
                    kind = command.kind,
                    absenceReason = command.absenceReason,
                    note = command.note,
                    provenance = command.provenance,
                    detectedKind = null,
                    detectedAt = null,
                    clientClaimedAt = null,
                    serverId = null,
                    firstRecordedAt = null,
                    lastModifiedAt = null,
                    syncState = SyncState.PENDING,
                )
            rows.value = rows.value.filterNot { it.dayDate == command.dayDate && it.portion == command.portion } + row
            return RecordResult.Recorded(row)
        }

        override fun observePending(): Flow<List<EntryEntity>> =
            rows.map { all -> all.filter { it.syncState == SyncState.PENDING } }

        override fun observeAll(): Flow<List<EntryEntity>> = rows
    }

    private fun settings(
        granularity: String = "DAY",
        start: String? = null,
    ) = Settings("GE", 100, "SIMPLIFIED240", null, granularity, start)

    private fun synced(
        day: String,
        kind: EntryKind,
        portion: Portion = Portion.FULL,
        note: String? = null,
    ) = EntryEntity(
        clientMutationId = "s-$day-$portion",
        dayDate = day,
        portion = portion,
        kind = kind,
        absenceReason = null,
        note = note,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$day-$portion",
        firstRecordedAt = "${day}T18:00:00.000Z",
        lastModifiedAt = null,
        syncState = SyncState.SYNCED,
    )

    private class Built(val controller: CalendarController, val repository: RecordingRepository) {
        var syncs = 0
    }

    @OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time Clock and Instant - on the allowlist.
    private fun TestScope.build(
        now: String,
        store: InMemorySettingsStore = InMemorySettingsStore(settings()),
        seed: List<EntryEntity> = emptyList(),
        taxYear: Int = 2026,
        restored: CalendarSnapshot? = null,
    ): Built {
        val at = Instant.parse(now)
        val repository = RecordingRepository(seed)
        lateinit var built: Built
        val controller =
            CalendarController(
                repository = repository,
                settingsStore = store,
                taxYear = taxYear,
                clock =
                    object : Clock {
                        override fun now(): Instant = at
                    },
                // backgroundScope: the controller observes the rows forever; the test's end cancels it.
                scope = backgroundScope,
                requestSync = { built.syncs++ },
                restored = restored,
            )
        built = Built(controller, repository)
        runCurrent()
        return built
    }

    private fun CalendarController.view(): MonthView = assertNotNull(state.value.monthView, "no month view")

    private fun MonthView.day(iso: String): CalendarDayUi = days.first { it.isoDate == iso }

    @Test
    fun itOpensOnTheParisMonthWithTodayMarked() =
        runTest {
            // instant -> (opening month, today's cell)
            listOf(
                Triple("2026-05-31T21:59:59.999Z", 5, "2026-05-31"),
                Triple("2026-05-31T22:00:00Z", 6, "2026-06-01"),
                // 03:00 CEST in Paris and Zurich
                Triple("2026-03-29T01:00:00Z", 3, "2026-03-29"),
                // the second 02:30
                Triple("2026-10-25T01:30:00Z", 10, "2026-10-25"),
            ).forEach { (now, month, today) ->
                val view = build(now).controller.view()
                assertEquals(month, view.month, "month at $now")
                assertEquals(listOf(today), view.days.filter { it.isToday }.map { it.isoDate }, "today at $now")
                assertTrue(view.day(today).recordable, "today recordable at $now")
                val next = view.days.firstOrNull { it.isoDate > today }
                if (next != null) assertFalse(next.recordable, "${next.isoDate} is future at $now")
            }
            // the year end: 2027 in Paris, tax year 2026 -> its first month, every day past and recordable
            val yearEnd = build("2026-12-31T23:00:00Z").controller.view()
            assertEquals(1, yearEnd.month)
            assertTrue(yearEnd.days.none { it.isToday })
            assertTrue(yearEnd.days.all { it.recordable })
            assertFalse(yearEnd.canGoPrev)
            assertTrue(yearEnd.canGoNext)
        }

    @Test
    fun aPartialYearOpensAtItsStartAndNavigationStopsAtTheBounds() =
        runTest {
            val built = build("2026-03-29T01:00:00Z", InMemorySettingsStore(settings(start = "2026-04-15")))
            val c = built.controller
            assertEquals(4, c.view().month)
            assertFalse(c.view().canGoPrev)
            assertFalse(c.view().day("2026-04-14").recordable)
            assertFalse(c.view().day("2026-04-15").recordable) // inside the period, but after today (29 March)
            c.goPreviousMonth()
            assertEquals(4, c.view().month)
            repeat(10) { c.goNextMonth() }
            assertEquals(12, c.view().month)
            assertFalse(c.view().canGoNext)
            c.goPreviousMonth()
            assertEquals(11, c.view().month)
        }

    @Test
    fun theEditSheetIsPrefilledRefusedWhereItMustBeAndPredictsLateness() =
        runTest {
            val built =
                build(
                    "2026-06-15T10:00:00Z",
                    seed = listOf(synced("2026-06-08", EntryKind.HOME, note = "train")),
                )
            val c = built.controller
            c.openDay("2026-06-16") // the future: refused
            assertNull(c.state.value.editing)
            c.openDay("2026-06-08")
            val day = assertNotNull(c.state.value.editing)
            assertEquals("2026-06-08", day.isoDate)
            assertEquals(GranularityChoice.DAY, day.granularity)
            assertEquals(listOf(Slot.FULL), day.slots.map { it.slot })
            assertEquals(RecordedKind.DOMICILE, day.slots.single().kind)
            assertEquals("train", day.slots.single().note)
            assertEquals("2026-06-08T18:00:00.000Z", day.slots.single().firstRecordedAt)
            assertTrue(day.wouldBeLate) // 7 days 10 hours after UTC midnight of the day
            assertEquals(LatenessForecast.BACKFILL_DAYS, day.lateThresholdDays)
            c.closeSheet()
            assertNull(c.state.value.editing)
            c.openDay("2026-06-09") // 6 days 10 hours: on time, nothing recorded yet
            val empty = assertNotNull(c.state.value.editing)
            assertFalse(empty.wouldBeLate)
            assertNull(empty.slots.single().kind)
            assertTrue(built.repository.recorded.isEmpty())
        }

    @Test
    fun aSaveWritesOnlyWhatChangedThenOneSync() =
        runTest {
            val built =
                build(
                    "2026-06-15T10:00:00Z",
                    InMemorySettingsStore(settings(granularity = "HALF_DAY")),
                    seed =
                        listOf(
                            synced("2026-06-10", EntryKind.HOME, Portion.AM),
                            synced("2026-06-10", EntryKind.HOME, Portion.PM, note = "x"),
                        ),
                )
            val c = built.controller
            c.openDay("2026-06-10")
            val halves = assertNotNull(c.state.value.editing)
            assertEquals(listOf(Slot.MORNING, Slot.AFTERNOON), halves.slots.map { it.slot })
            c.save(
                "2026-06-10",
                listOf(
                    SlotEdit(Slot.MORNING, RecordedKind.SUISSE, null, ""),
                    SlotEdit(Slot.AFTERNOON, RecordedKind.DOMICILE, null, "x"),
                ),
            )
            runCurrent()
            assertEquals(
                listOf(RecordCommand(dayDate = "2026-06-10", kind = EntryKind.CH, portion = Portion.AM, note = null)),
                built.repository.recorded,
            )
            assertEquals(1, built.syncs)
            assertNull(c.state.value.editing)
            // the same values again: nothing written, no sync
            c.openDay("2026-06-10")
            c.save(
                "2026-06-10",
                listOf(
                    SlotEdit(Slot.MORNING, RecordedKind.SUISSE, null, "  "),
                    SlotEdit(Slot.AFTERNOON, RecordedKind.DOMICILE, null, "x"),
                ),
            )
            runCurrent()
            assertEquals(1, built.repository.recorded.size)
            assertEquals(1, built.syncs)
            // an absence carries its reason
            c.openDay("2026-06-11")
            c.save("2026-06-11", listOf(SlotEdit(Slot.MORNING, RecordedKind.ABSENCE, AbsenceChoice.MALADIE, null)))
            runCurrent()
            assertEquals(
                RecordCommand("2026-06-11", EntryKind.ABSENT, Portion.AM, AbsenceReason.MALADIE, null),
                built.repository.recorded.last(),
            )
            assertEquals(2, built.syncs)
        }

    @Test
    fun theSelectionAnchorsFillsTogglesAndRefusesTheFuture() =
        runTest {
            val c = build("2026-06-15T10:00:00Z").controller
            c.startSelection()
            assertTrue(c.state.value.selection.active)
            assertEquals(emptySet(), c.state.value.selection.days)
            c.tapDay("2026-06-02")
            assertEquals(SelectionState(true, setOf("2026-06-02"), "2026-06-02"), c.state.value.selection)
            c.tapDay("2026-06-05")
            assertEquals(
                SelectionState(true, setOf("2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"), null),
                c.state.value.selection,
            )
            c.tapDay("2026-06-03")
            assertEquals(setOf("2026-06-02", "2026-06-04", "2026-06-05"), c.state.value.selection.days)
            c.tapDay("2026-06-20") // future: refused
            assertEquals(setOf("2026-06-02", "2026-06-04", "2026-06-05"), c.state.value.selection.days)
            c.cancelSelection()
            assertEquals(SelectionState(), c.state.value.selection)
            c.startSelection("2026-06-12") // a long press seeds the pressed day
            assertEquals(SelectionState(true, setOf("2026-06-12"), "2026-06-12"), c.state.value.selection)
        }

    @Test
    fun theBulkConfirmationThenOneWritePerDayAndOneSync() =
        runTest {
            val built =
                build(
                    "2026-06-15T10:00:00Z",
                    seed = listOf(synced("2026-06-08", EntryKind.HOME)),
                )
            val c = built.controller
            c.chooseBulk(RecordedKind.ABSENCE, AbsenceChoice.CONGE) // not selecting: nothing
            assertNull(c.state.value.bulkConfirmation)
            c.startSelection()
            c.tapDay("2026-06-10")
            c.tapDay("2026-06-07")
            c.chooseBulk(RecordedKind.ABSENCE, AbsenceChoice.CONGE)
            assertEquals(
                BulkConfirmation(
                    days = listOf("2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"),
                    kind = RecordedKind.ABSENCE,
                    absence = AbsenceChoice.CONGE,
                    alreadyRecordedCount = 1,
                    lateCount = 2,
                    lateThresholdDays = LatenessForecast.BACKFILL_DAYS,
                ),
                c.state.value.bulkConfirmation,
            )
            c.cancelBulkConfirmation()
            assertNull(c.state.value.bulkConfirmation)
            assertTrue(c.state.value.selection.active)
            assertTrue(built.repository.recorded.isEmpty())
            c.chooseBulk(RecordedKind.ABSENCE, AbsenceChoice.CONGE)
            c.confirmBulk()
            runCurrent()
            assertEquals(
                listOf("2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10").map {
                    RecordCommand(it, EntryKind.ABSENT, Portion.FULL, AbsenceReason.CONGE)
                },
                built.repository.recorded,
            )
            assertEquals(1, built.syncs)
            assertEquals(SelectionState(), c.state.value.selection)
            assertNull(c.state.value.bulkConfirmation)
        }

    @Test
    fun theRestoreSeedReopensTheMonthTheSheetAndTheSelection() =
        runTest {
            val c =
                build(
                    "2026-06-15T10:00:00Z",
                    restored = CalendarSnapshot(month = 3, editingDay = "2026-03-10"),
                ).controller
            assertEquals(3, c.view().month)
            assertEquals("2026-03-10", c.state.value.editing?.isoDate)
            val clamped = build("2026-06-15T10:00:00Z", restored = CalendarSnapshot(month = 0)).controller
            assertEquals(1, clamped.view().month)
            val selecting =
                build(
                    "2026-06-15T10:00:00Z",
                    restored = CalendarSnapshot(selection = SelectionSnapshot(listOf("2026-06-01"), "2026-06-01")),
                ).controller
            assertEquals(SelectionState(true, setOf("2026-06-01"), "2026-06-01"), selecting.state.value.selection)
        }

    @Test
    fun aSettingChangedElsewhereIsFollowedAtTheNextSheet() =
        runTest {
            val store = InMemorySettingsStore(settings())
            val c = build("2026-06-15T10:00:00Z", store).controller
            c.openDay("2026-06-12")
            assertEquals(listOf(Slot.FULL), assertNotNull(c.state.value.editing).slots.map { it.slot })
            c.closeSheet()
            store.save(settings(granularity = "HALF_DAY"))
            c.refresh()
            c.openDay("2026-06-12")
            val day = assertNotNull(c.state.value.editing)
            assertEquals(GranularityChoice.HALF_DAY, day.granularity)
            assertEquals(listOf(Slot.MORNING, Slot.AFTERNOON), day.slots.map { it.slot })
        }
}
