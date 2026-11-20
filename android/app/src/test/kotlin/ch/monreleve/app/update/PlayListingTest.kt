package ch.monreleve.app.update

import android.content.ActivityNotFoundException
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

// AN-FORCE-UPDATE (R1111). The update button opens the Play listing of ch.monreleve.app: market:// first, the https
// listing when nothing handles market://, and the address shown when nothing handles either - never a crash (R299's
// rule). Proven over seams, as LegalLinkTest proves openLegalLink, so no Android runtime is needed.

class PlayListingTest : FunSpec({
    test("the listing is ch.monreleve.app's, as the app and as the web page") {
        PlayListing.MARKET_URL shouldBe "market://details?id=ch.monreleve.app"
        PlayListing.WEB_URL shouldBe "https://play.google.com/store/apps/details?id=ch.monreleve.app"
    }

    test("a Play Store present: market:// opens and nothing else fires") {
        val opened = mutableListOf<String>()
        var shown: String? = null
        openPlayListing(open = { opened += it }, showAddress = { shown = it })
        opened shouldBe listOf(PlayListing.MARKET_URL)
        shown.shouldBeNull()
    }

    test("no Play Store: the https listing opens instead") {
        val tried = mutableListOf<String>()
        var shown: String? = null
        openPlayListing(
            open = { url ->
                tried += url
                if (url == PlayListing.MARKET_URL) throw ActivityNotFoundException("no Play Store")
            },
            showAddress = { shown = it },
        )
        tried shouldBe listOf(PlayListing.MARKET_URL, PlayListing.WEB_URL)
        shown.shouldBeNull()
    }

    test("nothing can open either: the web address is shown, no crash") {
        var shown: String? = null
        openPlayListing(open = { throw ActivityNotFoundException("nothing at all") }, showAddress = { shown = it })
        shown shouldBe PlayListing.WEB_URL
    }
})
