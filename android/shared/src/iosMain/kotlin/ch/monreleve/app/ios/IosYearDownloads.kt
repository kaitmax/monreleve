package ch.monreleve.app.ios

import androidx.room.Transactor
import androidx.room.useWriterConnection
import ch.monreleve.app.data.local.MonReleveDatabase
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

// IOS-SHELL-3 R1371 (iOS Ruling 15 Q2). THE YEAR DOWNLOADS' TRANSACTION ON iOS - what Room's withTransaction is in
// :app's buildEntriesDownload. Room 2.7.2 offers withTransaction on Android only, so the year is written the way
// clearIosRecord writes (IosLocalStores.kt): the writer connection, ONE IMMEDIATE transaction around every write of the
// year. The DAO calls inside it join that connection - Room's performSuspending keeps the transaction's connection in
// the coroutine context (room-runtime 2.7.2 ConnectionPoolImpl: ConnectionElement), so a write that fails part-way
// takes the year's earlier writes back with it (R484). IosYearDownloadAtomicityIosTest proves it on the iOS database.
//
// A STOPPED DOWNLOAD OPENS NO TRANSACTION. Android relies on the GET's withContext rethrowing the cancellation on
// return (YearDownloads' header). iOS asks it explicitly before the writer connection is taken: an ending stops the
// download through the session-end seam (IosSessionEndSeam.kt), and a GET whose answer still arrives after that -
// NSURLSession completes on its own queue - writes nothing. The account read again inside the transaction
// (EntriesDownload) is the second guard: one account's year never lands under another's tag.

/** The year download's transaction seam on iOS (EntriesDownload's inTransaction) - startIosShell's, and the tests'. */
internal fun iosEntriesTransaction(database: MonReleveDatabase): suspend (write: suspend () -> Unit) -> Unit =
    { write ->
        currentCoroutineContext().ensureActive()
        database.useWriterConnection { connection ->
            connection.withTransaction(Transactor.SQLiteTransactionType.IMMEDIATE) { write() }
        }
    }
