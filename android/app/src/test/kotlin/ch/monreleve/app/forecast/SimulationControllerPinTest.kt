package ch.monreleve.app.forecast

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.SimChange
import ch.monreleve.app.dossier.simulationResults
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// IOS-2d R814. THE SIMULATION CONTROLLER'S PIN, written and run green in :app against the controller as it stood (on
// kotlinx-datetime and the kotlin.time Clock seam since R813), BEFORE it moved to :shared - then moved to commonTest
// by `git mv`, unedited (R768's shape). kotlin.test + kotlinx-coroutines-test only. The Kotest spec
// (SimulationControllerTest) and SettingsFollowedWithoutRestartTest stay in :app through JavaTimeForecast.kt.
//
// Pinned: the change each scenario and input SENDS to the engine - the expected view is the shared engine's own
// result for the literal change written beside it (R181), so the assertion is "this input means that change";
// the first available weekday and the current rate seeded so no field starts empty, and a weekday that stops being
// available re-seeded; canAdopt; the rhythm FOLLOWED from the repository (never a second copy); a restored snapshot;
// refresh() moving the tax year at the year end; nothing ever written (R340).
@OptIn(ExperimentalCoroutinesApi::class)
class SimulationControllerPinTest {
    private class Rhythms(initial: WeeklyRhythm) : RhythmRepository {
        val source = MutableStateFlow(initial)
        var writes = 0

        override fun observe(): Flow<WeeklyRhythm> = source

        override suspend fun save(rhythm: WeeklyRhythm) {
            writes++
        }

        override suspend fun clear() {
            writes++
        }
    }

    private class ReadOnlyEntries(seed: List<EntryEntity>) : EntryRepository {
        val rows = MutableStateFlow(seed)
        var records = 0

        override suspend fun record(command: RecordCommand): RecordResult {
            records++
            throw UnsupportedOperationException("the simulator never records a day (R340)")
        }

        override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

        override fun observeAll(): Flow<List<EntryEntity>> = rows
    }

    private class Built(val controller: SimulationController, val rhythms: Rhythms, val entries: ReadOnlyEntries) {
        val state: SimulationState get() = controller.state.value
    }

    @OptIn(ExperimentalTime::class) // KMP-DT R590: a fixed kotlin.time Clock - on the allowlist.
    private fun TestScope.build(
        now: String = OCT_9,
        rhythm: WeeklyRhythm = TUE_THU_HOME,
        seed: List<EntryEntity> = RECORDED,
        store: InMemorySettingsStore = InMemorySettingsStore(SETTINGS),
        restored: SimulationSnapshot? = null,
    ): Built {
        val at = Instant.parse(now)
        val rhythms = Rhythms(rhythm)
        val entries = ReadOnlyEntries(seed)
        val controller =
            SimulationController(
                rhythmRepo = rhythms,
                entryRepo = entries,
                settingsStore = store,
                taxYear = 2026,
                clock =
                    object : Clock {
                        override fun now(): Instant = at
                    },
                // backgroundScope: the controller follows the rhythm and the record forever; the test's end cancels it.
                scope = backgroundScope,
                restored = restored,
            )
        runCurrent()
        return Built(controller, rhythms, entries)
    }

    @Test
    fun itSeedsTheFirstAvailableWeekdayAndTheCurrentRate() =
        runTest {
            val built = build()
            assertEquals(SimScenario.EXTRA_WEEKDAY, built.state.scenario)
            assertEquals(listOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), built.state.availableWeekdays)
            assertEquals(SimInputs(extraWeekday = DayOfWeek.MONDAY, targetRate = "100"), built.state.inputs)
            assertTrue(built.state.canAdopt)
            assertEquals(expected(SimChange.ExtraWeekday(DayOfWeek.MONDAY)), built.state.view)
        }

    @Test
    fun eachScenarioAndInputSendsItsChangeToTheEngine() =
        runTest {
            val built = build()
            val mismatches = mutableListOf<String>()
            for ((scenario, inputs, change) in VECTORS) {
                built.controller.selectScenario(scenario)
                built.controller.updateInputs(inputs)
                runCurrent()
                val adopt = scenario == SimScenario.EXTRA_WEEKDAY && built.state.inputs.extraWeekday != null
                if (built.state.view != expected(change)) mismatches += "<$scenario $inputs> does not send $change"
                if (built.state.canAdopt != adopt) mismatches += "<$scenario $inputs> canAdopt ${built.state.canAdopt}"
            }
            assertTrue(mismatches.isEmpty(), "${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))
            assertTrue(expected(SimChange.ExtraWeekday(DayOfWeek.FRIDAY)) != expected(SimChange.ExtraMonthDays(0)))
            assertEquals(0 to 0, built.rhythms.writes to built.entries.records, "nothing written (R340)")
        }

    @Test
    fun theRhythmIsFollowedAndAWeekdayNoLongerOfferedIsReseeded() =
        runTest {
            val built = build()
            built.controller.updateInputs(built.state.inputs.copy(extraWeekday = DayOfWeek.WEDNESDAY))
            runCurrent()
            val monWedHome = WeeklyRhythm(HOME, AWAY, HOME, AWAY, AWAY)
            built.rhythms.source.value = monWedHome
            runCurrent()
            assertEquals(listOf(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY), built.state.availableWeekdays)
            assertEquals(DayOfWeek.TUESDAY, built.state.inputs.extraWeekday)
            assertEquals(expected(SimChange.ExtraWeekday(DayOfWeek.TUESDAY), rhythm = monWedHome), built.state.view)
            val allHome = WeeklyRhythm(HOME, HOME, HOME, HOME, HOME)
            built.rhythms.source.value = allHome
            runCurrent()
            assertEquals(emptyList(), built.state.availableWeekdays)
            assertNull(built.state.inputs.extraWeekday)
            assertEquals(false, built.state.canAdopt)
            assertEquals(expected(SimChange.ExtraMonthDays(0), rhythm = allHome), built.state.view)
            assertEquals(0, built.rhythms.writes, "following the rhythm writes nothing")
        }

    @Test
    fun aRestoredSnapshotReopensItsScenarioAndInputs() =
        runTest {
            val restored = SimulationSnapshot(SimScenario.RATE, SimInputs(targetRate = "80"))
            val built = build(restored = restored)
            assertEquals(SimScenario.RATE, built.state.scenario)
            assertEquals(SimInputs(extraWeekday = DayOfWeek.MONDAY, targetRate = "80"), built.state.inputs)
            assertEquals(false, built.state.canAdopt)
            assertEquals(expected(SimChange.Rate(80)), built.state.view)
        }

    @Test
    fun refreshMovesTheTaxYearAtTheYearEndAndNoSettingsOrRhythmIsTheInvitation() =
        runTest {
            val built = build(now = "2026-12-31T23:00:00Z")
            val newYear = LocalDate(2027, 1, 1)
            val change = SimChange.ExtraWeekday(DayOfWeek.MONDAY)
            assertEquals(expected(change, today = newYear), built.state.view, "1 Jan 2027, tax year still 2026")
            built.controller.refresh()
            runCurrent()
            val after = expected(change, today = newYear, taxYear = 2027, recorded = emptyList())
            assertEquals(after, built.state.view, "tax year 2027: the 2026 rows no longer count")
            assertEquals(0.0, assertNotNull(built.state.view).recordedRate)
            val unset = build(store = InMemorySettingsStore(null))
            assertNull(unset.state.view)
            assertEquals("", unset.state.inputs.targetRate, "no settings: nothing to seed the rate from")
            assertNull(build(rhythm = WeeklyRhythm()).state.view, "an empty rhythm is the invitation")
        }

    /** The view the shared engine itself gives for [change] - what the controller must show for it. */
    @Suppress("LongParameterList")
    private fun expected(
        change: SimChange,
        rhythm: WeeklyRhythm = TUE_THU_HOME,
        today: LocalDate = LocalDate(2026, 10, 9),
        taxYear: Int = 2026,
        recorded: List<EntryEntity> = RECORDED,
    ): SimulationView? {
        // null when the engine itself refuses the input - the controller then shows the invitation (a null view)
        val results =
            simulationResults(
                SETTINGS.toAggregatableUser(),
                recorded.map { it.toAggregatable() },
                rhythm.toEntryKindMap(),
                change,
                today,
                taxYear,
            ) ?: return null
        val rules = ruleSetFor(taxYear)
        return SimulationView(
            recordedRate = results.recorded.declarableRate,
            currentRate = results.baseline.declarableRate,
            simulatedRate = results.simulated.declarableRate,
            simulated = results.simulated,
            fiscalCeiling = rules.fiscalCeiling,
            socialCeiling = rules.socialCeiling,
        )
    }

    private companion object {
        const val OCT_9 = "2026-10-09T10:00:00Z"
        val HOME = RhythmKind.DOMICILE
        val AWAY = RhythmKind.SUISSE
        val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)
        val TUE_THU_HOME = WeeklyRhythm(AWAY, HOME, AWAY, HOME, AWAY)

        /** Ten 2026 home rows, the record the view reads; not one is in another year. */
        val RECORDED =
            listOf("01-05", "01-06", "01-07", "01-08", "01-09", "02-02", "02-03", "02-04", "02-05", "02-06")
                .map { md -> home("2026-$md") }

        val WEEKDAY = SimScenario.EXTRA_WEEKDAY
        val DAYS = SimScenario.EXTRA_MONTH_DAYS
        val RATE = SimScenario.RATE
        val MISSIONS = SimScenario.MISSIONS

        val VECTORS: List<Triple<SimScenario, SimInputs, SimChange>> =
            listOf(
                Triple(WEEKDAY, SimInputs(DayOfWeek.FRIDAY), SimChange.ExtraWeekday(DayOfWeek.FRIDAY)),
                Triple(WEEKDAY, SimInputs(null), SimChange.ExtraWeekday(DayOfWeek.MONDAY)),
                // Tuesday is already a home day: not offered, so re-seeded to the first offered weekday
                Triple(WEEKDAY, SimInputs(DayOfWeek.TUESDAY), SimChange.ExtraWeekday(DayOfWeek.MONDAY)),
                Triple(DAYS, SimInputs(extraMonthDays = "6"), SimChange.ExtraMonthDays(6)),
                Triple(DAYS, SimInputs(extraMonthDays = ""), SimChange.ExtraMonthDays(0)),
                Triple(DAYS, SimInputs(extraMonthDays = "-3"), SimChange.ExtraMonthDays(0)),
                Triple(DAYS, SimInputs(extraMonthDays = "abc"), SimChange.ExtraMonthDays(0)),
                Triple(RATE, SimInputs(targetRate = "80"), SimChange.Rate(80)),
                Triple(RATE, SimInputs(targetRate = "1"), SimChange.Rate(1)),
                Triple(RATE, SimInputs(targetRate = "0"), SimChange.Rate(100)),
                Triple(RATE, SimInputs(targetRate = "101"), SimChange.Rate(100)),
                Triple(RATE, SimInputs(targetRate = ""), SimChange.Rate(100)),
                Triple(MISSIONS, SimInputs(missionsFrance = "4", missionsThird = "2"), SimChange.Missions(4, 2)),
                Triple(MISSIONS, SimInputs(missionsFrance = "-1", missionsThird = "x"), SimChange.Missions(0, 0)),
                Triple(MISSIONS, SimInputs(missionsFrance = "", missionsThird = "3"), SimChange.Missions(0, 3)),
            )

        fun home(day: String): EntryEntity =
            EntryEntity(
                clientMutationId = "pin-$day",
                dayDate = day,
                portion = Portion.FULL,
                kind = EntryKind.HOME,
                absenceReason = null,
                note = null,
                provenance = Provenance.MANUAL,
                detectedKind = null,
                detectedAt = null,
                clientClaimedAt = null,
                serverId = null,
                firstRecordedAt = null,
                lastModifiedAt = null,
                syncState = SyncState.SYNCED,
            )
    }
}
