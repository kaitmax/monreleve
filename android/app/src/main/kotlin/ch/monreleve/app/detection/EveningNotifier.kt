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
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.LocalRhythmRepository
import ch.monreleve.app.forecast.projectedThresholdCrossing
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.DetectionCopy
import ch.monreleve.app.fr.NotificationCopy
import ch.monreleve.app.fr.NotificationLines
import ch.monreleve.app.fr.format.formatDayLong
import ch.monreleve.app.notification.EveningTap
import ch.monreleve.app.notification.eveningRecordIntent
import ch.monreleve.app.settings.AlertThreshold
import ch.monreleve.app.settings.LoggingMode
import ch.monreleve.app.settings.SharedPrefsDetectionModeStore
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import ch.monreleve.app.settings.SharedPrefsSettingsStore
import ch.monreleve.app.settings.SharedPrefsThresholdAlertStore
import kotlinx.coroutines.flow.first
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

// R323 / PARKAN-36, extended by AN-NOTIF (R339). The evening notification's ANDROID GLUE: it gathers the day's
// state, asks the pure decision (EveningNotificationDecision), and - only when the decision says so - posts ONE
// local notification. No server, no FCM (SPEC 13.3's reminder was parked as a server feature; this one needs none).
//
// R339: A NOTIFICATION BUTTON MAY RECORD THE DAY. The notification carries RECORDING BUTTONS - manual mode the two
// side buttons, auto mode Confirmer and the other side - built as IMMUTABLE BROADCAST PendingIntents to
// EveningActionReceiver (a receiver, off the main thread; Android 12+ forbids a receiver that a notification
// launched from starting an activity, so "Autre…"/body/"Modifier" are ACTIVITY PendingIntents instead). D16 holds:
// a clearly labelled button tap IS the person's tap; nothing is written unless the receiver's pure decision says so.
//
// LOCK SCREEN SHOWS NOTHING PRIVATE AND OFFERS NO BUTTONS. The posted notification is VISIBILITY_PRIVATE with a
// PUBLIC VERSION that says only that a day is to record (never where, D18) and carries NO actions. Each recording
// action additionally requires the device UNLOCKED (setAuthenticationRequired, Android 12+/API 31+), so someone
// picking up a locked phone cannot write to the owner's tax record. The channel is PRIVATE too.
//
// NO COORDINATE IS READ HERE (D18) - the glue reads only the day's four Classification checks and the entry rows.

/** The launch-intent extra that tells MainActivity to open the Aujourd'hui tab (a notification tap, D16). */
const val EXTRA_OPEN_AUJOURDHUI = "ch.monreleve.app.OPEN_AUJOURDHUI"

/** AN-ALERT. The launch-intent extra that tells MainActivity to open the forecast (a threshold-alert tap). */
const val EXTRA_OPEN_FORECAST = "ch.monreleve.app.OPEN_FORECAST"

// android.permission.POST_NOTIFICATIONS (Android 13+, API 33). A literal, not Manifest.permission.POST_NOTIFICATIONS,
// so no API-33 symbol is referenced on minSdk 26 (the NewApi gate stays clean) - the permission name is a frozen
// platform value, the same reasoning as FIX_PROVIDERS' provider literals. Requested only when the person turns the
// evening notification on, and only on API 33+ (below it, posting needs no grant).
const val POST_NOTIFICATIONS_PERMISSION = "android.permission.POST_NOTIFICATIONS"

private const val CHANNEL_ID = "monreleve.evening.proposal"

// AN-ALERT: the threshold alert's OWN channel, so it can be silenced apart from the evening reminder.
private const val ALERT_CHANNEL_ID = "monreleve.threshold.alert"

// AN-ALERT (never two Mon Releve notifications a day): the alert and the evening reminder SHARE this id, so
// posting one replaces the other rather than stacking - at most one Mon Releve notification exists at a time.
private const val EVENING_NOTIFICATION_ID = 1001
private val PARIS: ZoneId = ZoneId.of("Europe/Paris")

// AN-NOTIF (R339). How long the post-tap confirmation lingers before it disappears on its own. Eight seconds:
// long enough to read the one-line « <côté> / Enregistré pour le <date> » and tap « Modifier » if the tap was a
// mistake, short enough that it does not sit as a nag - the product is a support, not a reminder that persists.
// Mistakes past the window are still fixable in the app (the prompt: no undo button is needed beyond Modifier).
private const val CONFIRMATION_TIMEOUT_MS = 8_000L

// Distinct request codes per recording button: a PendingIntent's identity ignores its extras, so two buttons
// sharing a request code would collide (the second would overwrite the first's day/kind). The activity opens
// (body/Autre…/Modifier) share REQUEST_OPEN - they are the same action.
private const val REQUEST_OPEN = 0
private const val REQUEST_RECORD_PRIMARY = 1
private const val REQUEST_RECORD_SECONDARY = 2

// AN-ALERT: a distinct request code so the forecast-opening PendingIntent never collides with openAujourdhui's.
private const val REQUEST_OPEN_FORECAST = 3

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
    val (conditions, outcome) =
        gatherEveningConditions(context, clock, today, db, alreadyNotified = eveningStore.lastNotifiedDay() == today)
    val notice = eveningDecision(conditions, outcome) ?: return

    // R303: the notification is shown FOR the account signed in now; the buttons carry it, and the receiver
    // refuses the write if a different account is signed in when a button is tapped.
    val account = SharedPrefsAccountStore(context).current()
    // AN-ALERT (never two Mon Releve notifications a day): if a threshold alert already fired today, its
    // sentence JOINS this one notification (composeDaily -> Merged) and the record buttons stay; otherwise the
    // reminder posts alone, unchanged.
    val composition = composeDaily(notice, SharedPrefsThresholdAlertStore(context).activeThresholdToday(today))
    EveningNotifier.postDaily(context, composition, today, account)
    eveningStore.markNotified(today) // at most one per working day
}

/**
 * AN-ALERT. The threshold alert: when the person has opted in, recompute the year-end forecast on the imagined
 * year (the EXISTING engine, R281/R340 - never UI arithmetic) and, THE FIRST TIME it would cross a threshold,
 * post one notification. The last crossing state per threshold is kept on the phone, so staying crossed is
 * silent and a fall-back-then-re-cross fires again (decideThresholdAlert). NEVER TWO MON RELEVE NOTIFICATIONS A
 * DAY: if the evening reminder applies today, the alert's sentence joins it with its record buttons kept;
 * otherwise the alert posts alone, opening the forecast. It records NOTHING (D16/R340) and reads no coordinate
 * (D18) - only the entry rows, the rhythm and the settings, all by value through the engine.
 */
@Suppress("ReturnCount")
suspend fun maybeAlertThreshold(
    context: Context,
    clock: Clock,
) {
    val alertStore = SharedPrefsThresholdAlertStore(context)
    if (!alertStore.isEnabled()) return // OPT-OUT SENDS NOTHING

    val today = todayInParis(clock)
    val todayDate = LocalDate.parse(today)
    val db = MonReleveDatabase.get(context)
    val account = SharedPrefsAccountStore(context).current()
    val settings = SharedPrefsSettingsStore(context).load() ?: return
    val rhythm = LocalRhythmRepository(db.rhythmDao(), account).observe().first()
    val current = projectedThresholdCrossing(settings, db.entryDao().all(), rhythm, todayDate, todayDate.year)

    val decision = decideThresholdAlert(optedIn = true, current = current, previous = alertStore.crossing())
    alertStore.saveCrossing(decision.newState) // keep the last state whether or not it fires
    val threshold = decision.alert ?: return // no NEW crossing this evaluation

    // A new crossing. Merge with the evening reminder when it applies today (alreadyNotified ignored, so a
    // reminder already shown is replaced by the merged one with its buttons kept), else post the alert alone.
    val (conditions, outcome) = gatherEveningConditions(context, clock, today, db, alreadyNotified = false)
    val eveningNotice = eveningDecision(conditions, outcome)
    EveningNotifier.postDaily(context, composeDaily(eveningNotice, threshold), today, account)
    alertStore.markAlerted(today, threshold)
    if (eveningNotice != null) SharedPrefsEveningNotificationStore(context).markNotified(today)
}

// AN-NOTIF / AN-ALERT. Gather the evening reminder's six conditions and today's detection outcome in one place
// (R206), so maybeNotifyEvening and the alert's same-day merge read them identically - the only difference is
// [alreadyNotified], which the merge sets false (it wants "does the reminder apply", not "has it fired yet").
private suspend fun gatherEveningConditions(
    context: Context,
    clock: Clock,
    today: String,
    db: MonReleveDatabase,
    alreadyNotified: Boolean,
): Pair<EveningConditions, DetectionOutcome> {
    val checks = db.tallyDao().byDay(today)?.toDayChecks() ?: DayChecks(null, null, null, null)
    val conditions =
        EveningConditions(
            optedIn = SharedPrefsEveningNotificationStore(context).isEnabled(),
            autoMode = SharedPrefsDetectionModeStore(context).load() == LoggingMode.AUTO_DETECT,
            workingDay = isWorkingDay(clock.instant().atZone(PARIS).toLocalDate().dayOfWeek.value),
            // Conservative: ANY recorded portion today suppresses the notification (never nag a recorded day).
            hasEntryToday = db.entryDao().all().any { it.dayDate == today },
            dayConcluded = afterLastCheckWindow(clock),
            alreadyNotified = alreadyNotified,
        )
    return conditions to detectionOutcome(dayProposal(checks))
}

// TooManyFunctions suppressed: this is the notification's cohesive builder set (the channel, the actionable post
// and its per-mode content/actions, the confirmation, the cancel, the lock-screen public version, the small
// mappers). Splitting it across objects would scatter one notification's construction, not simplify it.
@Suppress("TooManyFunctions")
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

    /**
     * Post the single evening notification (R339): PRIVATE content with the recording buttons and a PUBLIC
     * lock-screen version that carries NO buttons. `shownForDay`/`shownForAccount` are baked into the buttons so
     * the receiver records exactly the day shown, for exactly the account shown (R303).
     */
    fun post(
        context: Context,
        notice: EveningNotice,
        shownForDay: String,
        shownForAccount: String?,
        // AN-ALERT: the threshold alert's sentence to JOIN this reminder (the same-day merge). Null = the
        // reminder alone. It is added to the UNLOCKED text only; the public (lock-screen) version is unchanged,
        // so the merge never reveals the threshold on a locked phone (R323).
        alertSentence: String? = null,
    ) {
        val manager = NotificationManagerCompat.from(context)
        // On API 33+ a denied POST_NOTIFICATIONS makes this disabled; respect it rather than posting into a void.
        if (!manager.areNotificationsEnabled()) return

        val content = privateContent(notice, shownForDay)
        val builder =
            baseBuilder(context)
                .setContentTitle(content.title)
                .setContentText(content.text)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion(context))
                .setContentIntent(openAujourdhui(context))
                .setAutoCancel(true)
        alertSentence?.let {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText("${content.text}\n\n$it"))
        }
        recordActions(context, notice, shownForDay, shownForAccount).forEach { builder.addAction(it) }
        // "Autre…" opens the app on today (a mission, an absence, a split half-day) - an ACTIVITY PendingIntent,
        // never a broadcast (Android 12+ forbids a receiver that a notification launched from starting an activity).
        builder.addAction(R.drawable.ic_sun, NotificationCopy.AUTRE, openAujourdhui(context))
        manager.notify(EVENING_NOTIFICATION_ID, builder.build())
    }

    /**
     * AN-ALERT. Post the ONE Mon Releve notification for today, from the composed decision (never two a day):
     * the alert alone (opens the forecast, its own channel), the reminder alone, or the reminder with the
     * alert's sentence joined and its record buttons kept. The alert's sentence has one home - NotificationCopy
     * .alertTitle (R206).
     */
    fun postDaily(
        context: Context,
        composition: DailyNotification,
        shownForDay: String,
        shownForAccount: String?,
    ) {
        when (composition) {
            DailyNotification.None -> Unit
            is DailyNotification.Alert -> postAlert(context, composition.threshold)
            is DailyNotification.Evening -> {
                ensureChannel(context)
                post(context, composition.notice, shownForDay, shownForAccount)
            }
            is DailyNotification.Merged -> {
                ensureChannel(context)
                post(
                    context,
                    composition.notice,
                    shownForDay,
                    shownForAccount,
                    NotificationCopy.alertTitle(composition.threshold.name),
                )
            }
        }
    }

    /**
     * AN-ALERT. The threshold alert alone: PRIVATE content naming the seuil (unlocked), a PUBLIC lock-screen
     * version that says only that there is information about the year (no figure, no threshold, R323), NO
     * record buttons, and a tap that opens the forecast. Same id as the reminder, so the two never coexist.
     */
    fun postAlert(
        context: Context,
        threshold: AlertThreshold,
    ) {
        ensureAlertChannel(context)
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        val notification =
            alertBaseBuilder(context)
                .setContentTitle(NotificationCopy.alertTitle(threshold.name))
                .setContentText(NotificationCopy.ALERT_PROJECTION_NOTE)
                .setStyle(NotificationCompat.BigTextStyle().bigText(NotificationCopy.ALERT_PROJECTION_NOTE))
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(alertPublicVersion(context))
                .setContentIntent(openForecast(context))
                .setAutoCancel(true)
                .build()
        manager.notify(EVENING_NOTIFICATION_ID, notification)
    }

    /** AN-ALERT. The threshold alert's channel « Seuils » (idempotent). Private on the lock screen. */
    fun ensureAlertChannel(context: Context) {
        val channel =
            NotificationChannel(
                ALERT_CHANNEL_ID,
                NotificationCopy.ALERT_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = NotificationCopy.ALERT_CHANNEL_DESCRIPTION
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /** The unlocked (private) title and text, by mode (R339): the question (manual), the proposal (auto HIGH),
     *  or the not-sure invitation (auto otherwise). The day is shown in words (formatDayLong). */
    private fun privateContent(
        notice: EveningNotice,
        shownForDay: String,
    ): NotificationLines =
        when (notice) {
            is EveningNotice.Proposed ->
                NotificationLines(NotificationCopy.autoProposalTitle(notice.kind.name), formatDayLong(shownForDay))
            EveningNotice.NotSure -> NotificationLines(NotificationCopy.MANUAL_TITLE, DetectionCopy.NOT_SURE)
            EveningNotice.Manual -> NotificationLines(NotificationCopy.MANUAL_TITLE, formatDayLong(shownForDay))
        }

    /**
     * The recording buttons, by mode. Auto HIGH: Confirmer (record the proposed side, DETECTED_CONFIRMED) and the
     * other side (DETECTED_CORRECTED, keeping the detected side, R202). Manual and not-sure: the two side buttons
     * (MANUAL). Each is an immutable broadcast to EveningActionReceiver that requires the device unlocked.
     */
    private fun recordActions(
        context: Context,
        notice: EveningNotice,
        shownForDay: String,
        shownForAccount: String?,
    ): List<NotificationCompat.Action> =
        when (notice) {
            is EveningNotice.Proposed -> {
                val proposed = notice.kind
                val other = otherSide(proposed)
                listOf(
                    recordAction(
                        context,
                        REQUEST_RECORD_PRIMARY,
                        DetectionCopy.CONFIRM,
                        EveningTap(shownForDay, shownForAccount, proposed, Provenance.DETECTED_CONFIRMED, proposed),
                    ),
                    recordAction(
                        context,
                        REQUEST_RECORD_SECONDARY,
                        sideLabel(other),
                        EveningTap(shownForDay, shownForAccount, other, Provenance.DETECTED_CORRECTED, proposed),
                    ),
                )
            }
            EveningNotice.NotSure, EveningNotice.Manual -> manualActions(context, shownForDay, shownForAccount)
        }

    private fun manualActions(
        context: Context,
        shownForDay: String,
        shownForAccount: String?,
    ): List<NotificationCompat.Action> =
        listOf(
            recordAction(
                context,
                REQUEST_RECORD_PRIMARY,
                AujourdhuiCopy.SUISSE,
                EveningTap(shownForDay, shownForAccount, EntryKind.CH, Provenance.MANUAL, null),
            ),
            recordAction(
                context,
                REQUEST_RECORD_SECONDARY,
                AujourdhuiCopy.DOMICILE,
                EveningTap(shownForDay, shownForAccount, EntryKind.HOME, Provenance.MANUAL, null),
            ),
        )

    // A recording button: an IMMUTABLE BROADCAST PendingIntent to the receiver, requiring the device UNLOCKED
    // (setAuthenticationRequired - API 31+/Android 12; a no-op below, where there is no lock-screen action gate).
    private fun recordAction(
        context: Context,
        requestCode: Int,
        label: String,
        tap: EveningTap,
    ): NotificationCompat.Action {
        val pending =
            PendingIntent.getBroadcast(
                context,
                requestCode,
                eveningRecordIntent(context, tap),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        return NotificationCompat.Action.Builder(R.drawable.ic_sun, label, pending)
            .setAuthenticationRequired(true)
            .build()
    }

    // The lock-screen (public) notification: says only that a day is to record (D18), with NO actions (section 3).
    private fun publicVersion(context: Context): Notification {
        val lines = NotificationCopy.publicLines()
        return baseBuilder(context)
            .setContentTitle(lines.title)
            .setContentText(lines.text)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    // AN-ALERT. The alert's lock-screen (public) version: says only that there is information about the year -
    // NO figure, NO threshold, NO actions (R323). The threshold named in the private version never appears here.
    private fun alertPublicVersion(context: Context): Notification {
        val lines = NotificationCopy.alertPublicLines()
        return alertBaseBuilder(context)
            .setContentTitle(lines.title)
            .setContentText(lines.text)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun sideLabel(kind: EntryKind): String =
        when (kind) {
            EntryKind.CH -> AujourdhuiCopy.SUISSE
            else -> AujourdhuiCopy.DOMICILE
        }

    private fun otherSide(kind: EntryKind): EntryKind =
        when (kind) {
            EntryKind.CH -> EntryKind.HOME
            else -> EntryKind.CH
        }

    /**
     * AN-NOTIF (R339). After a tap records the day, the actionable notification becomes a one-line confirmation
     * « <côté> / Enregistré pour le <date> » with a single « Modifier » button (opens the app on today), and
     * disappears on its own after CONFIRMATION_TIMEOUT_MS. SAME id (EVENING_NOTIFICATION_ID), so it REPLACES the
     * actionable notification rather than stacking (section 3: one per day). It says « Enregistré », never
     * « envoyé » - the phone's record, as on Aujourd'hui; the sync state stays the app's business.
     */
    fun postConfirmation(
        context: Context,
        kindName: String,
        dayDate: String,
    ) {
        ensureChannel(context)
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        val lines = NotificationCopy.confirmation(kindName, dayDate)
        val notification =
            baseBuilder(context)
                .setContentTitle(lines.title)
                .setContentText(lines.text)
                // The side is private; a secure lock screen redacts it (no explicit public version), revealing
                // nothing (D18). The side is harmless on an unlocked or PIN-less phone.
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .addAction(R.drawable.ic_sun, AujourdhuiCopy.MODIFIER, openAujourdhui(context))
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setTimeoutAfter(CONFIRMATION_TIMEOUT_MS)
                .build()
        manager.notify(EVENING_NOTIFICATION_ID, notification)
    }

    /**
     * AN-NOTIF (R339). Cancel today's evening notification. Recording the day by ANY path - the app, the
     * calendar, another button - dismisses it (section 3), and a refused tap (wrong account / wrong day) dismisses
     * it too. Cancelling by the one constant id reaches exactly this notification.
     */
    fun cancel(context: Context) {
        NotificationManagerCompat.from(context).cancel(EVENING_NOTIFICATION_ID)
    }

    private fun baseBuilder(context: Context): NotificationCompat.Builder =
        NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_sun)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

    // AN-ALERT: the alert's builder on its own channel « Seuils ».
    private fun alertBaseBuilder(context: Context): NotificationCompat.Builder =
        NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_sun)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)

    // AN-ALERT: the alert tap OPENS the forecast (D16: it records nothing). A distinct request code from
    // openAujourdhui so the two activity PendingIntents never collide; EXTRA_OPEN_FORECAST forces the forecast.
    private fun openForecast(context: Context): PendingIntent {
        val intent =
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                putExtra(EXTRA_OPEN_FORECAST, true)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
        return PendingIntent.getActivity(
            context,
            REQUEST_OPEN_FORECAST,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

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
            REQUEST_OPEN,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
