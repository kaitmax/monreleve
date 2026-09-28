package ch.monreleve.app.ui.screens.onboarding

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice

/**
 * The onboarding screen's callbacks, one per field plus submit. A data class so OnboardingScreen
 * takes (state, actions, modifier) rather than nine parameters - grouped rather than suppressed,
 * because the no-inline-string fence forbids the annotation string a @Suppress would put in a ui/
 * file. LongParameterList ignores data classes, so bundling here is clean on both counts.
 */
data class OnboardingActions(
    val onCantonChange: (Canton) -> Unit,
    val onEmploymentRateChange: (String) -> Unit,
    val onDenominatorChange: (DenominatorChoice) -> Unit,
    val onExactTotalChange: (String) -> Unit,
    val onGranularityChange: (GranularityChoice) -> Unit,
    val onActivityStartDateChange: (String) -> Unit,
    val onSubmit: () -> Unit,
)
