package ch.monreleve.app.data.sync

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.repo.FakeEntryDao
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-PULL (R481, R484, R485). WHEN the year comes down - the trigger layer :app owns (R482). WHAT a download does is
// EntriesDownload's, proven in :shared's commonTest; here the download is real (over :app's FakeEntryDao and a
// scripted GET), and what is asserted is which years each trigger fetches, what the screen is told, and that sign-out
// stops a year still in flight. Counted in GETs, because a GET is the only thing a download sends (R486).

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
private class Server(
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

private class Rig(scope: TestScope, server: Map<Int, List<String>>) {
    val dao = FakeEntryDao()
    val server = Server(server)
    val log = mutableListOf<String>()
    val downloads = YearDownloads(scope) { log += it }
    val download =
        EntriesDownload(
            dao = dao,
            get = this.server::get,
            currentAccount = { ACCOUNT },
            inTransaction = { block -> block() },
        )
}

private val SERVER = mapOf(2026 to listOf("2026-04-07", "2026-04-08"), 2025 to listOf("2025-12-31"))

private val YEARS = listOf(2026, 2025)

@OptIn(ExperimentalCoroutinesApi::class)
class YearDownloadsTest : FunSpec({
    test("R481: after a sign-in BOTH years come down, whatever the phone already holds") {
        runTest {
            val rig = Rig(this, SERVER)
            rig.dao.seed(synced("2026-04-07"))

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            rig.server.gets shouldBe listOf("/api/v1/entries?year=2026", "/api/v1/entries?year=2025")
            rig.dao.rows.size shouldBe 3
            rig.downloads.status.value shouldBe YearDownloadStatus.Quiet
            rig.log[0] shouldContain "year 2026: applied - 1 inserted, 0 replaced, 1 unchanged"
            rig.log[1] shouldContain "year 2025: applied - 1 inserted"
        }
    }

    test("R485: on start only the year that is EMPTY on the phone is fetched") {
        runTest {
            val rig = Rig(this, SERVER)
            rig.dao.seed(synced("2026-04-07"))

            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()

            rig.server.gets shouldBe listOf("/api/v1/entries?year=2025")
        }
    }

    test("R485: with both years on the phone the start check sends nothing at all") {
        runTest {
            val rig = Rig(this, SERVER)
            rig.dao.seed(synced("2026-04-07"), synced("2025-12-31"))

            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()

            rig.server.gets.shouldBeEmpty()
            rig.downloads.status.value shouldBe YearDownloadStatus.Quiet
            // Positive control: the same rig, signed in, DOES fetch - the check ran and found nothing to do.
            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()
            rig.server.gets.size shouldBe 2
        }
    }

    test("R485: the start check runs once per process, and not after a sign-in download") {
        runTest {
            val rig = Rig(this, SERVER)

            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()
            rig.server.gets.size shouldBe 2

            rig.dao.rows.clear()
            rig.downloads.atStart(rig.download, YEARS)
            advanceUntilIdle()
            rig.server.gets.size shouldBe 2

            val fresh = Rig(this, SERVER)
            fresh.downloads.afterSignIn(fresh.download, YEARS)
            fresh.downloads.atStart(fresh.download, YEARS)
            advanceUntilIdle()
            fresh.server.gets.size shouldBe 2
        }
    }

    test("R484: a year that fails is shown failed, nothing changes, and the retry fetches it again") {
        runTest {
            val rig = Rig(this, SERVER)
            var unreachable = true
            rig.server.answer = { year -> if (year == 2025 && unreachable) AuthedOutcome.NetworkError else null }

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            rig.downloads.status.value shouldBe YearDownloadStatus.Failed(listOf(2025))
            rig.dao.rows.keys.map { it.second } shouldBe listOf("2026-04-07", "2026-04-08")
            rig.log[1] shouldContain "year 2025: not downloaded - nothing changed"

            unreachable = false
            rig.downloads.retry(rig.download)
            advanceUntilIdle()

            rig.downloads.status.value shouldBe YearDownloadStatus.Quiet
            rig.server.gets shouldBe
                listOf("/api/v1/entries?year=2026", "/api/v1/entries?year=2025", "/api/v1/entries?year=2025")
            rig.dao.rows.size shouldBe 3
        }
    }

    test("R484: a session that is gone ends quietly - nothing to show, nothing to retry") {
        runTest {
            val rig = Rig(this, SERVER)
            rig.server.answer = { AuthedOutcome.SessionExpired }

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            rig.downloads.status.value shouldBe YearDownloadStatus.Quiet
            rig.server.gets shouldBe listOf("/api/v1/entries?year=2026")
            rig.log shouldBe listOf("year 2026: no session - ended quietly")
            rig.dao.rows.size shouldBe 0
        }
    }

    test("R483: a synced row the server lacks is kept, and COUNTED in the log line") {
        runTest {
            val rig = Rig(this, SERVER)
            rig.dao.seed(synced("2026-03-02"))

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()

            rig.dao.rows.keys.map { it.second } shouldBe
                listOf("2026-03-02", "2026-04-07", "2026-04-08", "2025-12-31")
            rig.log[0] shouldContain "1 synced on this phone but absent from the server (kept, R483)"
        }
    }

    test("sign-out stops a year still in flight: nothing lands after the stop") {
        runTest {
            val rig = Rig(this, SERVER)
            val held = CompletableDeferred<Unit>()
            rig.server.answer = { held.await().let { null } }

            rig.downloads.afterSignIn(rig.download, YEARS)
            advanceUntilIdle()
            rig.server.gets shouldBe listOf("/api/v1/entries?year=2026")

            rig.downloads.stop()
            held.complete(Unit)
            advanceUntilIdle()

            rig.dao.rows.size shouldBe 0
            rig.downloads.status.value shouldBe YearDownloadStatus.Quiet
            rig.server.gets shouldBe listOf("/api/v1/entries?year=2026")
        }
    }

    test("R28: the tax years are Paris's, whatever zone the phone is in") {
        val london = ZoneId.of("Europe/London")
        // 23:30 in Paris on 31 December - still 2026 everywhere.
        taxYearsToDownload(Clock.fixed(Instant.parse("2026-12-31T22:30:00Z"), london)) shouldBe listOf(2026, 2025)
        // 00:30 in Paris on 1 January, 23:30 in London: Paris's new year is the one that counts.
        taxYearsToDownload(Clock.fixed(Instant.parse("2026-12-31T23:30:00Z"), london)) shouldBe listOf(2027, 2026)
    }
})

private fun FakeEntryDao.seed(vararg entries: EntryEntity) {
    entries.forEach { rows[Triple(it.accountTag, it.dayDate, it.portion)] = it }
}
