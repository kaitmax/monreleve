package ch.monreleve.app.shared

import ch.monreleve.app.design.Glyph
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-1b-A R603. THE GENERATOR DELIVERED (R154): iOS's glyph files carry EXACTLY the app's path data.
//
// generateGlyphResources copies app/src/main/res/drawable/ic_*.xml into the directory registered as iosMain's
// Compose Multiplatform resources. R603 asks that the icons reach Compose Multiplatform "without changing a path,
// a test compares each path string with the original XML" - this is that test, run on the generator's real output
// (the test task depends on the copy). It asserts presence, not only absence of difference: every Glyph has a
// generated file, every one carries at least one path, and each file's ordered path strings equal the original's.

private val APP_DRAWABLES = File("../app/src/main/res/drawable")
private val GENERATED = File("build/generated/glyphResources/drawable")
private val PATH_DATA = Regex("""android:pathData="([^"]*)"""")

private fun paths(file: File): List<String> = PATH_DATA.findAll(file.readText()).map { it.groupValues[1] }.toList()

class GlyphResourceGeneratorTest {
    @Test
    fun everyGlyphIsGeneratedWithItsPathsUnchanged() {
        check(APP_DRAWABLES.isDirectory) { "the app's drawables are not at ${APP_DRAWABLES.absolutePath}" }
        check(GENERATED.isDirectory) {
            "nothing generated at ${GENERATED.absolutePath} - did generateGlyphResources run?"
        }
        for (glyph in Glyph.entries) {
            val original = File(APP_DRAWABLES, glyph.fileName + ".xml")
            val generated = File(GENERATED, glyph.fileName + ".xml")
            assertTrue(generated.isFile, "no generated file for $glyph at ${generated.path}")
            val expected = paths(original)
            assertTrue(expected.isNotEmpty(), "positive control: ${original.name} carries no android:pathData")
            assertEquals(expected, paths(generated), "${glyph.fileName}: a path string changed between app and iOS")
        }
    }

    @Test
    fun theGeneratorCopiesNoLauncherArt() {
        val launcher = GENERATED.listFiles().orEmpty().filter { it.name.startsWith("ic_launcher") }
        assertEquals(emptyList(), launcher.map { it.name }, "launcher icons are not glyphs and must not reach iOS")
    }
}
