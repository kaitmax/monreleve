package ch.monreleve.app.fences

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// AN-ANSWER-ICON increment 2 (R430, R293, R167). The answer line's five kind glyphs ship as committed vector
// drawables, exactly as AN10b's eight do - no runtime dependency (R136), paths taken from Lucide's published
// SVGs at a NAMED version.
//
// WHY A TEST AND NOT A COMMENT. R167: a citation names the instrument, not its current file. A drawable whose
// header says Lucide "house" (lucide-static v1.48.0) is a claim about where its geometry came from, and the
// licences screen's source of truth (docs/lucide-icons.md) repeats it. Nothing connected the two, so either
// could be edited without the other noticing - R206's shape on an attribution rather than on copy.
//
// IT ALSO FENCES THE CONVERSION. Every one of the 23 drawables already in res/drawable is a 24-unit viewport
// with strokeWidth 2 and round cap/join - Lucide's own published geometry. These five are asserted to match,
// so the set cannot silently acquire a sixth convention. (DESIGN-SYSTEM section 1 says "1.75 px stroke"; the
// shipped set has always carried Lucide's 2 at a 24 viewport, which renders 1.67 dp at the 20 dp `icon` size.
// Making these five differ from the other 23 would be worse than the discrepancy - PARKED, see the report.)
//
// POSITIVE CONTROL (R133/R63): a test asserts the walk found the real res/drawable directory and an icon this
// file does not own. A scanner pointed at nothing reports perfect compliance.

/** file name (without .xml) to the Lucide icon it is converted from. */
private val ANSWER_ICONS =
    mapOf(
        "ic_building_2" to "building-2",
        "ic_house" to "house",
        "ic_briefcase" to "briefcase",
        "ic_plane" to "plane",
        "ic_calendar_x" to "calendar-x",
    )

private const val LUCIDE_VERSION = "lucide-static v1.48.0"

private val drawableDir = File("src/main/res/drawable")
private val licencesDoc = File("../../docs/lucide-icons.md")

class AnswerIconDrawablesTest {
    @Test
    fun theDrawableDirectoryIsTheRealOneAndHoldsAnIconThisTestDoesNotOwn() {
        assertTrue(
            "res/drawable not found at ${drawableDir.absolutePath} - renamed? (vacuity guard)",
            drawableDir.isDirectory,
        )
        assertTrue(
            "the positive control icon ic_circle_check.xml is missing - this test is scanning the wrong tree",
            File(drawableDir, "ic_circle_check.xml").isFile,
        )
    }

    @Test
    fun everyAnswerIconIsCommittedAndNamesItsLucideGlyphAndVersion() {
        val offenders = mutableListOf<String>()
        for ((file, lucide) in ANSWER_ICONS) {
            val xml = File(drawableDir, "$file.xml")
            if (!xml.isFile) {
                offenders += "$file.xml is missing from res/drawable"
                continue
            }
            val text = xml.readText()
            if (!text.contains("Lucide \"$lucide\"")) {
                offenders += "$file.xml does not name the Lucide glyph it was converted from ($lucide)"
            }
            if (!text.contains(LUCIDE_VERSION)) {
                offenders += "$file.xml does not name the Lucide version ($LUCIDE_VERSION)"
            }
        }
        assertTrue(offenders.joinToString("\n"), offenders.isEmpty())
    }

    @Test
    fun everyAnswerIconKeepsTheConversionTheOtherDrawablesUse() {
        val offenders = mutableListOf<String>()
        for (file in ANSWER_ICONS.keys) {
            val xml = File(drawableDir, "$file.xml")
            if (!xml.isFile) {
                offenders += "$file.xml is missing from res/drawable"
                continue
            }
            val text = xml.readText()
            if (!text.contains("android:viewportWidth=\"24\"") || !text.contains("android:viewportHeight=\"24\"")) {
                offenders += "$file.xml is not a 24-unit viewport like the rest of the set"
            }
            if (!text.contains("android:strokeWidth=\"2\"")) {
                offenders += "$file.xml does not carry Lucide's stroke width (2) like the rest of the set"
            }
            val roundCap = text.contains("android:strokeLineCap=\"round\"")
            val roundJoin = text.contains("android:strokeLineJoin=\"round\"")
            if (!roundCap || !roundJoin) {
                offenders += "$file.xml does not carry Lucide's round cap/join like the rest of the set"
            }
        }
        assertTrue(offenders.joinToString("\n"), offenders.isEmpty())
    }

    @Test
    fun everyAnswerIconIsAttributedInTheLicencesSourceOfTruth() {
        assertTrue("docs/lucide-icons.md not found at ${licencesDoc.absolutePath}", licencesDoc.isFile)
        val doc = licencesDoc.readText()
        val offenders = mutableListOf<String>()
        for ((file, lucide) in ANSWER_ICONS) {
            if (!doc.contains("`$file.xml`")) offenders += "$file.xml is not listed in docs/lucide-icons.md"
            if (!doc.contains("`$lucide`")) offenders += "the Lucide name $lucide is not listed in docs/lucide-icons.md"
        }
        assertTrue(offenders.joinToString("\n"), offenders.isEmpty())
    }
}
