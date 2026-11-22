package ch.monreleve.app.data.sync

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-SHELL-3 R1371 (iOS Ruling 15 Q2): PIN THEN MOVE, as IOS-MOVE-GRAPH (5b) did. YearDownloadsTest's eight cases about
// the coordinator, transcribed to kotlin.test (R457) where the code lives TODAY, run green against :app's YearDownloads
// beside the Kotest originals, and then moved to :shared commonTest WITH the coordinator. Each `actual shouldBe
// expected` became assertEquals(expected, actual) and each `shouldContain` an assertTrue naming the line; no value,
// count or order changed. The ninth original case (R28, taxYearsToDownload over java.time) stays in :app as
// TaxYearsToDownloadTest, because the function it pins stays (java.time is Android's).
//
// AN-PULL (R481, R484, R485). WHEN the year comes down - the trigger layer (R482). WHAT a download does is
// EntriesDownload's, proven in :shared's commonTest; here the download is real (over an in-memory DAO and a scripted
// GET), and what is asserted is which years each trigger fetches, what the screen is told, and that sign-out stops a
// year still in flight. Counted in GETs, because a GET is the only thing a download sends (R486).

private const val ACCOUNT = "acct-tag"

private fun yearBody(
    year: Int,
    days: List<String>,
): String =
    days.joinToString(prefix = """{"status":"ok","year":$year,"entries":[""", postfix = "]}") { day ->
        """{"id":"srv-$day","clientMutationId":"m-$day","dayDate":"$day","portion":"FULL","kind":"CH",""" +
            """"absenceReason":null,"note":null,"provenance":"MANUAL","detectedKind":null,"detectedAt":null,""" +
            """"clientClaimedAt":null,"firstRecordedAt":"${day}T18:00:00.000Z","lastModifiedAt":null}"""
    }

private fun synced(day: String): EntryEntity =
    EntryEntity(
        clientMutationId = "m-$day",
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.CH,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = null,
        serverId = "srv-$day",
        firstRecordedAt = "${day}T18:00:00.000Z",
        lastModifiedAt = null,
        syncState = SyncState.SYNCED,
        accountTag = ACCOUNT,
    )

/** A server holding [server] per year; each GET is counted by its path, and [answer] can override one. */
private class PinServer(
    private val server: Map<Int, List<String>>,
) {
    val gets = mutableListOf<String>()
    var answer: (suspend (Int) -> AuthedOutcome?) = { null }

    suspend fun get(path: String): AuthedOutcome {
        gets += path
        val year = path.substringAfter("?year=").toInt()
        return answer(year) ?: AuthedOutcome.Ok(200, yearBody(year, server[year].orEmpty()))
    }
}

private class PinRig(
    scope: TestScope,
    server: Map<Int, List<String>>,
) {
    val dao = FakeEntryDao()
    val server = PinServer(server)
    val log = mutableListOf<String>()
    val downloads = YearDownloads(scope) { log += it }
    val download =
        EntriesDownload(
            dao = dao,
            get = this.server::get,
            currentAccount = { ACCOUNT },
            inTransaction = { block -> block() },
        )

    fun seed(vararg entries: EntryEntity) {
        entries.forEach { dao.rows[Triple(it.accountTag, it.dayDate, it.portion)] = it }
    }
}

private val SERVER = mapOf(2026 to listOf("2026-04-07", "2026-04-08"), 2025 to listOf("2025-12-31"))

private val YEARS = listOf(2026, 2025)

@OptIn(ExperimentalCoroutinesApi::class)
class YearDownloadsPinTest {
    // "R481: after a sign-in BOTH years come down, whatever the phone already holds"
    @Test
    fun r481AfterASignInBothYearsComeDownWhateverThePhoneAlreadyHolds() =
        runTest {
            val rig = PinRig(this, SERVER)
            rig.seed(synced("2026-04-07"))

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            assertEquals(listOf("/api/v1/entries?year=2026", "/api/v1/entries?year=2025"), rig.server.gets)
            assertEquals(3, rig.dao.rows.size)
            assertEquals(YearDownloadStatus.Quiet, rig.downloads.status.value)
            assertTrue("year 2026: applied - 1 inserted, 0 replaced, 1 unchanged" in rig.log[0], rig.log[0])
            assertTrue("year 2025: applied - 1 inserted" in rig.log[1], rig.log[1])
        }

    // "R485: on start only the year that is EMPTY on the phone is fetched"
    @Test
    fun r485OnStartOnlyTheYearThatIsEmptyOnThePhoneIsFetched() =
        runTest {
            val rig = PinRig(this, SERVER)
            rig.seed(synced("2026-04-07"))

            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()

            assertEquals(listOf("/api/v1/entries?year=2025"), rig.server.gets)
        }

    // "R485: with both years on the phone the start check sends nothing at all"
    @Test
    fun r485WithBothYearsOnThePhoneTheStartCheckSendsNothingAtAll() =
        runTest {
            val rig = PinRig(this, SERVER)
            rig.seed(synced("2026-04-07"), synced("2025-12-31"))

            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()

            assertTrue(rig.server.gets.isEmpty(), rig.server.gets.toString())
            assertEquals(YearDownloadStatus.Quiet, rig.downloads.status.value)
            // Positive control: the same rig, signed in, DOES fetch - the check ran and found nothing to do.
            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()
            assertEquals(2, rig.server.gets.size)
        }

    // "R485: the start check runs once per process, and not after a sign-in download"
    @Test
    fun r485TheStartCheckRunsOncePerProcessAndNotAfterASignInDownload() =
        runTest {
            val rig = PinRig(this, SERVER)

            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()
            assertEquals(2, rig.server.gets.size)

            rig.dao.rows.clear()
            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()
            assertEquals(2, rig.server.gets.size)

            val fresh = PinRig(this, SERVER)
            fresh.downloads.afterSignIn(fresh.download, YEARS)
            fresh.downloads.atStart(fresh.download, YEARS)
            advanceUntilIdle()
            assertEquals(2, fresh.server.gets.size)
        }

    // "R484: a year that fails is shown failed, nothing changes, and the retry fetches it again"
    @Test
    fun r484AYearThatFailsIsShownFailedNothingChangesAndTheRetryFetchesItAgain() =
        runTest {
            val rig = PinRig(this, SERVER)
            var unreachable = true
            rig.server.answer = { year -> if (year == 2025 && unreachable) AuthedOutcome.NetworkError else null }

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            assertEquals(YearDownloadStatus.Failed(listOf(2025)), rig.downloads.status.value)
            assertEquals(listOf("2026-04-07", "2026-04-08"), rig.dao.rows.keys.map { it.second })
            assertTrue("year 2025: not downloaded - nothing changed" in rig.log[1], rig.log[1])

            unreachable = false
            rig.downloads.retry(rig.download)
            advanceUntilIdle()

            assertEquals(YearDownloadStatus.Quiet, rig.downloads.status.value)
            assertEquals(
                listOf("/api/v1/entries?year=2026", "/api/v1/entries?year=2025", "/api/v1/entries?year=2025"),
                rig.server.gets,
            )
            assertEquals(3, rig.dao.rows.size)
        }

    // "R484: a session that is gone ends quietly - nothing to show, nothing to retry"
    @Test
    fun r484ASessionThatIsGoneEndsQuietlyNothingToShowNothingToRetry() =
        runTest {
            val rig = PinRig(this, SERVER)
            rig.server.answer = { AuthedOutcome.SessionExpired }

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            assertEquals(YearDownloadStatus.Quiet, rig.downloads.status.value)
            assertEquals(listOf("/api/v1/entries?year=2026"), rig.server.gets)
            assertEquals(listOf("year 2026: no session - ended quietly"), rig.log)
            assertEquals(0, rig.dao.rows.size)
        }

    // "R483: a synced row the server lacks is kept, and COUNTED in the log line"
    @Test
    fun r483ASyncedRowTheServerLacksIsKeptAndCountedInTheLogLine() =
        runTest {
            val rig = PinRig(this, SERVER)
            rig.seed(synced("2026-03-02"))

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            assertEquals(
                listOf("2026-03-02", "2026-04-07", "2026-04-08", "2025-12-31"),
                rig.dao.rows.keys.map { it.second },
            )
            assertTrue("1 synced on this phone but absent from the server (kept, R483)" in rig.log[0], rig.log[0])
        }

    // "sign-out stops a year still in flight: nothing lands after the stop"
    @Test
    fun signOutStopsAYearStillInFlightNothingLandsAfterTheStop() =
        runTest {
            val rig = PinRig(this, SERVER)
            val held = CompletableDeferred<Unit>()
            rig.server.answer = { held.await().let { null } }

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()
            assertEquals(listOf("/api/v1/entries?year=2026"), rig.server.gets)

            rig.downloads.stop()
            held.complete(Unit)
            advanceUntilIdle()

            assertEquals(0, rig.dao.rows.size)
            assertEquals(YearDownloadStatus.Quiet, rig.downloads.status.value)
            assertEquals(listOf("/api/v1/entries?year=2026"), rig.server.gets)
        }
}
