package ch.monreleve.app.data.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import java.util.concurrent.TimeUnit

// AN5 increment 3. Enqueues the drain. ONE WORKER AT A TIME: the request is unique by
// name, so WorkManager never runs two concurrently - two drains of one queue would send
// each mutation twice, and while R219 makes that harmless on the server it doubles the
// traffic and hides the bug. APPEND_OR_REPLACE, not KEEP: a record made while a drain is
// running still gets its own drain (appended after the current one) rather than being
// dropped, so nothing is stranded PENDING until the next unrelated trigger.

object SyncScheduler {
    private const val UNIQUE_WORK = "entries-sync"

    fun requestSync(context: Context) {
        val request =
            OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS,
                )
                .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }
}
