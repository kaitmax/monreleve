package ch.monreleve.app.fences

import ch.monreleve.app.R
import ch.monreleve.app.design.Glyph
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// IOS-1b-A R603. EVERY GLYPH THE SHARED DESIGN SYSTEM NAMES IS A DRAWABLE THIS APP SHIPS, AND IS KEPT.
//
// :shared finds each glyph's drawable BY NAME at run time (design/Glyph.android.kt: "ic_" + the enum constant in
// lower case), because it cannot import this module's R. Two things can then go wrong without a compile error, and
// this file is where each one fails instead:
//   1. a Glyph whose derived name is not a drawable here - a blank (or a crash) on the first screen that draws it;
//   2. a Glyph the resource shrinker strips from the release APK - it cannot see a name built at run time, so
//      res/raw/glyph_keep.xml keeps them by name, and that list must be exactly the enum.
// POSITIVE CONTROL (R133): the R.drawable lookup is shown to resolve a name it must (ic_house), and the keep file is
// shown to parse to a non-empty set, before either "nothing missing" is believed.

private val KEEP_FILE = File("src/main/res/raw/glyph_keep.xml")

private fun drawableId(name: String): Int =
    runCatching { R.drawable::class.java.getDeclaredField(name).getInt(null) }.getOrDefault(0)

class GlyphDrawablesExistTest {
    @Test
    fun everyGlyphResolvesToADrawableOfThisApp() {
        assertTrue("positive control: R.drawable.ic_house must resolve by name", drawableId("ic_house") != 0)
        val missing = Glyph.entries.filter { drawableId(it.fileName) == 0 }
        assertEquals(
            "Glyph constants with no drawable named after them in app/src/main/res/drawable",
            emptyList<Glyph>(),
            missing,
        )
        assertEquals(
            "two glyphs resolved to one drawable",
            Glyph.entries.size,
            Glyph.entries.map { drawableId(it.fileName) }.toSet().size,
        )
    }

    @Test
    fun theShrinkerKeepsExactlyTheGlyphs() {
        assertTrue("${KEEP_FILE.absolutePath} is missing", KEEP_FILE.isFile)
        val kept =
            Regex("""@drawable/([a-z0-9_]+)""").findAll(KEEP_FILE.readText()).map { it.groupValues[1] }.toSet()
        assertTrue("positive control: the keep file parsed to no drawable at all", kept.isNotEmpty())
        assertEquals(
            "res/raw/glyph_keep.xml must keep exactly the Glyph files",
            Glyph.entries.map { it.fileName }.toSet(),
            kept,
        )
    }
}
