package ch.monreleve.app.aujourdhui

import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.calendar.weekdayCells
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-HOME sections C/E/F (R328). THE ONE CONDITION: the home's « Ce mois » counts and the calendar's
// month tiles come from the SAME function, and « À traiter »'s unrecorded-days count and the calendar's
// « Non renseigné » come from the SAME function - never two calculations that can drift (FW12's defect).
// These tests prove AGREEMENT: the controller's read-only projections equal CalendarModel's own output for
// identical inputs, so a change to one that forgot the other would fail here. ADDITIVE (R328): this is a
// new file; AujourdhuiControllerTest is not touched, and every non-ui behaviour test passes unchanged.
//
// D16 is intact: these are READ-ONLY projections of days the app already holds - nothing here records or
// sends anything (the sole writer stays record()/recordDetected(), unchanged).

private const val TAX_YEAR = 2026

// The same Settings the store hands the controller, so the independent CalendarModel calls below are given
// identical inputs - the whole point of an agreement test.
private fun settings(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

private fun storeOf(): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = settings()

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

@OptIn(ExperimentalCoroutinesApi::class)
class AujourdhuiSectionsTest : FunSpec({
    // 10:00 UTC is 12:00 in Paris in June - the same calendar day, so today is unambiguous.
    val clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))
    val today = "2026-06-15"

    // One recorded day of each kind, plus an absence, and several past working days left unrecorded.
    suspend fun seed(repo: LocalEntryRepository) {
        repo.record(RecordCommand(dayDate = "2026-06-01", kind = EntryKind.CH))
        repo.record(RecordCommand(dayDate = "2026-06-02", kind = EntryKind.HOME))
        repo.record(RecordCommand(dayDate = "2026-06-03", kind = EntryKind.MISSION_FR))
        repo.record(RecordCommand(dayDate = "2026-06-04", kind = EntryKind.ABSENT, absenceReason = AbsenceReason.CONGE))
        // 2026-06-05, 06-08, 06-09, ... before today stay unrecorded -> « Non renseigné » / « À traiter ».
    }

    test("Ce mois agrees with the calendar's month tiles - one way of counting (R328)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            seed(repo)
            // The SAME list the controller observes (repository.observeAll's one emission).
            val entries = repo.observeAll().first()
            val controller = AujourdhuiController(repo, storeOf(), TAX_YEAR, clock, this)
            advanceUntilIdle()

            val month = controller.state.value.month
            month.shouldNotBeNull()
            // The SAME MonthSummary the calendar computes for June, field for field (not a second count).
            month shouldBe buildMonthView(entries, settings(), TAX_YEAR, today, 6).summary
            // And the four tiles read as recorded: one of each working kind, one absence.
            month.suisse shouldBe 1.0
            month.domicile shouldBe 1.0
            month.mission shouldBe 1.0
            month.absent shouldBe 1.0
        }
    }

    test("A traiter's unrecorded count agrees with the calendar's Non renseigne - one way of counting (R328)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            seed(repo)
            val entries = repo.observeAll().first()
            val controller = AujourdhuiController(repo, storeOf(), TAX_YEAR, clock, this)
            advanceUntilIdle()

            val attend = controller.state.value.attend
            attend.shouldNotBeNull()
            val nonRenseigne = buildMonthView(entries, settings(), TAX_YEAR, today, 6).summary.nonRenseigne.toInt()
            attend.unrecordedThisMonth shouldBe nonRenseigne
            // There ARE past working days left unrecorded, so the section is present with a positive count.
            (attend.unrecordedThisMonth > 0) shouldBe true
        }
    }

    test("Cette semaine is five cells and agrees with CalendarModel's weekdayCells (R328)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, clock)
            seed(repo)
            val entries = repo.observeAll().first()
            val controller = AujourdhuiController(repo, storeOf(), TAX_YEAR, clock, this)
            advanceUntilIdle()

            val week = controller.state.value.week
            week shouldHaveSize 5
            week shouldBe weekdayCells(entries, settings(), TAX_YEAR, today)
        }
    }

    test("A traiter is absent when there is nothing to attend to - never an empty box (R328)") {
        runTest {
            // The first of the month, nothing recorded: no past working days before today, nothing pending.
            val startClock = Clock.fixed(Instant.parse("2026-06-01T10:00:00Z"), ZoneId.of("Europe/Paris"))
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, startClock)
            val controller = AujourdhuiController(repo, storeOf(), TAX_YEAR, startClock, this)
            advanceUntilIdle()

            controller.state.value.attend shouldBe null
        }
    }
})
