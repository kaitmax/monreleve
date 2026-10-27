package ch.monreleve.app.fences

import app.cash.paparazzi.Paparazzi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// IOS-1b-A R626 (R345). EVERY PAPARAZZI RULE STATES ZERO, AND THIS TEST READS THE VALUE.
//
// Paparazzi 1.3.5's constructor defaults maxPercentDifference to 0.1 - a tolerance nobody chose, applied
// precisely while nobody writes the word (R345's Playwright 0.2, one toolkit over). Every screenshot rule
// now passes maxPercentDifference = 0.0, and this test asserts the VALUE carried by each live rule object,
// not the text: a source scan cannot tell 0.0 from 0.1, and an "is the argument absent" check is satisfied
// by the default it exists to forbid.
//
// HOW: the census walks the test sources for every file constructing a Paparazzi rule, derives its class,
// instantiates it, and reads the private maxPercentDifference field off its `paparazzi` rule. A screenshot
// class added tomorrow is found by the walk on the day it is written (R246's discovery half).
//
// WHAT ZERO DOES NOT CLOSE IN 1.3.5, stated rather than implied: ImageUtils.compareImages uses the OffByTwo
// differ, so a pixel whose channels each differ by at most 2 counts as identical (0 %), and a width or
// height difference of 1 px passes. Neither is configurable through the 1.3.5 constructor. Zero here means
// "no pixel beyond OffByTwo", which is the strictest this Paparazzi offers.
//
// POSITIVE CONTROL (R133/R460): the walk must find its root (pinned) and must find the Aujourd'hui rule.

private val TEST_ROOT = FenceRoot(File("src/test/kotlin/ch/monreleve/app"), pin = "FenceRoot.kt")
private const val PROBE_CLASS = "ch.monreleve.app.ui.screens.aujourdhui.AujourdhuiScreenScreenshotTest"
private const val SELF = "PaparazziZeroToleranceTest.kt"

class PaparazziZeroToleranceTest {
    private fun screenshotClasses(): List<String> {
        listOf(TEST_ROOT).assertFound("PaparazziZeroToleranceTest")
        val base = TEST_ROOT.dir
        return base
            .walkTopDown()
            .filter { it.isFile && it.extension == "kt" && it.name != SELF }
            .filter { it.readText().contains("Paparazzi(") }
            .map { file ->
                val rel = file.relativeTo(base).path.replace(File.separatorChar, '/').removeSuffix(".kt")
                "ch.monreleve.app." + rel.replace('/', '.')
            }.sorted()
            .toList()
    }

    private fun toleranceOf(className: String): Double {
        val instance = Class.forName(className).getDeclaredConstructor().newInstance()
        val rule = instance.javaClass.getMethod("getPaparazzi").invoke(instance) as Paparazzi
        val field = Paparazzi::class.java.getDeclaredField("maxPercentDifference")
        field.isAccessible = true
        return field.getDouble(rule)
    }

    @Test
    fun theCensusFindsTheScreenshotClasses() {
        val classes = screenshotClasses()
        assertTrue("the walk did not find $PROBE_CLASS (found $classes)", PROBE_CLASS in classes)
    }

    @Test
    fun everyPaparazziRuleCarriesZeroTolerance() {
        val offenders =
            screenshotClasses()
                .map { it to toleranceOf(it) }
                .filter { (_, tolerance) -> tolerance != 0.0 }
        assertEquals(
            "Paparazzi rules whose maxPercentDifference is not 0.0 (R626/R345) - state it, never loosen it",
            emptyList<Pair<String, Double>>(),
            offenders,
        )
    }
}
