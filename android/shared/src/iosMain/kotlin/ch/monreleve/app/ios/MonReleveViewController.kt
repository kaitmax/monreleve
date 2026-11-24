package ch.monreleve.app.ios

import androidx.compose.runtime.ExperimentalComposeApi
import androidx.compose.ui.uikit.ComposeUIViewControllerConfiguration
import androidx.compose.ui.window.ComposeUIViewController
import ch.monreleve.app.fr.ParametresCopy
import platform.Foundation.NSBundle
import platform.UIKit.UIViewController
import kotlin.time.ExperimentalTime

// IOS-SHELL-1 (R1320). THE iOS APP'S CONTENT: ONE ComposeUIViewController whose content is the COMMON AppRoot around
// the
// common router (IosShellRoot), over the process's ONE shell (startIosShell - built the first time this is called and
// reused after, so a second view controller can never build a second session, R507's rule on iOS).
//
// The two values Swift does not pass come from Info.plist, where ios/project.yml writes them (R206 - one home each):
//   MonReleveApiBaseUrl          the API base URL, ONE build setting per configuration (MONRELEVE_API_BASE_URL)
//   CFBundleShortVersionString   with CFBundleVersion, the version line ParametresCopy.version formats (R894)
// A bundle without the base URL is refused loudly rather than defaulted: a default would be a literal in code.

private var processShell: IosShell? = null

// IOS-A11Y-SYNC R1431/R1432. THE CONFIGURATION THE APP'S ONE ComposeUIViewController IS BUILT WITH - one home, passed
// as `configure` below and read by IosAccessibilitySyncIosTest from this value (R154: the object, not the source).
@OptIn(ExperimentalComposeApi::class) // R1431: the configuration's accessibility sync option (CMP 1.7.3).
internal val monReleveControllerConfiguration: ComposeUIViewControllerConfiguration.() -> Unit = {}

/** The app's view controller - what MonReleveApp.swift hosts with .ignoresSafeArea() (R1170). */
@OptIn(ExperimentalTime::class) // KMP-DT R590: startIosShell's signature names kotlin.time.Clock - on the allowlist.
fun monReleveViewController(): UIViewController {
    val shell = processShell ?: startIosShell(apiBaseUrl(), appVersion()).also { processShell = it }
    // IOS-SHELL-2 (R1331): the share sheet is presented from this controller (IosShareSheet.kt).
    return ComposeUIViewController(configure = monReleveControllerConfiguration) { IosShellRoot(shell) }
        .also { hostViewController = it }
}

private fun infoString(key: String): String? = NSBundle.mainBundle.objectForInfoDictionaryKey(key) as? String

private fun apiBaseUrl(): String =
    checkNotNull(infoString("MonReleveApiBaseUrl")) { "Info.plist carries no MonReleveApiBaseUrl (ios/project.yml)" }

private fun appVersion(): String =
    ParametresCopy.version(
        infoString("CFBundleShortVersionString").orEmpty(),
        infoString("CFBundleVersion").orEmpty(),
    )
