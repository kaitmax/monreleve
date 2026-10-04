package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.TallyEntity
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest

// R320 (the sampler's persistence step). recordCheck is what each WorkManager wake calls after a fix is classified
// and its coordinate discarded: it writes the fix's side into ONE of the day's four check slots, preserving the
// others. A MISSED window stays null, and a new day is a fresh row. No coordinate is read or stored here - only a
// Classification and the window index.

private class FakeTallyDao : TallyDao {
    val rows = mutableMapOf<String, TallyEntity>()

    override suspend fun upsert(tally: TallyEntity) {
        rows[tally.dayDate] = tally
    }

    override suspend fun byDay(dayDate: String): TallyEntity? = rows[dayDate]

    override suspend fun all(): List<TallyEntity> = rows.values.sortedBy { it.dayDate }

    override fun observeAll(): Flow<List<TallyEntity>> = flowOf(rows.values.sortedBy { it.dayDate })
}

class DetectionSamplerTest : FunSpec({
    val day = "2027-06-18"

    test("recordCheck fills one window slot and preserves the others across wakes") {
        runTest {
            val dao = FakeTallyDao()
            recordCheck(dao, day, 1, Classification.INSIDE, FixProvider.GPS)
            recordCheck(dao, day, 2, Classification.OUTSIDE, FixProvider.GPS)
            recordCheck(dao, day, 4, Classification.BUFFER, FixProvider.GPS)
            // window 3 was MISSED (no wake landed inside it with a fix)

            val row = dao.byDay(day)!!
            row.toDayChecks() shouldBe
                DayChecks(Classification.INSIDE, Classification.OUTSIDE, null, Classification.BUFFER)
        }
    }

    // AN-NEXT-2 / R324. recordCheck counts WHICH PROVIDER produced each check, as two integers on the row -
    // counts only, never a per-check label, a coordinate or an accuracy value (D18). The field test reads these to
    // see how often the NETWORK (wifi/cell) fallback decided a day.
    test("recordCheck counts each check's provider, and the counts sum to the checks taken (R324)") {
        runTest {
            val dao = FakeTallyDao()
            recordCheck(dao, day, 1, Classification.INSIDE, FixProvider.GPS)
            recordCheck(dao, day, 2, Classification.OUTSIDE, FixProvider.NETWORK)
            recordCheck(dao, day, 3, Classification.BUFFER, FixProvider.NETWORK)
            // window 4 MISSED

            val row = dao.byDay(day)!!
            row.gpsCheckCount shouldBe 1
            row.networkCheckCount shouldBe 2
            // The invariant: gps + network == the number of checks taken.
            (row.gpsCheckCount + row.networkCheckCount) shouldBe row.toDayChecks().taken().size
        }
    }

    test("re-recording a window does not double-count the provider (keeps the sum == taken invariant, R324)") {
        runTest {
            val dao = FakeTallyDao()
            recordCheck(dao, day, 1, Classification.INSIDE, FixProvider.GPS)
            // A second wake for the SAME window (the worker's hasCheck guard normally prevents this, but the
            // count must stay correct regardless): no new window is filled, so no count moves.
            recordCheck(dao, day, 1, Classification.OUTSIDE, FixProvider.NETWORK)
            val row = dao.byDay(day)!!
            row.gpsCheckCount shouldBe 1
            row.networkCheckCount shouldBe 0
            (row.gpsCheckCount + row.networkCheckCount) shouldBe row.toDayChecks().taken().size
        }
    }

    test("hasCheck reflects which windows already have a fix - the worker's idempotence guard") {
        runTest {
            val dao = FakeTallyDao()
            dao.byDay(day).hasCheck(1).shouldBeFalse() // absent row -> nothing recorded
            recordCheck(dao, day, 1, Classification.INSIDE, FixProvider.GPS)
            dao.byDay(day).hasCheck(1).shouldBeTrue()
            dao.byDay(day).hasCheck(2).shouldBeFalse()
        }
    }

    test("a new day is a fresh row, independent of the previous day's checks") {
        runTest {
            val dao = FakeTallyDao()
            recordCheck(dao, day, 1, Classification.INSIDE, FixProvider.GPS)
            val day2 = "2027-06-19"
            recordCheck(dao, day2, 1, Classification.OUTSIDE, FixProvider.NETWORK)
            dao.byDay(day2)!!.toDayChecks() shouldBe DayChecks(Classification.OUTSIDE, null, null, null)
            dao.byDay(day)!!.toDayChecks() shouldBe DayChecks(Classification.INSIDE, null, null, null)
            // Each day counts its own provider.
            dao.byDay(day2)!!.networkCheckCount shouldBe 1
            dao.byDay(day)!!.gpsCheckCount shouldBe 1
        }
    }

    test("an absent row reads as four missed checks") {
        runTest {
            val dao = FakeTallyDao()
            val missed = DayChecks(null, null, null, null)
            (dao.byDay(day)?.toDayChecks() ?: missed) shouldBe missed
        }
    }
})
