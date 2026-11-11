package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
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
import kotlinx.datetime.DayOfWeek
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-FORECAST (R340, R341). The controller boundary: computing a projection (reading the rhythm + the record
// and running the engine) writes to NO store; the only write the controller makes is persisting the rhythm on
// setDay (R341, a planning preference - not a day record, D16 untouched). The store-level proof that drives the
// real controller and reads Room back belongs to the on-device walkthrough; this is its JVM witness.

private class RecordingRhythmRepository(private val initial: WeeklyRhythm) : RhythmRepository {
    var saveCount = 0
        private set

    override fun observe(): Flow<WeeklyRhythm> = flowOf(initial)

    override suspend fun save(rhythm: WeeklyRhythm) {
        saveCount++
    }

    override suspend fun clear() = Unit
}

private class EmptyEntryRepository : EntryRepository {
    override suspend fun record(command: RecordCommand): RecordResult =
        throw UnsupportedOperationException("not used by the forecast controller test")

    override fun observePending(): Flow<List<EntryEntity>> = flowOf(emptyList())

    override fun observeAll(): Flow<List<EntryEntity>> = flowOf(emptyList())
}

@OptIn(ExperimentalCoroutinesApi::class)
class ForecastControllerTest : FunSpec({
    val clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
    val settingsStore =
        object : SettingsStore {
            override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

            override fun save(settings: Settings) = Unit

            override fun clear() = Unit
        }

    test("computing a projection writes nothing; only setDay persists the rhythm (R340/R341)") {
        runTest {
            val rhythmRepo =
                RecordingRhythmRepository(WeeklyRhythm(tuesday = RhythmKind.DOMICILE, thursday = RhythmKind.DOMICILE))
            val controller = ForecastController(rhythmRepo, EmptyEntryRepository(), settingsStore, 2026, clock, this)
            advanceUntilIdle()

            // The engine produced a projection (a set rhythm), and computing it wrote to NO store.
            controller.state.value.projection.shouldNotBeNull()
            rhythmRepo.saveCount shouldBe 0

            // Setting a weekday is the ONE write - the local rhythm (R341), not a day record.
            controller.setDay(DayOfWeek.MONDAY, RhythmChoice.DOMICILE)
            advanceUntilIdle()
            rhythmRepo.saveCount shouldBe 1
        }
    }

    test("an empty rhythm shows the invitation, not an empty projection") {
        runTest {
            val controller =
                ForecastController(
                    RecordingRhythmRepository(WeeklyRhythm()),
                    EmptyEntryRepository(),
                    settingsStore,
                    2026,
                    clock,
                    this,
                )
            advanceUntilIdle()
            controller.state.value.projection shouldBe null
        }
    }
})
