package ch.monreleve.app.fr

import ch.monreleve.app.fences.FenceRoot
import ch.monreleve.app.fences.assertFound
import ch.monreleve.app.fences.ktFiles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-COPY-TRUTH-2 (R1230, Android Ruling 20 Q3). WHAT A6 PROVED, AND NOT MORE: the two modes give the same releve
 * with the same figures, and the only difference is the origin stated for each day (docs/release-audit-android.md
 * section 3: byte-identical once the provenance strings are masked). « exactement le même relevé » claimed the
 * provenance column too. A13 corrected the store listing (R1223); this holds the app's own two surfaces, each
 * written in its own register (R165), asserted as CONCEPTS rather than by quoting the copy (R181):
 *   - OnboardingCopy.MODE_INFO, the note under step 7's choice (OnboardingScreen renders it);
 *   - ParametresCopy.AUTO_DESCRIPTION, the « En savoir plus » sheet (ParametresInfoContent renders it), which also
 *     keeps « les deux se valent » - D19: manual is never the lesser option.
 * And a census over every fr/ copy file, so the claim cannot come back in a third place. Presence first (R154): the
 * roots are found and pinned, and the matcher is shown to fire on the old wording, even split across a `+`.
 */
private val FR_DIRS =
    listOf(
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/fr"), pin = "Fr.kt"),
        // IOS-MOVE-REMINDER R1291: NotificationCopy, the last copy file in :app, moved to :shared fr (read by the root
        // above), so :app's fr root is gone; CopyDuplicationTest.appHoldsNoFrCopy refuses one coming back.
    )

/** A literal continued on the next line (`"... " +` newline `"..."`) is one sentence to a reader: join it. */
private val CONTINUATION = Regex(""""\s*\+\s*"""")
private val STRING_LITERAL = Regex(""""((?:[^"\\]|\\.)*)"""")
private val OVERCLAIM = Regex("""(?i)exactement\s+l[ea]\s+même\s+(relevé|document)""")

private fun overclaimsIn(source: String): List<String> =
    STRING_LITERAL.findAll(source.replace(CONTINUATION, "")).flatMap { literal ->
        OVERCLAIM.findAll(literal.groupValues[1]).map { it.value }
    }.toList()

class ModeParityCopyTest {
    @Test
    fun theOnboardingNoteNamesTheOriginAsTheOneDifference() {
        val text = OnboardingCopy.MODE_INFO
        assertTrue("R1230: still the same releve: $text", text.contains("même relevé"))
        assertTrue("R1230: the same figures: $text", text.contains("mêmes chiffres"))
        assertTrue("R1230: the origin is what differs: $text", text.contains("origine"))
        assertFalse("R1230: « exactement » claims the provenance column too: $text", text.contains("exactement"))
        assertTrue("R1230: the note still says the mode can be changed: $text", text.contains("changer"))
        assertFalse("R126: no ASCII apostrophe in fr/ copy", text.contains("'"))
    }

    @Test
    fun theParametresSheetNamesTheOriginAndKeepsTheModesEqual() {
        val text = ParametresCopy.AUTO_DESCRIPTION
        assertTrue("R1230: still the same annual releve: $text", text.contains("même relevé annuel"))
        assertTrue("R1230: the same figures: $text", text.contains("mêmes chiffres"))
        assertTrue("R1230: the origin is what differs: $text", text.contains("origine"))
        assertTrue("D19: manual is never the lesser option: $text", text.contains("les deux se valent"))
        assertFalse("R1230: « exactement » claims the provenance column too: $text", text.contains("exactement"))
        assertFalse("R126: no ASCII apostrophe in fr/ copy", text.contains("'"))
    }

    @Test
    fun noFrCopySaysTheModesGiveExactlyTheSameReleve() {
        FR_DIRS.assertFound("mode-parity census")
        val files = FR_DIRS.ktFiles()
        assertTrue("expected the fr/ copy files to scan, found ${files.size}", files.size >= 20)
        val hits = files.flatMap { file -> overclaimsIn(file.readText()).map { "${file.name}: $it" } }
        assertEquals("R1230: a mode-parity claim stronger than A6's proof", emptyList<String>(), hits)
    }

    @Test
    fun theCensusFiresOnTheOldWordingEvenSplitAcrossLines() {
        // R133/R180: the scan above is green because the claim is absent, not because the matcher is blind.
        // The second sample is the shape ParametresCopy had: the claim cut between two literals by a `+`.
        val onOneLine = "const val X = \"Les deux produisent exactement le même relevé.\""
        val splitAcross =
            "const val Y =\n    \"La saisie manuelle produit exactement \" +\n        \"le même relevé annuel.\""
        val corrected = "const val Z = \"Les deux produisent le même relevé, avec les mêmes chiffres.\""
        assertEquals(1, overclaimsIn(onOneLine).size)
        assertEquals(1, overclaimsIn(splitAcross).size)
        assertEquals(0, overclaimsIn(corrected).size)
    }
}
