package ch.monreleve.app.settings

import org.json.JSONObject

// KMP-3 (R446/R448). THE /api/v1/me VOCABULARY, IN org.json, DELIBERATELY LEFT IN :app.
//
// Settings, MeView and the completeness rules went to :shared commonMain with this task; the
// three functions that turn them into and out of JSON did not. They were split out of
// Settings.kt and ReleveCompleteness.kt, unchanged line for line.
//
// WHY THE CODEC STAYED, which R448 asks to be answered per store and this is the one place the
// answer is NOT "the platform storage stays". org.json is a JVM/Android API, so the obvious move
// is to rewrite these under KMP-1's one kotlinx.serialization Json configuration. R448 permits
// that ONLY if the bytes read back identically, and here they demonstrably would not:
//
//   - KMP-1's Json is configured to OMIT nulls (encodeDefaults off, explicitNulls off) - which is
//     right for the entries wire, where EntriesMapping's own header says "a null optional stays
//     null here; wireJson omits it on encode (never "k":null)".
//   - mePatchBody needs the OPPOSITE for two fields and the SAME for three others, in one body:
//     exactTotalWorkDays and activityStartDate are sent as JSON null ON PURPOSE, because null is
//     how the simplified basis and the whole-year case are STATED - omitting them would leave a
//     stale server value standing, which the comment on mePatchBody has said since AN5b. Meanwhile
//     name, loggingMode and detectionConsent must be OMITTED when absent, because /me's schema
//     refuses a null name outright.
//
// So one body needs explicit nulls for two fields and omission for three, and a single Json
// configuration cannot express both. Converting it would be a silent WIRE change - the thing the
// hard boundary forbids - and there is no /me golden that would have caught it, which is exactly
// why it is written down here rather than discovered later. PARKED as PARK-D3.
//
// THIS IS NOT AN ON-DEVICE FORMAT. The settings PREFERENCES file (monreleve.settings) is written
// by SharedPrefsSettingsStore and is untouched by this task; this file is the SERVER wire. The two
// were in one file and are now in two, which is the clearer arrangement anyway.
//
// iOS implements these three functions over its own JSON (R455). Everything they take and return -
// Settings, MeView - is shared, so only the encoding is platform work.

/**
 * The PATCH /api/v1/me body carrying exactly the six manual fields. exactTotalWorkDays and
 * activityStartDate are sent as JSON null when absent - the schema is nullable there, and null is
 * how the simplified basis and the whole-year case are stated (never omitted, which .strict() on
 * the server would still accept but would leave a stale value standing).
 */
fun Settings.mePatchBody(): String =
    JSONObject()
        .put("canton", canton)
        .put("employmentRate", employmentRate)
        .put("denominatorKind", denominatorKind)
        .put("exactTotalWorkDays", exactTotalWorkDays ?: JSONObject.NULL)
        .put("granularity", granularity)
        .put("activityStartDate", activityStartDate ?: JSONObject.NULL)
        // AN-ONBOARD: the name is OMITTED when absent, never sent as JSON null - the server's /me schema
        // requires a non-empty string, so a null would be refused. Onboarding always sends one; a settings
        // save that does not touch the name leaves the server's existing value standing.
        .apply { if (name != null) put("name", name) }
        // AN-ONBOARD: the mode + consent are sent only when onboarding set them (automatic, after disclosure +
        // permission). Omitted on the manual path, leaving the server's MANUAL default. /me enforces that
        // AUTO_DETECT requires consent, so they always travel together.
        .apply { if (loggingMode != null) put("loggingMode", loggingMode) }
        .apply { if (detectionConsent != null) put("detectionConsent", detectionConsent) }
        .toString()

/**
 * R297. Parse a GET /api/v1/me body into the six manual Settings, or null when the account has no settings on
 * the server yet (which sends the person to onboarding). Presence keys on `canton`: it is the one field with
 * no sensible server default, so a body without it is a not-yet-onboarded account. Reads ONLY the six manual
 * fields (R282): reminderTime, reminderEnabled, loggingMode and detectionConsentAt are ignored. Null follows
 * DossierPayload's convention (isNull, never optString, which coerces a JSON null to the string "null"). A
 * malformed body yields null - the safe direction is onboarding, never a crash. This is the READ counterpart
 * of mePatchBody above; both live here so the /api/v1/me vocabulary has one home (R206).
 */
fun parseMeSettings(body: String): Settings? =
    runCatching {
        val json = JSONObject(body)
        val canton = json.stringOrNull("canton") ?: return@runCatching null
        Settings(
            canton = canton,
            employmentRate = json.getInt("employmentRate"),
            denominatorKind = json.getString("denominatorKind"),
            exactTotalWorkDays = if (json.isNull("exactTotalWorkDays")) null else json.getInt("exactTotalWorkDays"),
            granularity = json.getString("granularity"),
            activityStartDate = json.stringOrNull("activityStartDate"),
            // AN-ONBOARD: the holder name, read back so onboarding can skip step 1 when the server has it (R297).
            name = json.stringOrNull("name"),
        )
    }.getOrNull()

/** Parse a /me body into a MeView, tolerating any absent field; a malformed body yields null (safe: onboarding). */
fun parseMeView(body: String): MeView? =
    runCatching {
        val json = JSONObject(body)
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

/** DossierPayload's convention: a JSON null (or an absent key) reads as null, never the literal string "null". */
internal fun JSONObject.stringOrNull(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)

/** The same convention for an integer field: an absent or JSON-null key reads as null rather than throwing. */
internal fun JSONObject.intOrNull(key: String): Int? = if (!has(key) || isNull(key)) null else getInt(key)
