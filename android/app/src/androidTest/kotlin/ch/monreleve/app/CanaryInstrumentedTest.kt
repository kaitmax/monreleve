package ch.monreleve.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * R63 canary for the instrumented source set. It runs on a device, so it is
 * exercised by the emulator instrument (AN1 increment 4), not by `./gradlew test`.
 * Its presence proves the androidTest source set is configured and compiles.
 */
@RunWith(AndroidJUnit4::class)
class CanaryInstrumentedTest {
    @Test
    fun instrumentedSourceSetExecutes() {
        assertTrue(true)
    }
}
