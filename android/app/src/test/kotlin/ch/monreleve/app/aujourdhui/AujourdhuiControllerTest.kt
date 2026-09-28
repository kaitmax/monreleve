package ch.monreleve.app.aujourdhui

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.onboarding.GranularityChoice
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

// AN5b increment 3. The recording controller (SPEC 11.2). The write path is the real
// LocalEntryRepository over a FakeEntryDao, so D16 is exercised as it ships: a tap and only a tap
// writes a day. FakeEntryDao.observeAll() is a one-shot flow (Room's is hot), so the observe->state
// mapping is tested by seeding a day BEFORE the controller, and the write by reading the DAO after.

private fun storeWith(granularity: String): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, granularity, null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

@OptIn(ExperimentalCoroutinesApi::class)
class AujourdhuiControllerTest : FunSpec({
    // 10:00 UTC is 12:00 in Paris in June - the same calendar day, so today is unambiguous.
    val clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
    val today = "2026-06-15"

    test("a tap records today's kind through the repository - the only writer (D16)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            val controller = AujourdhuiController(repo, storeWith("DAY"), clock, this)
            // Screen vocabulary in; wire vocabulary out (R202): SUISSE -> CH.
            controller.record(RecordedKind.SUISSE, Slot.FULL)
            advanceUntilIdle()
            dao.byDayPortion(today, Portion.FULL)?.kind shouldBe EntryKind.CH
        }
    }

    test("an absence records with its reason, on today's Paris day") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            val controller = AujourdhuiController(repo, storeWith("DAY"), clock, this)
            controller.record(RecordedKind.ABSENCE, Slot.FULL, AbsenceChoice.CONGE)
            advanceUntilIdle()
            val row = dao.byDayPortion(today, Portion.FULL)
            row?.kind shouldBe EntryKind.ABSENT
            row?.absenceReason shouldBe AbsenceReason.CONGE
        }
    }

    test("a morning half-day records as the AM portion") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            val controller = AujourdhuiController(repo, storeWith("HALF_DAY"), clock, this)
            controller.record(RecordedKind.DOMICILE, Slot.MORNING)
            advanceUntilIdle()
            dao.byDayPortion(today, Portion.AM)?.kind shouldBe EntryKind.HOME
        }
    }

    test("the screen state shows a day already recorded, pending until sync") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            repo.record(RecordCommand(dayDate = today, kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY"), clock, this)
            advanceUntilIdle()
            // Wire vocabulary out of Room, screen vocabulary into the state (R202): HOME -> DOMICILE.
            controller.state.value.fullDay?.kind shouldBe RecordedKind.DOMICILE
            controller.state.value.fullDay?.pending shouldBe true
        }
    }

    test("granularity comes from the cached settings (half-day shows two slots)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            val controller = AujourdhuiController(repo, storeWith("HALF_DAY"), clock, this)
            controller.state.value.granularity shouldBe GranularityChoice.HALF_DAY
        }
    }
})
