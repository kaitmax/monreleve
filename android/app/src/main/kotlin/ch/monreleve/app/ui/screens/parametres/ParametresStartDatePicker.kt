package ch.monreleve.app.ui.screens.parametres

import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.fr.CalendarCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.parametres.ParametresState
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

// IOS-2e R830. ANDROID'S HALF OF THE « Début d'activité » SHEET: its date dialog, and nothing else - IOS-2b R776's
// OnboardingStartDatePicker shape, with an initial date.
//
// The shared sheet (ParametresDateField.kt) composes a slot where the Material 3 block sat; this is what Android puts
// in it: that block - rememberDatePickerState(initialSelectedDateMillis), DatePickerDialog with its confirm
// (ParametresCopy.START_DATE_PICK) and cancel (CalendarCopy.SHEET_CANCEL), DatePicker - moved here UNEDITED except
// that its three "pickerOpen = false" are now the slot's onDismiss(), and the current value arrives as
// initialIsoDay. isoToMillis and millisToIso, the UTC-midnight conversions Material 3 speaks, moved with it unchanged
// (ParametresDatePickerConversionsTest pins them).
//
// WHY :app AND NOT :shared androidMain: it needs no dependency change in either (Material 3 is on :app's classpath),
// and here it stays under :app's ui/ fences (no inline string, tokens only), which do not read androidMain. The
// overload below, named like the shared screen, keeps MainActivity's call exactly as it was.

/** The settings screen, hosted on Android with Material 3's date dialog in its picker slot. */
@Composable
fun ParametresScreen(
    state: ParametresState,
    actions: ParametresActions,
    appVersion: String,
    modifier: Modifier = Modifier,
) {
    ParametresScreen(
        state = state,
        actions = actions,
        appVersion = appVersion,
        startDatePicker = { initialIsoDay, onPicked, onDismiss ->
            MaterialStartDateDialog(initialIsoDay, onPicked, onDismiss)
        },
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MaterialStartDateDialog(
    initialIsoDay: String?,
    onChange: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val pickerState = rememberDatePickerState(initialSelectedDateMillis = isoToMillis(initialIsoDay.orEmpty()))
    DatePickerDialog(
        onDismissRequest = { onDismiss() },
        confirmButton = {
            TextButton(onClick = {
                pickerState.selectedDateMillis?.let { onChange(millisToIso(it)) }
                onDismiss()
            }) { Text(text = ParametresCopy.START_DATE_PICK) }
        },
        dismissButton = {
            TextButton(onClick = { onDismiss() }) { Text(text = CalendarCopy.SHEET_CANCEL) }
        },
    ) {
        DatePicker(state = pickerState)
    }
}

// ISO day <-> UTC millis for the Material 3 date picker (which speaks epoch millis at UTC midnight). The stored
// value is an ISO YYYY-MM-DD day (R28); these keep the picker's millis an implementation detail of this file.
internal fun isoToMillis(iso: String): Long? =
    iso.ifBlank { null }?.let {
        runCatching { LocalDate.parse(it).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()
    }

internal fun millisToIso(millis: Long): String {
    val utcDay = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
    return utcDay.toString()
}
