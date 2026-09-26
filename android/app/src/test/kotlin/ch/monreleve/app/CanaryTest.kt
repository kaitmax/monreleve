package ch.monreleve.app

import ch.monreleve.app.calc.CALC_PACKAGE_SCAFFOLDED
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * R63 canary: proves the unit (test) source set actually runs. The
 * checkTestFloor gradle task then asserts the run OBSERVED at least the floor
 * count - a source set that runs nothing exits 0 and reads exactly like one that
 * passed everything (R133). The second test also proves calc/ is reachable.
 *
 * AN2 increment 0: references CALC_PACKAGE_SCAFFOLDED rather than AN1's
 * enginePlaceholder() (deleted - the real package replaces the placeholder
 * it was proving). Updated again in increment 1 once real types land.
 */
class CanaryTest {
    @Test
    fun unitSourceSetExecutes() {
        assertTrue(true)
    }

    @Test
    fun calcPackageIsReachableFromUnitTests() {
        assertTrue(CALC_PACKAGE_SCAFFOLDED)
    }
}
