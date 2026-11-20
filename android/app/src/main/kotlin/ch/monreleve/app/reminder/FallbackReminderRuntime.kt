package ch.monreleve.app.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.detection.EveningNotice
import ch.monreleve.app.detection.gatherEveningConditions
import ch.monreleve.app.detection.postEveningFor
import ch.monreleve.app.push.PushAvailability
import ch.monreleve.app.push.notificationsPermitted
import ch.monreleve.app.push.showOncePerDay
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

// AN-MANUAL-REMINDER (R1140, R1141). THE 19:00 FALLBACK'S ANDROID GLUE: the schedule, the wake, the re-plan.
//
// THE MECHANISM, AND WHY (R1140). A WorkManager ONE-TIME request with an initial delay to the next 19:00 device-local,
// which on every wake plans the next one - a CHAIN, not a 24-hour PeriodicWorkRequest. Chosen against an inexact
// AlarmManager alarm by the three things R1140 names, none of which needs SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM:
//   - REBOOT: WorkManager keeps its requests in its own database and puts them back after a reboot or an app update
//     itself; an alarm is wiped by both and must be re-armed by hand. (RECEIVE_BOOT_COMPLETED is already in the APK,
//     declared by WorkManager - this task adds no permission.)
//   - DOZE: the request runs as a JobScheduler job, deferred while the phone dozes to the next maintenance window or to
//     the moment the screen comes on - which is when a reminder can be read. An inexact alarm is deferred the same way
//     unless it is an allow-while-idle one, which would wake a phone nobody is looking at.
//   - DRIFT: a fixed 24-hour period is measured from the previous run, so every late evening pushes the next one later
//     and a daylight-saving change moves it an hour. Each link here is computed afresh from the wall clock and the zone
//     in force (nextFallbackAt), so lateness never accumulates and 19:00 stays 19:00 local across DST.
// The same library as the sampler (DetectionScheduling) - no new dependency.
//
// RE-PLANNED (R1140): on a time-zone change and a clock change (FallbackReminderReplanReceiver: the delay is a
// duration, so the 19:00 it aimed at moves with the zone only if re-planned) and after a reboot (from the zone in
// force, catching up an evening whose 19:00 passed while the phone was off); ENSURED - never moved - at every launch
// of the signed-in shell (MainActivity), so a pending link survives.
//
// SCHEDULED ONLY WHILE SOMEBODY IS SIGNED IN (Android Ruling 8): the "session ended" seam cancels it on every ending
// path (auth/SessionEndSeam.kt), and a wake that finds nobody signed in cancels itself and plans nothing - the backstop
// for an ending no seam sees. Everything else - the mode, the opt-in, push - is read AT THE WAKE: push availability in
// particular can change with no event the app receives (a system notification setting, Play services), so it is a
// reason to show nothing that evening, never a reason to unschedule.

private const val TAG = "MonReleveReminder"

/** R1140: the fallback's schedule - one unique chain of one-time requests, each aimed at the next 19:00 local. */
internal object FallbackReminderScheduling {
    const val WORK = "monreleve.fallback.reminder"

    /** At a signed-in shell's launch: plan the next 19:00 only if no link is pending (KEEP). */
    fun ensure(context: Context) = enqueue(context, ExistingWorkPolicy.KEEP)

    /**
     * After a reboot: re-planned from the zone in force (the zone may have changed while the phone was off or booting,
     * with no TIMEZONE_CHANGED for any app), and an evening whose 19:00 has passed is decided at once (bootFallbackAt).
     * Measured on the emulator: KEEP here left the link aimed at the pre-boot zone's 19:00.
     */
    fun afterReboot(context: Context) = enqueue(context, ExistingWorkPolicy.REPLACE, ::bootFallbackAt)

    /** After a time-zone or clock change: the pending link aimed at the old 19:00, so it is replaced. */
    fun replan(context: Context) = enqueue(context, ExistingWorkPolicy.REPLACE)

    /** From inside a wake: the next link runs after this one finishes (APPEND) - the running one is never cancelled. */
    fun planNextAfterWake(context: Context) = enqueue(context, ExistingWorkPolicy.APPEND_OR_REPLACE)

    /** The session ended (the seam) or a wake found nobody signed in: nothing stays scheduled. Idempotent. */
    fun cancel(context: Context) {
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork(WORK)
    }

    private fun enqueue(
        context: Context,
        policy: ExistingWorkPolicy,
        target: (Instant, ZoneId) -> Instant = ::nextFallbackAt,
    ) {
        val now = Clock.systemDefaultZone().instant()
        val delay = Duration.between(now, target(now, ZoneId.systemDefault()))
        val request =
            OneTimeWorkRequestBuilder<FallbackReminderWorker>()
                .setInitialDelay(delay)
                .addTag(WORK)
                .build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(WORK, policy, request)
        Log.i(TAG, "fallback planned: policy=${policy.name} delaySeconds=${delay.seconds}")
    }
}

/** R1141: one wake of the fallback - see fallbackWake. Always a success: a missed evening is missed, never retried. */
internal class FallbackReminderWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext
        val clock = Clock.systemDefaultZone()
        val wake =
            fallbackWake(
                signedIn = { processSession(app).isSignedIn() },
                cancelOwnSchedule = { FallbackReminderScheduling.cancel(app) },
                remind = { maybeRemindAtFallback(app, clock) },
                planNext = { FallbackReminderScheduling.planNextAfterWake(app) },
            )
        Log.i(TAG, "fallback wake: ${wake.name}")
        return Result.success()
    }
}

/**
 * R1141: P4's whole path - the fallback's refusals, then R339's decision with 19:00 as the reminder time, through the
 * one showOncePerDay, posting the EXISTING evening notification for today (postEveningFor, as the push does).
 */
internal suspend fun maybeRemindAtFallback(
    context: Context,
    clock: Clock,
): EveningNotice? {
    val app = context.applicationContext
    val today = todayInParis(clock)
    val signedIn = processSession(app).isSignedIn()
    val pushAvailable = PushAvailability.isPushAvailable(app)
    val permitted = notificationsPermitted(app)
    val reached = reachedFallbackTime(clock.instant(), ZoneId.systemDefault())
    val db = MonReleveDatabase.get(app)
    return showOncePerDay(
        today,
        SharedPrefsEveningNotificationStore(app),
        decide = { alreadyNotified ->
            val (conditions, _) = gatherEveningConditions(app, clock, today, db, alreadyNotified)
            fallbackReminderDecision(signedIn, pushAvailable, permitted, reached, conditions).also { notice ->
                // Facts only - never a day, an account or a token - so a walkthrough can say which rule answered.
                Log.i(
                    TAG,
                    "fallback decision: shown=${notice != null} pushAvailable=$pushAvailable " +
                        "autoMode=${conditions.autoMode} permitted=$permitted reached=$reached " +
                        "optedIn=${conditions.optedIn} workingDay=${conditions.workingDay} " +
                        "entryToday=${conditions.hasEntryToday} alreadyShown=$alreadyNotified",
                )
            }
        },
        post = { notice -> postEveningFor(app, notice, today) },
    )
}

/**
 * R1140: RE-PLAN on a time-zone change and a clock change; ENSURE after a reboot. System broadcasts, all three exempt
 * from Android 8's implicit-broadcast limits; exported="false" (the system still delivers them, as it does to
 * WorkManager's own RescheduleReceiver). Nothing is scheduled for nobody: signed out, it does nothing.
 */
class FallbackReminderReplanReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val app = context.applicationContext
        if (!processSession(app).isSignedIn()) return
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> FallbackReminderScheduling.afterReboot(app)
            Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_TIME_CHANGED -> FallbackReminderScheduling.replan(app)
        }
    }
}
