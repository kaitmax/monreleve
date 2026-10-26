package ch.monreleve.app.detection

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Platform-free as it stood.
// The SharedPreferences store stays in :app (detection/NearBorderNotice.kt).

/** Whether the one-time near-border notice has been shown to this account on this device. */
interface NearBorderNoticeStore {
    fun hasShown(): Boolean

    fun markShown()
}

/** The test/default in-memory store. */
class InMemoryNearBorderNoticeStore(private var shown: Boolean = false) : NearBorderNoticeStore {
    override fun hasShown(): Boolean = shown

    override fun markShown() {
        shown = true
    }
}
