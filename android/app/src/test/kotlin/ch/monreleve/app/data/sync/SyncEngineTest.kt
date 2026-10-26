package ch.monreleve.app.data.sync

import ch.monreleve.app.account.UNOWNED_ACCOUNT
import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MemoryDossierCache
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

    // R559: every drain in this file marks through this cache, so a test can read which years it marked.
    private val cache = MemoryDossierCache()

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
        val entity = pendingEntity(mutId, day)
        // AN-FIX F4 / R303: the fake is keyed on the whole primary key; these single-account tests use
        // the default UNOWNED tag, so (tag, day, portion) is the key.
        rows[Triple(entity.accountTag, entity.dayDate, entity.portion)] = entity
    }

    // These single-account tests seed one FULL row per day, so matching on the day alone is unambiguous.
    private fun FakeEntryDao.row(day: String): EntryEntity = rows.values.first { it.dayDate == day }

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

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

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

            SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

            assertEquals(SyncState.SYNCED, dao.row("2027-06-18").syncState)
        }

    @Test
    fun aClientDefectIsMarkedFailedAndNotRetried() =
        runTest {
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            val poster = FakePoster(listOf(PostOutcome.Ok(status = 400, body = """{"code":"invalid_payload"}""")))

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

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

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

            assertEquals(SyncOutcome.Settled(written = 1, defects = 1), outcome)
            assertEquals(SyncState.SYNCED, dao.row("2027-06-18").syncState)
            assertEquals(SyncState.FAILED, dao.row("2027-06-19").syncState)
            // The batch POST plus one isolation POST per item: the refused payload was sent exactly twice.
            assertEquals(3, poster.bodies.size)
            // And never again: both rows have left pending(), so a second drain sends nothing.
            assertTrue("nothing left to retry", dao.pending().isEmpty())
            SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()
            assertEquals("the refused payload is never re-sent", 3, poster.bodies.size)
        }

    @Test
    fun aGranularityConflictInABatchOfThreeLandsTheTwoValidDaysAndHoldsTheConflictingOne() =
        runTest {
            // R589 (the operator, 2026-10-25, on FW-GRANULARITY's decision 1). The server refuses the WHOLE
            // batch with 400 granularity_conflict when one day in it would sit FULL beside AM/PM (docs/api-v1.md
            // section 6.1), and refuses that day again when it is sent alone. One conflicting day between two
            // valid ones: the two valid rows end SYNCED, the conflicting one FAILED, its payload sent exactly
            // twice (the batch, then alone) and never again. FW-DOSSIER-EMPTY-3 proves the server half.
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2027-06-18") // valid
                    seed("mut-2", "2027-06-19") // the conflicting day
                    seed("mut-3", "2027-06-21") // valid
                }
            val conflict =
                PostOutcome.Ok(
                    status = 400,
                    body = """{"status":"error","code":"granularity_conflict","message":"refused"}""",
                )
            val first = serverRow("srv-1", "mut-1", "2027-06-18", "2027-06-18T10:00:05.000Z")
            val third = serverRow("srv-3", "mut-3", "2027-06-21", "2027-06-21T10:00:05.000Z")
            // The batch of three (refused whole), then each alone in insertion order: valid, refused, valid.
            val poster =
                FakePoster(listOf(conflict, okBody(1, 0, listOf(first)), conflict, okBody(1, 0, listOf(third))))

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

            assertEquals(SyncOutcome.Settled(written = 2, defects = 1), outcome)
            assertEquals(SyncState.SYNCED, dao.row("2027-06-18").syncState)
            assertEquals(SyncState.FAILED, dao.row("2027-06-19").syncState)
            assertEquals(SyncState.SYNCED, dao.row("2027-06-21").syncState)
            // One batch POST plus one isolation POST per item.
            assertEquals(4, poster.bodies.size)
            assertEquals("the conflicting payload is sent exactly twice", 2, poster.bodies.count { "mut-2" in it })
            // And never again: a second drain finds nothing pending and sends nothing.
            assertTrue("nothing left to retry", dao.pending().isEmpty())
            SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()
            assertEquals("no payload is re-sent", 4, poster.bodies.size)
            assertEquals("the conflicting payload is never re-sent", 2, poster.bodies.count { "mut-2" in it })
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

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

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

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

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

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

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

            SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache, batchLimit = 2).sync()

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

            val outcome = SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

            assertEquals(SyncOutcome.Settled(written = 0, defects = 0), outcome)
            val row = dao.row("2027-06-18")
            assertEquals("the newer edit survives", "mut-2", row.clientMutationId)
            assertEquals(SyncState.PENDING, row.syncState)
        }

    // ---------------------------------------------------------------------------------------------------------
    // AN-RELEVE-FRESH (R559): A SENT DAY MAKES THE CACHE STALE. A batch the server accepted marks the cached
    // releve stale for every year it touched; a drain that sends nothing marks nothing.
    // ---------------------------------------------------------------------------------------------------------

    @Test
    fun anAcceptedBatchMarksEveryYearItTouchedStale() =
        runTest {
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2026-12-31")
                    seed("mut-2", "2027-01-04")
                }
            val rows =
                listOf(
                    serverRow("srv-1", "mut-1", "2026-12-31", "2027-01-04T10:00:05.000Z"),
                    serverRow("srv-2", "mut-2", "2027-01-04", "2027-01-04T10:00:05.000Z"),
                )
            val poster = FakePoster(listOf(okBody(2, 0, rows)))

            SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

            assertEquals(setOf(2026, 2027), cache.marked.toSet())
            assertTrue(cache.isStale(2026))
            assertTrue(cache.isStale(2027))
            assertTrue("a year the batch did not touch is left alone", !cache.isStale(2025))
        }

    @Test
    fun aDrainThatSendsNothingMarksNothing() =
        runTest {
            // Nothing pending: no POST, no mark.
            SyncEngine(FakeEntryDao(), FakePoster(emptyList()), UNOWNED_ACCOUNT, cache).sync()
            // A transport fault: the day stays PENDING and was not sent.
            val offline = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            SyncEngine(offline, FakePoster(listOf(PostOutcome.NetworkError)), UNOWNED_ACCOUNT, cache).sync()
            // A refusal: the server wrote nothing (R198), so its record did not change.
            val refused = FakeEntryDao().apply { seed("mut-2", "2027-06-19") }
            val refusal = PostOutcome.Ok(status = 400, body = """{"code":"invalid_payload"}""")
            SyncEngine(refused, FakePoster(listOf(refusal)), UNOWNED_ACCOUNT, cache).sync()

            assertEquals(emptyList<Int>(), cache.marked)
            assertEquals(SyncState.PENDING, offline.row("2027-06-18").syncState)
            assertEquals(SyncState.FAILED, refused.row("2027-06-19").syncState)
        }

    @Test
    fun anIsolatedBatchMarksOnlyTheYearOfTheDayTheServerAccepted() =
        runTest {
            // R296 isolation: the batch is refused whole (nothing written), then each day alone - 2027's accepted,
            // 2026's refused again. Only 2027's record changed on the server.
            val dao =
                FakeEntryDao().apply {
                    seed("mut-1", "2027-01-04") // accepted alone
                    seed("mut-2", "2026-12-31") // refused alone
                }
            val refusal = PostOutcome.Ok(status = 400, body = """{"code":"granularity_conflict"}""")
            val good = serverRow("srv-1", "mut-1", "2027-01-04", "2027-01-04T10:00:05.000Z")
            val poster = FakePoster(listOf(refusal, okBody(1, 0, listOf(good)), refusal))

            SyncEngine(dao, poster, UNOWNED_ACCOUNT, cache).sync()

            assertEquals(listOf(2027), cache.marked)
            assertTrue(!cache.isStale(2026))
        }

    @Test
    fun theYearIsMarkedBeforeItsRowsLeavePending() =
        runTest {
            // The Releve reacts to the rows leaving pending (R560); it can only find the year stale then if the
            // mark came first. So at the moment of the mark, the sent row must still be PENDING.
            val dao = FakeEntryDao().apply { seed("mut-1", "2027-06-18") }
            val atMark = mutableListOf<SyncState>()
            val watching =
                object : ch.monreleve.app.data.local.DossierCache by cache {
                    override fun markStale(year: Int) {
                        atMark += dao.row("2027-06-18").syncState
                        cache.markStale(year)
                    }
                }
            val server = serverRow("srv-1", "mut-1", "2027-06-18", "2027-06-18T10:00:05.000Z")

            SyncEngine(dao, FakePoster(listOf(okBody(1, 0, listOf(server)))), UNOWNED_ACCOUNT, watching).sync()

            assertEquals(listOf(SyncState.PENDING), atMark)
            assertEquals(SyncState.SYNCED, dao.row("2027-06-18").syncState)
        }
}
