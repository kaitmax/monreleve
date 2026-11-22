package ch.monreleve.app.parametres

import ch.monreleve.app.auth.CallbackLinkHost

// IOS-2e R829: split out UNCHANGED from LegalPage.kt when the LegalPage enum moved to :shared commonMain. The origin
// derived from CallbackLink.HOST, which lived in :app's auth/ (java.net), so the one origin stayed there with its host.
// IOS-MOVE-CORE R1300: the host was split from the java.net parser into commonMain (CallbackLinkHost; CallbackLink.HOST
// is that constant), so Site moved to commonMain beside LegalPage.

// AN-LINKS increment 1 (R206). ONE home for the website's origin. Now that monreleve.ch is live, every
// app -> site link is built from this one constant with the LegalPage's own path, rather than each call site
// assembling a URL. The DOMAIN is not retyped: it derives from CallbackLinkHost.HOST, the frozen App Link host
// (R195), so the auth callback and the public pages can never drift onto two different domains. The scheme is
// https - increment 0 confirmed http redirects to https and the certificate is valid.
//
// BOTH BUILD TYPES USE IT. These are public, read-only pages that hold no personal data, so there is no reason
// for the debug build to point them at the emulator host. The API's base address (BuildConfig.API_BASE_URL)
// is a SEPARATE setting - the emulator host in debug, the domain in release - and is deliberately untouched
// here: an app -> site page link and an app -> API call are different addresses that only happen to share a
// domain in release.
object Site {
    const val ORIGIN = "https://${CallbackLinkHost.HOST}"

    /** The full URL of a website page: the one origin, plus the page's own path (R206). */
    fun url(page: LegalPage): String = ORIGIN + page.path
}
