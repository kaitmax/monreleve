package ch.monreleve.app.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport

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
            // No usable session: the rows stay PENDING and a fresh sign-in enqueues another
            // sync. Retrying now would back off forever against an absent session.
            SyncOutcome.Unauthenticated -> Result.success()
        }
}

private fun buildSyncEngine(context: Context): SyncEngine {
    val dao = MonReleveDatabase.get(context).entryDao()
    val api = AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
    val session = SessionManager(api, KeystoreTokenStore(context))
    // AN-FIX F4 / R303: the drain is scoped to the account signed in RIGHT NOW. An expired session that
    // has not signed back in has no current account, so SyncEngine drains nothing (fail closed) rather
    // than posting the previous account's queue under the next account's token.
    val currentAccount = SharedPrefsAccountStore(context).current()
    return SyncEngine(dao, session, currentAccount)
}
