package ch.monreleve.app.settings

import ch.monreleve.app.dossier.AggregatableUser
import org.json.JSONObject

// AN5b increment 1. The person's calculation settings - the manual-onboarding subset of
// /api/v1/me. Cached on the device so Aujourd'hui computes offline from the first launch, and
// PATCHed to the server so the dossier computes the same figures from the same settings.
//
// ONLY THE SIX MANUAL FIELDS (R282). loggingMode, detectionConsent and the reminder settings are
// NOT here and NOT sent: a field the manual product does not offer is not written. loggingMode
// stays MANUAL by the server's default; consent stays absent.

/**
 * The complete, validated settings, in the /api/v1/me vocabulary (strings, as the wire carries them).
 *
 * AN-ONBOARD: `name` is the holder's name, the document's titulaire (onboarding step 1). It is LAST and
 * defaulted so every existing positional caller is unchanged; the new onboarding always provides it. It
 * is nullable because the calculation half of Settings is complete without it - the name is carried to
 * /api/v1/me so the server's dossier/PDF has a titulaire (R205), and is not part of the engine input.
 */
data class Settings(
    val canton: String,
    val employmentRate: Int,
    val denominatorKind: String,
    val exactTotalWorkDays: Int?,
    val granularity: String,
    val activityStartDate: String?,
    val name: String? = null,
    // AN-ONBOARD: the recording mode chosen at onboarding step 6. Null (the common manual path) leaves the
    // server's MANUAL default; "AUTO_DETECT" is sent only after the disclosure and the OS permission, with
    // detectionConsent true (R315/R316) - the same pair /api/v1/me enforces together.
    val loggingMode: String? = null,
    val detectionConsent: Boolean? = null,
)

/** The engine input's person half (increment 2). Aujourd'hui reads settings through this (increment 4). */
fun Settings.toAggregatableUser(): AggregatableUser =
    AggregatableUser(
        canton = canton,
        employmentRate = employmentRate,
        denominatorKind = denominatorKind,
        exactTotalWorkDays = exactTotalWorkDays,
        granularity = granularity,
        activityStartDate = activityStartDate,
    )

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

/** DossierPayload's convention: a JSON null (or an absent key) reads as null, never the literal string "null". */
internal fun JSONObject.stringOrNull(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)

/** The same convention for an integer field: an absent or JSON-null key reads as null rather than throwing. */
internal fun JSONObject.intOrNull(key: String): Int? = if (!has(key) || isNull(key)) null else getInt(key)
