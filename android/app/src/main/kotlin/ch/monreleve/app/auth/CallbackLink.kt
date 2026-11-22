package ch.monreleve.app.auth

import java.net.URI
import java.net.URLDecoder

// AN4 increment 4 (AC2 / android-intent-security). The incoming App Link URI is
// UNTRUSTED input (an external app can fire the exported callback activity), so it
// is validated against the FROZEN contract shape before anything trusts it:
// https, host monreleve.ch, path /api/v1/auth/callback, a non-blank token AND a
// non-blank email. Anything else returns null and the activity refuses.
//
// Pure java.net.URI (not android.net.Uri), so the validation is a JVM unit test,
// not a device one - and the SAME parse runs in onCreate and onNewIntent.
// The host is validated here; the exchange call still goes to the app's OWN
// configured base URL, never a host taken from this URI (AuthApi).

object CallbackLink {
    // IOS-MOVE-CORE R1300: the host lives in :shared commonMain (CallbackLinkHost) so Site could follow it there. One
    // value, read here, never retyped (R206).
    const val HOST = CallbackLinkHost.HOST
    const val PATH = "/api/v1/auth/callback"

    data class Parsed(val token: String, val email: String)

    fun parse(uriString: String?): Parsed? {
        val uri = uriString?.let { runCatching { URI(it) }.getOrNull() } ?: return null
        val validShape =
            "https".equals(uri.scheme, ignoreCase = true) &&
                HOST.equals(uri.host, ignoreCase = true) &&
                uri.path == PATH
        val params = if (validShape) queryParams(uri.rawQuery) else emptyMap()
        val token = params["token"]?.takeIf { it.isNotBlank() }
        val email = params["email"]?.takeIf { it.isNotBlank() }
        return if (validShape && token != null && email != null) Parsed(token, email) else null
    }

    private fun queryParams(rawQuery: String?): Map<String, String> {
        if (rawQuery.isNullOrEmpty()) return emptyMap()
        return rawQuery
            .split("&")
            .mapNotNull { part ->
                val idx = part.indexOf('=')
                if (idx <= 0) {
                    null
                } else {
                    val key = part.substring(0, idx)
                    val value = runCatching { URLDecoder.decode(part.substring(idx + 1), "UTF-8") }.getOrDefault("")
                    key to value
                }
            }.toMap()
    }
}
