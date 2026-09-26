package ch.monreleve.app.fences

// AN3 increment 0 (R269, from AN2's close-out review). R238's own shape:
// every exported copy string under fr/ is reachable from ui/, or declared
// unreachable with a stated reason.
//
// WHY THIS EXISTS, matching the web-side finding this ports rather than
// merely citing it: web/lib/fr/dossier.ts held four strings no surface
// reached, one of them the product's headline answer - each individually
// well-formed French, passing every typography guard, found only by
// somebody reading the module against the page it was meant for. This
// generalises that reading into a failing test rather than a discovery
// tasks later, on the Android side before it has the chance to accumulate
// the same way.

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

private val FR_DIR = File("src/main/kotlin/ch/monreleve/app/fr")
private val UI_DIR = File("src/main/kotlin/ch/monreleve/app/ui")

private fun ktFiles(dir: File): List<File> =
    if (!dir.exists()) emptyList() else dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

/** The enclosing `object Name` a const belongs to - this codebase's convention is one per file. */
private val OBJECT_NAME = Regex("""object\s+(\w+)""")
private val CONST_NAME = Regex("""const\s+val\s+(\w+)\s*=""")

/** Every `Object.CONST` reference a copy constant would be read through. */
private fun copyReferences(): List<String> =
    ktFiles(FR_DIR).flatMap { file ->
        val objectName = OBJECT_NAME.find(file.readText())?.groupValues?.get(1) ?: return@flatMap emptyList()
        CONST_NAME.findAll(file.readText()).map { "$objectName.${it.groupValues[1]}" }.toList()
    }

private fun renderedText(): String = ktFiles(UI_DIR).joinToString("\n") { it.readText() }

/**
 * Strings that no ui/ file reaches TODAY, each naming the state it waits
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
        assertTrue("expected ui/ to carry meaningful content, found ${rendered.length} chars", rendered.length > 100)
    }

    @Test
    fun reachesEveryStringOrDeclaresItUnreachableWithItsReason() {
        val rendered = renderedText()
        val orphans = copyReferences().filter { ref -> ref !in rendered && UNREACHABLE[ref] == null }

        assertTrue("no ui/ file references: ${orphans.joinToString(", ")}", orphans.isEmpty())
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
