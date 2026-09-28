package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN6a increment 2, AC2's runtime proof (the third, beside the source fence 2b and the Room
 * DDL scan): the type that crosses OUT of classification carries no coordinate. If a
 * latitude or longitude field is ever added to ClassifiedFix, this goes red - the plant in
 * REPORT-AN6a.txt confirms it does (R180).
 *
 * D18 lives or dies on the fix never being retained. The source fence proves no coordinate
 * NAME escapes detection/; this proves the one type detection/ hands onward holds no
 * coordinate VALUE.
 */
class CoordinateConfinementTest {
    private val coordinateShaped = Regex("""(?i)(lat|lon|lng|coord|location|geo|position)""")

    // Real declared fields, minus compiler-generated ones (the Compose plugin adds a static
    // $stable; coverage adds $jacocoData) - all of which start with '$'.
    private fun declaredFieldNames(): List<String> =
        ClassifiedFix::class.java.declaredFields
            .filterNot { it.isSynthetic || it.name.startsWith("$") }
            .map { it.name }

    @Test
    fun classifiedFixHasExactlyTheSideAndTheTimestamp() {
        assertEquals(setOf("classification", "epochMillis"), declaredFieldNames().toSet())
    }

    @Test
    fun noFieldOfTheClassifierOutputIsCoordinateShaped() {
        val offenders = declaredFieldNames().filter { coordinateShaped.containsMatchIn(it) }
        assertTrue("ClassifiedFix must carry no coordinate-shaped field, found $offenders", offenders.isEmpty())
    }
}
