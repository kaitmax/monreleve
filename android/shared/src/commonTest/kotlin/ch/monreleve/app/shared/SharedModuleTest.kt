package ch.monreleve.app.shared

// KMP-0 increment 1 (R368). The commonTest counterpart of SharedModule.kt, written with kotlin.test so it
// compiles and runs on EVERY declared target - on the JVM today (via :shared:testDebugUnitTest in :app:gate),
// and on iOS the day those targets build (R370's pattern, proven here on the trivial function before the
// Geneva conformance test moves to commonTest in increment 3). This is the test the increment-1 proof plants
// a failure into, to show :app:gate goes RED when a shared test fails.

import kotlin.test.Test
import kotlin.test.assertEquals

class SharedModuleTest {
    @Test
    fun moduleIdIsTheSharedPackage() {
        assertEquals("ch.monreleve.app.shared", sharedModuleId())
    }
}
