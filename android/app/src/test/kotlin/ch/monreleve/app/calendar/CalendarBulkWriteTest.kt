package ch.monreleve.app.calendar

import ch.monreleve.app.aujourdhui.AbsenceChoice
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.data.local.AbsenceReason
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.deviceClaimNow
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CAL2 (section 2 WHAT IS WRITTEN, C3/C4). The confirmation tap writes ONE mutation per day through the SAME
// repository single-day editing uses - each with its own clientMutationId, the account's tag (R303) and the
// confirmation tap's clientClaimedAt (R275), nothing saying « bulk ». Annuler writes nothing (C4, D16).

private const val BULK_TAX_YEAR = 2026
private const val ACCOUNT = "acct-bulk"

private fun bulkStore(): SettingsStore =
    object : SettingsStore {
        override fun load(): Settings = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

        override fun save(settings: Settings) = Unit

        override fun clear() = Unit
    }

@OptIn(ExperimentalCoroutinesApi::class)
class CalendarBulkWriteTest : FunSpec({
    val june15 = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

    test("Confirm writes one mutation per selected day, each its own id, all tagged with the account (C3)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, june15, currentAccount = { ACCOUNT })
            var syncs = 0
            val c =
                CalendarController(repo, bulkStore(), BULK_TAX_YEAR, june15, this, requestSync = { syncs += 1 })
            advanceUntilIdle()

            c.startSelection()
            c.tapDay("2026-06-01")
            c.tapDay("2026-06-05") // a work week, Monday to Friday
            c.chooseBulk(RecordedKind.ABSENCE, AbsenceChoice.FERIE)
            c.confirmBulk()
            advanceUntilIdle()

            val rows = dao.all()
            rows.map { it.dayDate } shouldContainExactly
                listOf("2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05")
            // One mutation PER DAY: five rows, five DISTINCT ids - the same records as entering them one by one.
            rows.map { it.clientMutationId }.toSet().size shouldBe 5
            // Whole days (section 2: splitting a day stays in the single-day editor).
            rows.all { it.portion == Portion.FULL } shouldBe true
            rows.all { it.kind == EntryKind.ABSENT } shouldBe true
            rows.all { it.absenceReason == AbsenceReason.FERIE } shouldBe true
            // Each tagged with the account (R303), and clientClaimedAt = the confirmation tap (R275).
            rows.all { it.accountTag == ACCOUNT } shouldBe true
            rows.all { it.clientClaimedAt == deviceClaimNow(june15) } shouldBe true
            rows.all { it.syncState == SyncState.PENDING } shouldBe true
            // Nothing in the record says « bulk »: provenance is the ordinary MANUAL default.
            syncs shouldBe 1
            // The selection ends and the confirmation closes.
            c.state.value.selection.active shouldBe false
            c.state.value.bulkConfirmation shouldBe null
        }
    }

    test("Annuler on the confirmation writes nothing (C4, D16)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, june15, currentAccount = { ACCOUNT })
            val c = CalendarController(repo, bulkStore(), BULK_TAX_YEAR, june15, this)
            advanceUntilIdle()

            c.startSelection()
            c.tapDay("2026-06-03")
            c.chooseBulk(RecordedKind.SUISSE, null)
            c.cancelBulkConfirmation()
            advanceUntilIdle()

            dao.all() shouldBe emptyList()
            // The selection is intact beneath the dismissed confirmation.
            c.state.value.selection.days shouldBe setOf("2026-06-03")
            c.state.value.bulkConfirmation shouldBe null
        }
    }

    test("a bulk over days that already hold a value re-records each - the confirmation warned of it (C4)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, june15, currentAccount = { ACCOUNT })
            repo.record(RecordCommand(dayDate = "2026-06-02", kind = EntryKind.HOME))
            val c = CalendarController(repo, bulkStore(), BULK_TAX_YEAR, june15, this)
            advanceUntilIdle()

            c.startSelection()
            c.tapDay("2026-06-02")
            c.tapDay("2026-06-03")
            c.chooseBulk(RecordedKind.SUISSE, null)
            c.state.value.bulkConfirmation?.alreadyRecordedCount shouldBe 1
            c.confirmBulk()
            advanceUntilIdle()

            // The pre-existing day is coalesced (one row per day, now CH), the new day added - two rows total.
            dao.all().map { it.dayDate } shouldContainExactly listOf("2026-06-02", "2026-06-03")
            dao.all().all { it.kind == EntryKind.CH } shouldBe true
        }
    }
})
