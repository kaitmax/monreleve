package ch.monreleve.app.data.remote

import org.json.JSONObject

// AN4 increment 1. The two ways a call can fail, kept as DISTINCT types (R198):
// a Server failure is the server refusing us, with the rule it fired preserved;
// a Network failure is not reaching the server at all. Collapsing the two into
// one "error" is the shape R198 forbids - "could not connect" and "the link was
// already used" send a person to two different actions.

sealed interface ApiFailure {
    /**
     * The server answered with an error status and body. `code` is the parsed,
     * recognised code or null; `rawCode` is what the wire actually carried, kept
     * even when unrecognised so a future code reaches a crash report intact
     * rather than being lost to a null (contract 6.5). `status` is always kept.
     */
    data class Server(
        val status: Int,
        val code: AuthServerCode?,
        val rawCode: String?,
        val message: String?,
    ) : ApiFailure

    /** No HTTP response: a timeout, DNS, a dropped connection. Distinct from Server. */
    data class Network(val detail: String) : ApiFailure

    /** A response reached us but was not the shape the contract promises. */
    data class Malformed(val detail: String) : ApiFailure
}

/**
 * Read an error response into an ApiFailure.Server. Tolerant of a non-JSON body
 * (a proxy's HTML 502, an empty body): the status is always preserved, and a
 * body that will not parse yields a null code rather than throwing - a crash
 * while reading an error is a worse error.
 */
fun parseServerFailure(
    status: Int,
    body: String,
): ApiFailure.Server {
    val rawCode: String? =
        try {
            val json = JSONObject(body)
            if (json.has("code") && !json.isNull("code")) json.getString("code") else null
        } catch (_: org.json.JSONException) {
            null
        }
    val message: String? =
        try {
            val json = JSONObject(body)
            if (json.has("message") && !json.isNull("message")) json.getString("message") else null
        } catch (_: org.json.JSONException) {
            null
        }
    return ApiFailure.Server(
        status = status,
        code = AuthServerCode.fromWire(rawCode),
        rawCode = rawCode,
        message = message,
    )
}
