package ch.monreleve.app.ios

import androidx.compose.ui.graphics.Color
import kotlinx.cinterop.ExperimentalForeignApi
import platform.CoreGraphics.CGColorGetAlpha
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-AUDIT R1389 (iOS Ruling 18, F6). THE NATIVE DATE PICKER SPEAKS FRENCH AND IS OPAQUE. IOS-WALK's run 15 screenshot
// showed it in ENGLISH ("November 2026", SUN..SAT) inside a French app, and drawn with NO background - the Paramètres
// rows showed through its calendar. The composed picker cannot be opened in an iosTest (no interop container -
// IosStartDatePickerCanaryIosTest), so this reads the picker the slot builds (startDatePickerView, the one place it is
// configured) - the same object IosStartDatePicker hands to UIKitView. The simulator test process's own locale is the
// runner's (English), which is exactly the condition that drew the English calendar. The look itself is confirmed on
// the walk's screenshot of the opened picker.

class IosStartDatePickerViewIosTest {
    @OptIn(ExperimentalForeignApi::class)
    @Test
    fun r1389ThePickerIsFrenchAndOpaqueWhateverTheDevicesLanguage() {
        val picker = startDatePickerView("2026-03-01", Color.White)

        val locale = picker.locale?.localeIdentifier
        assertTrue(locale?.startsWith(PICKER_LANGUAGE) == true, "R1389: the picker's locale is French, read $locale")
        val alpha = CGColorGetAlpha(picker.backgroundColor?.CGColor)
        assertEquals(1.0, alpha, "R1389: the picker draws its own, opaque background")
    }
}
