package ch.monreleve.app.detection

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.todayInParis
import java.time.Clock

// R320. The background sampler (SPEC 13.1: WorkManager periodic work). Detection checks the position FOUR TIMES A
// DAY, not continuously: the worker wakes periodically, and each wake does something ONLY when it lands inside one
// of the four check windows (CheckWindows.kt) whose slot is still empty.
//
// WHAT EACH WAKE DOES, and WHAT IT NEVER DOES. Inside a check window whose slot has no fix yet it requests ONE
// fix (GPS first, then NETWORK as the indoor fallback - R322), classifies it against the bundled polygon reading
// the fix's accuracy to decide whether it may assert a side (R324), discards the coordinate AND the accuracy value
// (awaitClassifiedFix, D18), and writes the side into that window's slot while counting which provider produced it
// (recordCheck - counts only, never a coordinate or an accuracy value, R324). A wake outside every window -
// including lunch - does NOTHING: a check
// that cannot run inside its window is MISSED, never taken late (an 11:00 check delayed to 13:00 would sample
// lunch, which the windows exist to avoid). It NEVER records a day (D16 - only a confirming tap does); it only
// fills the day's four checks the evening vote reads. No coordinate is read, stored, logged or sent at any point -
// the worker only ever sees a Classification and the day string.
//
// NO EXACT ALARMS, NO GEOFENCING, NO PLAY SERVICES. The exact-alarm permission is restricted and NOT requested
// (R320); periodic WorkManager + a single platform GPS fix needs no new dependency (R136). The window is 60 minutes
// wide precisely because WorkManager cannot promise an exact time; A5 measures how many checks Samsung still drops.

class SamplingWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    @Suppress("ReturnCount") // each early return is a distinct "nothing to do this wake" path; all return success
    override suspend fun doWork(): Result {
        val clock = Clock.systemUTC()
        // R323 / PARKAN-36: every wake also offers the evening proposal notification. It self-gates (opted in,
        // auto mode, a concluded working day with no entry yet, not already fired today), so most wakes do
        // nothing; the first wake after the last window posts it. It records nothing (D16) and reads no
        // coordinate (D18) - only the day's four Classification checks and the entry rows.
        maybeNotifyEvening(applicationContext, clock)
        val window = currentCheckWindow(clock) ?: return Result.success() // between windows, or lunch
        val dao = MonReleveDatabase.get(applicationContext).tallyDao()
        val dayDate = todayInParis(clock)
        if (dao.byDay(dayDate).hasCheck(window.index)) return Result.success() // this window already sampled today

        val border = loadBundledBorder(applicationContext)
        // No fix inside the window -> this check stays MISSED (null); never taken late. The ProviderFix carries
        // the side AND which provider produced it, so the tally can count GPS vs NETWORK (R324) - never the
        // coordinate, never the accuracy value (D18).
        val fix = awaitClassifiedFix(applicationContext, border) ?: return Result.success()
        recordCheck(dao, dayDate, window.index, fix.classification, fix.provider)
        return Result.success()
    }
}
