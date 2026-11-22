package ch.monreleve.app.ui.shell

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.design.FrontierTheme

// AN-EDGE-INSETS (R1170). THE ONE PLACE THE SYSTEM BARS ARE HANDLED, for every screen of every activity.
//
// targetSdk 36 makes the window edge-to-edge on Android 15+ whatever the theme asks: the app draws behind the status
// bar and the navigation bar, and each screen has to keep its content out of them. Until this task only MainShell's
// Scaffold did (Material3 pads its content and its NavigationBar by default); every screen drawn outside it - welcome,
// sign-in, onboarding, the detection disclosure, Prevision, Comparaison - put its main button under the navigation
// bar, and on a 3-button phone a tap on Prevision's button opened Recents (REPORT-AN-API36-PASS N1).
//
// WHY HERE, AT THE ROOT, AND NOT PER CALL SITE OR IN :shared:
//   - one wrapper hosts every destination, so a screen added tomorrow is covered by being reachable, not by somebody
//     remembering a modifier - fences/EdgeToEdgeCensusTest fails on any screen that is not hosted by it;
//   - windowInsetsPadding both PADS and CONSUMES: everything beneath it sees the insets as already used, so MainShell's
//     Scaffold and its NavigationBar (which subtract consumed insets) add nothing - no screen pads twice;
//   - it lives in :app because the insets are the Android window's. iOS hosts the shared screens in its own view
//     controllers with their own safe areas, and :shared stays unchanged.
//
// THE SET: the system bars and the display cutout (a landscape phone's camera notch). NOT the IME - the keyboard
// covering a bottom button is older behaviour than N1 and is recorded, not changed, by this task.
// Below Android 15 (the S9 is API 29) the window is not edge-to-edge, the reported insets are zero, and this pads
// nothing - the same inset source Scaffold already read there.
//
// [insets] is a parameter only so AppRootScreenshotTest can hand it fixed values (Paparazzi's window has no bars);
// every activity calls AppRoot with the default.

/** Hosts [content] in the app theme, on the canvas, inside the system bars - which it consumes. */
@Composable
fun AppRoot(
    insets: WindowInsets = WindowInsets.systemBars.union(WindowInsets.displayCutout),
    content: @Composable () -> Unit,
) {
    FrontierTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Box(modifier = Modifier.fillMaxSize().windowInsetsPadding(insets)) { content() }
        }
    }
}
