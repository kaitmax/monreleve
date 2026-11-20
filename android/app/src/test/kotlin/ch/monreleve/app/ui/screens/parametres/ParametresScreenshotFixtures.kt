package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.ParametresState

// AN-PARAM-BASELINES (R871). What ParametresListScreenshotTest and ParametresScreenScreenshotTest share: the
// settings every state starts from, actions that do nothing, and the host - the PRODUCT's own entry point,
// :app's public ParametresScreen (the overload MainActivity calls), inside the theme on the background colour.
// Nothing here reaches past the public surface: the sheets are internal to :shared and open only on a tap, so
// they are PARK-PB1, not reached by a back door (Queue Ruling 7).

/** The default settings: Geneva, 100 %, the 240-day method, whole days, no start date, every switch off. */
internal val defaultParametresState =
    ParametresState(
        canton = Canton.GE,
        employmentRate = "100",
        denominator = DenominatorChoice.SIMPLIFIED240,
        exactTotalWorkDays = "",
        granularity = GranularityChoice.DAY,
        activityStartDate = "",
    )

internal val noopParametresActions =
    ParametresActions(
        onCantonChange = {},
        onEmploymentRateChange = {},
        onDenominatorChange = {},
        onExactTotalChange = {},
        onGranularityChange = {},
        onActivityStartDateChange = {},
        onSave = {},
        onConfirmRateChange = {},
        onCancelRateChange = {},
        onExportJson = {},
        onExportCsv = {},
        onRequestSignOut = {},
        onConfirmSignOut = {},
        onCancelSignOut = {},
        onRequestDelete = {},
        onConfirmDelete = {},
        onCancelDelete = {},
        onAcknowledgeDelete = {},
        onOpenLegal = {},
        onToggleAutoDetection = {},
        onToggleEveningNotification = {},
    )

/** A fixed version, so the « Version » row never moves with the build. */
private const val APP_VERSION = "1.0.0"

// AN-PLAY-PACK (R1124): `actions` defaults to the no-op set; the manual-only baseline passes a set with no detection
// handler, which is how a build without detection reaches the screen.
@Composable
internal fun ParametresHost(
    state: ParametresState,
    actions: ParametresActions = noopParametresActions,
) {
    FrontierTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            ParametresScreen(state = state, actions = actions, appVersion = APP_VERSION)
        }
    }
}
