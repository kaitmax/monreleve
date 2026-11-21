package ch.monreleve.app.release

import ch.monreleve.app.calc.repoRoot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * AN-COPY-TRUTH-2 (R1230, Android Ruling 20 Q3). THE BACKGROUND-LOCATION DECLARATION SAYS NO MORE THAN A6 PROVED.
 *
 * docs/play-release.md section 3 holds the English texts the operator pastes into Play's form (the quoted `> `
 * blocks). Its manual-mode sentence said manual entry "produces the same statement" - true of every figure, silent
 * on the one thing A6 found different: the origin printed for each day (docs/release-audit-android.md section 3,
 * byte-identical once the provenance strings are masked). Read from the document (R181: never a copy here), and
 * asserted as concepts: the statement is still the same one, the figures are the same, the origin is named as
 * the difference, and no "exactly" / "identical" overstates it. The document is a declared input of this task in
 * app/build.gradle.kts (R283), as docs/play-store-listing.md is for StoreListingCopyTest.
 */
class PlayDeclarationCopyTest {
    private val doc = File(repoRoot(), "docs/play-release.md")

    /** Section 3's quoted declaration texts, joined: what is pasted into the form. */
    private val declaration by lazy {
        val section =
            Regex("""(?s)\n## 3\. The background-location declaration.*?\n## 4\. """).findAll(doc.readText()).toList()
        assertEquals("exactly one section 3 in $doc", 1, section.size)
        val quoted =
            section.single().value.lines()
                .filter { it.startsWith("> ") }
                .joinToString(" ") { it.removePrefix("> ").trim() }
        // R133: the blocks exist and are the declaration (it names the feature), so what follows means something.
        assertTrue("section 3 quotes the declaration: $quoted", quoted.contains("background"))
        quoted
    }

    @Test
    fun theManualModeSentenceNamesTheOriginAsTheOneDifference() {
        val sentences = declaration.split(Regex("""(?<=\.)\s+""")).filter { it.contains("manually") }
        assertEquals("exactly one manual-mode sentence in the declaration: $sentences", 1, sentences.size)
        val manual = sentences.single()
        assertTrue("R1230: still the same statement: $manual", manual.contains("same statement"))
        assertTrue("R1230: the same figures: $manual", manual.contains("same figures"))
        assertTrue("R1230: the origin is what differs: $manual", manual.contains("origin"))
    }

    @Test
    fun noDeclarationTextSaysExactlyOrIdentical() {
        val overclaim = Regex("""(?i)\bexactly\b|\bidentical""").findAll(declaration).map { it.value }.toList()
        assertEquals("R1230: stronger than A6's proof", emptyList<String>(), overclaim)
    }
}
