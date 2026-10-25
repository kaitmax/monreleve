package ch.monreleve.app

import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CALENDAR (R477). IN HALF-DAY MODE, A DAY HELD WHOLE IS SHOWN ANSWERED - and showing it writes nothing.
//
// WHAT THIS EXISTS TO STOP, stated as the thing that happened. A day recorded WHOLE before the switch to half-days
// was asked for again on Aujourd'hui as morning and afternoon (REPORT-KMP-4 NOTICED 3), and the calendar sheet showed
// its halves as unanswered. Answering would add AM and PM rows beside the FULL one, which both engines then count as
// a second day (R476, MixedPortionsTodayTest). The rule: a half with no row of its own, on a day held as FULL, shows
// the FULL day's kind; no row is written to show it.
//
// WHAT THIS DOES NOT DECIDE. Changing such a half is R478's question, put to the operator: until it is answered the
// sheet and Aujourd'hui write only the half that changed (R473), beside the FULL row - the shape main produced already.

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

/** Today, in Paris, under [JUNE_15]. */
private const val TODAY = "2026-06-15"

private object HalfDays : SettingsStore {
    override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "HALF_DAY", null)

    override fun save(settings: Settings) = Unit

    override fun clear() = Unit
}

private class Writes(private val inner: EntryRepository) : EntryRepository {
    val made = mutableListOf<RecordCommand>()

    override suspend fun record(command: RecordCommand): RecordResult = inner.record(command).also { made += command }

    override fun observePending(): Flow<List<EntryEntity>> = inner.observePending()

    override fun observeAll(): Flow<List<EntryEntity>> = inner.observeAll()
}

/** A repository already holding [rows] - written BEFORE anything observes it, so none of them is counted. */
private suspend fun holding(vararg rows: RecordCommand): Writes {
    val inner = LocalEntryRepository(FakeEntryDao(), JUNE_15)
    rows.forEach { inner.record(it) }
    return Writes(inner)
}

private fun whole(
    day: String,
    kind: EntryKind,
) = RecordCommand(dayDate = day, kind = kind, portion = Portion.FULL)

@OptIn(ExperimentalCoroutinesApi::class)
class WholeDayInHalfDayModeTest : FunSpec({
    test("R477 Aujourd'hui shows a day held whole as answered in half-day mode - both halves its kind, no write") {
        runTest {
            val repo = holding(whole(TODAY, EntryKind.HOME))
            val controller = AujourdhuiController(repo, HalfDays, 2026, JUNE_15, this)
            advanceUntilIdle()

            val state = controller.state.value
            state.granularity shouldBe GranularityChoice.HALF_DAY
            state.morning.shouldNotBeNull().kind shouldBe RecordedKind.DOMICILE
            state.afternoon.shouldNotBeNull().kind shouldBe RecordedKind.DOMICILE
            repo.made.shouldBeEmpty()
        }
    }

    test("R477 a half with a row of its own shows that row; only the half without one shows the whole day") {
        runTest {
            // AN-GRANULARITY (R492): the repository no longer MAKES this day (AM beside FULL is refused), so it is
            // stored the way such a day reaches the phone - a row written straight to the store.
            val dao = FakeEntryDao()
            val inner = LocalEntryRepository(dao, JUNE_15)
            inner.record(RecordCommand(TODAY, EntryKind.CH, Portion.AM))
            val morning = dao.all().single()
            dao.upsert(morning.copy(clientMutationId = "stored", portion = Portion.FULL, kind = EntryKind.HOME))
            val repo = Writes(inner)
            val controller = AujourdhuiController(repo, HalfDays, 2026, JUNE_15, this)
            advanceUntilIdle()

            controller.state.value.morning.shouldNotBeNull().kind shouldBe RecordedKind.SUISSE
            controller.state.value.afternoon.shouldNotBeNull().kind shouldBe RecordedKind.DOMICILE
        }
    }
})
