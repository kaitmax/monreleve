package ch.monreleve.app.ios

import ch.monreleve.app.data.local.MonReleveDatabase

// IOS-SHELL-3 R1371 - SKELETON FOR THE RED RUN (test-first): the seam IosYearDownloadAtomicityIosTest drives, NOT yet a
// transaction - each write lands on its own, so a failure part-way through a year leaves the part written. The next
// increment makes it ONE IMMEDIATE transaction on the iOS database.

/** The year download's transaction seam on iOS (EntriesDownload's inTransaction). SKELETON: no transaction yet. */
@Suppress("UnusedParameter") // SKELETON: the database is the transaction's, from the next increment.
internal fun iosEntriesTransaction(database: MonReleveDatabase): suspend (write: suspend () -> Unit) -> Unit =
    { write -> write() }
