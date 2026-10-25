package ch.monreleve.app

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.design.DayKind
import ch.monreleve.app.dossier.countDays
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.toAggregatableUser
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CALENDAR (R476). WHAT HAPPENS WHEN A DAY HOLDS A FULL ROW BESIDE ITS TWO HALVES - investigated before anything
// changed, and pinned so the answer to R478 would be a deliberate change rather than a discovery.
//
// AN-GRANULARITY (R490-R494) IS THAT ANSWER, and it turned the first test here red on purpose, exactly as this header
// said it would. R490: a day keeps the granularity it was recorded in. R492: the repository REFUSES the write that
// would make a day mixed - so the phone can no longer produce one by recording FULL, then AM, then PM. That test now
// pins the refusal.
//
// THE COUNTS DO NOT CHANGE, AND THAT IS ALSO THE RULING. Option C ("halves outrank FULL in the count") was REJECTED:
// it changes the Geneva-gated engines and prints contradictory rows in the Releve. So a day ALREADY mixed - test data,
// or a day AN-PULL brought down from the server - is still counted as its rows say (twice), by both engines and the
// calendar's tiles. R494: such a day is shown, not repaired; FW-GRANULARITY's census decides what happens to it. The
// mixed day below is therefore SEEDED the way such a day reaches the phone - stored as the server holds it, through
// the DAO - and no longer recorded through the repository, which now refuses to make it.

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private const val DAY = "2026-06-10"

private fun settings(granularity: String) = Settings("GE", 100, "SIMPLIFIED240", null, granularity, null)

/** One stored, synced row of [DAY] - a day as the server holds it and a download stores it (R494). */
private fun storedRow(portion: Portion): EntryEntity =
    EntryEntity(
        clientMutationId = "stored-$portion",
        dayDate = DAY,
        portion = portion,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$portion",
        firstRecordedAt = "2026-06-10T18:00:00Z",
        lastModifiedAt = "2026-06-10T18:00:00Z",
        syncState = SyncState.SYNCED,
    )

/** A day ALREADY mixed - a whole day of telework beside the same day as two halves of telework (NOTICED 3's shape). */
private suspend fun alreadyMixed(): List<EntryEntity> {
    val dao = FakeEntryDao()
    listOf(Portion.FULL, Portion.AM, Portion.PM).forEach { dao.upsert(storedRow(it)) }
    return dao.all()
}

class MixedPortionsTodayTest : FunSpec({
    test("R492 the phone can no longer MAKE the day: after FULL, the repository refuses AM and PM and writes nothing") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, JUNE_15)
            repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.FULL))

            repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.AM)) shouldBe
                RecordResult.MixedGranularityRefused(DAY, Portion.AM, listOf(Portion.FULL))
            repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.PM)) shouldBe
                RecordResult.MixedGranularityRefused(DAY, Portion.PM, listOf(Portion.FULL))
            // AN-CALENDAR's R476 read [FULL, AM, PM] here.
            dao.all().map { it.portion } shouldBe listOf(Portion.FULL)
        }
    }

    test("R494 a day ALREADY mixed is stored as it came - nothing on the phone replaces or deletes its rows") {
        runTest {
            alreadyMixed().map { it.portion } shouldBe listOf(Portion.FULL, Portion.AM, Portion.PM)
        }
    }

    test("R476 / R490 (option C rejected) the Kotlin engine still takes an already-mixed day as TWO days of telework") {
        runTest {
            val rows = alreadyMixed().map { it.toAggregatable() }

            countDays(rows).teleworkDays shouldBe 2.0
            val input = toTeleworkInput(settings("HALF_DAY").toAggregatableUser(), rows, 2026)
            input.teleworkDays shouldBe 2.0
            // 2 / 240 truncated, where the one day actually lived is 1 / 240 = 0.41.
            (calculateTelework(input) as? CalcResult.Ok)?.value?.declarableRate shouldBe 0.83
        }
    }

    test("R476 / R494 the calendar's month tiles still count it twice, and its cell shows the FULL row's kind") {
        runTest {
            val view = buildMonthView(alreadyMixed(), settings("HALF_DAY"), 2026, "2026-06-15", 6)

            view.summary.domicile shouldBe 2.0
            // Portion's order is FULL, AM, PM, so the cell reads the FULL row first.
            view.days.first { it.isoDate == DAY }.kind shouldBe DayKind.DOMICILE
        }
    }
})
