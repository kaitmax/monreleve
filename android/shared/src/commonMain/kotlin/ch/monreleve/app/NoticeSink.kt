package ch.monreleve.app

import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.releve.ExportEvent

// IOS-SHELL-2 (R1331, PARK-IF2). ONE SEAM FOR A SHORT MESSAGE THAT ASKS NOTHING BACK - what Android shows as a Toast.
//
// Android's shell showed five such messages, each with Toast.makeText (REPORT-IOS-HOST-CENSUS R1200 A): an export that
// failed, an export that needs connectivity, a legal page with no browser to open it (R299), no mail app (AN-ONBOARD),
// and the location permission revoked (R316). iOS has no Toast. So every site that iOS reaches goes through THIS seam,
// and each platform puts its own presentation behind it: Android its Toast, unchanged (MainActivity's toastNotices);
// iOS a transient in-app notice (iosMain ios/IosNotices.kt). No message is new: each site passes the same copy constant
// it passed to its Toast.
//
// The export hand-off (handleExportEvent) moved here with it, because it is where two of the five live: ONE mapping
// from an export event to what the person meets (R206), whichever platform shares the file.

/** A short message that asks nothing back: Android's Toast, iOS's transient notice. */
fun interface NoticeSink {
    fun show(message: String)
}

/**
 * AC2 / R136 (Android's handleExport, moved): a Ready export goes to the platform's share hand-off; a connectivity or
 * server failure is said, never silent (SPEC 13.2: the export requires connectivity and says so).
 */
fun handleExportEvent(
    event: ExportEvent,
    share: (ExportEvent.Ready) -> Unit,
    notices: NoticeSink,
) {
    when (event) {
        is ExportEvent.Ready -> share(event)
        ExportEvent.RequiresConnectivity -> notices.show(ReleveCopy.EXPORT_REQUIRES_CONNECTIVITY)
        ExportEvent.Failed -> notices.show(ReleveCopy.EXPORT_FAILED)
    }
}
