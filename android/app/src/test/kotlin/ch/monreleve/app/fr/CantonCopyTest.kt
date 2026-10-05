package ch.monreleve.app.fr

import ch.monreleve.app.calc.Canton
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// AN-PARAMS. The settings screen showed the canton CODE (« GE »); it now shows the French NAME (« Genève »,
// accented, R155). CantonCopy maps every Canton to its name. A positive test (R154): a known input produces
// the known rendered name, and the map is TOTAL - every one of the 26 enum members has a distinct, non-blank
// French name, so a new canton cannot slip through showing its bare code.

class CantonCopyTest {
    @Test
    fun geneveIsNamedWithItsAccent() {
        assertEquals("Genève", CantonCopy.name(Canton.GE))
    }

    @Test
    fun everyCantonHasADistinctNonBlankName() {
        val names = Canton.entries.map { CantonCopy.name(it) }
        for ((canton, label) in Canton.entries.zip(names)) {
            assertTrue("$canton has a blank name", label.isNotBlank())
            // The name is never the bare enum code - the whole point is to replace « GE » with « Genève ».
            assertTrue("$canton still shows its code", label != canton.name)
        }
        assertEquals("canton names must be unique", names.size, names.toSet().size)
    }
}
