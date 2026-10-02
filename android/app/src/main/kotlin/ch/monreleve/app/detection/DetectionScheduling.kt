package ch.monreleve.app.detection

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

// R320 / AN-AUTO. Start and stop the background sampler (SPEC 13.1 / R315).
//
// START enqueues a unique periodic SamplingWorker at the WorkManager floor (15 minutes - SPEC 13.1: "no more often
// than every 15 minutes"). The worker itself does nothing except inside one of the four check windows whose slot is
// empty (SamplingWorker + CheckWindows), so scheduling stays simple: a single periodic worker, windowed in the
// worker rather than by a fragile per-window schedule, and no restricted exact-alarm permission (R320).
//
// STOP cancels the work, so turning automatic mode off stops sampling AT ONCE (R315 / SPEC 13). There is no cursor
// to clear under the four-window model - a check is a discrete value, not an incremental accumulation. This is the
// seam ParametresController.stopSampling is wired to; starting happens after the disclosure + permission grant (R316).

/** The WorkManager periodic floor the sampler wakes on; each wake acts only inside a check window. */
const val SAMPLING_INTERVAL_MINUTES = 15L

private const val SAMPLING_WORK = "monreleve.detection.sampling"

object DetectionScheduling {
    fun startSampling(context: Context) {
        val request =
            PeriodicWorkRequestBuilder<SamplingWorker>(SAMPLING_INTERVAL_MINUTES, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            SAMPLING_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun stopSampling(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(SAMPLING_WORK)
    }
}
