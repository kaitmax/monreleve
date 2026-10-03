package ch.monreleve.app.detection

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest

// R322 / F-DETECT-GPS. REPORT-AN-AUTO-2's real-day read found NO daily_tally row on a plugged-in, screen-on
// phone: the SamplingWorker ran every window (logcat SUCCESS) yet recorded nothing, because awaitClassifiedFix
// requested LocationManager.GPS_PROVIDER ALONE and - indoors, where a telework day is spent - GPS returns no
// fix, so every check was MISSED and recordCheck was never called. The fix adds NETWORK_PROVIDER (wifi/cell,
// works indoors, already covered by the ACCESS_FINE_LOCATION grant, no new dependency - R136/D18 intact) as a
// fallback, tried only when GPS is silent so the 150 m buffer keeps GPS's precision when it can get it (D25).
//
// This test fixes the ORCHESTRATION that was missing: try each provider in order and stop at the first fix.
// It speaks only in Classification - no coordinate crosses firstClassifiedFix (D18). The on-device behavioural
// reproduction (no row for today despite the worker running) is recorded in REPORT-AN-NEXT.txt; this is its
// JVM regression guard.

class LiveLocationFallbackTest : FunSpec({
    test("indoors GPS is silent, so a GPS-only sampler records nothing - the F-DETECT-GPS defect") {
        runTest {
            // Only GPS tried, and it yields no fix (the indoor case). The check is MISSED, as the field saw.
            val result = firstClassifiedFix(listOf("gps")) { null }
            result shouldBe null
        }
    }

    test("the NETWORK fallback records when GPS is silent indoors") {
        runTest {
            val queried = mutableListOf<String>()
            val result =
                firstClassifiedFix(listOf("gps", "network")) { provider ->
                    queried += provider
                    if (provider == "network") Classification.OUTSIDE else null
                }
            result shouldBe Classification.OUTSIDE
            queried shouldContainExactly listOf("gps", "network") // GPS tried first, then the fallback
        }
    }

    test("GPS wins when it has a fix - the precise provider is preferred and NETWORK is not consulted (D25)") {
        runTest {
            val queried = mutableListOf<String>()
            val result =
                firstClassifiedFix(listOf("gps", "network")) { provider ->
                    queried += provider
                    if (provider == "gps") Classification.INSIDE else error("network must not be consulted")
                }
            result shouldBe Classification.INSIDE
            queried shouldContainExactly listOf("gps")
        }
    }

    test("FIX_PROVIDERS tries GPS first, then NETWORK as the indoor fallback") {
        // "gps"/"network" are LocationManager.GPS_PROVIDER / NETWORK_PROVIDER's frozen platform values.
        FIX_PROVIDERS shouldContainExactly listOf("gps", "network")
    }
})
