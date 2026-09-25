package ch.monreleve.app.design

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * DESIGN-SYSTEM.md 4.1 / ruling R8, ported: the radius scale is closed at both
 * ends. Each token equals its documented value, AND no other token exists - a
 * tenth token added to Radius.tokens fails the size assertion below even if
 * every named val the test doesn't yet know about still compiles.
 */
class RadiusTest {
    @Test
    fun everyDocumentedValueIsExact() {
        assertEquals(4.dp, Radius.xs)
        assertEquals(6.dp, Radius.checkbox)
        assertEquals(8.dp, Radius.sm)
        assertEquals(12.dp, Radius.md)
        assertEquals(14.dp, Radius.buttonLg)
        assertEquals(16.dp, Radius.lg)
        assertEquals(20.dp, Radius.xl)
        assertEquals(24.dp, Radius.xxl)
        assertEquals(999.dp, Radius.pill)
    }

    @Test
    fun noOtherRadiusTokenExists() {
        val expectedNames = setOf("xs", "checkbox", "sm", "md", "buttonLg", "lg", "xl", "xxl", "pill")

        assertEquals(
            "Radius.allForTest must carry exactly the nine documented names - " +
                "a name here that DESIGN-SYSTEM.md 4.1 does not list is a tenth token.",
            expectedNames,
            Radius.allForTest.keys,
        )
        assertEquals(9, Radius.allForTest.size)
    }
}
