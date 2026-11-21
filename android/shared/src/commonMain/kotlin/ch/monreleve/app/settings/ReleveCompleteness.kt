package ch.monreleve.app.settings

// AN-ONBOARD-2 (R335). COMPLETE means "every field the releve needs", defined ONCE here (R206). StartupDecider
// keys the start destination on this (not on canton alone - the Q1 bug, where an account with settings but no
// name landed on Aujourd'hui and its PDF 422'd), and SettingsStore.isOnboarded keys the local shortcut on the
// SAME definition via Settings.toMeView, so the server path and the device path cannot drift apart.
//
// The /api/v1/me vocabulary already lives in settings/ (Settings.kt: parseMeSettings + mePatchBody), so the
// tolerant read (parseMeView) and the required-field set live beside it. The mapping from a required field to
// the WIZARD STEP that asks it needs an onboarding type (OnboardingStep) and so lives in onboarding/
// Completeness.kt, which reads this file's ReleveField set.
//
// KMP-3 (R446): the completeness RULES moved to :shared commonMain - MeView, toMeView, ReleveField,
// missingReleveFields and isComplete - because SettingsStore.isOnboarded is a default method that
// calls them, and the interface moved. parseMeView did NOT then: it was org.json, and it went to
// :app/settings/MeWire.kt beside the other two /me functions. IOS-MOVE-ME (R1270) moved MeWire.kt to
// commonMain settings/, so the /api/v1/me vocabulary is one home (R206) in one module again.

/**
 * A tolerant view of GET /api/v1/me: every releve-relevant field, each nullable, read WITHOUT requiring any of
 * them - unlike parseMeSettings, which returns null unless canton, rate, method and granularity are all present.
 * It is what the completeness check and the onboarding prefill read.
 */
data class MeView(
    val name: String?,
    val canton: String?,
    val employmentRate: Int?,
    val denominatorKind: String?,
    val exactTotalWorkDays: Int?,
    val granularity: String?,
    val activityStartDate: String?,
)

/** A local Settings as a MeView, so isOnboarded uses the SAME completeness definition the server path does. */
fun Settings.toMeView(): MeView =
    MeView(
        name = name,
        canton = canton,
        employmentRate = employmentRate,
        denominatorKind = denominatorKind,
        exactTotalWorkDays = exactTotalWorkDays,
        granularity = granularity,
        activityStartDate = activityStartDate,
    )

/**
 * The releve's required fields (R335), in onboarding order. ReleveCompletenessTest asserts this set is exactly
 * these six - "a test listing each field". Each carries the predicate deciding, over a MeView, whether the
 * server already holds a satisfactory answer.
 *
 * PERIOD is the one field whose answer cannot be told apart from its default: `activityStartDate = null` is a
 * valid "whole year" answer AND the server's default, so an existing account's period is always a resolved
 * answer. The only honest signal the period was never asked is an account that was never set up - no canton. So
 * PERIOD rides on canton: satisfied once the account exists. (Re-asking an existing account its period would be
 * harmless, but we claim no more than the record supports - R156 conservative. A brand-new account, having no
 * canton, is sent the full flow by onboarding/Completeness.kt regardless.)
 */
enum class ReleveField {
    NAME {
        override fun satisfiedBy(view: MeView): Boolean = !view.name.isNullOrBlank()
    },
    CANTON {
        override fun satisfiedBy(view: MeView): Boolean = !view.canton.isNullOrBlank()
    },
    RATE {
        override fun satisfiedBy(view: MeView): Boolean = view.employmentRate != null
    },
    METHOD {
        override fun satisfiedBy(view: MeView): Boolean =
            !view.denominatorKind.isNullOrBlank() &&
                (view.denominatorKind != "EXACT" || view.exactTotalWorkDays != null)
    },
    GRANULARITY {
        override fun satisfiedBy(view: MeView): Boolean = !view.granularity.isNullOrBlank()
    },
    PERIOD {
        override fun satisfiedBy(view: MeView): Boolean = !view.canton.isNullOrBlank()
    }, ;

    abstract fun satisfiedBy(view: MeView): Boolean
}

/** The required fields the server does not yet satisfy, in onboarding order. Empty = the account is complete. */
fun missingReleveFields(view: MeView): List<ReleveField> = ReleveField.entries.filter { !it.satisfiedBy(view) }

/** COMPLETE: the releve has every field it needs. */
fun MeView.isComplete(): Boolean = missingReleveFields(this).isEmpty()
