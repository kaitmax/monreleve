package ch.monreleve.app.ios

import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-MOVE-TABS R1362 (iOS Ruling 13 Q4 and THE RUN-B SIGSEGV). STEP 1, REPRODUCE - BEFORE ANY FIX.
//
// IOS-SHELL-1's run B (ios-shared 45019964025) died with "Child process terminated with signal 11: Segmentation fault"
// while IosShellStartupIosTest was running, and the suspected cause is IosLogger's DEFAULT sink, NSLog("%@", line): a
// Kotlin String passed to a C variadic function where %@ expects an Objective-C object. Run C changed that path and
// two other things at once, so its green could not say which. This calls the REAL default sink - IosLogger() with no
// sink argument, in the test process - with an ordinary line and with a line carrying '%'. If the process dies here,
// that is the reproduction; if it does not, the cause of run B's crash is still open and this test says so by passing.
//
// RED, REPRODUCED (ios-shared run 45025248454, on the commit adding this file, the sink unchanged): "R1362 BEFORE
// ordinary", then "Child process terminated with signal 11: Segmentation fault", no AFTER line, exitValue=139, and no
// JUnit suite written. STEP 2: the default sink is now consoleLine (IosLogger.kt), the shell's format-only line, ONE
// function for both; this same test, its body unedited, is the green.
//
// What a run shows, read from its job log (R133 - a pass is a statement about something that happened):
//   - "R1362 BEFORE <case>" on the test's STANDARD_OUT, then the sink's own line if NSLog's stderr reaches the log,
//     then "R1362 AFTER <case>" - the call returned and the process lived through it;
//   - a death prints the BEFORE line and no AFTER line, and the run reports signal 11 against this class.
// The lines are fixed sentences: no mail, code, token or day (R1363 - the repository is public, the job log too), and
// scrub is asserted to leave them whole, so what NSLog was handed is exactly the sentence written here.

private const val TAG = "R1362"
private const val ORDINARY = "R1362 probe: an ordinary sentence through the default sink"
private const val WITH_PERCENT = "R1362 probe: 100% of a sentence with %d and %@ and %s written as text"

class IosLoggerDefaultSinkIosTest {
    @Test
    fun theRealDefaultSinkWritesAnOrdinaryLineAndTheProcessLives() {
        throughTheDefaultSink("ordinary", ORDINARY)
    }

    @Test
    fun theRealDefaultSinkWritesALineCarryingPercentSignsAndTheProcessLives() {
        throughTheDefaultSink("percent", WITH_PERCENT)
    }

    private fun throughTheDefaultSink(
        case: String,
        line: String,
    ) {
        // The sentence reaches NSLog unchanged: scrub finds nothing in it to remove.
        assertEquals(line, scrub(line))
        println("R1362 BEFORE $case")
        IosLogger().info(TAG, line)
        IosLogger().error(TAG, line)
        println("R1362 AFTER $case")
    }
}
