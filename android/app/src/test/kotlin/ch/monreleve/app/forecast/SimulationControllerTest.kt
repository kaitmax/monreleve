package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
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
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId

// AN-SIM (R340). A PROJECTION IS NEVER A RECORD - the controller boundary. Computing a simulation (reading the
// rhythm + the record and running the engine over an imagined change) writes to NO store. The SimulationController
// has no save or record seam at all - adopting a weekday is the ForecastController's setDay, wired at the shell
// and tested in ForecastControllerTest - so the ONLY thing to prove here is that every scenario a reader can run
// leaves the rhythm store (and therefore the record it was never given a seam to) untouched. This is the chain's
// handover "nothing written" check at the controller level; the store-level device proof is in the walkthrough.

private class CountingRhythmRepository(private val initial: WeeklyRhythm) : RhythmRepository {
    var saveCount = 0
        private set
    var clearCount = 0
        private set

    override fun observe(): Flow<WeeklyRhythm> = flowOf(initial)

    override suspend fun save(rhythm: WeeklyRhythm) {
        saveCount++
    }

    override suspend fun clear() {
        clearCount++
    }
}

// record() throws: the simulator must never reach the entry-write path. observeAll returns a fixed year so the
// view computes; observePending is unused by the simulator.
private class ThrowingEntryRepository : EntryRepository {
    override suspend fun record(command: RecordCommand): EntryEntity =
        throw UnsupportedOperationException("the simulator must not record a day (R340)")

    override fun observePending(): Flow<List<EntryEntity>> = flowOf(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = flowOf(emptyList())
}

@OptIn(ExperimentalCoroutinesApi::class)
class SimulationControllerTest : FunSpec({
    val clock = Clock.fixed(Instant.parse("2026-10-09T10:00:00Z"), ZoneId.of("Europe/Paris"))
    val settingsStore =
        object : SettingsStore {
            override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

            override fun save(settings: Settings) = Unit

            override fun clear() = Unit
        }

    test("running every scenario writes to no store (R340)") {
        runTest {
            val rhythmRepo =
                CountingRhythmRepository(WeeklyRhythm(tuesday = RhythmKind.DOMICILE, thursday = RhythmKind.DOMICILE))
            val controller =
                SimulationController(rhythmRepo, ThrowingEntryRepository(), settingsStore, 2026, clock, this)
            advanceUntilIdle()

            // The engine produced a simulation (a set rhythm), and computing it wrote NOTHING.
            controller.state.value.view.shouldNotBeNull()

            // Drive each scenario and feed every input - the whole surface a reader can touch.
            controller.selectScenario(SimScenario.EXTRA_WEEKDAY)
            controller.updateInputs(SimInputs(extraWeekday = DayOfWeek.FRIDAY))
            controller.selectScenario(SimScenario.EXTRA_MONTH_DAYS)
            controller.updateInputs(SimInputs(extraMonthDays = "6"))
            controller.selectScenario(SimScenario.RATE)
            controller.updateInputs(SimInputs(targetRate = "80"))
            controller.selectScenario(SimScenario.MISSIONS)
            controller.updateInputs(SimInputs(missionsFrance = "4", missionsThird = "2"))
            controller.refresh()
            advanceUntilIdle()

            // Nothing was written to the rhythm store, and the entry-write path (record) was never reached
            // (ThrowingEntryRepository would have thrown).
            rhythmRepo.saveCount shouldBe 0
            rhythmRepo.clearCount shouldBe 0
        }
    }

    test("an empty rhythm shows the invitation, not an empty simulation") {
        runTest {
            val controller =
                SimulationController(
                    CountingRhythmRepository(WeeklyRhythm()),
                    ThrowingEntryRepository(),
                    settingsStore,
                    2026,
                    clock,
                    this,
                )
            advanceUntilIdle()
            controller.state.value.view shouldBe null
        }
    }

    test("the rate field is seeded to the current rate, and the weekday to the first available day") {
        runTest {
            val rhythmRepo =
                CountingRhythmRepository(WeeklyRhythm(tuesday = RhythmKind.DOMICILE, thursday = RhythmKind.DOMICILE))
            val controller =
                SimulationController(rhythmRepo, ThrowingEntryRepository(), settingsStore, 2026, clock, this)
            advanceUntilIdle()

            // Monday is the first weekday that is not already a home day (only Tuesday/Thursday are Domicile).
            controller.state.value.inputs.extraWeekday shouldBe DayOfWeek.MONDAY
            controller.state.value.inputs.targetRate shouldBe "100"
            controller.state.value.canAdopt shouldBe true
        }
    }
})
