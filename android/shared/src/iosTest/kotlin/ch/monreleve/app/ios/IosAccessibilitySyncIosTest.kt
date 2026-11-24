package ch.monreleve.app.ios

import androidx.compose.runtime.ExperimentalComposeApi
import androidx.compose.ui.platform.AccessibilitySyncOptions
import androidx.compose.ui.uikit.ComposeUIViewControllerConfiguration
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-A11Y-SYNC R1432. THE APP'S CONTROLLER SYNCS ITS ACCESSIBILITY TREE ALWAYS, NOT ONLY WHILE VOICEOVER RUNS.
// Compose Multiplatform 1.7.3's default, WhenRequiredByAccessibilityServices, syncs only when
// UIAccessibilityIsVoiceOverRunning() (Accessibility.uikit.kt:990), so Voice Control, Switch Control and Full Keyboard
// Access may meet an empty tree (REPORT-IOS-AUDIT F1, Q1 option (a)). The assertion is read from the configuration
// OBJECT the app's lambda builds - the same `ComposeUIViewControllerConfiguration().apply(configure)` Compose runs in
// ComposeUIViewController - never from a source grep (R154). The control test proves the assertion can tell the two
// options apart: a fresh configuration carries the default. What this does NOT prove: that monReleveViewController
// passes this lambda (its hosting controller keeps the configuration private, and the function needs a bundle's
// MonReleveApiBaseUrl); that is one `configure =` argument at the lambda's one home.
class IosAccessibilitySyncIosTest {
    @OptIn(ExperimentalComposeApi::class) // R1431: the sync option is @ExperimentalComposeApi in CMP 1.7.3.
    @Test
    fun aFreshConfigurationCarriesTheVoiceOverOnlyDefault() {
        val options = ComposeUIViewControllerConfiguration().accessibilitySyncOptions
        assertTrue(
            options is AccessibilitySyncOptions.WhenRequiredByAccessibilityServices,
            "control: a fresh configuration carries ${options::class.simpleName}, not the VoiceOver-only default",
        )
    }

    @OptIn(ExperimentalComposeApi::class) // R1431: the sync option is @ExperimentalComposeApi in CMP 1.7.3.
    @Test
    fun theAppsControllerConfigurationSyncsTheTreeAlways() {
        val options =
            ComposeUIViewControllerConfiguration().apply(monReleveControllerConfiguration).accessibilitySyncOptions
        assertTrue(
            options is AccessibilitySyncOptions.Always,
            "R1432: the app's controller is configured with ${options::class.simpleName}, not Always",
        )
    }
}
