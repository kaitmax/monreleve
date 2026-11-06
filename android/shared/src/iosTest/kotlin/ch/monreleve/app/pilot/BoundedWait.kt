package ch.monreleve.app.pilot

import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import kotlin.time.TimeSource

// IOS-2c-FIX R807. THE ONE WAIT IN iosTest THAT ENDS. R808 (android/app's IosTestRawWaitUntilFenceTest): a raw call to
// the library's wait stands here and nowhere else, except in OnboardingScreensIosTest and SignInScreensIosTest, which
// keep theirs on an allowlist at their exact counts until a later task converts them (PARKED) - a list that can only
// shrink by being edited.
//
// WHY IT EXISTS. IOS-2c-PROBE R800 read it in the CMP 1.7.3 sources (ui-test-uikitsimarm64-1.7.3-sources.jar,
// skikoMain/androidx/compose/ui/test/ComposeUiTest.skikoMain.kt 289-304): SkikoComposeUiTest's waitUntil BUILDS its
// timeout message and never throws it, so a condition that stays false is polled for ever and looks, from outside,
// exactly like a hang. The library's own waitUntilNodeCount, waitUntilAtLeastOneExists, waitUntilExactlyOneExists
// and waitUntilDoesNotExist all go through that same loop (commonMain ComposeUiTest.kt 205-290).
//
// WHAT IT DOES. The condition itself expires: every evaluation reads a monotonic wall clock, and the first one past
// the bound throws an AssertionError naming the condition and the bound - the test FAILS with what it waited for,
// and the next test runs. The pattern is the probe's (run 42202057374: step4c's wait expired at 10 002 ms, failed its
// test, and every later class still ran), lifted out of its test file and stripped of its instrumentation.
// BoundedWaitIosTest is its positive control, in the same run as every test that relies on it.
//
// WHAT IT DOES NOT BOUND: a wait that calls nothing back. Every semantics fetch inside a condition first waits for
// idle (R800 (1)), and that inner wait never returns to this helper while it waits - a scene that never idles is the
// watchdog's to end (R793, kept by R809), not this helper's.

/**
 * Waits until [condition] holds; FAILS with an AssertionError naming [what] and [boundMillis] once the condition has
 * stayed false for longer than [boundMillis] of wall time. The bound has no default: each caller states the one it
 * means (R345 - a default is a value nobody chose).
 */
@ExperimentalTestApi
internal fun ComposeUiTest.waitBounded(
    what: String,
    boundMillis: Long,
    condition: () -> Boolean,
) {
    val started = TimeSource.Monotonic.markNow()
    // The library's own timeout is handed TWICE the bound, so that if a later CMP honours it (1.7.3 does not), the
    // bound that fires is still this one, with this message. Never Long.MAX_VALUE: the skiko loop multiplies it into
    // nanoseconds, and an overflow would make a CMP that does throw fire at once.
    waitUntil(timeoutMillis = boundMillis * 2) {
        val met = condition()
        val elapsed = started.elapsedNow().inWholeMilliseconds
        if (!met && elapsed > boundMillis) {
            throw AssertionError(
                "bounded wait \"$what\": still false after ${elapsed}ms, past its bound of ${boundMillis}ms",
            )
        }
        met
    }
}
