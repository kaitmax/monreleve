package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

// AN-PARAMS. The « Début d'activité » edit sheet, picked with Material 3's date picker (SPEC 11.5 / the relay):
// the AAAA-MM-JJ text field is gone, the storage format no longer leaks onto the screen. The current value shows
// in the Swiss format (startDateDisplay, dd.MM.yyyy) or « Toute l'année »; the stored value stays an ISO day
// string, set by the picker. In its own file so ParametresFields.kt stays under detekt's TooManyFunctions
// threshold (the picker and its UTC-millis conversions are a distinct concern). Stateless but for the picker's
// open flag (rememberSaveable, R310); every string from fr/ (the no-literal fence). It shares EditSheet and
// EditSheetFrame with the other sheets (same package).

@OptIn(ExperimentalMaterial3Api::class)
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
    if (pickerOpen) {
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = isoToMillis(value))
        DatePickerDialog(
            onDismissRequest = { pickerOpen = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { onChange(millisToIso(it)) }
                    pickerOpen = false
                }) { Text(text = ParametresCopy.START_DATE_PICK) }
            },
            dismissButton = {
                TextButton(onClick = { pickerOpen = false }) { Text(text = CalendarCopy.SHEET_CANCEL) }
            },
        ) {
            DatePicker(state = pickerState)
        }
    }
}

// ISO day <-> UTC millis for the Material 3 date picker (which speaks epoch millis at UTC midnight). The stored
// value is an ISO YYYY-MM-DD day (R28); these keep the picker's millis an implementation detail of this file.
private fun isoToMillis(iso: String): Long? =
    iso.ifBlank { null }?.let {
        runCatching { LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()
    }

private fun millisToIso(millis: Long): String {
    val utcDay = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
    return utcDay.toString()
}
