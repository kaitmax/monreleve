package ch.monreleve.app.fences

// AN3 increment 6. Carried from increment 4's own text: "a test asserts a
// legend exists wherever a DayCell grid does - letters need a key (R119's
// shape)." Increment 4 built DayKindLegend() but had no real DayCell grid
// yet to pair it with (ComponentsScreenshotTest.kt's DayCell tests are
// each a single isolated cell, not a grid) - dev/GalleryScreen.kt's row
// of five is the first, so this is that assertion's first real exercise
// (R178), not a retrofit onto code this task did not touch.
//
// "GRID" IS OPERATIONALISED as 2-OR-MORE DayCell(...) calls in one file:
// a single isolated cell (as every ComponentsScreenshotTest.kt case is)
// names its own state some other way and needs no key: a key is for
// telling several cells apart, which only exists once there are several.

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

private val SCANNED_DIRS =
    listOf(
        File("src/main/kotlin/ch/monreleve/app/ui"),
        File("src/main/kotlin/ch/monreleve/app/design"),
        File("src/main/kotlin/ch/monreleve/app/dev"),
    )

private fun stripComments(text: String): String {
    return text.replace(Regex("""/\*[\s\S]*?\*/"""), " ").replace(Regex("""//[^\n]*"""), " ")
}

private fun ktFiles(dir: File): List<File> =
    if (!dir.exists()) emptyList() else dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

private fun scannedFiles(): List<File> = SCANNED_DIRS.flatMap { ktFiles(it) }

class DayCellGridHasLegendTest {
    @Test
    fun findsAtLeastOneGridSoTheAssertionIsNotVacuous() {
        val grids =
            scannedFiles().filter { file ->
                Regex("""\bDayCell\(""").findAll(stripComments(file.readText())).count() >= 2
            }
        assertTrue("expected at least one file with a DayCell grid (>= 2 calls), found none", grids.isNotEmpty())
    }

    @Test
    fun everyDayCellGridIsPairedWithTheLegendInTheSameFile() {
        val offenders =
            scannedFiles().filter { file ->
                val text = stripComments(file.readText())
                val cellCount = Regex("""\bDayCell\(""").findAll(text).count()
                cellCount >= 2 && !Regex("""\bDayKindLegend\(""").containsMatchIn(text)
            }
        assertTrue(
            "a DayCell grid with no DayKindLegend() in the same file (letters need a key):\n" +
                offenders.joinToString("\n") { it.path },
            offenders.isEmpty(),
        )
    }
}
