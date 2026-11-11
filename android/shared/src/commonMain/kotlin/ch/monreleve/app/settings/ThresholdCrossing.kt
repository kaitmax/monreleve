package ch.monreleve.app.settings

// AN-ALERT. IOS-2d R813: MOVED UNCHANGED out of :app's settings/ThresholdAlert.kt (IOS-1b-A R602a's split shape): the
// shared forecast's projectedThresholdCrossing returns it, so it lives where that function lives. The threshold alert's
// stores (SharedPreferences, beside android.content) stay in :app and read and write this same type.

/** The last-known crossing state of each threshold (the forecast would exceed it). Default: neither crossed. */
data class ThresholdCrossing(
    val fiscal: Boolean = false,
    val social: Boolean = false,
)
