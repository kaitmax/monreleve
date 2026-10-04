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

    @Test
    fun theNetworkDisclosureIsTypographicAndNonTrivial() {
        val text = DisclosureCopy.NETWORK_LOCATION
        // R126: typographic apostrophes only (U+2019), never the ASCII apostrophe.
        assertFalse("R126: no ASCII apostrophe in fr/ copy", text.contains("'"))
        assertTrue("the disclosure is a real sentence, not a stub", text.length > 80)
    }
}
