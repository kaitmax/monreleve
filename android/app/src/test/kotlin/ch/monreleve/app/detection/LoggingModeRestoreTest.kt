package ch.monreleve.app.detection

import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.LoggingMode
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-SIGNIN-RESOLVE (R1162, PARK-E3). THE MODE THE PHONE HOLDS FOR THE MODE THE SERVER HOLDS. The server is the
// consent authority (detectionConsentAt, read fail-closed by parseLoggingMode); the phone can only sample where the
// OS grants the location permission. So AUTO_DETECT on the phone needs BOTH, and anything else is MANUAL with the
// sampler stopped - the phone shows manual and nothing samples silently. Nothing here writes to the server (R316:
// a missing permission is not a revocation of consent; the person may grant it later).

private class Sampler {
    val calls = mutableListOf<String>()

    fun start() {
        calls += "start"
    }

    fun stop() {
        calls += "stop"
    }
}

class LoggingModeRestoreTest : FunSpec({
    test("R1162: AUTO_DETECT on the phone only when the server says AUTO_DETECT AND the permission is held") {
        phoneLoggingMode(LoggingMode.AUTO_DETECT, locationFullyGranted = true) shouldBe LoggingMode.AUTO_DETECT
        phoneLoggingMode(LoggingMode.AUTO_DETECT, locationFullyGranted = false) shouldBe LoggingMode.MANUAL
        phoneLoggingMode(LoggingMode.MANUAL, locationFullyGranted = true) shouldBe LoggingMode.MANUAL
        phoneLoggingMode(LoggingMode.MANUAL, locationFullyGranted = false) shouldBe LoggingMode.MANUAL
    }

    test("R1162: server AUTO + permission held -> the phone saves AUTO_DETECT and starts the sampler") {
        val store = InMemoryDetectionModeStore()
        val sampler = Sampler()
        applyServerLoggingMode(LoggingMode.AUTO_DETECT, true, store, sampler::start, sampler::stop) shouldBe
            LoggingMode.AUTO_DETECT
        store.load() shouldBe LoggingMode.AUTO_DETECT
        sampler.calls shouldBe listOf("start")
    }

    test("R1162: server AUTO but no permission -> the phone shows MANUAL and the sampler is stopped, never started") {
        val store = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT)
        val sampler = Sampler()
        applyServerLoggingMode(LoggingMode.AUTO_DETECT, false, store, sampler::start, sampler::stop) shouldBe
            LoggingMode.MANUAL
        store.load() shouldBe LoggingMode.MANUAL
        sampler.calls shouldBe listOf("stop")
    }

    test("R1162: server MANUAL -> MANUAL and stopped, whatever the permission") {
        listOf(true, false).forEach { granted ->
            val store = InMemoryDetectionModeStore(LoggingMode.AUTO_DETECT)
            val sampler = Sampler()
            applyServerLoggingMode(LoggingMode.MANUAL, granted, store, sampler::start, sampler::stop) shouldBe
                LoggingMode.MANUAL
            store.load() shouldBe LoggingMode.MANUAL
            sampler.calls shouldBe listOf("stop")
        }
    }
})
