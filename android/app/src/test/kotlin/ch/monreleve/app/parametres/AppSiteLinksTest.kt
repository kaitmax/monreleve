package ch.monreleve.app.parametres

import ch.monreleve.app.auth.CallbackLink
import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN-LINKS increment 1 (R246). Every path the app links to on the website must EXIST as a page on the website,
// and the proof derives the website's routes from the web app's own filesystem (web/app/**/page.tsx) rather
// than from a second hand-kept list. The consequence is the point: rename or remove a web page and this build
// goes red, instead of a link breaking silently in someone's hand after it ships (R181 - the text is derived
// from the thing it describes, never transcribed beside it). web/app is a declared Gradle input of the test
// task (build.gradle.kts, R283), so a web page renamed in a later session re-runs this rather than leaving it
// UP-TO-DATE.
//
// Proven able to fire (R180): planting a wrong path on a LegalPage - /sources-xyz - and confirming it landed
// made this test RED on that path not existing as a web page; reverting restored green. Recorded in
// REPORT-AN-LINKS.txt.
class AppSiteLinksTest {
    private val webAppDir: File by lazy {
        val dir = File(repoRoot(), "web/app")
        check(dir.isDirectory) {
            "the web app directory was not found at ${dir.absolutePath} - the website's routes cannot be " +
                "derived, so the app's links cannot be verified against it (R246)"
        }
        dir
    }

    /**
     * Every static route the website serves, derived from the files named `page.tsx` under web/app. A route is
     * the file's directory relative to web/app with every Next.js route group - a segment wrapped in
     * parentheses, e.g. (public) - removed, because a group names no URL segment. The root page.tsx is "/".
     * Dynamic segments ([code], [slug]) are kept verbatim; the app links only to static pages, so they never
     * match and that is correct.
     */
    private fun websiteRoutes(): Set<String> =
        webAppDir.walkTopDown()
            .filter { it.isFile && it.name == "page.tsx" }
            .map { pageFile ->
                // e.g. "(public)/a-propos/page.tsx" -> drop the "page.tsx" leaf, drop route groups -> "/a-propos"
                val segments =
                    pageFile.relativeTo(webAppDir).invariantSeparatorsPath
                        .split('/')
                        .dropLast(1)
                        .filter { it.isNotEmpty() && !(it.startsWith("(") && it.endsWith(")")) }
                if (segments.isEmpty()) "/" else "/" + segments.joinToString("/")
            }
            .toSet()

    @Test
    fun everyPathTheAppLinksToExistsAsAWebsitePage() {
        val routes = websiteRoutes()

        // Not vacuous (R133/R154): a broken walk that found nothing would otherwise pass every subset check
        // below. The website has many pages and certainly these two, so an empty or tiny set is a parse bug,
        // not a shrunken site.
        assertTrue(
            "derived ${routes.size} website routes from ${webAppDir.absolutePath} - the page.tsx walk is " +
                "vacuous (expected the live site's many routes)",
            routes.size >= MIN_PLAUSIBLE_ROUTE_COUNT,
        )
        assertTrue(
            "the derived website routes do not include the known page /confidentialite - the route " +
                "derivation is broken: $routes",
            "/confidentialite" in routes,
        )

        val linkedPaths = LegalPage.entries.map { it.path }
        assertTrue("the app links to no website pages - LegalPage is empty", linkedPaths.isNotEmpty())

        linkedPaths.forEach { path ->
            assertTrue(
                "the app links to $path (a LegalPage), but no page exists at that path on the website. " +
                    "A page was renamed or removed on the web side, or the LegalPage path is wrong. " +
                    "Website routes: $routes",
                path in routes,
            )
        }
    }

    @Test
    fun theSiteOriginUsesTheOneFrozenDomain() {
        // R206: the public-pages origin and the App Link callback name ONE domain. Site.ORIGIN derives from
        // CallbackLink.HOST, so this asserts the derivation rather than comparing two independently typed
        // literals - the two cannot drift onto different domains.
        assertEquals("https://${CallbackLink.HOST}", Site.ORIGIN)
    }

    private companion object {
        // A floor, not a count: the walk is vacuous below this. The real site has well over a dozen routes;
        // this only needs to be large enough that an empty or broken walk fails rather than passing silently.
        const val MIN_PLAUSIBLE_ROUTE_COUNT = 5
    }
}
