package ch.monreleve.app.pilot

import androidx.compose.material3.DatePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.runComposeUiTest
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.fail

// IOS-1b-A R624 / UNNUMBERED-6. THE CANARY FOR MATERIAL3'S DATE PICKERS ON iOS - ASSERTED BROKEN, NOT SILENTLY BROKEN.
//
// Compose Multiplatform 1.7.3's Material3 was compiled against kotlinx-datetime 0.6.0; this project runs 0.7.1, which
// replaced kotlinx.datetime.Instant. On iOS the calendar model behind the date pickers is therefore UNLINKED: the
// probe (run 40408680643) threw IrLinkageError the moment rememberDatePickerState ran. CommonMainFenceTest forbids
// every shared file from importing them; this test proves the reason is still true.
//
// WHEN THIS TEST STARTS FAILING, the break is gone (a Material3 built against kotlinx-datetime 0.7 has arrived - the
// parked CMP upgrade): delete this test AND the date-picker rule in CommonMainFenceTest together.

@OptIn(ExperimentalTestApi::class, ExperimentalMaterial3Api::class)
class MaterialDatePickerCanaryTest {
    @Test
    fun material3DatePickerStillCannotLinkKotlinxDatetimeOnIos() {
        val thrown =
            try {
                runComposeUiTest {
                    setContent { DatePicker(state = rememberDatePickerState(initialSelectedDateMillis = 0L)) }
                    waitForIdle()
                }
                null
            } catch (e: Throwable) {
                e
            }
        if (thrown == null) {
            fail("Material3's DatePicker composed on iOS: the break is gone - delete this canary and the rule")
        }
        val message = thrown.toString()
        assertTrue(message.contains("kotlinx.datetime/Instant"), "a different failure than the known one: $message")
        println("IOS-1b-A canary: still broken as expected - $message")
    }
}
