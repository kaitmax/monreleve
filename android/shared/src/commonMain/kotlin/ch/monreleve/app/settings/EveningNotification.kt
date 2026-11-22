package ch.monreleve.app.settings

// R323 / PARKAN-36. The evening proposal notification's device state: the OPT-IN (separate from the detection
// toggle, OFF by default - D19's safe default) and the DAY LAST NOTIFIED, which enforces "at most one per working
// day" across worker wakes. No server, no consent PATCH: this is a purely local notification, so unlike the
// detection mode there is nothing to reconcile with /api/v1/me.
//
// IT SHARES THE DETECTION PREFS FILE (monreleve.detection), the same home NearBorderNotice uses, so
// SharedPrefsDetectionModeStore.clear() on sign-out/deletion (R289/R295) sweeps the opt-in too - a new account on
// a shared device does NOT inherit the previous person's evening notification. Off by default, so a cleared file
// reads as opted-out.
//
// IOS-2e R828: this file - the store's INTERFACE and its in-memory implementation - moved to :shared commonMain,
// package unchanged. The SharedPreferences implementation stays in :app, split out unchanged into
// settings/SharedPrefsEveningNotificationStore.kt: the same file (monreleve.detection), keys and value forms.

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
