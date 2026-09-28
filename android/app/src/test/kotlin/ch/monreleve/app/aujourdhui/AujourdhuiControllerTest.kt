package ch.monreleve.app.aujourdhui

import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.dossier.LatenessForecast
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
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

private const val TAX_YEAR = 2026

private fun storeWith(
    granularity: String,
    activityStartDate: String? = null,
): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, granularity, activityStartDate)

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
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
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
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
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
            val controller = AujourdhuiController(repo, storeWith("HALF_DAY"), TAX_YEAR, clock, this)
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
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
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
            val controller = AujourdhuiController(repo, storeWith("HALF_DAY"), TAX_YEAR, clock, this)
            controller.state.value.granularity shouldBe GranularityChoice.HALF_DAY
        }
    }

    test("an empty year shows no rate, not 0 % (AC3): state.year is null") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            controller.state.value.year shouldBe null
        }
    }

    test("the year is computed on the device from the recorded days, unsynced days counted (AC2/AC3)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            // Seeded before the controller so the one-shot observe picks them up; both stay PENDING.
            repo.record(RecordCommand(dayDate = "2026-06-01", kind = EntryKind.HOME))
            repo.record(RecordCommand(dayDate = "2026-06-02", kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            val year = controller.state.value.year
            year.shouldNotBeNull()
            year.unsyncedDays shouldBe 2
        }
    }

    test("a mid-year start marks the year partial, keyed on the fraction not the date (FW26)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            repo.record(RecordCommand(dayDate = "2026-07-06", kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY", "2026-07-01"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            controller.state.value.year?.partialYear shouldBe true
        }
    }

    // R286: the pending line escalates with the OLDEST unsynced day. today is 2026-06-15.
    test("a recently recorded pending day is not yet flagged (NONE)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            repo.record(RecordCommand(dayDate = "2026-06-14", kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            controller.state.value.year?.pendingLateness shouldBe PendingLateness.NONE
        }
    }

    test("a pending day nearing the threshold escalates to APPROACHING before it is crossed") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            // 2026-06-09 is six days before today: one day short of the seven-day threshold.
            repo.record(RecordCommand(dayDate = "2026-06-09", kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            controller.state.value.year?.pendingLateness shouldBe PendingLateness.APPROACHING
        }
    }

    test("a pending day past the threshold is OVERDUE, driven by the OLDEST pending day") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            // 2026-06-06 is nine days before today; a recent day does not lower the escalation.
            repo.record(RecordCommand(dayDate = "2026-06-06", kind = EntryKind.HOME))
            repo.record(RecordCommand(dayDate = "2026-06-14", kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            controller.state.value.year?.pendingLateness shouldBe PendingLateness.OVERDUE
        }
    }

    // SPEC 13.2: "Entries are written to Room first AND enqueued as pending mutations; WorkManager
    // replays them on connectivity." Recording must enqueue the drain, or a day recorded through the
    // real screen never reaches the server (DevRecorderActivity, the only other trigger, is adb-only).
    test("recording a day requests a sync so the offline queue drains (SPEC 13.2)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            var syncRequests = 0
            val controller =
                AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this, requestSync = { syncRequests += 1 })
            controller.record(RecordedKind.SUISSE, Slot.FULL)
            advanceUntilIdle()
            syncRequests shouldBe 1
        }
    }

    test("the pending escalation carries the shared threshold, not a typed number (R206)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            repo.record(RecordCommand(dayDate = "2026-06-06", kind = EntryKind.HOME))
            val controller = AujourdhuiController(repo, storeWith("DAY"), TAX_YEAR, clock, this)
            advanceUntilIdle()
            controller.state.value.year?.lateThresholdDays shouldBe LatenessForecast.BACKFILL_DAYS
        }
    }
})
