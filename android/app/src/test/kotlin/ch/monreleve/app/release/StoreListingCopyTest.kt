package ch.monreleve.app.release

import ch.monreleve.app.calc.repoRoot
import ch.monreleve.app.parametres.LegalPage
import ch.monreleve.app.parametres.Site
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-PLAY-PACK (R1123). THE STORE LISTING'S BINDING RULES, ENFORCED ON THE TEXT THAT WILL BE PASTED INTO PLAY.
 *
 * docs/play-store-listing.md holds the French texts between markers; this reads them from there (never a copy here -
 * a test that quotes the copy has the copy's defect, R181) and fails on what the prompt and the rulings forbid:
 *   - over Play's length limits (title 30, short 80, full 4 000; Play Console Help answer/9859152, read 2026-11-20);
 *   - « certifié », « atteste », « conforme » in any form ("never claim more than the record supports");
 *   - a typed threshold value - a digit followed by % (R153: the texts NAME the seuils);
 *   - a typewriter apostrophe (R126);
 *   - a privacy URL other than the page the app's Paramètres opens: Site.url(LegalPage.PRIVACY) (R181);
 *   - a detection paragraph that does not state precise location, the « Toujours autoriser » grant, the background
 *     use and the beta (Android Ruling 8: NOTHING may imply detection works with approximate location or without
 *     the background grant - so the requirement is asserted PRESENT, not merely the opposite absent);
 *   - location or detection named OUTSIDE that paragraph, so the manual-only listing (R1124) is the same text with
 *     the paragraph removed, and says nothing about a feature that build does not have.
 */
class StoreListingCopyTest {
    private val listing = File(repoRoot(), "docs/play-store-listing.md")

    private fun section(name: String): String {
        val text = listing.readText()
        val match = Regex("""(?s)<!-- listing:$name -->\n(.*?)\n<!-- /listing:$name -->""").findAll(text).toList()
        assertEquals("exactly one listing:$name section in $listing", 1, match.size)
        return match.single().groupValues[1].trim()
    }

    private val title by lazy { section("title") }
    private val short by lazy { section("short") }
    private val full by lazy { section("full") }
    private val detection by lazy { section("detection") }
    private val privacy by lazy { section("privacy") }

    /** Every text a reader sees, the full description with its detection paragraph markers stripped. */
    private val everything by lazy {
        listOf(title, short, full.replace(Regex("""<!-- /?listing:detection -->"""), ""), privacy)
    }

    private fun length(text: String) = text.codePointCount(0, text.length)

    @Test
    fun eachTextFitsPlaysLimit() {
        assertTrue("title is ${length(title)} characters", length(title) in 1..30)
        assertTrue("short description is ${length(short)} characters", length(short) in 1..80)
        assertTrue("full description is ${length(full)} characters", length(full) in 1..4000)
    }

    @Test
    fun noTextClaimsMoreThanTheRecordSupports() {
        val forbidden = Regex("""(?i)certifi|attest|conform""")
        everything.forEach { text ->
            assertEquals(
                "forbidden word in: $text",
                emptyList<String>(),
                forbidden.findAll(text).map { it.value }.toList(),
            )
        }
    }

    @Test
    fun noThresholdIsTypedAsAValue() {
        everything.forEach { text ->
            assertEquals("typed percentage in: $text", null, Regex("""\d\s*%""").find(text)?.value)
        }
        // R133: the seuils are NAMED, so the rule above is about something the text actually discusses.
        assertTrue(full.contains("seuil fiscal") && full.contains("seuil de sécurité sociale"))
    }

    @Test
    fun apostrophesAreTypographic() {
        everything.forEach { text -> assertTrue("a typewriter apostrophe in: $text", '\'' !in text) }
    }

    @Test
    fun thePrivacyUrlIsThePageTheAppOpens() {
        val expected = Site.url(LegalPage.PRIVACY)
        assertEquals(expected, privacy)
        assertTrue("the full description must link the same privacy page", full.contains(expected))
    }

    @Test
    fun theDetectionParagraphStatesWhatItNeedsAndThatItIsABeta() {
        listOf("position exacte", "« Toujours autoriser »", "arrière-plan", "approximative", "bêta", "confirmation")
            .forEach {
                    phrase ->
                assertTrue("the detection paragraph must say « $phrase »", detection.contains(phrase))
            }
    }

    @Test
    fun nothingOutsideTheDetectionParagraphNamesLocationOrDetection() {
        val outside =
            listOf(
                title,
                short,
                full.replace(Regex("""(?s)<!-- listing:detection -->.*?<!-- /listing:detection -->"""), ""),
            )
        // R133: the paragraph exists and does say these words, so their absence outside it means something.
        assertTrue(detection.contains("localisation") && detection.contains("position"))
        val named = Regex("""(?i)localisation|position|détect|arrière-plan|gps""")
        outside.forEach { text ->
            assertEquals(
                "named outside the detection paragraph: $text",
                emptyList<String>(),
                named.findAll(text).map {
                    it.value
                }.toList(),
            )
        }
    }
}
