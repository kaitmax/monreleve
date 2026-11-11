package ch.monreleve.app.settings

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
//
// IOS-2e R828: this file - the store's INTERFACE, its in-memory implementation and AlertThreshold - moved to :shared
// commonMain, package unchanged. The SharedPreferences implementation stays in :app, split out unchanged into
// settings/SharedPrefsThresholdAlertStore.kt: the same file (monreleve.detection), keys and value forms.

/** Which regulatory threshold an alert is about. */
enum class AlertThreshold {
    /** The 40 % fiscal ceiling: beyond it, telework days become taxable in France. */
    FISCAL,

    /** The 49,9 % social-security ceiling: beyond it, the Swiss social-security regime is lost. */
    SOCIAL,
}

// IOS-2d R813: ThresholdCrossing, the plain value the shared forecast returns, moved unchanged to :shared
// (settings/ThresholdCrossing.kt, package unchanged); the stores stayed in :app beside android.content until IOS-2e
// R828 moved the interface below and its in-memory implementation here.

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
