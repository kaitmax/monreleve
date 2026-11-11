package ch.monreleve.app.fr

import ch.monreleve.app.fences.FenceRoot
import ch.monreleve.app.fences.assertFound
import ch.monreleve.app.fences.ktFiles
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

// KMP-0 increment 5: fr copy moved to :shared's commonMain, except the two formatter-dependent files and
// fr/format (which stay in :app). DetectionCopy (the « bêta » this guard watches) is in :shared now, so the
// scan covers both fr locations.
// AN-FENCE-ROOTS (R460): each root asserted SEPARATELY and pinned by a file only it holds, in place of a
// `.filter { it.exists() }` that would have let a moved fr/ tree contribute nothing in silence.
private val FR_DIRS =
    listOf(
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/fr"), pin = "Fr.kt"),
        // IOS-2d R816/R819: ComparisonCopy moved to :shared fr (read by the root above); NotificationCopy is the one
        // copy file left in :app, so it pins this root now (R460).
        FenceRoot(File("src/main/kotlin/ch/monreleve/app/fr"), pin = "NotificationCopy.kt"),
    )

private val LINE_COMMENT = Regex("""//[^\n]*""")
private val BLOCK_COMMENT = Regex("""/\*[\s\S]*?\*/""")
private val STRING_LITERAL = Regex(""""((?:[^"\\]|\\.)*)"""")
private val WORD = Regex("""\p{L}{3,}""")

private fun stripAccents(word: String): String {
    val decomposed = Normalizer.normalize(word, Normalizer.Form.NFD)
    return decomposed.replace(Regex("""\p{M}+"""), "")
}

private fun frCopyStrings(): List<String> {
    FR_DIRS.assertFound("accent guard")
    return FR_DIRS
        .ktFiles()
        .flatMap { file ->
            val withoutComments = file.readText().replace(BLOCK_COMMENT, " ").replace(LINE_COMMENT, " ")
            STRING_LITERAL.findAll(withoutComments).map { it.groupValues[1] }.toList()
        }
}

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
