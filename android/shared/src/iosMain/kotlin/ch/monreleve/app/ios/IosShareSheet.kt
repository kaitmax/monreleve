package ch.monreleve.app.ios

import platform.Foundation.NSURL
import platform.UIKit.UIActivityViewController
import platform.UIKit.UIViewController

// IOS-SHELL-2 (R1331, G5, PARK-IF2). THE SHARE SHEET - Android's ACTION_SEND chooser (MainActivity.shareFile).
//
// The two exports (the releve's PDF/CSV and the account's JSON/CSV) are written by IosExportFiles.write (IOS-2f R891:
// the app's temporary directory, under the server's filename, erased with the record) and the path it returns is
// handed to a UIActivityViewController, presented from the app's own view controller - the ComposeUIViewController
// monReleveViewController builds, which UIKit forwards to the scene's presenting controller - or from whatever it
// already presents. No window lookup: the controller the app hosts is the one place a presentation starts from.
//
// The host probe (step (3)) proved on the simulator that an ad-hoc bundle presents this sheet in a window (iOS Ruling
// 4); the iosTests have no window, so they pass their own presenter and assert the path it was given and the file's
// bytes (IosShellExportIosTest). The sheet on the simulator, opened from the product's export, is IOS-WALK's.

/** The app's view controller, set once by monReleveViewController; null until then (and in the test process). */
internal var hostViewController: UIViewController? = null

/** Presents the share sheet for the file at [path] over whatever the app's view controller shows now. */
fun presentShareSheet(path: String) {
    val host = hostViewController ?: return
    var top: UIViewController = host
    while (true) {
        top = top.presentedViewController ?: break
    }
    val file = NSURL.fileURLWithPath(path)
    val sheet = UIActivityViewController(activityItems = listOf(file), applicationActivities = null)
    top.presentViewController(sheet, animated = true, completion = null)
}
