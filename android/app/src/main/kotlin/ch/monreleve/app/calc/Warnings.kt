package ch.monreleve.app.calc

// AN2 increment 5: ports web/lib/calc-engine/warnings.ts.
//
// SPEC 7.4's Warning union, plus RuleSetFallback from ruling R11. A warning
// is not an error: the result is still computed and returned. Each variant
// maps onto copy in the UI layer.
//
// Where the spec states the trigger, the trigger is the spec's. Where it
// does not, the reading is recorded at the site.

fun warningsFor(
    context: WarningContext,
    rules: RuleSet,
): List<Warning> {
    val warnings = mutableListOf<Warning>()

    warnings.addAll(context.denominatorWarnings)

    // Ruling R11: the substitution reaches the user rather than being
    // implied by a taxYear a caller has to think to compare.
    if (context.requestedTaxYear != rules.taxYear) {
        warnings.add(Warning.RuleSetFallback(context.requestedTaxYear, rules.taxYear))
    }

    if (!context.regimeApplies) {
        // SPEC 7.2 step 1: the ceiling is the same under both regimes, the
        // consequence is not, so the warning carries which one applies.
        warnings.add(Warning.FiscalCeilingExceeded(context.regime))

        // Only under the 1983 accord is the status itself at risk. Telling
        // a Geneva frontalier their status is at risk would simply be
        // false.
        if (context.regime == Regime.RESIDENCE_1983) {
            warnings.add(Warning.FrontalierStatusAtRisk)
        }
    }

    if (context.missionDaysTotal > context.missionCap) {
        warnings.add(
            Warning.MissionCapExceeded(
                cap = context.missionCap,
                excess = context.missionDaysTotal - context.missionCap,
            ),
        )
    }

    // A distinct fact from the cap: the cap says how many mission days may
    // ever be credited, headroom says how many fit under the ceiling this
    // year. Both can bind at once and a user needs to be told which is
    // biting.
    //
    // Not reported once the regime is lost: there is no headroom left to
    // exceed, and FiscalCeilingExceeded is the fact that matters then.
    if (context.regimeApplies && context.missionDaysTotal > context.headroomDays) {
        warnings.add(Warning.MissionsExceedHeadroom(context.missionDaysTotal - context.headroomDays))
    }

    if (context.daysCountedAgainstCeiling > context.totalWorkDays * rules.socialCeiling) {
        warnings.add(Warning.SocialCeilingExceeded)
    }

    // THE A1 THRESHOLD, settled at Checkpoint A on 09.09.2026. The EU
    // framework agreement on cross-border telework applies FROM 25%
    // telework in the state of residence up to (but not including) 50%.
    // Below 25%, article 13 of regulation (EC) 883/2004 governs and the
    // framework agreement's A1 is not the instrument in question.
    //
    // TELEWORK DAYS, NOT daysCountedAgainstCeiling. The fiscal ceiling
    // counts telework plus credited missions; this is about work in the
    // state of residence, and a mission day in a third state is neither.
    // The social ceiling check above still uses daysCountedAgainstCeiling,
    // which is a different question and unchanged.
    //
    // INCLUSIVE at 25%: the agreement applies "from" 25%. totalWorkDays is
    // guaranteed positive by validation (TotalWorkDaysNotPositive), so the
    // division is safe here.
    if (context.teleworkDays / context.totalWorkDays >= rules.a1ThresholdRate) {
        warnings.add(Warning.A1Required)
    }

    return warnings
}
