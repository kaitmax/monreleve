package ch.monreleve.app.settings

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Platform-free as it stood.
// The JSON helpers and the SharedPreferences store stay in :app (settings/DetectionMode.kt).

/** Which mode records the person's days. MANUAL by default (D19). */
enum class LoggingMode {
    MANUAL,
    AUTO_DETECT,
}

/** The device's cache of the logging mode, so the mode decision survives a relaunch without a network round trip. */
interface DetectionModeStore {
    fun load(): LoggingMode

    fun save(mode: LoggingMode)

    /**
     * R289/R295: erase the cached mode on sign-out and deletion, so the next account on a shared device does
     * NOT inherit the previous person's AUTO_DETECT. Android restores it from GET /api/v1/me at the next sign-in's
     * RESOLVING, as it does the six calculation settings (R297; AN-SIGNIN-RESOLVE R1162 - AUTO_DETECT only with the
     * consent stamp AND the location permission held, MANUAL otherwise).
     */
    fun clear()

    /**
     * AN-FORCED-SIGNOUT (R527): a session the SERVER ended. Erase the mode and every other flag the detection file
     * holds - the evening and alert opt-ins, the alert's crossing state, the near-border "told once" - so the next
     * account inherits no detection consent and the same person comes back in manual mode with notifications off.
     * EXCEPT the employer figures (EMPLOYER_KEY_PREFIX): already scoped to their account, on this phone only, and
     * brought back by nothing if erased. [clear] - the voluntary sign-out and the deletion - still takes them too.
     */
    fun clearForSessionEnd()
}

/** The default used by JVM tests and as a safe fallback; the app injects the SharedPreferences store. */
class InMemoryDetectionModeStore(private var mode: LoggingMode = LoggingMode.MANUAL) : DetectionModeStore {
    override fun load(): LoggingMode = mode

    override fun save(mode: LoggingMode) {
        this.mode = mode
    }

    override fun clear() {
        mode = LoggingMode.MANUAL
    }

    // It holds the mode alone - no employer figure lives here - so the session-end clear is the whole clear.
    override fun clearForSessionEnd() = clear()
}
