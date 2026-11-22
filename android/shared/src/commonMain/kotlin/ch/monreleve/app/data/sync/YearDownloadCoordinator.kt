package ch.monreleve.app.data.sync

import androidx.sqlite.SQLiteException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// IOS-SHELL-3 R1371 (iOS Ruling 15 Q2): MOVED from :app's data/sync/YearDownloads.kt, so iOS's shell runs the SAME
// coordinator Android does - the year downloads are a ship blocker on iOS (an existing account's threshold answer
// would otherwise be computed from the days recorded on that phone alone). The class and its status are verbatim but
// for two platform names: the write failure caught is androidx.sqlite's SQLiteException - on Android an actual
// TYPEALIAS of android.database.SQLException, the type :app caught, so Android catches exactly what it did; on iOS the
// exception Room's bundled driver raises - and the log names its class through ::class (javaClass is the JVM's).
// What stays in :app is Android's: the process's one instance (processYearDownloads, logged through Log), the
// construction over Room's withTransaction (buildEntriesDownload) and the java.time tax years (taxYearsToDownload).
// iOS builds its own in startIosShell (ios/IosShell.kt) and stops it through its session-end seam.
//
// AN-PULL (R481-R485). THE PLATFORM ONLY TRIGGERS THE DOWNLOAD (R482). Everything about WHAT a download does - the
// GET, the reconciliation, the one transaction per year - is EntriesDownload's. This file decides WHEN, and keeps what
// the screen waiting for it shows (R484):
//
//   afterSignIn  R481. After a sign-in, BOTH tax years, whatever the phone holds - a re-sign-in after sign-out's
//                wipe (R295) holds nothing, and a sign-in on a phone that still holds rows reconciles them.
//   atStart      R485. Once per process, only the years in which the signed-in account has NO row on the phone:
//                one SELECT of the account's rows, no network unless a year is empty. Skipped when a sign-in
//                download already ran in this process.
//   retry        R484. The person's "Réessayer" after a failure: the years that failed, again.
//   stop         Sign-out. Cancels a download in flight BEFORE the record is cleared, so a year that was still
//                arriving cannot land in the store sign-out has just emptied (R295). Not a join: the transport's
//                blocking read must not hold a sign-out for its fifteen-second timeout, and a cancelled job
//                cannot open a transaction (the GET's withContext rethrows the cancellation on return).
//
// ONE PER PROCESS. A download outlives the activity that started it - a rotation rebuilds MainActivity mid-GET -
// and so must its status, or the failure notice would vanish on the rebuild (R310) and the start check would
// re-run on every rotation. The triggers are all called from the main thread (Compose effects and callbacks, and
// sign-out's clearRecord before it leaves for the IO dispatcher).

/** What the screen waiting for the year shows (R484). */
sealed interface YearDownloadStatus {
    /** Nothing to say: no download has run, one finished, or one ended quietly because the session was gone. */
    data object Quiet : YearDownloadStatus

    data object Running : YearDownloadStatus

    /** These years could not be brought down, and nothing changed. The screen says so, with a retry. */
    data class Failed(val years: List<Int>) : YearDownloadStatus
}

class YearDownloads(
    private val scope: CoroutineScope,
    /** A counted log line per year (R483's anomaly count included). Counts and years only - never a day. */
    private val log: (String) -> Unit,
) {
    private val mutableStatus = MutableStateFlow<YearDownloadStatus>(YearDownloadStatus.Quiet)
    val status: StateFlow<YearDownloadStatus> = mutableStatus.asStateFlow()

    private var job: Job? = null
    private var ranThisProcess = false

    /** R481: after a sign-in, both [years], whatever the phone holds. Replaces any download still in flight. */
    fun afterSignIn(
        download: EntriesDownload,
        years: List<Int>,
    ) {
        ranThisProcess = true
        job?.cancel()
        run(download) { years }
    }

    /** R485: once per process, only the years of [years] with no local row for the signed-in account. */
    fun atStart(
        download: EntriesDownload,
        years: List<Int>,
    ) {
        if (ranThisProcess) return
        ranThisProcess = true
        run(download) { download.emptyLocally(years) }
    }

    /** R484: the person asked again - the years that failed. Nothing to retry, or one already running: nothing. */
    fun retry(download: EntriesDownload) {
        val failed = (status.value as? YearDownloadStatus.Failed)?.years.orEmpty()
        if (failed.isEmpty() || job?.isActive == true) return
        run(download) { failed }
    }

    /** Sign-out: stop a download in flight before the record is cleared (see the header), and say nothing. */
    fun stop() {
        job?.cancel()
        job = null
        mutableStatus.value = YearDownloadStatus.Quiet
    }

    private fun run(
        download: EntriesDownload,
        years: suspend () -> List<Int>,
    ) {
        job =
            scope.launch {
                val wanted = years()
                if (wanted.isNotEmpty()) {
                    // A job that was replaced or stopped never writes the status: ensureActive before each write.
                    ensureActive()
                    mutableStatus.value = YearDownloadStatus.Running
                    val outcomes = downloadOrFail(download, wanted)
                    outcomes.forEach { log(lineFor(it)) }
                    val failed = outcomes.filterIsInstance<YearDownload.Failed>().map { it.year }
                    ensureActive()
                    mutableStatus.value =
                        if (failed.isEmpty()) YearDownloadStatus.Quiet else YearDownloadStatus.Failed(failed)
                }
            }
    }

    // A write that fails inside a year's transaction was rolled back by it (R484) and arrives here as the platform's
    // SQLiteException. The years not yet confirmed are reported failed; a retry repeats them, and a year that did land
    // costs nothing the second time (identical rows are not rewritten, R483).
    private suspend fun downloadOrFail(
        download: EntriesDownload,
        years: List<Int>,
    ): List<YearDownload> =
        try {
            download.downloadYears(years)
        } catch (e: SQLiteException) {
            log("years $years: the local write failed (${e::class.simpleName}) - rolled back, nothing changed")
            years.map { YearDownload.Failed(it) }
        }

    private fun lineFor(outcome: YearDownload): String =
        when (outcome) {
            is YearDownload.Applied ->
                "year ${outcome.year}: applied - ${outcome.inserted} inserted, ${outcome.replaced} replaced, " +
                    "${outcome.unchanged} unchanged, ${outcome.keptUnsynced} kept unsynced, " +
                    "${outcome.absentFromServer} synced on this phone but absent from the server (kept, R483)"
            is YearDownload.Failed -> "year ${outcome.year}: not downloaded - nothing changed"
            is YearDownload.Unauthenticated -> "year ${outcome.year}: no session - ended quietly"
        }
}
