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

/** The complete, validated settings, in the /api/v1/me vocabulary (strings, as the wire carries them). */
data class Settings(
    val canton: String,
    val employmentRate: Int,
    val denominatorKind: String,
    val exactTotalWorkDays: Int?,
    val granularity: String,
    val activityStartDate: String?,
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
        .toString()
