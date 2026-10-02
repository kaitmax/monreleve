package ch.monreleve.app.detection

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

// AN-AUTO increment 4. Start and stop the background sampler (SPEC 13.1 / R315).
//
// START enqueues a unique periodic SamplingWorker at the WorkManager floor (15 minutes, SAMPLE_INTERVAL_MINUTES
// - SPEC 13.1: "no more often than every 15 minutes"). The worker itself skips wakes outside the working window,
// so scheduling is simple and window-bounded in the worker rather than by a fragile per-day schedule.
//
// STOP cancels the work AND clears the day's cursor (SharedPrefsSamplingCursorStore), so turning automatic mode
// off stops sampling AT ONCE (R315/SPEC 13) and leaves no half-day cursor to resume from. This is the seam
// ParametresController.stopSampling is wired to; starting happens after the disclosure + permission grant (R316).

private const val SAMPLING_WORK = "monreleve.detection.sampling"

object DetectionScheduling {
    fun startSampling(context: Context) {
        val request =
            PeriodicWorkRequestBuilder<SamplingWorker>(SAMPLE_INTERVAL_MINUTES.toLong(), TimeUnit.MINUTES)
                .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            SAMPLING_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun stopSampling(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(SAMPLING_WORK)
        // R315/SPEC 13: off stops at once and leaves no running cursor to resume from.
        SharedPrefsSamplingCursorStore(context).clear()
    }
}
