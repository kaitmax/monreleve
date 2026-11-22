package ch.monreleve.app.ios

import androidx.sqlite.SQLiteException
import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.sync.EntriesDownload
import ch.monreleve.app.data.sync.YearDownload
import ch.monreleve.app.data.sync.YearDownloadStatus
import ch.monreleve.app.data.sync.YearDownloads
import ch.monreleve.app.data.sync.serverRow
import ch.monreleve.app.data.sync.yearBody
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import platform.Foundation.NSLock
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-SHELL-3 R1371 - ATOMICITY ON iOS (R484). Android proves its half with an instrumented test outside the gate
// (YearDownloadRoomTransactionInstrumentedTest: Room's withTransaction on a real SQLite takes a part-written year
// back).
// This is iOS's own, on the iOS database - Room KMP over the bundled driver, built by buildIosDatabase in a temporary
// directory - with EXACTLY the transaction seam startIosShell passes (iosEntriesTransaction). The planted failure is
// androidx.sqlite's SQLiteException on the second write, raised by a DAO that otherwise delegates every call to Room's
// generated one; and the coordinator turns it into a failed year the screen can show, never an uncaught exception (on
// the app's MainScope that would end the process).
//
// Every wait is bounded (withTimeout): if Room's DAO calls did not join the transaction's connection, the symptom would
// be a writer waiting on itself - a hang - and this test must fail rather than stall the run.

private const val ACCOUNT = "acct-ios-room-tag"
private const val YEAR = 2026
private const val BOUND_MILLIS = 20_000L

private val BODY =
    yearBody(
        YEAR,
        listOf("2026-04-07" to "CH", "2026-04-08" to "HOME", "2026-04-09" to "MISSION_FR").map { (day, kind) ->
            serverRow(id = "srv-$day", mutation = "m-$day", day = day, kind = kind)
        },
    )

private val PENDING =
    EntryEntity(
        clientMutationId = "pending-1",
        dayDate = "2026-04-10",
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = "2026-04-10T19:00:00.000+02:00",
        serverId = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        syncState = SyncState.PENDING,
        accountTag = ACCOUNT,
    )

/** Room's DAO, except that write number [failOn] throws the platform's own exception instead of landing. */
private class FailingWrite(
    private val room: EntryDao,
    private val failOn: Int,
) : EntryDao by room {
    var attempts = 0
        private set

    override suspend fun upsert(entry: EntryEntity) {
        attempts++
        if (attempts == failOn) throw SQLiteException("planted: write $attempts fails part-way through the year")
        room.upsert(entry)
    }
}

class IosYearDownloadAtomicityIosTest {
    private val directory = freshTempDirectory()
    private val db: MonReleveDatabase = buildIosDatabase(directory)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @AfterTest
    fun close() {
        scope.cancel()
        db.close()
        removeDirectory(directory)
    }

    private fun downloadOver(dao: EntryDao) =
        EntriesDownload(
            dao = dao,
            get = { AuthedOutcome.Ok(200, BODY) },
            currentAccount = { ACCOUNT },
            // EXACTLY startIosShell's seam.
            inTransaction = iosEntriesTransaction(db),
        )

    @Test
    fun aYearWhoseSecondWriteFailsIsRolledBackOnTheIosDatabase() =
        runBlocking {
            withTimeout(BOUND_MILLIS) {
                db.entryDao().upsert(PENDING)
                val before = db.entryDao().all()
                assertEquals(1, before.size, "the BEFORE: the pending day is there")
                val failing = FailingWrite(db.entryDao(), failOn = 2)

                val thrown = runCatching { downloadOver(failing).download(YEAR) }.exceptionOrNull()

                assertTrue(thrown is SQLiteException, "the planted SQLiteException must surface, got $thrown")
                assertEquals(2, failing.attempts, "the first write was issued - and landed inside the transaction")
                assertEquals(before, db.entryDao().all(), "the iOS database took the first write back: as it was")

                // Positive control: the same year over Room's own DAO lands whole, beside the pending day.
                val outcome = downloadOver(db.entryDao()).download(YEAR)
                assertEquals(YearDownload.Applied(YEAR, 3, 0, 0, 0, 0), outcome)
                assertEquals(4, db.entryDao().all().size)
            }
        }

    @Test
    fun theCoordinatorShowsALocalWriteFailureOnIosAsAFailedYear() =
        runBlocking {
            withTimeout(BOUND_MILLIS) {
                val lock = NSLock()
                val lines = mutableListOf<String>()
                val downloads =
                    YearDownloads(scope) { line ->
                        lock.lock()
                        lines += line
                        lock.unlock()
                    }

                downloads.afterSignIn(downloadOver(FailingWrite(db.entryDao(), failOn = 2)), listOf(YEAR))
                val status = downloads.status.first { it is YearDownloadStatus.Failed }

                assertEquals(YearDownloadStatus.Failed(listOf(YEAR)), status)
                lock.lock()
                val logged = lines.toList()
                lock.unlock()
                assertTrue(logged.any { "the local write failed (SQLiteException)" in it }, logged.toString())
                assertEquals(0, db.entryDao().all().size, "nothing landed")
            }
        }
}
