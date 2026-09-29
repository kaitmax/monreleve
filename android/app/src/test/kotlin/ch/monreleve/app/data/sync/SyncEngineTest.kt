package ch.monreleve.app.data.sync

import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN5 increment 3. The drain's contract: one round trip reconciling from the SERVER's
 * rows (R217); a client defect held FAILED and never retried (R198); a network fault
 * retryable with the rows left pending; the queue sent in batches of the server's limit;
 * a duplicate response still clearing pending (AC3's client half); and a concurrent edit
 * never clobbered by an in-flight batch.
 */
class SyncEngineTest {
    private class FakePoster(
        responses: List<PostOutcome>,
        private val onCall: suspend (String) -> Unit = {},
    ) : AuthenticatedPoster {
        private val queue = ArrayDeque(responses)
        val bodies = mutableListOf<String>()

        override suspend fun authenticatedPost(
            path: String,
            body: String,
        ): PostOutcome {
            bodies += body
            onCall(body)
            return queue.removeFirst()
        }
    }

    private fun claimed(day: String): String = "${day}T12:00:00.000+02:00"

    private fun pendingEntity(
        mutId: String,
        day: String,
    ): EntryEntity =
        EntryEntity(
            clientMutationId = mutId,
            dayDate = day,
            portion = Portion.FULL,
            kind = EntryKind.HOME,
            absenceReason = null,
            note = null,
            provenance = Provenance.MANUAL,
            detectedKind = null,
            detectedAt = null,
            clientClaimedAt = claimed(day),
            serverId = null,
            firstRecordedAt = null,
            lastModifiedAt = null,
            syncState = SyncState.PENDING,
        )

    private fun FakeEntryDao.seed(
        mutId: String,
        day: String,
    ) {
        rows[day to Portion.FULL] = pendingEntity(mutId, day)
    }

    private fun FakeEntryDao.row(day: String): EntryEntity = rows[day to Portion.FULL]!!

    private fun serverRow(
        id: String,
        mutId: String,
        day: String,
        firstRecordedAt: String,
    ): String =
        """
        {"id":"$id","clientMutationId":"$mutId","dayDate":"$day","portion":"FULL","kind":"HOME",
         "absenceReason":null,"note":null,"provenance":"MANUAL","detectedKind":null,"detectedAt":null,
         "clientClaimedAt":"${claimed(day)}","firstRecordedAt":"$firstRecordedAt","lastModifiedAt":null}
        """.trimIndent()

    private fun okBody(
        written: Int,
        duplicates: Int,
        rows: List<String>,
    ): PostOutcome {
        val entries = rows.joinToString(",")
        return PostOutcome.Ok(
            status = 200,
            body = """{"status":"ok","written":$written,"duplicates":$duplicates,"entries":[$entries]}""",
        )
    }

    @Test
    fun aDrainMarksRowsSyncedFromTheServerRow() =
        runTest {
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            val server = serverRow("srv-1", "mut-1", "2027-06-18", "2027-06-18T10:00:05.000Z")
            val poster = FakePoster(listOf(okBody(1, 0, listOf(server))))

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Settled(written = 1, defects = 0), outcome)
            val row = dao.row("2027-06-18")
            assertEquals(SyncState.SYNCED, row.syncState)
            assertEquals("srv-1", row.serverId)
            assertEquals("2027-06-18T10:00:05.000Z", row.firstRecordedAt)
        }

    @Test
    fun aDuplicateResponseStillClearsPending() =
        runTest {
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            // A re-sent mutation the server already had: written=0, duplicates=1, but the row
            // still comes back (R217, "written and duplicate alike") - the client clears it.
            val server = serverRow("srv-1", "mut-1", "2027-06-18", "2027-06-18T10:00:05.000Z")
            val poster = FakePoster(listOf(okBody(0, 1, listOf(server))))

            SyncEngine(dao, poster).sync()

            assertEquals(SyncState.SYNCED, dao.row("2027-06-18").syncState)
        }

    @Test
    fun aClientDefectIsMarkedFailedAndNotRetried() =
        runTest {
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            val poster = FakePoster(listOf(PostOutcome.Ok(status = 400, body = """{"code":"invalid_payload"}""")))

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Settled(written = 0, defects = 1), outcome)
            assertEquals(SyncState.FAILED, dao.row("2027-06-18").syncState)
            // Not retried: the one call happened, and a FAILED row leaves pending() so it is
            // never sent again (retrying a rejected payload can never succeed).
            assertEquals(1, poster.bodies.size)
            assertTrue("a FAILED row is out of the queue", dao.pending().isEmpty())
        }

    @Test
    fun aRejectedBatchIsIsolatedSoTheGoodItemsStillSync() =
        runTest {
            // R296: a 400 on a MULTI-item batch is retried item by item, ONCE. The good item syncs; the
            // refused one stays FAILED and named. Insertion order is the isolation order (FakeEntryDao).
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2027-06-18") // good
                    seed("mut-2", "2027-06-19") // the one the server refuses
                }
            val good = serverRow("srv-1", "mut-1", "2027-06-18", "2027-06-18T10:00:05.000Z")
            val refused = PostOutcome.Ok(status = 400, body = """{"code":"invalid_payload"}""")
            // The batch of two (refused), then mut-1 alone (accepted), then mut-2 alone (refused again).
            val poster = FakePoster(listOf(refused, okBody(1, 0, listOf(good)), refused))

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Settled(written = 1, defects = 1), outcome)
            assertEquals(SyncState.SYNCED, dao.row("2027-06-18").syncState)
            assertEquals(SyncState.FAILED, dao.row("2027-06-19").syncState)
            // The batch POST plus one isolation POST per item: the refused payload was sent exactly twice.
            assertEquals(3, poster.bodies.size)
            // And never again: both rows have left pending(), so a second drain sends nothing.
            assertTrue("nothing left to retry", dao.pending().isEmpty())
            SyncEngine(dao, poster).sync()
            assertEquals("the refused payload is never re-sent", 3, poster.bodies.size)
        }

    @Test
    fun anEntirelyBadBatchLeavesEveryItemFailed() =
        runTest {
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2027-06-18")
                    seed("mut-2", "2027-06-19")
                }
            val refused = PostOutcome.Ok(status = 400, body = """{"code":"invalid_payload"}""")
            // The batch of two, then each item alone - all refused.
            val poster = FakePoster(listOf(refused, refused, refused))

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Settled(written = 0, defects = 2), outcome)
            assertEquals(SyncState.FAILED, dao.row("2027-06-18").syncState)
            assertEquals(SyncState.FAILED, dao.row("2027-06-19").syncState)
            assertEquals(3, poster.bodies.size)
            assertTrue(dao.pending().isEmpty())
        }

    @Test
    fun aServerErrorIsNotIsolatedButRetried() =
        runTest {
            // A 500 is the SERVER's problem, not the payload's: NOT isolated, retried with backoff as
            // before. Isolating it would re-send perfectly good items one by one against a broken server.
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2027-06-18")
                    seed("mut-2", "2027-06-19")
                }
            val poster = FakePoster(listOf(PostOutcome.Ok(status = 500, body = "")))

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Retryable, outcome)
            // Only the single batch POST happened - no item-by-item isolation.
            assertEquals(1, poster.bodies.size)
            assertEquals(SyncState.PENDING, dao.row("2027-06-18").syncState)
            assertEquals(SyncState.PENDING, dao.row("2027-06-19").syncState)
        }

    @Test
    fun aNetworkFaultIsRetryableAndLeavesRowsPending() =
        runTest {
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            val poster = FakePoster(listOf(PostOutcome.NetworkError))

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Retryable, outcome)
            assertEquals(SyncState.PENDING, dao.row("2027-06-18").syncState)
        }

    @Test
    fun theQueueIsSentInBatchesOfTheLimit() =
        runTest {
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2027-06-18")
                    seed("mut-2", "2027-06-19")
                    seed("mut-3", "2027-06-20")
                }
            val poster = FakePoster(listOf(okBody(0, 0, emptyList()), okBody(0, 0, emptyList())))

            SyncEngine(dao, poster, batchLimit = 2).sync()

            assertEquals("three rows at a limit of two are two batches", 2, poster.bodies.size)
            assertEquals(2, JSONObject(poster.bodies[0]).getJSONArray("entries").length())
            assertEquals(1, JSONObject(poster.bodies[1]).getJSONArray("entries").length())
        }

    @Test
    fun aConcurrentEditIsNotClobbered() =
        runTest {
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            // While the batch (mut-1) is in flight, the user edits the day: a new mutation
            // (mut-2) replaces the row, PENDING again. The batch's older server row must not
            // overwrite it.
            val server = serverRow("srv-1", "mut-1", "2027-06-18", "2027-06-18T10:00:05.000Z")
            val poster =
                FakePoster(
                    responses = listOf(okBody(1, 0, listOf(server))),
                    onCall = { dao.seed("mut-2", "2027-06-18") },
                )

            val outcome = SyncEngine(dao, poster).sync()

            assertEquals(SyncOutcome.Settled(written = 0, defects = 0), outcome)
            val row = dao.row("2027-06-18")
            assertEquals("the newer edit survives", "mut-2", row.clientMutationId)
            assertEquals(SyncState.PENDING, row.syncState)
        }
}
