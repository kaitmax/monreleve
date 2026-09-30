package ch.monreleve.app.parametres

import android.content.ActivityNotFoundException
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

// R299. The legal-link launch never crashes: with no handler it shows the address; with a handler it opens and
// shows nothing. Proven over seams so no Android runtime is needed.

class LegalLinkTest : FunSpec({
    test("R299: no handler -> the address is shown, no crash") {
        var shown: String? = null
        openLegalLink(
            url = "https://monreleve.ch/confidentialite",
            open = { throw ActivityNotFoundException("no browser on this device") },
            showAddress = { shown = it },
        )
        shown shouldBe "https://monreleve.ch/confidentialite"
    }

    test("R299: a handler present -> the link opens and no address fallback fires") {
        var opened: String? = null
        var shown: String? = null
        openLegalLink(
            url = "https://monreleve.ch/mentions-legales",
            open = { opened = it },
            showAddress = { shown = it },
        )
        opened shouldBe "https://monreleve.ch/mentions-legales"
        shown.shouldBeNull()
    }
})
