package ch.monreleve.app.detection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ch.monreleve.app.R
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.fr.NotificationCopy
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import java.time.Clock
import java.time.ZoneId

// R323 / PARKAN-36. The evening proposal notification's ANDROID GLUE: it gathers the day's state, asks the pure
// decision (EveningNotificationDecision), and - only when the decision says so - posts ONE local notification.
// No server, no FCM (SPEC 13.3's reminder was parked as a server feature; this one needs none).
//
// LOCK SCREEN SHOWS NOTHING PRIVATE. The posted notification is VISIBILITY_PRIVATE with a PUBLIC VERSION: on a
// locked phone the platform shows the public version (that a proposal waits, never where - D18 on the lock
// screen); unlocked, it shows the detected side. The channel's lockscreenVisibility is PRIVATE too, so the
// default is to hide content a user has not unlocked for.
//
// NOTHING IS RECORDED FROM THE NOTIFICATION (D16): tapping only opens Aujourd'hui (EXTRA_OPEN_AUJOURDHUI), where
// the person confirms or corrects. No coordinate is read here (D18) - the glue reads only the day's four
// Classification checks and the entry rows.

/** The launch-intent extra that tells MainActivity to open the Aujourd'hui tab (a notification tap, D16). */
const val EXTRA_OPEN_AUJOURDHUI = "ch.monreleve.app.OPEN_AUJOURDHUI"

// android.permission.POST_NOTIFICATIONS (Android 13+, API 33). A literal, not Manifest.permission.POST_NOTIFICATIONS,
// so no API-33 symbol is referenced on minSdk 26 (the NewApi gate stays clean) - the permission name is a frozen
// platform value, the same reasoning as FIX_PROVIDERS' provider literals. Requested only when the person turns the
// evening notification on, and only on API 33+ (below it, posting needs no grant).
const val POST_NOTIFICATIONS_PERMISSION = "android.permission.POST_NOTIFICATIONS"

private const val CHANNEL_ID = "monreleve.evening.proposal"
private const val EVENING_NOTIFICATION_ID = 1001
private val PARIS: ZoneId = ZoneId.of("Europe/Paris")

/**
 * Called on every background wake (SamplingWorker): if the person has opted in, automatic detection is on, today
 * is a working day that has concluded with no entry yet, and it has not already fired today, post the single
 * evening notification for today's proposal. All six conditions are the pure decision's; this only gathers them.
 */
suspend fun maybeNotifyEvening(
    context: Context,
    clock: Clock,
) {
    val eveningStore = SharedPrefsEveningNotificationStore(context)
    // Cheap early-out: opted out is the default, and then there is nothing to read from the database.
    if (!eveningStore.isEnabled()) return

    val today = todayInParis(clock)
    val db = MonReleveDatabase.get(context)
    val checks = db.tallyDao().byDay(today)?.toDayChecks() ?: DayChecks(null, null, null, null)
    val conditions =
        EveningConditions(
            optedIn = true,
            autoMode = SharedPrefsDetectionModeStore(context).load() == LoggingMode.AUTO_DETECT,
            workingDay = isWorkingDay(clock.instant().atZone(PARIS).toLocalDate().dayOfWeek.value),
            // Conservative: ANY recorded portion today suppresses the notification (never nag a recorded day).
            hasEntryToday = db.entryDao().all().any { it.dayDate == today },
            dayConcluded = afterLastCheckWindow(clock),
            alreadyNotified = eveningStore.lastNotifiedDay() == today,
        )
    val notice = eveningDecision(conditions, detectionOutcome(dayProposal(checks))) ?: return

    EveningNotifier.ensureChannel(context)
    EveningNotifier.post(context, notice)
    eveningStore.markNotified(today) // at most one per working day
}

object EveningNotifier {
    /** Create the evening-proposal channel (idempotent). Private on the lock screen; posts carry a public version. */
    fun ensureChannel(context: Context) {
        val channel =
            NotificationChannel(CHANNEL_ID, NotificationCopy.CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT)
                .apply {
                    description = NotificationCopy.CHANNEL_DESCRIPTION
                    lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /** Post the single evening notification: PRIVATE content with a PUBLIC version for the lock screen. */
    fun post(
        context: Context,
        notice: EveningNotice,
    ) {
        val manager = NotificationManagerCompat.from(context)
        // On API 33+ a denied POST_NOTIFICATIONS makes this disabled; respect it rather than posting into a void.
        if (!manager.areNotificationsEnabled()) return

        val kindName = (notice as? EveningNotice.Proposed)?.kind?.name // null -> the not-sure invitation
        val publicLines = NotificationCopy.publicLines()
        val publicNotification =
            baseBuilder(context)
                .setContentTitle(publicLines.title)
                .setContentText(publicLines.text)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build()
        val privateLines = NotificationCopy.privateLines(kindName)
        val notification =
            baseBuilder(context)
                .setContentTitle(privateLines.title)
                .setContentText(privateLines.text)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicNotification)
                .setContentIntent(openAujourdhui(context))
                .setAutoCancel(true)
                .build()
        manager.notify(EVENING_NOTIFICATION_ID, notification)
    }

    private fun baseBuilder(context: Context): NotificationCompat.Builder =
        NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_sun)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

    // D16: the tap only OPENS Aujourd'hui; it records nothing. The launcher intent targets MainActivity without
    // detection/ importing it, and EXTRA_OPEN_AUJOURDHUI forces the Aujourd'hui tab even on a warm resume.
    private fun openAujourdhui(context: Context): PendingIntent {
        val intent =
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                putExtra(EXTRA_OPEN_AUJOURDHUI, true)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
