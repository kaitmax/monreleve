package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.TallyEntity
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest

// AN-AUTO increment 4 (the sampler's persistence step). recordFix is what each WorkManager wake calls after a
// (The 15-minute cadence constant lives in SyntheticTracks via trackPointInstant; no local time math is needed.)
// fix is classified and its coordinate discarded: it loads the day's aggregate tally and the coordinate-free
// cursor, folds the fix in (accumulateFix), and writes back the aggregate + cursor + the recomputed tier.
// Across wakes it must reconstruct exactly the tally a single in-memory day would, and a new day must start
// fresh (the cursor is per-day). No coordinate is read or stored here - only a Classification and a time.

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
    val windowStart = WORKING_WINDOW_START_MINUTE
    val windowEnd = WORKING_WINDOW_END_MINUTE

    suspend fun record(
        dao: TallyDao,
        cursor: SamplingCursorStore,
        side: Classification,
        minuteOfDay: Int,
    ) = recordFix(dao, cursor, day, windowStart, windowEnd, side, trackPointInstant(day, minuteOfDay))

    test("recordFix across wakes reconstructs the same tally an in-memory day would") {
        runTest {
            val dao = FakeTallyDao()
            val cursor = InMemorySamplingCursorStore()
            // A clear Swiss day: INSIDE every 15 minutes, 08:00-18:00.
            val minutes = (480..1080 step 15).toList()
            for (m in minutes) record(dao, cursor, Classification.INSIDE, m)

            val expectedFixes = minutes.map { ClassifiedFix(Classification.INSIDE, trackPointInstant(day, it)) }
            val batch = computeTally(expectedFixes)
            val stored = dao.byDay(day)!!
            stored.minutesSwitzerland shouldBe batch.minutesSwitzerland
            stored.minutesElsewhere shouldBe batch.minutesElsewhere
            stored.fixCount shouldBe batch.fixCount
            stored.bufferFixCount shouldBe batch.bufferFixCount
            // The tier is recomputed and stored (HIGH for a clear full Swiss day).
            stored.tier shouldBe Tier.HIGH.name
            stored.windowStartMinuteOfDay shouldBe windowStart
            stored.windowEndMinuteOfDay shouldBe windowEnd
        }
    }

    test("a new day starts a fresh tally and cursor (the cursor is per-day)") {
        runTest {
            val dao = FakeTallyDao()
            val cursor = InMemorySamplingCursorStore()
            record(dao, cursor, Classification.INSIDE, 480)
            record(dao, cursor, Classification.INSIDE, 495)

            // A fix on the NEXT day must not attribute a gap across the day boundary.
            val day2 = "2027-06-19"
            recordFix(dao, cursor, day2, windowStart, windowEnd, Classification.OUTSIDE, trackPointInstant(day2, 480))
            val stored2 = dao.byDay(day2)!!
            stored2.fixCount shouldBe 1
            stored2.minutesSwitzerland shouldBe 0
            stored2.minutesElsewhere shouldBe 0
        }
    }

    test("the cursor is coordinate-free and cleared on demand") {
        runTest {
            val cursor = InMemorySamplingCursorStore()
            cursor.save(day, FixCursor(Classification.INSIDE, 123L))
            cursor.load(day) shouldBe FixCursor(Classification.INSIDE, 123L)
            // A different day reads no cursor (fresh day).
            cursor.load("2027-06-19").shouldBeNull()
            cursor.clear()
            cursor.load(day).shouldBeNull()
        }
    }
})
