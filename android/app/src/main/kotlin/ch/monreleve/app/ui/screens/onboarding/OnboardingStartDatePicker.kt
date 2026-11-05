package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.OnboardingState
import ch.monreleve.app.onboarding.isoOf

// IOS-2b R776/R779. ANDROID'S HALF OF THE ONBOARDING WIZARD: its date picker, and nothing else.
//
// The wizard moved to :shared commonMain; the period step's date picker did not, because Material3 1.7.3's date
// pickers are unlinked on iOS (CommonMainFenceTest, MaterialDatePickerCanaryTest). The shared screen takes the picker
// as a slot (`startDatePicker`) and keeps owning WHEN it shows. This file is what Android puts in it: the block that
// sat at the end of the period step - rememberDatePickerState, DatePickerDialog with TertiaryButton(CONTINUE),
// DatePicker - moved here UNEDITED except for its two `showPicker = false`, which are now the slot's onDismiss().
//
// WHY :app AND NOT :shared androidMain: it needs no dependency change in either (Material3 is already on :app's
// classpath - ParametresDateField uses the same picker), and here it stays under :app's ui/ fences (no inline string,
// tokens only), which do not read androidMain. The overload below, named like the shared screen, keeps every Android
// call - MainActivity's OnboardingRoute and OnboardingScreenScreenshotTest - exactly as it was.

/** The shared onboarding wizard, hosted on Android with Material3's date dialog in its picker slot. */
@Composable
fun OnboardingScreen(
    state: OnboardingState,
    actions: OnboardingActions,
    modifier: Modifier = Modifier,
) {
    OnboardingScreen(
        state = state,
        actions = actions,
        startDatePicker = { onPicked, onDismiss -> MaterialStartDateDialog(onPicked, onDismiss) },
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MaterialStartDateDialog(
    onActivityStartDateChange: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val pickerState = androidx.compose.material3.rememberDatePickerState()
    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = { onDismiss() },
        confirmButton = {
            TertiaryButton(
                label = OnboardingCopy.CONTINUE,
                onClick = {
                    pickerState.selectedDateMillis?.let { onActivityStartDateChange(isoOf(it)) }
                    onDismiss()
                },
            )
        },
    ) { androidx.compose.material3.DatePicker(state = pickerState) }
}
