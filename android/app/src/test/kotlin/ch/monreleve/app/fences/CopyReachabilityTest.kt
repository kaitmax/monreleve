package ch.monreleve.app.fences

// AN3 increment 0 (R269, from AN2's close-out review). R238's own shape:
// every exported copy string under fr/ is reachable from ui/ or design/,
// or declared unreachable with a stated reason.
//
// WHY THIS EXISTS, matching the web-side finding this ports rather than
// merely citing it: web/lib/fr/dossier.ts held four strings no surface
// reached, one of them the product's headline answer - each individually
// well-formed French, passing every typography guard, found only by
// somebody reading the module against the page it was meant for. This
// generalises that reading into a failing test rather than a discovery
// tasks later, on the Android side before it has the chance to accumulate
// the same way.
//
// design/ ADDED IN AN3 INCREMENT 3, FOUND NECESSARY RATHER THAN ASSUMED:
// this fence's own first run after ThresholdRail.kt (design/rail/) started
// reading Fr.APP_NAME reported it as an orphan, because increment 0 scoped
// the rendered-text scan to ui/ alone - the only surface that existed
// then. Components live in design/, not ui/ (ui/ holds screens that
// compose them), so the census was blind to the one place AN3 actually
// writes.

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

private val FR_DIR = File("src/main/kotlin/ch/monreleve/app/fr")
private val SURFACE_DIRS =
    listOf(
        File("src/main/kotlin/ch/monreleve/app/ui"),
        File("src/main/kotlin/ch/monreleve/app/design"),
    )

private fun ktFiles(dir: File): List<File> =
    if (!dir.exists()) emptyList() else dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

/**
 * Comments are stripped before matching - found necessary on this exact
 * file, not assumed: an earlier draft's own KDoc explaining "wrapped in an
 * object rather than left as top-level consts" contained the literal
 * substring "object rather", which OBJECT_NAME matched before ever
 * reaching the real `object RailCopy {` declaration below it, and every
 * reference this file generated was reported under the wrong name. The
 * other fences in this package (FencesTest.kt) already strip comments for
 * the identical reason; this one had not, because it predates the KDoc
 * that broke it.
 */
private fun stripComments(text: String): String {
    return text.replace(Regex("""/\*[\s\S]*?\*/"""), " ").replace(Regex("""//[^\n]*"""), " ")
}

/** The enclosing `object Name` a const belongs to - this codebase's convention is one per file. */
private val OBJECT_NAME = Regex("""object\s+(\w+)""")
private val CONST_NAME = Regex("""const\s+val\s+(\w+)\s*=""")

/** Every `Object.CONST` reference a copy constant would be read through. */
private fun copyReferences(): List<String> =
    ktFiles(FR_DIR).flatMap { file ->
        val text = stripComments(file.readText())
        val objectName = OBJECT_NAME.find(text)?.groupValues?.get(1) ?: return@flatMap emptyList()
        CONST_NAME.findAll(text).map { "$objectName.${it.groupValues[1]}" }.toList()
    }

private fun renderedText(): String = SURFACE_DIRS.flatMap { ktFiles(it) }.joinToString("\n") { it.readText() }

/**
 * Strings that no surface reaches TODAY, each naming the state it waits
 * for. An entry without a stated reason is refused by the test below - the
 * same corollary R206 states for NOT_PERSONAL: an exemption argues for
 * itself, or it is not one. "Unused for now" is exactly the note the web
 * side's four orphans would have carried.
 */
private val UNREACHABLE: Map<String, String> = emptyMap()

class CopyReachabilityTest {
    @Test
    fun findsCopyToCheckSoTheCensusIsNotVacuous() {
        val refs = copyReferences()
        val rendered = renderedText()
        assertTrue("expected at least one copy constant under fr/, found none", refs.isNotEmpty())
        assertTrue(
            "expected a surface to carry meaningful content, found ${rendered.length} chars",
            rendered.length > 100,
        )
    }

    @Test
    fun reachesEveryStringOrDeclaresItUnreachableWithItsReason() {
        val rendered = renderedText()
        val orphans = copyReferences().filter { ref -> ref !in rendered && UNREACHABLE[ref] == null }

        assertTrue("no surface (ui/ or design/) references: ${orphans.joinToString(", ")}", orphans.isEmpty())
    }

    @Test
    fun refusesAnAllowListEntryThatDoesNotNameTheStateItWaitsFor() {
        for ((ref, reason) in UNREACHABLE) {
            assertTrue("$ref has no stated reason", reason.length > 40)
            assertTrue("$ref is not a real copy constant", ref in copyReferences())
        }
    }

    @Test
    fun canTellAnOrphanFromASurfaceThatFailedToLoad() {
        // R133's positive half: an empty rendered text and a fully-reachable
        // copy set both produce zero orphans. This proves the two are
        // distinguishable rather than trusting silence as success.
        val rendered = renderedText()
        assertTrue("expected Fr.GREETING to be referenced somewhere in ui/", rendered.contains("Fr.GREETING"))
        assertTrue(
            "expected a made-up reference to be absent",
            !rendered.contains("Fr.THIS_IS_NOT_A_REAL_CONSTANT"),
        )
    }
}
