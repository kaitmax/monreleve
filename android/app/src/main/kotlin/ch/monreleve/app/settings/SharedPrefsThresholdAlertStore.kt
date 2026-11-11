package ch.monreleve.app.settings

import android.content.Context
import android.content.SharedPreferences

// AN-ALERT / IOS-2e R828. The threshold alert's SharedPreferences store - split out UNCHANGED from ThresholdAlert.kt
// when that file (ThresholdAlertStore, InMemoryThresholdAlertStore, AlertThreshold) moved to :shared commonMain.
// Android's storage stays here beside android.content: the same file, the same keys, the same value forms.

// Shares monreleve.detection with the detection mode, the near-border notice and the evening opt-in, so the
// one clear() on sign-out wipes the whole detection-flag file (R289/R295). Keys are namespaced "alert." so
// they cannot collide with the mode, near-border or evening keys in the same file.
private const val ALERT_PREFS = "monreleve.detection"
private const val KEY_ENABLED = "alert.enabled"
private const val KEY_FISCAL = "alert.fiscalCrossed"
private const val KEY_SOCIAL = "alert.socialCrossed"
private const val KEY_ALERTED_DAY = "alert.alertedDay"
private const val KEY_ALERTED_THRESHOLD = "alert.alertedThreshold"

class SharedPrefsThresholdAlertStore internal constructor(
    private val prefs: SharedPreferences,
) : ThresholdAlertStore {
    // AN-FORCED-SIGNOUT (R527): the shared file as an argument, so a JVM test can read what a clear leaves of it.
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(ALERT_PREFS, Context.MODE_PRIVATE),
    )

    override fun isEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

    override fun setEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_ENABLED, enabled).commit()
    }

    override fun crossing(): ThresholdCrossing =
        ThresholdCrossing(
            fiscal = prefs.getBoolean(KEY_FISCAL, false),
            social = prefs.getBoolean(KEY_SOCIAL, false),
        )

    override fun saveCrossing(crossing: ThresholdCrossing) {
        prefs.edit()
            .putBoolean(KEY_FISCAL, crossing.fiscal)
            .putBoolean(KEY_SOCIAL, crossing.social)
            .commit()
    }

    override fun activeThresholdToday(today: String): AlertThreshold? {
        if (prefs.getString(KEY_ALERTED_DAY, null) != today) return null
        return prefs.getString(KEY_ALERTED_THRESHOLD, null)
            ?.let { runCatching { AlertThreshold.valueOf(it) }.getOrNull() }
    }

    override fun markAlerted(
        day: String,
        threshold: AlertThreshold,
    ) {
        prefs.edit()
            .putString(KEY_ALERTED_DAY, day)
            .putString(KEY_ALERTED_THRESHOLD, threshold.name)
            .commit()
    }
}
