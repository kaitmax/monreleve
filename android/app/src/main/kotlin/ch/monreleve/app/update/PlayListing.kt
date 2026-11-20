package ch.monreleve.app.update

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.fr.ParametresCopy

// AN-FORCE-UPDATE (R1111). The Android half of the update screen: where its one button goes, and the process's gate.
//
// THE PLAY LISTING OF ch.monreleve.app. market:// first - it opens the Play Store app straight on the listing - and
// the https listing as the fallback for a device with no Play Store (a de-Googled phone, some emulators), which a
// browser can open. A device with neither shows the address instead of crashing (R299's rule, LegalLink.kt). The
// package is the listing's, written once here: the debug and release builds share the applicationId
// (app/build.gradle.kts), so BuildConfig's would be the same string, but the listing is a fact about the store, not
// about the build that happens to be running.
//
// Only ActivityNotFoundException is caught, as openLegalLink does: it IS the signal that nothing can open the link.
// resolveActivity() is not used - on API 30+ it answers null without a manifest <queries> entry.

/** The Play listing, as the app and as the web page. */
object PlayListing {
    const val PACKAGE = "ch.monreleve.app"
    const val MARKET_URL = "market://details?id=$PACKAGE"
    const val WEB_URL = "https://play.google.com/store/apps/details?id=$PACKAGE"
}

/**
 * Opens the Play listing through [open]: [PlayListing.MARKET_URL], then [PlayListing.WEB_URL] if nothing handles it,
 * then [showAddress] with the web address if nothing handles that either. Any other failure propagates.
 */
@Suppress("SwallowedException")
fun openPlayListing(
    open: (String) -> Unit,
    showAddress: (String) -> Unit,
) {
    try {
        open(PlayListing.MARKET_URL)
    } catch (e: ActivityNotFoundException) {
        try {
            open(PlayListing.WEB_URL)
        } catch (e: ActivityNotFoundException) {
            showAddress(PlayListing.WEB_URL)
        }
    }
}

/**
 * The update screen's button, from an Activity [context]: an ACTION_VIEW on the listing, falling back as
 * [openPlayListing] says. With no handler at all the address is shown in a toast, in the words the legal links already
 * use for the same situation - "no app can open this link; here is its address" (ParametresCopy.legalNoHandler, R206).
 */
fun openPlayListingFrom(context: Context) {
    openPlayListing(
        open = { url -> context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) },
        showAddress = { url -> Toast.makeText(context, ParametresCopy.legalNoHandler(url), Toast.LENGTH_LONG).show() },
    )
}

/**
 * THE PROCESS'S UpdateGate (update/MinimumVersion.kt in :shared). One per process, so a rotation or a second
 * activity reads the same answer rather than flashing the app while it asks again. It starts OPEN: nothing waits on
 * it. Built on first use; it reads the build's own versionCode and API base, and asks with a plain transport - never
 * through the session, so a 401 from anything on that port is just a status, never a refresh or a sign-out.
 */
internal val processUpdateGate: UpdateGate by lazy {
    val client = MinimumVersionClient(UrlConnectionTransport(), BuildConfig.API_BASE_URL)
    UpdateGate(appVersionCode = BuildConfig.VERSION_CODE) { client.fetch() }
}
