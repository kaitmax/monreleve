package ch.monreleve.app.pilot

import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.aujourdhui.AujourdhuiState
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.design.RecordQuality
import ch.monreleve.app.onboarding.GranularityChoice
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-1b-A R608. THE FIXTURE DRIVES EVERY STATE THE SCREEN CAN SHOW - through the REAL controller and record path.
//
// Wednesday 17 June 2026, 10:00 UTC (noon in Paris). For each PilotScenario the controller's state is read after
// the in-memory record has emitted (runCurrent, not advanceUntilIdle: the controller collects a HOT flow in
// backgroundScope, and advanceUntilIdle does not run background work), and checked for what the top of the screen
// draws; the seeded history is checked once for what the week strip, the month and « À traiter » draw. Then a
// tap is driven through it: it writes one row, pending, under the pilot's own account tag - and a tap the record
// path must refuse (a whole day beside halves,
// R492) writes nothing. Runs on the JVM and on the iOS simulator (commonTest).

private const val TODAY = "2026-06-17"

@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Clock/Instant - on the allowlist.
private val NOON_IN_PARIS: Clock =
    object : Clock {
        override fun now(): Instant = Instant.parse("${TODAY}T10:00:00Z")
    }

@OptIn(ExperimentalCoroutinesApi::class)
class PilotFixtureTest {
    private var ids = 0

    @OptIn(ExperimentalTime::class) // KMP-DT R590: hands the kotlin.time.Clock seam over - on the allowlist.
    private fun TestScope.controllerFor(
        scenario: PilotScenario,
        dao: InMemoryEntryDao = InMemoryEntryDao(PilotFixture.seed(scenario, TODAY)),
    ): AujourdhuiController {
        val controller =
            PilotFixture.controller(
                scenario = scenario,
                scope = backgroundScope,
                clock = NOON_IN_PARIS,
                deviceZone = TimeZone.UTC,
                newMutationId = { "pilot-tap-${ids++}" },
                dao = dao,
            )
        runCurrent()
        return controller
    }

    private fun TestScope.stateOf(scenario: PilotScenario): AujourdhuiState = controllerFor(scenario).state.value

    @Test
    fun todayIsInEachScenariosState() =
        runTest {
            val unanswered = stateOf(PilotScenario.UNANSWERED)
            assertEquals(TODAY, unanswered.today)
            assertEquals(GranularityChoice.DAY, unanswered.granularity)
            assertNull(unanswered.fullDay)

            val halfDay = stateOf(PilotScenario.UNANSWERED_HALF_DAY)
            assertEquals(GranularityChoice.HALF_DAY, halfDay.granularity)
            assertNull(halfDay.morning)
            assertNull(halfDay.afternoon)

            val whole = assertNotNull(stateOf(PilotScenario.ANSWERED_WHOLE).fullDay)
            assertEquals(RecordedKind.SUISSE, whole.kind)
            assertEquals(false, whole.pending)
            assertEquals(false, whole.failed)

            val halves = stateOf(PilotScenario.ANSWERED_HALVES)
            assertEquals(GranularityChoice.HALF_DAY, halves.granularity)
            assertEquals(RecordedKind.SUISSE, halves.morning?.kind)
            assertEquals(RecordedKind.DOMICILE, halves.afternoon?.kind)

            val pending = assertNotNull(stateOf(PilotScenario.PENDING).fullDay)
            assertEquals(true, pending.pending)
            assertEquals(false, pending.failed)

            val refused = assertNotNull(stateOf(PilotScenario.REFUSED).fullDay)
            assertEquals(true, refused.failed)
        }

    @Test
    fun theHistoryFillsTheWeekTheMonthAndWhatToAttendTo() =
        runTest {
            val state = stateOf(PilotScenario.UNANSWERED)
            assertNotNull(state.year, "the year panel needs the seeded history")
            assertEquals(
                listOf("2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"),
                state.week.map { it.isoDate },
            )
            val week = state.week.associateBy { it.isoDate }
            assertEquals(
                RecordQuality.ON_TIME,
                week.getValue("2026-06-15").quality,
                "Monday: answered in halves, synced",
            )
            assertEquals("S", week.getValue("2026-06-15").kind?.letter)
            assertEquals("D", week.getValue("2026-06-15").secondKind?.letter)
            assertEquals(RecordQuality.ON_TIME, week.getValue("2026-06-16").quality, "Tuesday: a whole day, synced")
            val month = assertNotNull(state.month)
            assertEquals(5.0, month.nonRenseigne, "1-5 June are working days left unanswered")
            val attend = assertNotNull(state.attend, "a pending day and a refused day are something to attend to")
            assertTrue(attend.unsyncedDays >= 1)
        }

    @Test
    fun aTapRecordsIntoMemoryAndARefusedTapWritesNothing() =
        runTest {
            val dao = InMemoryEntryDao(PilotFixture.seed(PilotScenario.UNANSWERED, TODAY))
            val controller = controllerFor(PilotScenario.UNANSWERED, dao)
            controller.record(RecordedKind.DOMICILE, Slot.FULL)
            runCurrent()
            val today = assertNotNull(controller.state.value.fullDay)
            assertEquals(RecordedKind.DOMICILE, today.kind)
            assertEquals(true, today.pending)
            val row = assertNotNull(dao.byDayPortion(TODAY, Portion.FULL))
            assertEquals(PILOT_ACCOUNT, row.accountTag)
            assertEquals(SyncState.PENDING, row.syncState)

            val halvesDao = InMemoryEntryDao(PilotFixture.seed(PilotScenario.ANSWERED_HALVES, TODAY))
            val halves = controllerFor(PilotScenario.ANSWERED_HALVES, halvesDao)
            halves.record(RecordedKind.SUISSE, Slot.FULL)
            runCurrent()
            assertNull(halvesDao.byDayPortion(TODAY, Portion.FULL), "a whole day beside halves is refused (R492)")
        }
}
