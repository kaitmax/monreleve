package ch.monreleve.app.settings

import android.content.Context
import android.content.SharedPreferences

// R323 / IOS-2e R828. The evening notification's SharedPreferences store - split out UNCHANGED from
// EveningNotification.kt when that file (EveningNotificationStore, InMemoryEveningNotificationStore) moved to :shared
// commonMain. Android's storage stays here beside android.content: the same file, the same keys, the same value forms.

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
