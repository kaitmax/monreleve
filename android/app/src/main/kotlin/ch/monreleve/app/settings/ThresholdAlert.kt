package ch.monreleve.app.settings

import android.content.Context
import android.content.SharedPreferences

// AN-ALERT. The threshold alert's device state and its two plain types. A LOCAL notification that needs no
// server: it fires the FIRST time the year-end FORECAST would cross a regulatory threshold (40 % fiscal or
// 49,9 % social), and not again while it stays crossed; a fall-back-then-re-cross is a new crossing. So the
// last crossing state per threshold is kept here, beside the OPT-IN (separate from every other toggle, OFF by
// default - D19's safe default) and the "alerted today" marker the same-day merge with the evening reminder
// reads (never two Mon Releve notifications the same day).
//
// IT SHARES THE DETECTION PREFS FILE (monreleve.detection), the same home the detection mode and the evening
// opt-in use, so SharedPrefsDetectionModeStore.clear() on sign-out/deletion (R289/R295) sweeps the whole file
// - a new account on a shared device inherits no crossing state and no opt-in (R303). Off by default, so a
// cleared file reads as opted-out with no crossing.
//
// NOTHING HERE IS A RECORD (R340). A crossing is computed from the forecast and kept as device state; it is
// never written to the entries, the mutation queue, the server, the releve, the PDF or the annex.

/** Which regulatory threshold an alert is about. */
enum class AlertThreshold {
    /** The 40 % fiscal ceiling: beyond it, telework days become taxable in France. */
    FISCAL,

    /** The 49,9 % social-security ceiling: beyond it, the Swiss social-security regime is lost. */
    SOCIAL,
}

// IOS-2d R813: ThresholdCrossing, the plain value the shared forecast returns, moved unchanged to :shared
// (settings/ThresholdCrossing.kt, package unchanged); the stores below stay here beside android.content.

/** The threshold alert's opt-in, the last crossing state per threshold, and the "alerted today" marker. */
interface ThresholdAlertStore {
    fun isEnabled(): Boolean

    fun setEnabled(enabled: Boolean)

    /** The last crossing state evaluated while opted in (default neither crossed). */
    fun crossing(): ThresholdCrossing

    fun saveCrossing(crossing: ThresholdCrossing)

    /** The threshold alerted TODAY (for the same-day evening merge), or null if none was alerted today. */
    fun activeThresholdToday(today: String): AlertThreshold?

    fun markAlerted(
        day: String,
        threshold: AlertThreshold,
    )
}

/** The default used by JVM tests and as a safe fallback; the app injects the SharedPreferences store. */
class InMemoryThresholdAlertStore(
    private var enabled: Boolean = false,
    private var crossingState: ThresholdCrossing = ThresholdCrossing(),
    private var alertedDay: String? = null,
    private var alertedThreshold: AlertThreshold? = null,
) : ThresholdAlertStore {
    override fun isEnabled(): Boolean = enabled

    override fun setEnabled(enabled: Boolean) {
        this.enabled = enabled
    }

    override fun crossing(): ThresholdCrossing = crossingState

    override fun saveCrossing(crossing: ThresholdCrossing) {
        crossingState = crossing
    }

    override fun activeThresholdToday(today: String): AlertThreshold? = alertedThreshold.takeIf { alertedDay == today }

    override fun markAlerted(
        day: String,
        threshold: AlertThreshold,
    ) {
        alertedDay = day
        alertedThreshold = threshold
    }
}

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
