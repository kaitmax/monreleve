package ch.monreleve.app.ios

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.runComposeUiTest
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.fail

// IOS-SHELL-2 (R1339, iOS Ruling 13 Q2). CAN THE NATIVE DATE PICKER BE OPENED IN AN iosTest? MEASURED HERE, A CANARY.
//
// IosStartDatePicker (IosShellUi.kt) is a UIDatePicker inside androidx.compose.ui.viewinterop.UIKitView, in a Dialog.
// CMP 1.7.3's UIKitView reads LocalInteropContainer (ui-1.7.3-sources: uikitMain viewinterop/UIKitView.uikit.kt:56),
// whose default is `error("LocalInteropContainer not provided")` (skikoMain viewinterop/InteropContainer.skiko.kt:37).
// Only a ComposeUIViewController's own scene provides one; runComposeUiTest's scene (CanvasLayersComposeScene over a
// PlatformContext.Empty, ui-test-uikitsimarm64-1.7.3 ComposeUiTest.skikoMain.kt:221) does not, and the local is
// INTERNAL, so a test cannot provide it either. So the picker cannot be opened - or read - in an iosTest at all, from
// either slot; IOS-WALK opens it on the simulator, from onboarding and from Paramètres.
//
// This test composes the REAL IosStartDatePicker and asserts the failure IS that one. WHEN IT STARTS FAILING, the
// reason is gone (an upgrade that provides an interop container to tests): replace it with the test R1339 asks for -
// open the picker from each slot and assert the chosen day reaches the slot's callback.

@OptIn(ExperimentalTestApi::class)
class IosStartDatePickerCanaryIosTest {
    @Test
    fun theNativePickerCannotBeComposedInAnIosTestForWantOfAnInteropContainer() {
        var picked: String? = null
        val thrown =
            try {
                runComposeUiTest {
                    setContent { IosStartDatePicker("2026-03-01", onPicked = { picked = it }, onDismiss = {}) }
                    waitForIdle()
                }
                null
            } catch (e: Throwable) {
                e
            }
        if (thrown == null) {
            fail("the native picker composed in an iosTest (picked=$picked): the reason is gone - write R1339's test")
        }
        val message = thrown.toString()
        assertTrue(message.contains("LocalInteropContainer"), "a different failure than the known one: $message")
        println("IOS-SHELL-2 R1339 canary: the native picker cannot open in an iosTest - $message")
    }
}
