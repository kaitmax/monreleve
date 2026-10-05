package ch.monreleve.app.fr

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.text.Normalizer

// AN-PARAMS (R155 ported to the Android copy). R155's forbidden-forms list lives on the web side
// (web/tests/unit/fr/accents.test.ts) and scans web/lib/fr + content/guides ONLY - it is structurally blind to
// this product's Android copy under ch/monreleve/app/fr. The relay asks that the unaccented « beta » cannot
// return once the title is corrected to « bêta »; the enforcement point for Android copy is here, where the
// copy lives (R269's spirit: a scan earns its keep on the code it guards). It scans the WHOLE fr/ directory,
// not one file - « Détection automatique (bêta) » has one home (DetectionCopy.MODE_AUTO) that ParametresCopy
// now references, so the literal lives there, and a future « beta » anywhere in the copy would be caught.
//
// CURATED, NOT DERIVED (R155's whole design): a single deliberate entry, « beta », a form no correct French
// word spells that way (French writes « bêta », with the circumflex). An accented word is correct by
// construction and cannot be a hit, so « bêta » is never flagged - only the stripped-ASCII « beta ». String
// literal VALUES are scanned, never comments or identifiers, matching ParametresR282Test's renderedCopy idiom.

private val FORBIDDEN = listOf("beta")

private val FR_DIR = File("src/main/kotlin/ch/monreleve/app/fr")

private val LINE_COMMENT = Regex("""//[^\n]*""")
private val BLOCK_COMMENT = Regex("""/\*[\s\S]*?\*/""")
private val STRING_LITERAL = Regex(""""((?:[^"\\]|\\.)*)"""")
private val WORD = Regex("""\p{L}{3,}""")

private fun stripAccents(word: String): String {
    val decomposed = Normalizer.normalize(word, Normalizer.Form.NFD)
    return decomposed.replace(Regex("""\p{M}+"""), "")
}

private fun frCopyStrings(): List<String> =
    FR_DIR.walkTopDown().filter { it.isFile && it.extension == "kt" }.flatMap { file ->
        val withoutComments = file.readText().replace(BLOCK_COMMENT, " ").replace(LINE_COMMENT, " ")
        STRING_LITERAL.findAll(withoutComments).map { it.groupValues[1] }
    }.toList()

/** Every forbidden unaccented form found in a piece of rendered copy. */
private fun formsIn(text: String): List<String> =
    WORD.findAll(text)
        .map { it.value.lowercase() }
        // An accented word is correct by construction - only a purely-ASCII spelling can be a hit.
        .filter { it == stripAccents(it) }
        .filter { it in FORBIDDEN }
        .toList()

class ParametresCopyAccentTest {
    @Test
    fun theCopyWritesBetaWithItsAccent() {
        val copy = frCopyStrings()
        assertTrue("expected fr/ copy strings to scan, found none", copy.isNotEmpty())

        val hits = copy.flatMap(::formsIn)
        assertTrue(
            "R155: French writes « bêta », never « beta » - found unaccented forms: $hits",
            hits.isEmpty(),
        )
    }

    @Test
    fun theScanFiresOnAnUnaccentedBeta() {
        // R133/R154: prove the matcher catches a planted « beta » so a green run above means absence,
        // not a broken scan.
        assertTrue(
            "the matcher must fire on an unaccented « beta »",
            formsIn("Fonction en beta").contains("beta"),
        )
    }

    @Test
    fun theScanLeavesTheAccentedFormAlone() {
        // The positive other direction: « bêta » (the correct spelling) is never a hit.
        assertFalse(
            "the correctly accented « bêta » must not be flagged",
            formsIn("Fonction en bêta").contains("beta"),
        )
    }
}
