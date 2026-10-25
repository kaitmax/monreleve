package ch.monreleve.app.data.sync

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * AN5 increment 4. THE EVIDENCE docs/api-v1.md section 6.4 was parked waiting for: what
 * does THIS client's queue actually emit?
 *
 * The answer, structural rather than a matter of timing: the local store keys entries on
 * (dayDate, portion), and record() coalesces onto that key (EntryEntity's PK, @Upsert
 * REPLACE). So the queue holds AT MOST ONE pending mutation per (dayDate, portion) - a
 * re-record replaces the pending one in place rather than appending a second. Therefore a
 * single device:
 *   - can never put two mutations for one day-and-portion into a batch, so the server's
 *     two-items-for-one-day refusal (the reserved `conflict`, 409) can never fire against
 *     it;
 *   - can never emit two out-of-order mutations for one day, because there is only ever
 *     one to emit.
 *
 * The section-6.4 reversion (a late genuinely-new mutation winning by server receipt over
 * a newer one) therefore requires TWO devices with two independent queues - which no
 * single-device coalescing can prevent. That is the finding; the operator rules on
 * receipt-order vs clientClaimedAt (a frozen stated rule, R156).
 */
class OrderingEvidenceTest {
    private val clock = Clock.fixed(Instant.parse("2027-06-18T10:00:00Z"), ZoneId.of("Europe/Paris"))

    private fun repo(dao: FakeEntryDao): LocalEntryRepository {
        var counter = 0
        return LocalEntryRepository(dao, clock, newMutationId = { "mut-${counter++}" })
    }

    @Test
    fun reRecordingADayCoalescesToOnePendingMutation() =
        runTest {
            val dao = FakeEntryDao()
            val repo = repo(dao)

            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.CH))
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME))
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.MISSION_FR))

            val pending = dao.pending()
            assertEquals("three records of one day are one pending mutation", 1, pending.size)
            assertEquals("the latest value wins locally", EntryKind.MISSION_FR, pending.single().kind)
        }

    @Test
    fun aBatchNeverCarriesTwoItemsForOneDayAndPortion() =
        runTest {
            val dao = FakeEntryDao()
            val repo = repo(dao)

            // Re-records of the same key, plus a distinct portion and a distinct day.
            // AN-GRANULARITY (R492): the distinct portion of a day is its OTHER HALF. This used to record the day
            // FULL and then its morning - FULL beside AM, which the repository now refuses (a day keeps the
            // granularity it was recorded in), so the same three keys are made from a day held in halves.
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.CH, portion = Portion.AM))
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.HOME, portion = Portion.AM))
            repo.record(RecordCommand(dayDate = "2027-06-18", kind = EntryKind.CH, portion = Portion.PM))
            repo.record(RecordCommand(dayDate = "2027-06-19", kind = EntryKind.HOME))

            val entries = JSONObject(entriesRequestBody(dao.pending())).getJSONArray("entries")
            val keys =
                (0 until entries.length()).map {
                    val item = entries.getJSONObject(it)
                    item.getString("dayDate") to item.getString("portion")
                }

            assertEquals("three distinct (day, portion) keys", 3, keys.size)
            assertEquals("no (day, portion) key repeats in a batch", keys.size, keys.toSet().size)
        }
}
