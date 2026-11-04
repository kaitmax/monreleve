package ch.monreleve.app.onboarding

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.settings.MeView
import ch.monreleve.app.settings.ReleveField
import ch.monreleve.app.settings.missingReleveFields

// AN-ONBOARD-2 (R335). Turn a GET /api/v1/me view into an onboarding plan: either the account is COMPLETE (go
// straight to Aujourd'hui), or it is asked ONLY the missing questions, in order, each prefilled from /me. The
// completeness DEFINITION - which fields the releve needs and their predicates - lives in settings/
// ReleveCompleteness.kt (R206, one place); this file maps those fields to wizard STEPS (which need OnboardingStep,
// an onboarding type) and builds the prefill snapshot.
//
// A brand-new account (no canton) runs the full eight steps. A partial account runs only the missing
// releve-field steps and never the mode/reminder steps - those are not releve fields and are not "missing", and a
// partial onboarding must leave the server's detection mode and consent untouched (prefill keeps mode MANUAL, so
// mePatchBody omits loggingMode/consent and the server's value stands).

/** The wizard step that asks for a given required field. */
fun ReleveField.onboardingStep(): OnboardingStep =
    when (this) {
        ReleveField.NAME -> OnboardingStep.NOM
        ReleveField.CANTON -> OnboardingStep.CANTON
        ReleveField.RATE -> OnboardingStep.TAUX
        ReleveField.METHOD -> OnboardingStep.METHODE
        ReleveField.GRANULARITY -> OnboardingStep.GRANULARITY
        ReleveField.PERIOD -> OnboardingStep.PERIODE
    }

sealed interface OnboardingPlan {
    /** The releve has every field it needs; go straight to Aujourd'hui. */
    data object Complete : OnboardingPlan

    /** Run onboarding over `prefill.steps`, prefilled from /me (step = the first question to ask). */
    data class Onboard(val prefill: OnboardingSnapshot) : OnboardingPlan
}

/** The full-flow snapshot with nothing prefilled (a brand-new account, or a /me body that could not be read). */
fun freshOnboardingSnapshot(): OnboardingSnapshot {
    return OnboardingSnapshot(step = DEFAULT_STEPS.first(), steps = DEFAULT_STEPS)
}

/** Decide the plan for a /me view (null = malformed/unreachable body: run the full flow, nothing prefilled). */
fun onboardingPlanFor(view: MeView?): OnboardingPlan {
    if (view == null) return OnboardingPlan.Onboard(freshOnboardingSnapshot())
    val missing = missingReleveFields(view)
    // No canton means the account was never set up: run the full eight steps (mode + reminder included),
    // prefilled with the server's defaults (which are the onboarding defaults anyway). A partial account runs
    // only the missing releve-field steps.
    return when {
        missing.isEmpty() -> OnboardingPlan.Complete
        view.canton.isNullOrBlank() -> OnboardingPlan.Onboard(prefillSnapshot(view, DEFAULT_STEPS))
        else -> OnboardingPlan.Onboard(prefillSnapshot(view, missing.map { it.onboardingStep() }))
    }
}

/** An onboarding snapshot carrying the server's known values, the steps to ask, and the first step to ask. */
private fun prefillSnapshot(
    view: MeView,
    steps: List<OnboardingStep>,
): OnboardingSnapshot {
    val canton = Canton.entries.firstOrNull { it.name == view.canton }
    val (rateChoice, customRate) =
        when (view.employmentRate) {
            100, null -> RateChoice.R100 to ""
            80 -> RateChoice.R80 to ""
            60 -> RateChoice.R60 to ""
            else -> RateChoice.OTHER to view.employmentRate.toString()
        }
    return OnboardingSnapshot(
        step = steps.first(),
        name = view.name ?: "",
        canton = canton,
        rateChoice = rateChoice,
        customRate = customRate,
        denominator = if (view.denominatorKind == "EXACT") DenominatorChoice.EXACT else DenominatorChoice.SIMPLIFIED240,
        exactTotalWorkDays = view.exactTotalWorkDays?.toString() ?: "",
        allYear = view.activityStartDate.isNullOrBlank(),
        activityStartDate = view.activityStartDate ?: "",
        // MANUAL so a partial onboarding does not touch the server's detection mode/consent (see header).
        mode = ModeChoice.MANUAL,
        reminder = false,
        granularity = if (view.granularity == "HALF_DAY") GranularityChoice.HALF_DAY else GranularityChoice.DAY,
        steps = steps,
    )
}
