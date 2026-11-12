package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.parametres.DeleteOutcome
import ch.monreleve.app.parametres.DeletePrompt
import ch.monreleve.app.parametres.ParametresState
import ch.monreleve.app.parametres.RateChange
import ch.monreleve.app.parametres.SignOutPrompt
import org.junit.Rule
import org.junit.Test

// AN-PARAM-BASELINES (R871/R872). What the Parametres screen draws OVER its list, at the device's own size: every
// dialog ParametresState drives (R290's before/after, the three sign-out states, the delete prompt and its four
// outcomes), plus the licences sub-screen the « Licences » row opens. Each dialog is reached the way the product
// reaches it - a state handed to :app's public ParametresScreen (ParametresHost) - never by calling the internal
// dialog composable. R872's probe measured that Paparazzi 1.3.5 draws a Compose Dialog's own window whole, scrim
// included, so these are the product's dialogs as composed, not their content alone.
//
// NOT HERE, AND WHY (PARKED, not opened up): the seven sheets (PARK-PB1 - internal to :shared, opened only by a
// tap), the start-date dialog (PARK-PB2 - private to :app, behind a sheet), the delete dialog with its word typed
// (PARK-PB3 - local state, typing only).

class ParametresScreenScreenshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5,
            theme = "android:Theme.Material.Light.NoActionBar",
            // IOS-1b-A R626 (R345): zero, stated - never Paparazzi 1.3.5's default 0.1. Guarded by
            // fences/PaparazziZeroToleranceTest, which reads the VALUE off this rule.
            maxPercentDifference = 0.0,
        )

    private fun over(state: ParametresState) {
        paparazzi.snapshot { ParametresHost(state) }
    }

    private fun done(alertRemains: Boolean) = DeleteOutcome.Done(RECORDED, alertSubscriptionRemains = alertRemains)

    // R290: the year's rate would move. The walkthrough's figures (ParametresDialogScreenshotTest's): 0,41 -> 0,83 %.
    @Test
    fun rateChangeDialog() {
        over(defaultParametresState.copy(pendingRateChange = RateChange(before = BEFORE_RATE, after = AFTER_RATE)))
    }

    // R440: the bounded send is in flight - no buttons.
    @Test
    fun signOutSendingDialog() {
        over(defaultParametresState.copy(signOutSending = true))
    }

    // Nothing left on the phone: the plain two-button confirmation.
    @Test
    fun signOutDialog() {
        over(defaultParametresState.copy(signOutPrompt = SignOutPrompt(pendingDates = emptyList())))
    }

    // R440: two days still only on this phone, NAMED, and the three actions stacked.
    @Test
    fun signOutPendingDialog() {
        over(defaultParametresState.copy(signOutPrompt = SignOutPrompt(pendingDates = PENDING_DATES)))
    }

    // The case the stacked layout exists for: three actions at 200 %.
    @Test
    fun signOutPendingDialogLarge() {
        paparazzi.unsafeUpdateConfig(DeviceConfig.PIXEL_5.copy(fontScale = 2f))
        over(defaultParametresState.copy(signOutPrompt = SignOutPrompt(pendingDates = PENDING_DATES)))
    }

    // R289: what is destroyed, no unsynced day; the word not typed, so « Supprimer » is disabled.
    @Test
    fun deleteDialog() {
        over(defaultParametresState.copy(deletePrompt = DeletePrompt(recordedDays = RECORDED, unsyncedDays = 0)))
    }

    // R289: the unsynced days that cannot be recovered, named in the error colour.
    @Test
    fun deleteDialogUnsynced() {
        over(
            defaultParametresState.copy(deletePrompt = DeletePrompt(recordedDays = RECORDED, unsyncedDays = UNSYNCED)),
        )
    }

    @Test
    fun deleteDoneDialog() {
        over(defaultParametresState.copy(deleteOutcome = done(alertRemains = false)))
    }

    // SPEC 14.3: the alert subscription outlives the account, and the outcome says so.
    @Test
    fun deleteDoneAlertDialog() {
        over(defaultParametresState.copy(deleteOutcome = done(alertRemains = true)))
    }

    @Test
    fun deleteRefusedDialog() {
        over(defaultParametresState.copy(deleteOutcome = DeleteOutcome.Refused))
    }

    @Test
    fun deleteUnknownDialog() {
        over(defaultParametresState.copy(deleteOutcome = DeleteOutcome.Unknown))
    }

    // The sub-screen the « Licences » row opens: the product's public LicencesScreen, which ParametresScreen
    // renders as-is while showLicences is set.
    @Test
    fun licences() {
        paparazzi.snapshot {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    LicencesScreen(onBack = {})
                }
            }
        }
    }

    private companion object {
        const val BEFORE_RATE = 0.41
        const val AFTER_RATE = 0.83
        const val RECORDED = 42
        const val UNSYNCED = 3
        val PENDING_DATES = listOf("2026-06-02", "2026-06-03")
    }
}
