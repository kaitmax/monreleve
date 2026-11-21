package ch.monreleve.app.settings

import ch.monreleve.app.dossier.AggregatableUser

// AN5b increment 1. The person's calculation settings - the manual-onboarding subset of
// /api/v1/me. Cached on the device so Aujourd'hui computes offline from the first launch, and
// PATCHed to the server so the dossier computes the same figures from the same settings.
//
// ONLY THE SIX MANUAL FIELDS (R282). loggingMode, detectionConsent and the reminder settings are
// NOT here and NOT sent: a field the manual product does not offer is not written. loggingMode
// stays MANUAL by the server's default; consent stays absent.
//
// KMP-3 (R446): the Settings data class and toAggregatableUser MOVED to :shared commonMain.
// mePatchBody and parseMeSettings did not, then: they were org.json, the /api/v1/me WIRE, and stayed in
// :app/settings/MeWire.kt (PARK-D3). IOS-MOVE-ME (R1270) moved that file here, beside this one, on
// kotlinx.serialization's JSON tree - which, unlike one Json configuration, CAN send explicit nulls for
// two fields and omit three in one body (MeWire.kt states how).

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
