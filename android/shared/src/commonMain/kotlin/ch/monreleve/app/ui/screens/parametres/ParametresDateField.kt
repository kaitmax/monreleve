package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy

// AN-PARAMS. The « Début d'activité » edit sheet, picked with Material 3's date picker (SPEC 11.5 / the relay):
// the AAAA-MM-JJ text field is gone, the storage format no longer leaks onto the screen. The current value shows
// in the Swiss format (startDateDisplay, dd.MM.yyyy) or « Toute l'année »; the stored value stays an ISO day
// string, set by the picker. In its own file so ParametresFields.kt stays under detekt's TooManyFunctions
// threshold (the picker and its UTC-millis conversions are a distinct concern). Stateless but for the picker's
// open flag (rememberSaveable, R310); every string from fr/ (the no-literal fence). It shares EditSheet and
// EditSheetFrame with the other sheets (same package).
//
// IOS-2e R830 (R776's seam, with an initial date): the picker itself is a SLOT, frame.startDatePicker, composed
// exactly where the Material 3 block sat, handed the current value (an ISO day, or null when the field is empty) and
// onPicked / onDismiss. This file keeps WHEN the picker shows (pickerOpen, as before); WHAT shows is the host's -
// Android's Material 3 dialog and its UTC-millis conversions stay in :app (ParametresStartDatePicker.kt), because
// Material 3 1.7.3's date pickers are unlinked on iOS (CommonMainFenceTest, MaterialDatePickerCanaryTest).

@Composable
internal fun StartDateSheetContent(
    value: String,
    frame: EditSheetFrame,
    onChange: (String) -> Unit,
) {
    var pickerOpen by rememberSaveable { mutableStateOf(false) }
    EditSheet(OnboardingCopy.START_DATE_LABEL, frame) {
        Text(text = startDateDisplay(value), style = FrontierType.bodyM)
        OutlinedButton(
            onClick = { pickerOpen = true },
            enabled = !frame.saving,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = ParametresCopy.START_DATE_PICK)
        }
        // « Toute l'année » clears the date (the optional whole-year case) - no format helper, no typed date.
        TextButton(onClick = { onChange("") }, enabled = !frame.saving, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.START_DATE_EMPTY)
        }
    }
    if (pickerOpen) frame.startDatePicker(value.ifBlank { null }, onChange) { pickerOpen = false }
}
