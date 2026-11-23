package ch.monreleve.app.ios

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitInteropProperties
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.Dialog
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.ui.screens.onboarding.TertiaryButton
import kotlinx.cinterop.ExperimentalForeignApi
import platform.CoreGraphics.CGRectMake
import platform.Foundation.NSCalendar
import platform.Foundation.NSCalendarUnitDay
import platform.Foundation.NSCalendarUnitMonth
import platform.Foundation.NSCalendarUnitYear
import platform.Foundation.NSDateComponents
import platform.Foundation.NSLocale
import platform.UIKit.UIColor
import platform.UIKit.UIDatePicker
import platform.UIKit.UIDatePickerMode
import platform.UIKit.UIDatePickerStyle
import platform.UIKit.UIView
import platform.UIKit.UIViewAutoresizingFlexibleHeight
import platform.UIKit.UIViewAutoresizingFlexibleWidth

// IOS-SHELL-1 G7, IOS-AUDIT R1389. THE NATIVE DATE PICKER in the common startDatePicker slots - moved out of
// IosShellUi.kt unchanged (detekt TooManyFunctions: the shell's file held eleven), so the shell's composables and the
// picker's UIKit plumbing each have one home.

/**
 * G7: the native date picker in the common startDatePicker slots - a UIDatePicker (inline calendar, date only) in its
 * own layer, confirmed with the onboarding's existing CONTINUE; dismissing it changes nothing.
 */
@OptIn(ExperimentalForeignApi::class)
@Composable
internal fun IosStartDatePicker(
    initialIsoDay: String?,
    onPicked: (isoDay: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val background = MaterialTheme.colorScheme.background
    val host = remember { startDatePickerView(initialIsoDay, background) }
    Dialog(onDismissRequest = onDismiss) {
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // IOS-AUDIT R1389: the native view reaches VoiceOver itself (CMP 1.7.3's interop default hides it -
                // UIKitInteropProperties.isNativeAccessibilityEnabled = false, which IOS-WALK saw as the picker missing
                // from the tree). The picker is the only native view here, so the one-per-merged-tree limit holds.
                UIKitView(
                    factory = { host.container },
                    modifier = Modifier.fillMaxWidth().height(PICKER_HEIGHT.dp),
                    properties = UIKitInteropProperties(isInteractive = true, isNativeAccessibilityEnabled = true),
                )
                TertiaryButton(
                    label = OnboardingCopy.CONTINUE,
                    onClick = {
                        onPicked(isoDayOf(host.picker))
                        onDismiss()
                    },
                )
            }
        }
    }
}

private const val PICKER_HEIGHT = 360

/**
 * IOS-AUDIT R1389: the language the native picker draws its months and weekdays in - the app's own (every word of its
 * copy is French, and the site declares lang="fr"), never the device's, which drew an English calendar inside a French
 * app (iOS Ruling 18, F6). A language, not a region: the picker shows no number format, and the chosen day is read back
 * through the calendar's components (isoDayOf), not through a formatter.
 */
internal const val PICKER_LANGUAGE = "fr"

/** R1389: the native picker and the opaque view that holds it - the view UIKitView hosts. */
internal class StartDatePickerHost(
    val container: UIView,
    val picker: UIDatePicker,
)

/**
 * IOS-AUDIT R1389: the native picker the slot shows, built in ONE place so an iosTest can read what it is set to
 * (the composed picker cannot be opened in an iosTest - IosStartDatePickerCanaryIosTest). [background] is the dialog
 * surface's own colour, from the theme. The picker sits in an OPAQUE container that fills the slot: run 45175730795
 * measured that a UIDatePicker does not keep a background colour set on it (alpha read back 0.0), so the opacity is
 * the container's, which nothing overrides.
 */
@OptIn(ExperimentalForeignApi::class)
internal fun startDatePickerView(
    initialIsoDay: String?,
    background: Color,
): StartDatePickerHost {
    val opaque =
        UIColor(
            red = background.red.toDouble(),
            green = background.green.toDouble(),
            blue = background.blue.toDouble(),
            alpha = 1.0,
        )
    val picker = pickerOf(initialIsoDay, opaque)
    val container = UIView()
    container.backgroundColor = opaque
    // The picker FILLS the container: its own default frame is zeroed first, then it grows with the container
    // (flexible width and height). Without the zeroing, autoresizing ADDED the container's size to the picker's default
    // frame (walk run 45178578142, 28-datepicker-open.png: the calendar drawn oversized and clipped).
    picker.setFrame(CGRectMake(0.0, 0.0, 0.0, 0.0))
    picker.autoresizingMask = UIViewAutoresizingFlexibleWidth or UIViewAutoresizingFlexibleHeight
    container.addSubview(picker)
    return StartDatePickerHost(container, picker)
}

@OptIn(ExperimentalForeignApi::class)
private fun pickerOf(
    initialIsoDay: String?,
    opaque: UIColor,
): UIDatePicker =
    UIDatePicker().apply {
        datePickerMode = UIDatePickerMode.UIDatePickerModeDate
        preferredDatePickerStyle = UIDatePickerStyle.UIDatePickerStyleInline
        initialIsoDay?.let(::nsDateOf)?.let { date = it }
        // R1389: French months and weekdays whatever the device's language (F6 drew "November 2026", SUN..SAT).
        locale = NSLocale(localeIdentifier = PICKER_LANGUAGE)
        // R1389: asked for an opaque background too (the container is what guarantees it - see above), so the page
        // beneath can never show through the calendar (F6: the Paramètres rows drawn text over text through it).
        backgroundColor = opaque
    }

/** The picker's day in the device's calendar, as an ISO day (yyyy-MM-dd). */
private fun isoDayOf(picker: UIDatePicker): String {
    val parts =
        NSCalendar.currentCalendar.components(
            NSCalendarUnitYear or NSCalendarUnitMonth or NSCalendarUnitDay,
            fromDate = picker.date,
        )
    val year = parts.year.toString().padStart(4, '0')
    val month = parts.month.toString().padStart(2, '0')
    val day = parts.day.toString().padStart(2, '0')
    return "$year-$month-$day"
}

/** An ISO day as a date in the device's calendar, or null for anything that is not one. */
private fun nsDateOf(iso: String): platform.Foundation.NSDate? {
    val parts = iso.split('-').mapNotNull { it.toLongOrNull() }
    if (parts.size != 3) return null
    val components = NSDateComponents()
    components.year = parts[0]
    components.month = parts[1]
    components.day = parts[2]
    return NSCalendar.currentCalendar.dateFromComponents(components)
}
