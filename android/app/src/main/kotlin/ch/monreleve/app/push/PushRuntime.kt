package ch.monreleve.app.push

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.auth.processSession
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.detection.gatherEveningConditions
import ch.monreleve.app.detection.postEveningFor
import ch.monreleve.app.settings.SharedPrefsEveningNotificationStore
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailabilityLight
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Clock
import kotlin.coroutines.resume

// AN-FCM-CLIENT (R1150-R1153). THE ANDROID GLUE: Firebase, Play services, the notification permission and the stores,
// around the pure registration pass (PushRegistration.kt) and the pure receipt rules (PushReceipt.kt).
//
// FIREBASE EXISTS ONLY WHEN IT IS CONFIGURED. FirebaseInitProvider is removed from the merged manifest, so nothing
// starts Firebase at process launch. [firebaseReady] builds the default FirebaseApp from the four FCM_ANDROID_*
// values, lazily, the first time push is needed; an unconfigured build never builds it, never asks Play services
// anything and never asks for a token. Every entry point - the registration pass, the session-end line, the
// messaging service - asks [firebaseReady] first, because FCM can start this process on its own (a message or a
// token refresh) without MainActivity.
//
// NOTHING HERE PRINTS A TOKEN OR A FIREBASE VALUE. The one log line names the pass's PushStatus.

private const val TAG = "MonRelevePush"
private const val PUSH_PREFS = "monreleve.push"
private const val KEY_ACCOUNT = "push.account"
private const val KEY_REGISTERED = "push.registered"
private const val KEY_SERVER_REMINDER = "push.serverReminderEnabled"

/** How long a token request may take before the pass reads it as NO_TOKEN (Play services can be slow to answer). */
private const val TOKEN_TIMEOUT_MS = 30_000L

private val firebaseLock = Any()

/**
 * R1150: the default FirebaseApp, built from this build's four values when they are all present. False - and nothing
 * built - when they are not: push is unavailable and the app is otherwise unchanged.
 */
internal fun firebaseReady(context: Context): Boolean {
    val config = buildPushConfig() as? PushConfig.Configured ?: return false
    val app = context.applicationContext
    synchronized(firebaseLock) {
        if (FirebaseApp.getApps(app).isEmpty()) {
            val values = config.values
            val options =
                FirebaseOptions.Builder()
                    .setProjectId(values.projectId)
                    .setApplicationId(values.applicationId)
                    .setApiKey(values.apiKey)
                    .setGcmSenderId(values.senderId)
                    .build()
            FirebaseApp.initializeApp(app, options)
        }
    }
    return true
}

/** Play services present and usable - FCM's transport on Android. */
internal fun playServicesPresent(context: Context): Boolean =
    GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

/** The notification permission (API 33+) AND the app's notifications not switched off in the system settings. */
internal fun notificationsPermitted(context: Context): Boolean =
    NotificationManagerCompat.from(context).areNotificationsEnabled()

/** The SharedPreferences record of what this phone established with the server (never the token). */
internal class SharedPrefsPushRecordStore internal constructor(
    private val prefs: SharedPreferences,
) : PushRecordStore {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE),
    )

    override fun load(): PushRecord? {
        val account = prefs.getString(KEY_ACCOUNT, null) ?: return null
        val serverOn = if (prefs.contains(KEY_SERVER_REMINDER)) prefs.getBoolean(KEY_SERVER_REMINDER, false) else null
        return PushRecord(account, prefs.getBoolean(KEY_REGISTERED, false), serverOn)
    }

    override fun save(record: PushRecord) {
        val editor =
            prefs.edit()
                .putString(KEY_ACCOUNT, record.account)
                .putBoolean(KEY_REGISTERED, record.registered)
        record.serverReminderEnabled?.let { editor.putBoolean(KEY_SERVER_REMINDER, it) }
            ?: editor.remove(KEY_SERVER_REMINDER)
        editor.commit()
    }

    override fun clear() {
        prefs.edit().clear().commit()
    }
}

/** The install's registration token, from Firebase Cloud Messaging - only ever asked for when configured. */
internal class FirebasePushTokens(
    context: Context,
) : PushTokens {
    private val app = context.applicationContext

    override suspend fun current(): String? {
        if (!firebaseReady(app)) return null
        return withTimeoutOrNull(TOKEN_TIMEOUT_MS) { FirebaseMessaging.getInstance().token.awaitOrNull() }
    }

    override fun discard() {
        if (firebaseReady(app)) FirebaseMessaging.getInstance().deleteToken()
    }
}

/** A Play services Task as a suspension: its result, or null when it failed or was cancelled. */
private suspend fun <T> Task<T>.awaitOrNull(): T? =
    suspendCancellableCoroutine { continuation ->
        addOnCompleteListener { task ->
            continuation.resume(if (task.isSuccessful) task.result else null)
        }
    }

/** One pass at a time per process: the shell's launch, an opt-in change and a token refresh can meet. */
private val syncLock = Mutex()

/**
 * R1151: one registration pass for the process's session - on every launch of the signed-in shell, on an opt-in
 * change, and on a token refresh (MonRelevePushService.onNewToken). Returns the pass's PushStatus.
 */
internal suspend fun syncPush(context: Context): PushStatus {
    val app = context.applicationContext
    val session = processSession(app)
    val status =
        syncLock.withLock {
            PushSync(
                PushConditions(
                    config = buildPushConfig(),
                    signedIn = { session.isSignedIn() },
                    account = { SharedPrefsAccountStore(app).current() },
                    playServices = { playServicesPresent(app) },
                    permission = { notificationsPermitted(app) },
                    optedIn = { SharedPrefsEveningNotificationStore(app).isEnabled() },
                ),
                FirebasePushTokens(app),
                SessionPushServer(session),
                SharedPrefsPushRecordStore(app),
                BuildConfig.VERSION_NAME,
            ).sync()
        }
    Log.i(TAG, "push pass: ${status.name}")
    return status
}

/**
 * R1153 - "PUSH AVAILABLE" ON THIS PHONE, NOW. The one named state A7's 19:00 fallback reads: true only when the
 * server will remind the person signed in now, on this phone (see PushRegistration.kt pushAvailable). Every fact is
 * read when asked; the record is the last registration pass's.
 */
internal object PushAvailability {
    fun isPushAvailable(context: Context): Boolean {
        val app = context.applicationContext
        val configured = buildPushConfig() is PushConfig.Configured
        // Short-circuit: an unconfigured build never consults Play services.
        return configured &&
            pushAvailable(
                record = SharedPrefsPushRecordStore(app).load(),
                account = SharedPrefsAccountStore(app).current(),
                signedIn = processSession(app).isSignedIn(),
                configured = true,
                playServices = playServicesPresent(app),
                permission = notificationsPermitted(app),
            )
    }
}

/** R1152: push's line on the "session ended" seam (auth/SessionEndSeam.kt) - see pushSessionEnded. */
internal fun endPushOnThisPhone(context: Context) {
    val app = context.applicationContext
    pushSessionEnded(SharedPrefsPushRecordStore(app), FirebasePushTokens(app))
}

/**
 * R1152: a pushed reminder's whole path on the phone - read the payload, refuse what is not today's reminder or
 * arrives while nobody is signed in, then R339's decision and the one-a-day rule, posting the EXISTING evening
 * notification (same channel, buttons and lock-screen version - EveningNotifier) for today.
 */
internal suspend fun maybeRemindFromPush(
    context: Context,
    clock: Clock,
    data: Map<String, String>,
) {
    val app = context.applicationContext
    val day = reminderDayOf(data) ?: return
    val signedIn = processSession(app).isSignedIn()
    val today = todayInParis(clock)
    // Cheap refusals before the database is opened; pushReminderDecision states them again, as the rule.
    if (!signedIn || day != today) return
    val db = MonReleveDatabase.get(app)
    showOncePerDay(
        today,
        SharedPrefsEveningNotificationStore(app),
        decide = { alreadyNotified ->
            val (conditions, outcome) = gatherEveningConditions(app, clock, today, db, alreadyNotified)
            pushReminderDecision(day, signedIn, today, conditions, outcome)
        },
        post = { notice -> postEveningFor(app, notice, today) },
    )
}
