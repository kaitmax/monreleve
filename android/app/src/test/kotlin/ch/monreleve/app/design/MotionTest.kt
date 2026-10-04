package ch.monreleve.app.design

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * DESIGN-SYSTEM.md section 1 motion values, ported by AN-HOME and enforced the
 * way RadiusTest enforces the radius scale: the set is closed at both ends. Each
 * token equals its documented millisecond value, AND no other token exists - a
 * fifth name added to Motion.tokens fails the size assertion even if the named
 * val still compiles. R77 covers the values (already in the brief); R68 covers
 * the two distinct names that both read 300 (bottomSheetMillis, numbersMillis).
 */
class MotionTest {
    @Test
    fun everyDocumentedValueIsExact() {
        assertEquals(200, Motion.standardMillis)
        assertEquals(250, Motion.enterMillis)
        assertEquals(300, Motion.bottomSheetMillis)
        assertEquals(300, Motion.numbersMillis)
    }

    @Test
    fun noOtherMotionTokenExists() {
        val expectedNames = setOf("standardMillis", "enterMillis", "bottomSheetMillis", "numbersMillis")

        assertEquals(
            "Motion.allForTest must carry exactly the four documented names - " +
                "a name here that DESIGN-SYSTEM.md section 1 does not list is a fifth token.",
            expectedNames,
            Motion.allForTest.keys,
        )
        assertEquals(4, Motion.allForTest.size)
    }

    /**
     * CENSUS OF THE OBJECT ITSELF, not just the map (the RadiusTest shape): a
     * `val fifth: Int = 400` typed directly into Motion, beside tokens, would
     * satisfy both tests above while compiling as a live fifth token. `${'$'}stable`
     * is the Compose compiler plugin's own generated field, unrelated to the set.
     */
    @Test
    fun theObjectDeclaresNoFieldBeyondTheMapAndTheFourAccessors() {
        val expectedFieldNames =
            setOf(
                "INSTANCE",
                "tokens",
                "standardMillis",
                "enterMillis",
                "bottomSheetMillis",
                "numbersMillis",
                "\$stable",
            )
        val actualFieldNames = Motion::class.java.declaredFields.map { it.name }.toSet()

        assertEquals(
            "Motion declares a field this test does not expect - a duration typed " +
                "directly into the object, bypassing the map, is a live fifth motion token.",
            expectedFieldNames,
            actualFieldNames,
        )
    }
}
