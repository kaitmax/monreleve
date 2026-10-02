package ch.monreleve.app.detection

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.todayInParis
import java.time.Clock
import java.time.LocalTime
import java.time.ZoneId

// AN-AUTO increment 4. The background sampler (SPEC 13.1: WorkManager periodic work within the working window).
//
// WHAT EACH WAKE DOES, and WHAT IT NEVER DOES. Inside the 07:00-19:00 Europe/Paris window it requests ONE GPS
// fix, classifies it against the bundled polygon, discards the coordinate (LiveLocation.awaitClassifiedFix,
// D18), and folds the resulting side into the day's tally (recordFix). Outside the window it does nothing. It
// NEVER records a day (D16 - only a confirming tap does); it only accumulates the tally the evening proposal
// reads. No coordinate is read, stored, logged or sent at any point - the worker only ever sees a
// Classification and the day string.
//
// NO GEOFENCING, NO PLAY SERVICES. SPEC 13.1 names geofencing as a budget OPTION; using the Play Services
// Geofencing API would add a dependency (R136 - prefer the platform, no geo dependency) and D31's geofence
// CONTINGENCY is built only if Checkpoint G triggers it. So the spike choice here is WorkManager periodic +
// a single platform GPS fix, which needs no new dependency. The battery of this choice is A5's measurement.

class SamplingWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    @Suppress("ReturnCount") // early returns are the "skip this wake" paths (outside window, no fix); all success
    override suspend fun doWork(): Result {
        val clock = Clock.systemUTC()
        if (!insideWorkingWindow(clock)) return Result.success()

        val border = loadBundledBorder(applicationContext)
        val classification = awaitClassifiedFix(applicationContext, border) ?: return Result.success()

        val dayDate = todayInParis(clock)
        recordFix(
            dao = MonReleveDatabase.get(applicationContext).tallyDao(),
            cursorStore = SharedPrefsSamplingCursorStore(applicationContext),
            dayDate = dayDate,
            windowStartMinuteOfDay = WORKING_WINDOW_START_MINUTE,
            windowEndMinuteOfDay = WORKING_WINDOW_END_MINUTE,
            classification = classification,
            epochMillis = clock.millis(),
        )
        return Result.success()
    }
}

/** True when the current Paris wall-clock minute-of-day is within the working window (R28). */
fun insideWorkingWindow(clock: Clock): Boolean {
    val now = LocalTime.now(clock.withZone(ZoneId.of("Europe/Paris")))
    val minuteOfDay = now.hour * 60 + now.minute
    return minuteOfDay in WORKING_WINDOW_START_MINUTE until WORKING_WINDOW_END_MINUTE
}

/**
 * True once the Paris working window has ended for today (the evening, SPEC 11.2 ETAT B). The Aujourd'hui
 * auto surface reads this to decide whether a day is concluded enough to show a proposal (or the not-sure
 * message) rather than "detection en cours" - it does not show a withheld day while the day is still running.
 */
fun afterWorkingWindow(clock: Clock): Boolean {
    val now = LocalTime.now(clock.withZone(ZoneId.of("Europe/Paris")))
    val minuteOfDay = now.hour * 60 + now.minute
    return minuteOfDay >= WORKING_WINDOW_END_MINUTE
}
