package ch.monreleve.app.parametres

import ch.monreleve.app.auth.CallbackLink

// AN12 increment 4 / AN-LINKS. The pages the « À propos » section (and the sign-in consent line) open on the
// website. Each is a LIVE web route (AN-LINKS increment 0 fetched all five at 200 with their own heading and
// the site stylesheet loaded), verified not guessed (R156 forbids parking a slug), and AppSiteLinksTest
// re-derives the website's routes from web/app/**/page.tsx and fails the build if any path here stops
// existing as a page (R246) - so renaming a web page breaks this build, not a link in someone's hand. The
// path stays beside its page here (R206); Site, below, holds the one origin.
enum class LegalPage(val path: String) {
    PRIVACY("/confidentialite"),
    TERMS("/cgu"),
    LEGAL("/mentions-legales"),
    SOURCES("/sources"),
    ABOUT("/a-propos"),
}

// AN-LINKS increment 1 (R206). ONE home for the website's origin. Now that monreleve.ch is live, every
// app -> site link is built from this one constant with the LegalPage's own path, rather than each call site
// assembling a URL. The DOMAIN is not retyped: it derives from CallbackLink.HOST, the frozen App Link host
// (R195), so the auth callback and the public pages can never drift onto two different domains. The scheme is
// https - increment 0 confirmed http redirects to https and the certificate is valid.
//
// BOTH BUILD TYPES USE IT. These are public, read-only pages that hold no personal data, so there is no reason
// for the debug build to point them at the emulator host. The API's base address (BuildConfig.API_BASE_URL)
// is a SEPARATE setting - the emulator host in debug, the domain in release - and is deliberately untouched
// here: an app -> site page link and an app -> API call are different addresses that only happen to share a
// domain in release.
object Site {
    const val ORIGIN = "https://${CallbackLink.HOST}"

    /** The full URL of a website page: the one origin, plus the page's own path (R206). */
    fun url(page: LegalPage): String = ORIGIN + page.path
}
