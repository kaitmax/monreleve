package ch.monreleve.app.ui.screens.onboarding

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.RateChoice

/**
 * AN-ONBOARD. The wizard's callbacks, bundled (a data class so OnboardingScreen takes (state, actions,
 * modifier), and the no-literal fence need not meet a @Suppress in ui/; LongParameterList ignores data
 * classes). onChooseAuto is intercepted by the composition root, which runs the disclosure + OS permission
 * before consent is recorded (R315/R316); onReminderYes/No end step 7 by saving.
 */
data class OnboardingActions(
    val onNameChange: (String) -> Unit,
    val onCantonChange: (Canton) -> Unit,
    val onRateChoiceChange: (RateChoice) -> Unit,
    val onCustomRateChange: (String) -> Unit,
    val onDenominatorChange: (DenominatorChoice) -> Unit,
    val onExactTotalChange: (String) -> Unit,
    val onAllYearChange: (Boolean) -> Unit,
    val onActivityStartDateChange: (String) -> Unit,
    val onChooseManual: () -> Unit,
    val onChooseAuto: () -> Unit,
    val onReminderYes: () -> Unit,
    val onReminderNo: () -> Unit,
    val onNext: () -> Unit,
    val onBack: () -> Unit,
)
