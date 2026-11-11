package ch.monreleve.app.parametres

// AN12 increment 4 / AN-LINKS. The pages the « À propos » section (and the sign-in consent line) open on the
// website. Each is a LIVE web route (AN-LINKS increment 0 fetched all five at 200 with their own heading and
// the site stylesheet loaded), verified not guessed (R156 forbids parking a slug), and AppSiteLinksTest
// re-derives the website's routes from web/app/**/page.tsx and fails the build if any path here stops
// existing as a page (R246) - so renaming a web page breaks this build, not a link in someone's hand. The
// path stays beside its page here (R206); Site, in :app, holds the one origin.
//
// IOS-2e R829: the enum moved to :shared commonMain (package unchanged) - the shared settings screen hands a LegalPage
// to its host. Site stayed in :app (parametres/Site.kt): its origin derives from :app's CallbackLink, which reads
// java.net, and opening the page is the host's (R831).
enum class LegalPage(val path: String) {
    PRIVACY("/confidentialite"),
    TERMS("/cgu"),
    LEGAL("/mentions-legales"),
    SOURCES("/sources"),
    ABOUT("/a-propos"),
}
