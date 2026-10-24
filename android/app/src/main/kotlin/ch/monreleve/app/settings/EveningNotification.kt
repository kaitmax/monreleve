package ch.monreleve.app.settings

import android.content.Context
import android.content.SharedPreferences

// R323 / PARKAN-36. The evening proposal notification's device state: the OPT-IN (separate from the detection
// toggle, OFF by default - D19's safe default) and the DAY LAST NOTIFIED, which enforces "at most one per working
// day" across worker wakes. No server, no consent PATCH: this is a purely local notification, so unlike the
// detection mode there is nothing to reconcile with /api/v1/me.
//
// IT SHARES THE DETECTION PREFS FILE (monreleve.detection), the same home NearBorderNotice uses, so
// SharedPrefsDetectionModeStore.clear() on sign-out/deletion (R289/R295) sweeps the opt-in too - a new account on
// a shared device does NOT inherit the previous person's evening notification. Off by default, so a cleared file
// reads as opted-out.

/** The evening notification's opt-in and its "last notified" day (for at-most-one-per-day). */
interface EveningNotificationStore {
    fun isEnabled(): Boolean

    fun setEnabled(enabled: Boolean)

    /** The ISO day (Europe/Paris) the evening notification last fired, or null if never. */
    fun lastNotifiedDay(): String?

    fun markNotified(dayDate: String)
}

/** The default used by JVM tests and as a safe fallback; the app injects the SharedPreferences store. */
class InMemoryEveningNotificationStore(
    private var enabled: Boolean = false,
    private var lastDay: String? = null,
) : EveningNotificationStore {
    override fun isEnabled(): Boolean = enabled

    override fun setEnabled(enabled: Boolean) {
        this.enabled = enabled
    }

    override fun lastNotifiedDay(): String? = lastDay

    override fun markNotified(dayDate: String) {
        lastDay = dayDate
    }
}

// Shares monreleve.detection with SharedPrefsDetectionModeStore and SharedPrefsNearBorderNoticeStore, so the one
// clear() on sign-out wipes the whole detection-flag file (R289/R295). Keys are namespaced "evening." so they
// cannot collide with the mode or near-border keys in the same file.
private const val EVENING_PREFS = "monreleve.detection"
private const val KEY_ENABLED = "evening.enabled"
private const val KEY_LAST_DAY = "evening.lastNotifiedDay"

class SharedPrefsEveningNotificationStore internal constructor(
    private val prefs: SharedPreferences,
) : EveningNotificationStore {
    // AN-FORCED-SIGNOUT (R527): the shared file as an argument, so a JVM test can read what a clear leaves of it.
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(EVENING_PREFS, Context.MODE_PRIVATE),
    )

    override fun isEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

    override fun setEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_ENABLED, enabled).commit()
    }

    override fun lastNotifiedDay(): String? = prefs.getString(KEY_LAST_DAY, null)

    override fun markNotified(dayDate: String) {
        prefs.edit().putString(KEY_LAST_DAY, dayDate).commit()
    }
}
