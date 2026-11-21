package ch.monreleve.app.fr

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN-NEXT-2 / R325. The disclosure says what is true about NETWORK location. A POSITIVE test (R154): a known
 * input produces the known rendered claim - the Wi-Fi/cell determination clause and the "stores nothing, sends
 * nothing" reassurance both present - so the reword is proven to deliver, not merely proven absent of a forbidden
 * form. The screen renders DisclosureCopy.NETWORK_LOCATION (CopyReachabilityTest proves the surface reaches it),
 * and the on-device screenshot (REPORT) is its visual proof.
 */
class DisclosureCopyTest {
    @Test
    fun theNetworkDisclosureNamesWifiAndCellAndThePhonesSettings() {
        val text = DisclosureCopy.NETWORK_LOCATION
        assertTrue("R325: it names Wi-Fi", text.contains("Wi-Fi"))
        assertTrue("R325: it names the cell networks", text.contains("cellulaires"))
        assertTrue("R325: Android is what may use them", text.contains("Android peut utiliser"))
        assertTrue("R325: it defers to the phone's location settings", text.contains("réglages de localisation"))
    }

    @Test
    fun theNetworkDisclosureStillPromisesTheAppStoresAndSendsNothing() {
        val text = DisclosureCopy.NETWORK_LOCATION
        assertTrue("R325: the app keeps nothing and sends nothing", text.contains("ne conserve ni"))
        assertTrue("R325: it is about the position", text.contains("position"))
    }

    /**
     * AN-COPY-TRUTH R1220 (A6 F5a). « Rien n’est transmis » was false the day a confirmed day was sent: the Data
     * safety form declares Approximate location COLLECTED (Android Ruling 18 Q-DS1). The sentence now says what
     * leaves the phone and what never does. Presence first (R154): the validated day IS sent, with what detection
     * had proposed (EntriesMapping.toEntryWrite carries detectedKind, the CH/HOME side, on a corrected day too); the
     * position is NEVER sent, to anybody. Then the absence of the false opening.
     */
    @Test
    fun theSharingSentenceSaysTheValidatedDayIsSentAndThePositionNever() {
        val text = DisclosureCopy.NEVER_SHARED
        assertTrue("R1220: the validated day is sent", text.contains("la journée que vous validez nous est envoyée"))
        assertTrue("R1220: with what detection proposed", text.contains("ce que la détection vous avait proposé"))
        assertTrue("R1220: the position is never sent", text.contains("Votre position n’est jamais transmise"))
        assertTrue("the employer is still named", text.contains("employeur"))
        assertTrue("the administration is still named", text.contains("administration"))
        assertFalse("R1220: « Rien n’est transmis » is false: a confirmed day is sent", text.contains("Rien n"))
        assertFalse("R126: no ASCII apostrophe in fr/ copy", text.contains("'"))
    }

    @Test
    fun theNetworkDisclosureIsTypographicAndNonTrivial() {
        val text = DisclosureCopy.NETWORK_LOCATION
        // R126: typographic apostrophes only (U+2019), never the ASCII apostrophe.
        assertFalse("R126: no ASCII apostrophe in fr/ copy", text.contains("'"))
        assertTrue("the disclosure is a real sentence, not a stub", text.length > 80)
    }
}
