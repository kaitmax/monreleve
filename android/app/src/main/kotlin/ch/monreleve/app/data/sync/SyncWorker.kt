package ch.monreleve.app.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get

// AN5 increment 3. The thin CoroutineWorker: it builds the engine from the app
// context and maps the drain's outcome onto WorkManager's Result. All the logic is in
// SyncEngine (JVM-tested); this is the part that only exists on a device, exercised by
// the walkthrough (increment 6).

class SyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result =
        when (buildSyncEngine(applicationContext).sync()) {
            // Drained. Client defects were held as FAILED (loud, out of the queue), which
            // is a completed drain, not a fault to retry - retrying a rejected payload can
            // never succeed (R198).
            is SyncOutcome.Settled -> Result.success()
            // Network or a garbled response: retry with the request's exponential backoff.
            SyncOutcome.Retryable -> Result.retry()
            // No usable session: the rows stay PENDING, tagged, and the next sign-in sends them (R509 -
            // auth/SignInSync.kt). Retrying now would back off forever against an absent session.
            SyncOutcome.Unauthenticated -> Result.success()
        }
}

internal fun buildSyncEngine(context: Context): SyncEngine {
    val dao = MonReleveDatabase.get(context).entryDao()
    // AN-TOKEN-RACE (R507): the PROCESS's session - the one the screens use - never a drain's own. A SessionManager
    // built here raced the screens' refresh of the same token, and the server ended the session on the replay (R210).
    val session = processSession(context)
    // AN-FIX F4 / R303: the drain is scoped to the account signed in RIGHT NOW, read here, at drain time. A session
    // the server ENDED keeps its account tag - only the tokens go (R508) - so its drain posts nothing for want of a
    // session; and the next sign-in sets the tag BEFORE it sends (R509), so one account's queue never goes up under
    // another's token. A null account (nobody ever signed in, or a sign-out cleared it) drains nothing.
    val currentAccount = SharedPrefsAccountStore(context).current()
    return SyncEngine(dao, session, currentAccount)
}
