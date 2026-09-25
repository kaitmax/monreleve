package ch.monreleve.app

import ch.monreleve.app.calc.enginePlaceholder
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * R63 canary: proves the unit (test) source set actually runs. The
 * checkTestFloor gradle task then asserts the run OBSERVED at least the floor
 * count - a source set that runs nothing exits 0 and reads exactly like one that
 * passed everything (R133). The second test also proves calc/ is reachable.
 */
class CanaryTest {
    @Test
    fun unitSourceSetExecutes() {
        assertTrue(true)
    }

    @Test
    fun calcPackageIsReachableFromUnitTests() {
        assertTrue(enginePlaceholder())
    }
}
