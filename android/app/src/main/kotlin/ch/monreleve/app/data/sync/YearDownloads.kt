package ch.monreleve.app.data.sync

import android.content.Context
import android.util.Log
import androidx.room.withTransaction
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.StateFlow
import java.time.Clock
import java.time.Year
import java.time.ZoneId

// AN-PULL (R481-R485). :app ONLY TRIGGERS THE DOWNLOAD (R482). Everything about WHAT a download does - the GET, the
// reconciliation, the one transaction per year - is EntriesDownload's, in :shared. WHEN it runs - the coordinator,
// YearDownloads, with the status the screen waiting for it shows (R484) - moved to :shared commonMain too
// (data/sync/YearDownloadCoordinator.kt, IOS-SHELL-3 R1371), so iOS's shell runs the same one. What stays here is
// Android's: the process's one instance (logged through Log), its construction over Room's withTransaction, and the
// tax years read from a java.time clock. Sign-out stops it in account/DeviceLocalStores.kt, before the record is
// cleared (YearDownloads.stop says why it is a cancel, not a join).

private const val TAG = "YearDownload"

/**
 * What the shell needs of the year download, bundled so MainShell takes ONE argument for it - with no default, like
 * requestSync and syncNow, so the composition root cannot forget to wire it (R291): the status the screen waiting for
 * the year shows (R484), the start check (R485) and the person's retry.
 */
class ShellYearDownload(
    val status: StateFlow<YearDownloadStatus>,
    val atStart: () -> Unit,
    val retry: () -> Unit,
)

/**
 * The process's one coordinator (YearDownloads' header): built on first use, on a scope that outlives any activity.
 */
val processYearDownloads: YearDownloads by lazy {
    YearDownloads(CoroutineScope(SupervisorJob() + Dispatchers.IO)) { line -> Log.i(TAG, line) }
}

/**
 * The ONE construction of the download (R206), beside buildSyncEngine. [get] is the CALLER's session - the process's
 * one SessionManager (R507), whose refresh is single-flight, so the download never races the screens' calls or a drain
 * into a second refresh of one token (R210). The account is read when it is used (R303); the transaction is Room's.
 */
internal fun buildEntriesDownload(
    context: Context,
    get: suspend (String) -> AuthedOutcome,
): EntriesDownload {
    val db = MonReleveDatabase.get(context)
    val accountStore = SharedPrefsAccountStore(context)
    return EntriesDownload(
        dao = db.entryDao(),
        get = get,
        currentAccount = { accountStore.current() },
        inTransaction = { block -> db.withTransaction { block() } },
    )
}

/** R481: the current tax year - Paris's calendar year (R28) - and the one before it, read from [clock] at use. */
fun taxYearsToDownload(clock: Clock): List<Int> {
    val current = Year.now(clock.withZone(ZoneId.of("Europe/Paris"))).value
    return listOf(current, current - 1)
}
