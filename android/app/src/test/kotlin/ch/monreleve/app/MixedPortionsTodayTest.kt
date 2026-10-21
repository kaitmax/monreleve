package ch.monreleve.app

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calendar.buildMonthView
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
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

// AN-CALENDAR (R476). WHAT HAPPENS TODAY WHEN A DAY HOLDS A FULL ROW BESIDE ITS TWO HALVES - investigated before
// anything changes, and pinned so the answer to R478 is a deliberate change rather than a discovery.
//
// HOW IT ARISES. A person records a day whole, switches Parametres to half-days, and Aujourd'hui (until R477) asks
// for that day again as morning and afternoon; answering adds AM and PM rows beside the FULL one (REPORT-KMP-4
// NOTICED 3). The calendar sheet in half-day mode did the same: it showed the halves of a whole day as empty.
//
// THESE TESTS ARE A TRIPWIRE, NOT A SPECIFICATION. Every expected figure below is the double count as it stands; the
// operator's answer to R478 decides what it should be, and whichever option is chosen turns these red on purpose.
// The server's side of the same question is read from its source and driven live on the local stack
// (REPORT-AN-CALENDAR, ITEM 3) - this file is the device's half.

private val JUNE_15: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private const val DAY = "2026-06-10"

private fun settings(granularity: String) = Settings("GE", 100, "SIMPLIFIED240", null, granularity, null)

/** A whole day of telework, then the same day again as two halves of telework - the NOTICED 3 sequence. */
private suspend fun wholeThenHalves(): List<EntryEntity> {
    val dao = FakeEntryDao()
    val repo = LocalEntryRepository(dao, JUNE_15)
    repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.FULL))
    repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.AM))
    repo.record(RecordCommand(dayDate = DAY, kind = EntryKind.HOME, portion = Portion.PM))
    return dao.all()
}

class MixedPortionsTodayTest : FunSpec({
    test("R476 TODAY the device keeps all three rows: its key is (account, day, PORTION), so nothing replaces FULL") {
        runTest {
            // EntryEntity: @Entity(primaryKeys = ["accountTag", "dayDate", "portion"]); FakeEntryDao keys the same way.
            wholeThenHalves().map { it.portion } shouldBe listOf(Portion.FULL, Portion.AM, Portion.PM)
        }
    }

    test("R476 TODAY the Kotlin engine's count takes the one day as TWO days of telework") {
        runTest {
            val rows = wholeThenHalves().map { it.toAggregatable() }

            countDays(rows).teleworkDays shouldBe 2.0
            val input = toTeleworkInput(settings("HALF_DAY").toAggregatableUser(), rows, 2026)
            input.teleworkDays shouldBe 2.0
            // 2 / 240 truncated, where the one day actually lived is 1 / 240 = 0.41.
            (calculateTelework(input) as? CalcResult.Ok)?.value?.declarableRate shouldBe 0.83
        }
    }

    test("R476 TODAY the calendar's month tiles count it twice, and its cell shows the FULL row's kind") {
        runTest {
            val view = buildMonthView(wholeThenHalves(), settings("HALF_DAY"), 2026, "2026-06-15", 6)

            view.summary.domicile shouldBe 2.0
            // Portion's order is FULL, AM, PM, so the cell reads the FULL row first.
            view.days.first { it.isoDate == DAY }.kind shouldBe DayKind.DOMICILE
        }
    }
})
