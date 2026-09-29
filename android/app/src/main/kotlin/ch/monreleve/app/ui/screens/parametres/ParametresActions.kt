package ch.monreleve.app.ui.screens.parametres

import ch.monreleve.app.calc.Canton
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice

// AN12 increment 1. The Parametres screen's callbacks, bundled so the screen signature stays flat as later
// increments add account actions (export, sign-out, deletion). The screen is stateless (fence 5): it reads a
// ParametresState and calls these; the controller behind them holds the store, the session seam and the
// engine path for R290's before/after.

data class ParametresActions(
    val onCantonChange: (Canton) -> Unit,
    val onEmploymentRateChange: (String) -> Unit,
    val onDenominatorChange: (DenominatorChoice) -> Unit,
    val onExactTotalChange: (String) -> Unit,
    val onGranularityChange: (GranularityChoice) -> Unit,
    val onActivityStartDateChange: (String) -> Unit,
    val onSave: () -> Unit,
    /** R290: the person saw the before/after and confirmed the consequential change. */
    val onConfirmRateChange: () -> Unit,
    /** R290: the person saw the before/after and kept the current value. */
    val onCancelRateChange: () -> Unit,
)
