package ch.monreleve.app.data.sync

import android.database.sqlite.SQLiteException
import androidx.room.Room
import androidx.room.withTransaction
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

// AN-PULL (R484), ON REAL ROOM. commonTest proves every write of a year is issued inside ONE call of the transaction
// seam, against an in-memory store whose rollback is the test's own. This proves the half commonTest cannot: that
// the seam :app actually passes - Room's withTransaction, as buildEntriesDownload wires it - takes a part-written
// year back on a real SQLite database, and that the coordinator turns the platform's SQLException into a failed
// year the screen can show. The planted failure is a real android.database.sqlite.SQLiteException on the second
// write, raised by a DAO that otherwise delegates every call to Room's generated one.

private const val ACCOUNT = "acct-room-tag"
private const val YEAR = 2026

private val BODY =
    listOf("2026-04-07" to "CH", "2026-04-08" to "HOME", "2026-04-09" to "MISSION_FR").joinToString(
        prefix = """{"status":"ok","year":$YEAR,"entries":[""",
        postfix = "]}",
    ) { (day, kind) ->
        """{"id":"srv-$day","clientMutationId":"m-$day","dayDate":"$day","portion":"FULL","kind":"$kind",""" +
            """"absenceReason":null,"note":null,"provenance":"MANUAL","detectedKind":null,"detectedAt":null,""" +
            """"clientClaimedAt":null,"firstRecordedAt":"${day}T18:00:00.000Z","lastModifiedAt":null}"""
    }

/** Room's DAO, except that write number [failOn] throws the platform's own exception instead of landing. */
private class FailingWrite(private val room: EntryDao, private val failOn: Int) : EntryDao by room {
    var attempts = 0
        private set

    override suspend fun upsert(entry: EntryEntity) {
        attempts++
        if (attempts == failOn) throw SQLiteException("planted: write $attempts fails part-way through the year")
        room.upsert(entry)
    }
}

@RunWith(AndroidJUnit4::class)
class YearDownloadRoomTransactionInstrumentedTest {
    private lateinit var db: MonReleveDatabase

    @Before
    fun open() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(context, MonReleveDatabase::class.java).build()
    }

    @After
    fun close() {
        db.close()
    }

    private fun downloadOver(dao: EntryDao) =
        EntriesDownload(
            dao = dao,
            get = { AuthedOutcome.Ok(BODY) },
            currentAccount = { ACCOUNT },
            // EXACTLY buildEntriesDownload's seam.
            inTransaction = { block -> db.withTransaction { block() } },
        )

    private val pending =
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

    @Test
    fun aYearWhoseSecondWriteFailsIsRolledBackByRoom() =
        runBlocking {
            db.entryDao().upsert(pending)
            val before = db.entryDao().all()
            val failing = FailingWrite(db.entryDao(), failOn = 2)

            val thrown = runCatching { downloadOver(failing).download(YEAR) }.exceptionOrNull()

            assertTrue("the planted SQLiteException must surface, got $thrown", thrown is SQLiteException)
            assertEquals("the first write was issued - and landed inside the transaction", 2, failing.attempts)
            assertEquals("Room took the first write back: the store is as it was", before, db.entryDao().all())

            // Positive control: the same year over Room's own DAO lands whole, beside the pending day.
            val outcome = downloadOver(db.entryDao()).download(YEAR)
            assertEquals(YearDownload.Applied(YEAR, 3, 0, 0, 0, 0), outcome)
            assertEquals(4, db.entryDao().all().size)
        }

    @Test
    fun theCoordinatorShowsALocalWriteFailureAsAFailedYear() =
        runBlocking {
            val lines = mutableListOf<String>()
            val downloads = YearDownloads(CoroutineScope(SupervisorJob() + Dispatchers.IO)) { lines += it }

            downloads.afterSignIn(downloadOver(FailingWrite(db.entryDao(), failOn = 2)), listOf(YEAR))
            val status =
                withTimeout(10_000) { downloads.status.first { it is YearDownloadStatus.Failed } }

            assertEquals(YearDownloadStatus.Failed(listOf(YEAR)), status)
            assertTrue(lines.toString(), lines.any { "the local write failed (SQLiteException)" in it })
            assertEquals("nothing landed", 0, db.entryDao().all().size)
        }
}
