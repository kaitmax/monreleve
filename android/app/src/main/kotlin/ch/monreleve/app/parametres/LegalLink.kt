package ch.monreleve.app.parametres

import android.content.ActivityNotFoundException

// R299 (answers PARKAN-30). Opening a legal link never crashes. A device with no browser exists - a managed
// work profile, a kiosk setup, a disabled browser - and startActivity(ACTION_VIEW) throws
// ActivityNotFoundException there. This wraps the launch so that failure shows the link's address instead, so
// the person can open it another way rather than meeting a crash. JVM-testable: the launch and the address
// display are seams, so the fallback is proven without an Android runtime (LegalLinkTest).

/**
 * Attempt [open] for [url]; if no activity can handle it (ActivityNotFoundException), call [showAddress] with
 * the url so the person can copy it elsewhere. Any other failure propagates - this catches only the
 * no-handler case, never a real bug.
 *
 * SwallowedException is suppressed deliberately and is not a swallow: the exception IS the signal that no app
 * can open the link, and the handling is to show the address (R299). Nothing in it is worth preserving, and
 * logging it would leak the url to logcat for a case the person already sees on screen.
 */
@Suppress("SwallowedException")
fun openLegalLink(
    url: String,
    open: (String) -> Unit,
    showAddress: (String) -> Unit,
) {
    try {
        open(url)
    } catch (e: ActivityNotFoundException) {
        showAddress(url)
    }
}
