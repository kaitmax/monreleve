package ch.monreleve.app.data.remote

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

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
 *
 * KMP-1: org.json -> kotlinx.serialization's JSON TREE API, matched case for case to the old reads. A body that
 * is not a JSON object yields a null root (the old JSONObject(body) threw -> caught -> null). A field is null
 * when absent OR an explicit JSON null (the old `has(k) && !isNull(k)`); a primitive's string/number is read via
 * .content (the old getString coerced a number to its text); an object/array value throws .jsonPrimitive and is
 * swallowed to null (the old getString on a non-scalar threw -> caught -> null).
 */
fun parseServerFailure(
    status: Int,
    body: String,
): ApiFailure.Server {
    val root: JsonObject? = runCatching { wireJson.parseToJsonElement(body).jsonObject }.getOrNull()
    val rawCode = root?.tolerantString("code")
    val message = root?.tolerantString("message")
    return ApiFailure.Server(
        status = status,
        code = AuthServerCode.fromWire(rawCode),
        rawCode = rawCode,
        message = message,
    )
}

/**
 * A field read that reproduces org.json getString's tolerance: an absent or JSON-null value is null; a primitive
 * (string, number, boolean) yields its text content; a non-scalar (object/array) throws and is swallowed to null.
 */
private fun JsonObject.tolerantString(key: String): String? =
    runCatching {
        val element = this[key]
        if (element == null || element is JsonNull) null else element.jsonPrimitive.content
    }.getOrNull()
