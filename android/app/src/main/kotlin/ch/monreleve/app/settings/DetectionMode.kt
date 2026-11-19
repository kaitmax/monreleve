package ch.monreleve.app.settings

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

// AN-AUTO increment 2 (R315). The logging mode and the consent that gates it.
//
// CONSENT BOTH WAYS THROUGH /api/v1/me (FW26, SPEC 9.3). The client sends `detectionConsent: true|false`; it
// NEVER sends `detectionConsentAt` - timestamps are server-assigned throughout this product, and a client that
// could name the moment it consented could name one it did not. Enabling sends loggingMode AND consent together
// (SPEC 9.3's accepted row). Disabling sends consent=false only: the server clears the stamp AND forces MANUAL,
// which is "not a request the client may decline" - so the client does not send loggingMode on the way out.
//
// THE MODE IS CACHED ON THE DEVICE so Aujourd'hui and the sampler decide offline, the way the six manual
// settings are cached. MANUAL by default (D19 - the safe default). This is the client's local read; the SERVER
// is the consent authority (detectionConsentAt). It is read back from GET /me at RESOLVING after each sign-in
// (AN-SIGNIN-RESOLVE R1162, through parseLoggingMode below and LoggingModeRestore.kt) and on no other launch;
// onboarding's accepted automatic choice writes it too. Before R1162 nothing read it back (PARK-E3).

/** R315/FW26: the /api/v1/me PATCH body that turns automatic detection on (with consent) or off (revoking it). */
fun detectionConsentBody(enable: Boolean): String =
    if (enable) {
        JSONObject()
            .put("loggingMode", LoggingMode.AUTO_DETECT.name)
            .put("detectionConsent", true)
            .toString()
    } else {
        // Revocation forcing MANUAL is the server's (SPEC 9.3); the client sends only the boolean.
        JSONObject().put("detectionConsent", false).toString()
    }

/**
 * The logging mode the server holds, read from a GET /api/v1/me body. AUTO_DETECT is returned ONLY when the
 * server says loggingMode is AUTO_DETECT AND a consent stamp is present - a stamp-less AUTO_DETECT is the
 * forbidden state SPEC 9.3 names, so it is read fail-closed as MANUAL. A malformed body reads as MANUAL.
 */
fun parseLoggingMode(body: String): LoggingMode =
    runCatching {
        val json = JSONObject(body)
        val mode = if (json.isNull("loggingMode")) LoggingMode.MANUAL.name else json.optString("loggingMode")
        val consented = json.has("detectionConsentAt") && !json.isNull("detectionConsentAt")
        if (mode == LoggingMode.AUTO_DETECT.name && consented) LoggingMode.AUTO_DETECT else LoggingMode.MANUAL
    }.getOrDefault(LoggingMode.MANUAL)

private const val MODE_PREFS = "monreleve.detection"
private const val KEY_MODE = "loggingMode"

class SharedPrefsDetectionModeStore internal constructor(
    private val prefs: SharedPreferences,
) : DetectionModeStore {
    // AN-FORCED-SIGNOUT (R527): the file is a constructor argument so a JVM test can hand every store that shares
    // it ONE in-memory file - the only way to see what a clear leaves of it. The app builds it from the Context.
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(MODE_PREFS, Context.MODE_PRIVATE),
    )

    override fun load(): LoggingMode =
        runCatching { LoggingMode.valueOf(prefs.getString(KEY_MODE, null) ?: LoggingMode.MANUAL.name) }
            .getOrDefault(LoggingMode.MANUAL)

    override fun save(mode: LoggingMode) {
        prefs.edit().putString(KEY_MODE, mode.name).commit()
    }

    override fun clear() {
        prefs.edit().clear().commit()
    }

    // R527: every key of the file EXCEPT the employer figures - read from the file itself, so a flag added to it later
    // is cleared with the rest rather than kept by a list that forgot it.
    override fun clearForSessionEnd() {
        val editor = prefs.edit()
        prefs.all.keys.filterNot { it.startsWith(EMPLOYER_KEY_PREFIX) }.forEach { editor.remove(it) }
        editor.commit()
    }
}
