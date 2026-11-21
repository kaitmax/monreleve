@file:Suppress("TooManyFunctions")
// A codec is naturally many small readers, one per org.json call it reproduces (DossierPayload.kt's reason); folding
// them together would hide which old call each one stands for.

package ch.monreleve.app.settings

import ch.monreleve.app.data.remote.wireJson
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

// THE /api/v1/me CODEC, ONCE, IN COMMON CODE (IOS-MOVE-ME, R1270). Its parse and its PATCH body were org.json in
// :app (KMP-3 R446/R448, PARK-D3), which iOS cannot compile; they now live here, on kotlinx.serialization's JSON
// TREE (already a commonMain dependency, data/remote/WireJson.kt), in the package they always had, so every :app
// caller and pin compiles unedited. parseLoggingMode came from DetectionMode.kt to sit with the other readers.
//
// THE TREE, NOT A @Serializable CLASS. PARK-D3's measured reason still holds for a DTO: the PATCH body needs a JSON
// null for exactTotalWorkDays and activityStartDate (null is how the simplified basis and the whole-year case are
// STATED - omitting them would leave a stale server value standing) and OMISSION for name, loggingMode,
// detectionConsent and reminderEnabled (/me refuses a null name outright). One Json configuration cannot express
// both; buildJsonObject can, key by key, exactly as the org.json code did.
//
// THE READS REPRODUCE THE OLD ONES, NOT A TASTE. Each helper below names the org.json call it stands for, and
// fixtures/me-cases.json holds what the old codec RETURNED for every case, captured at 7df4d9fa before it was
// deleted; MeCodecGoldenTest asserts these functions return the same. Every reader stays FAIL-CLOSED: a body that
// is not a JSON object, or a field of the wrong type, gives the same null / MANUAL / false it gave before.
//
// WHAT IS NOT THE SAME is listed in that fixture's `divergences`, by case name, and asserted there - never assumed.

/** org.json `isNull(key)`: an absent key or a JSON null. */
private fun JsonObject.isNullAt(key: String): Boolean = this[key].let { it == null || it is JsonNull }

/** org.json `getString(key)`: a JSON string's text; any other value (a number, a boolean, an object) throws. */
private fun JsonElement.stringValue(): String {
    val primitive = this as? JsonPrimitive
    require(primitive != null && primitive.isString) { "not a string" }
    return primitive.content
}

/**
 * org.json `getInt(key)`: a JSON number reads as Java's Number.intValue() would (a fraction truncated, an integer
 * beyond Int keeping its low 32 bits, as Long.intValue() did); a JSON string reads through Integer.parseInt; anything
 * else throws. Reproduced rather than tightened, so a body the old codec read is read the same (R1270).
 */
private fun JsonElement.intValue(): Int {
    val primitive = this as? JsonPrimitive
    require(primitive != null && primitive !is JsonNull) { "not an int" }
    val text = primitive.content
    if (primitive.isString) return text.toInt()
    return text.toIntOrNull()
        ?: text.toLongOrNull()?.toInt()
        ?: text.toDouble().also { require(it.isFinite()) { "not an int" } }.toInt()
}

/** DossierPayload's convention: a JSON null (or an absent key) reads as null, never the literal string "null". */
private fun JsonObject.stringOrNull(key: String): String? = if (isNullAt(key)) null else getValue(key).stringValue()

/** The same convention for an integer field: an absent or JSON-null key reads as null rather than throwing. */
private fun JsonObject.intOrNull(key: String): Int? = if (isNullAt(key)) null else getValue(key).intValue()

/** org.json `JSONObject(body)`: the body as a JSON object, or a throw (not JSON, an array, a string, a null). */
private fun meObject(body: String): JsonObject = wireJson.parseToJsonElement(body).jsonObject

/**
 * The PATCH /api/v1/me body carrying exactly the six manual fields. exactTotalWorkDays and
 * activityStartDate are sent as JSON null when absent - the schema is nullable there, and null is
 * how the simplified basis and the whole-year case are stated (never omitted, which .strict() on
 * the server would still accept but would leave a stale value standing). The keys are written in
 * this order, which is the order Android's org.json (insertion-ordered) wrote them on a phone.
 */
fun Settings.mePatchBody(reminderEnabled: Boolean? = null): String =
    buildJsonObject {
        put("canton", canton)
        put("employmentRate", employmentRate)
        put("denominatorKind", denominatorKind)
        put("exactTotalWorkDays", exactTotalWorkDays?.let(::JsonPrimitive) ?: JsonNull)
        put("granularity", granularity)
        put("activityStartDate", activityStartDate?.let(::JsonPrimitive) ?: JsonNull)
        // AN-ONBOARD: the name is OMITTED when absent, never sent as JSON null - the server's /me schema
        // requires a non-empty string, so a null would be refused. Onboarding always sends one; a settings
        // save that does not touch the name leaves the server's existing value standing.
        name?.let { put("name", it) }
        // AN-ONBOARD: the mode + consent are sent only when onboarding set them (automatic, after disclosure +
        // permission). Omitted on the manual path, leaving the server's MANUAL default. /me enforces that
        // AUTO_DETECT requires consent, so they always travel together.
        loggingMode?.let { put("loggingMode", it) }
        detectionConsent?.let { put("detectionConsent", it) }
        // AN-MANUAL-REMINDER (R1145): onboarding's evening answer, sent only when the flow asked it; omitted otherwise
        // (every Parametres settings save, a partial onboarding), so the server's value stands.
        reminderEnabled?.let { put("reminderEnabled", it) }
    }.toString()

/**
 * R297. Parse a GET /api/v1/me body into the six manual Settings, or null when the account has no settings on
 * the server yet. Presence keys on `canton`: it is the one field with
 * no sensible server default, so a body without it is a not-yet-onboarded account. Reads ONLY the six manual
 * fields (R282): reminderTime, reminderEnabled, loggingMode and detectionConsentAt are ignored (the mode has its own
 * reader, parseLoggingMode). Null follows DossierPayload's convention (a JSON null is null, never the string "null").
 * A malformed body yields null, never a crash - and AN-SIGNIN-RESOLVE (R1161) made null
 * mean "no answer" to StartupDecider (Unresolved, a retry), no longer onboarding. This is the READ counterpart
 * of mePatchBody above; both live here so the /api/v1/me vocabulary has one home (R206).
 */
fun parseMeSettings(body: String): Settings? =
    runCatching {
        val json = meObject(body)
        val canton = json.stringOrNull("canton") ?: return@runCatching null
        Settings(
            canton = canton,
            employmentRate = json.getValue("employmentRate").intValue(),
            denominatorKind = json.getValue("denominatorKind").stringValue(),
            exactTotalWorkDays = json.intOrNull("exactTotalWorkDays"),
            granularity = json.getValue("granularity").stringValue(),
            activityStartDate = json.stringOrNull("activityStartDate"),
            // AN-ONBOARD: the holder name, read back so onboarding can skip step 1 when the server has it (R297).
            name = json.stringOrNull("name"),
        )
    }.getOrNull()

/** Parse a /me body into a MeView, tolerating any absent field; a malformed body yields null (R1161: Unresolved). */
fun parseMeView(body: String): MeView? =
    runCatching {
        val json = meObject(body)
        MeView(
            name = json.stringOrNull("name"),
            canton = json.stringOrNull("canton"),
            employmentRate = json.intOrNull("employmentRate"),
            denominatorKind = json.stringOrNull("denominatorKind"),
            exactTotalWorkDays = json.intOrNull("exactTotalWorkDays"),
            granularity = json.stringOrNull("granularity"),
            activityStartDate = json.stringOrNull("activityStartDate"),
        )
    }.getOrNull()

/**
 * AN-SIGNIN-RESOLVE (R1161). Whether [body] is recognisably a GET /api/v1/me ANSWER - a JSON object carrying the keys
 * serialiseMe writes on every answer, null or not (lib/me/read.ts). Two are asked for: "canton", because its JSON
 * null is the one positive answer that the settings are absent (an account that never onboarded), and "loggingMode",
 * which RESOLVING restores (R1162). An error body ({"status":"error",...}), {} or anything not JSON is not an
 * answer, so it can never read as a brand-new account and send a returning person to an empty onboarding.
 */
fun isMeAnswer(body: String): Boolean =
    runCatching { meObject(body).let { "canton" in it && "loggingMode" in it } }.getOrDefault(false)

/**
 * AN-MANUAL-REMINDER (R1147). The evening opt-in a GET /api/v1/me answer holds, read FAIL-CLOSED: on only for a JSON
 * true - absent, null, a string "true", a number or a body that is not JSON all read off, so no malformed answer can
 * turn a reminder on that the person did not choose. Not kotlinx's booleanOrNull, which reads the STRING "true" as
 * true: org.json's `opt(key) == true` matched a JSON boolean only.
 */
fun parseReminderEnabled(body: String): Boolean =
    runCatching {
        val value = meObject(body)["reminderEnabled"] as? JsonPrimitive
        value != null && value !is JsonNull && !value.isString && value.content == "true"
    }.getOrDefault(false)

/**
 * The logging mode the server holds, read from a GET /api/v1/me body. AUTO_DETECT is returned ONLY when the
 * server says loggingMode is AUTO_DETECT AND a consent stamp is present - a stamp-less AUTO_DETECT is the
 * forbidden state SPEC 9.3 names, so it is read fail-closed as MANUAL. A malformed body reads as MANUAL.
 * Moved here from :app's DetectionMode.kt with the other /me readers. org.json's optString gave any value's text,
 * and only a JSON string can have the text AUTO_DETECT, so a string is what is compared.
 */
fun parseLoggingMode(body: String): LoggingMode =
    runCatching {
        val json = meObject(body)
        val mode = (json["loggingMode"] as? JsonPrimitive)?.takeIf { it.isString }?.content
        val consented = !json.isNullAt("detectionConsentAt")
        if (mode == LoggingMode.AUTO_DETECT.name && consented) LoggingMode.AUTO_DETECT else LoggingMode.MANUAL
    }.getOrDefault(LoggingMode.MANUAL)
