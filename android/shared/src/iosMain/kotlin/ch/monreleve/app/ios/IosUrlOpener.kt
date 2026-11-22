package ch.monreleve.app.ios

import platform.Foundation.NSURL
import platform.UIKit.UIApplication

// IOS-SHELL-2 (R1333, iOS Ruling 3 Q5). OPENING A PAGE OR THE MAIL APP FROM THE iOS SHELL - Android's Custom Tab and
// CATEGORY_APP_EMAIL intent (MainActivity's openLegal / openMail).
//
// THE LEGAL PAGES open with UIApplication.openURL, not SFSafariViewController. Chosen because openURL's completion says
// whether ANY app took the address - the very signal R299's fallback needs (no browser: show the address instead of
// failing silently); SFSafariViewController always presents and would need the SafariServices framework linked for no
// added signal. The page opens in the person's browser, as a plain ACTION_VIEW does on an Android with no Custom Tabs.
//
// "OUVRIR MA MESSAGERIE" opens message:// (iOS Ruling 3 Q5), and the button is HIDDEN when canOpenURL says nothing can
// open it - a phone with no Mail app (the simulator: measured by the host probe's step (8)). canOpenURL answers for a
// scheme only when Info.plist's LSApplicationQueriesSchemes lists it (ios/project.yml lists `message`, nothing else).
// If openURL still fails, R299's fallback shows the existing NO_MAIL_APP copy.
//
// UIApplication exists only in the app's process: the iosTests pass their own opener (ShellTestDoubles.kt).

/** The Mail app's scheme - ONE home (R206) for the shell, the probe and project.yml's comment. */
const val MAIL_APP_URL = "message://"

/** What the shell asks of the system about an address. */
interface IosUrlOpener {
    /** Whether some app on this phone can open [url] (for a scheme Info.plist lists in LSApplicationQueriesSchemes). */
    fun canOpen(url: String): Boolean

    /** Opens [url]; [onResult] gets whether an app took it (on the main queue). */
    fun open(
        url: String,
        onResult: (opened: Boolean) -> Unit,
    )
}

/** The system's answers, through UIApplication. */
class SystemUrlOpener : IosUrlOpener {
    override fun canOpen(url: String): Boolean {
        val address = NSURL.URLWithString(url) ?: return false
        return UIApplication.sharedApplication.canOpenURL(address)
    }

    override fun open(
        url: String,
        onResult: (opened: Boolean) -> Unit,
    ) {
        val address = NSURL.URLWithString(url)
        if (address == null) {
            onResult(false)
            return
        }
        UIApplication.sharedApplication.openURL(address, options = emptyMap<Any?, Any?>()) { opened ->
            onResult(opened)
        }
    }
}

/** The host probe's step (8): what THIS phone answers for the Mail app's scheme, through the shell's own opener. */
fun canOpenMailApp(): Boolean = SystemUrlOpener().canOpen(MAIL_APP_URL)
