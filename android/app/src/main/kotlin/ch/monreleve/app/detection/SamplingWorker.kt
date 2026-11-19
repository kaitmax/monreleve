package ch.monreleve.app.detection

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
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
//
// AN-SESSION-END (R1180). A WAKE FOR NOBODY DOES NOTHING, AND ENDS ITS OWN SCHEDULE. A3's N3: after a sign-out the
// work stayed scheduled, and a wake checked only the window and the day's tally - so its next window would have asked
// the OS for a fix for nobody, against the background-location declaration. Every wake now asks FIRST, at use, whether
// a session exists (the process's session: a token pair is held) AND the phone's mode is AUTO_DETECT. If either is
// missing it requests no fix, offers no notification, and cancels the unique work through DetectionScheduling's one
// stop. The guard sits before the two notifications as well as before the fix: this worker exists for a signed-in
// person in automatic mode, and the threshold alert keeps its foreground run (MainActivity) for everyone else.
// It carries the load whatever ended the session - including the one ending no seam can see (an unreadable Keystore
// blob, which KeystoreTokenStore.load drops); the "session ended" seam (auth/SessionEndSeam.kt) cancels the schedule
// at the ending itself, so the guard is the backstop, not the only stop.

class SamplingWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext
        val clock = Clock.systemUTC()
        samplingWake(
            clock,
            signedIn = { processSession(app).isSignedIn() },
            loggingMode = { SharedPrefsDetectionModeStore(app).load() },
            cancelOwnSchedule = { DetectionScheduling.stopSampling(app) },
            offerNotifications = {
                // AN-ALERT: the once-a-day threshold check (section 1: "once a day after the day's checks conclude").
                // Runs BEFORE the evening reminder so a new crossing that coincides with the reminder posts ONE merged
                // notification (never two a day) and marks the reminder shown, which the reminder then skips. It
                // self-gates on the opt-in and a NEW crossing, records nothing (D16/R340) and reads no coordinate (D18)
                // - only the recorded days, the rhythm and the settings, by value through the engine.
                maybeAlertThreshold(app, clock)
                // R323 / PARKAN-36: every wake also offers the evening proposal notification. It self-gates (opted in,
                // auto mode, a concluded working day with no entry yet, not already fired today), so most wakes do
                // nothing; the first wake after the last window posts it. It records nothing (D16) and reads no
                // coordinate (D18) - only the day's four Classification checks and the entry rows.
                maybeNotifyEvening(app, clock)
            },
            tallies = { MonReleveDatabase.get(app).tallyDao() },
            // No fix inside the window -> this check stays MISSED (null); never taken late. The ProviderFix carries
            // the side AND which provider produced it, so the tally can count GPS vs NETWORK (R324) - never the
            // coordinate, never the accuracy value (D18).
            requestFix = { awaitClassifiedFix(app, loadBundledBorder(app)) },
        )
        // Every wake succeeds, whatever it did: a missed window is MISSED, never retried late.
        return Result.success()
    }
}

/** What one wake did. The worker returns success whatever it is; SamplingWakeTest reads it. */
internal enum class WakeOutcome {
    /** R1180: no session - no fix asked for, and the sampler cancelled its own schedule. */
    ENDED_NO_SESSION,

    /** R1180: signed in, but the phone is not in automatic mode - no fix, the schedule cancelled. */
    ENDED_NOT_AUTOMATIC,

    /** Between windows, or lunch: nothing to sample. */
    NO_WINDOW,

    /** This window already has today's check. */
    WINDOW_DONE,

    /** A fix was asked for and none came inside the window: the check stays MISSED. */
    MISSED,

    /** A fix was asked for, classified, and its side written to the window's slot. */
    SAMPLED,
}

/**
 * ONE WAKE of the sampler, over seams, so it runs as a plain JVM test (the app has no WorkManager test harness):
 * [requestFix] is the only door to the location layer, and a test counts what goes through it.
 */
@Suppress("LongParameterList", "ReturnCount") // the seams ARE the wake's world; each early return is one outcome
internal suspend fun samplingWake(
    clock: Clock,
    signedIn: () -> Boolean,
    loggingMode: () -> LoggingMode,
    cancelOwnSchedule: () -> Unit,
    offerNotifications: suspend () -> Unit,
    tallies: () -> TallyDao,
    requestFix: suspend () -> ProviderFix?,
): WakeOutcome {
    // R1180: THE GUARD, FIRST. Read at this wake (R423), never captured: a session that ended, or a mode that left
    // automatic, since the last wake stops THIS one. Neither -> no fix asked for, no notification offered, and the
    // schedule cancelled through the one stop (DetectionScheduling.stopSampling), so the next window is not woken.
    if (!signedIn()) return endSchedule(cancelOwnSchedule, WakeOutcome.ENDED_NO_SESSION)
    if (loggingMode() != LoggingMode.AUTO_DETECT) return endSchedule(cancelOwnSchedule, WakeOutcome.ENDED_NOT_AUTOMATIC)
    offerNotifications()
    val window = currentCheckWindow(clock) ?: return WakeOutcome.NO_WINDOW // between windows, or lunch
    val dao = tallies()
    val dayDate = todayInParis(clock)
    if (dao.byDay(dayDate).hasCheck(window.index)) return WakeOutcome.WINDOW_DONE // already sampled today
    val fix = requestFix() ?: return WakeOutcome.MISSED
    recordCheck(dao, dayDate, window.index, fix.classification, fix.provider)
    return WakeOutcome.SAMPLED
}

private fun endSchedule(
    cancelOwnSchedule: () -> Unit,
    outcome: WakeOutcome,
): WakeOutcome {
    cancelOwnSchedule()
    return outcome
}
