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

// AN-FENCE-ROOTS (R461). THIS FENCE READS :app ONLY, AND THAT IS CORRECT. Its subject is a Compose call -
// DayCell(...) paired with DayKindLegend() - and Compose is Android: there is no ui/, design/ or dev/ in
// :shared commonMain for it to miss. R460's assertion below is what makes that safe to leave: if any of
// the three ever moves, this fence FAILS naming the root it could not find, instead of scanning what is
// left and reporting perfect compliance.
private val SCANNED_DIRS =
    listOf(
        // IOS-MOVE-CORE R1303: AppBottomBar moved to :shared commonMain's ui/ (read by the shared root here); :app's
        // ui/ keeps the two start-date pickers, so the root stays, pinned by one of them (R460).
        FenceRoot(File("src/main/kotlin/ch/monreleve/app/ui"), pin = "OnboardingStartDatePicker.kt"),
        // IOS-1b-A R604: Aujourd'hui's screen moved to :shared commonMain - its ui/ root is read too, pinned (R460).
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/ui"), pin = "AujourdhuiScreen.kt"),
        // IOS-1b-A R603: design/ moved to :shared commonMain (Compose Multiplatform) - the root follows it, pinned.
        FenceRoot(File("../shared/src/commonMain/kotlin/ch/monreleve/app/design"), pin = "DayCell.kt"),
        FenceRoot(File("src/main/kotlin/ch/monreleve/app/dev"), pin = "GalleryScreen.kt"),
    )

private fun stripComments(text: String): String {
    return text.replace(Regex("""/\*[\s\S]*?\*/"""), " ").replace(Regex("""//[^\n]*"""), " ")
}

private fun scannedFiles(): List<File> {
    SCANNED_DIRS.assertFound("DayCell-legend fence")
    return SCANNED_DIRS.ktFiles()
}

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
