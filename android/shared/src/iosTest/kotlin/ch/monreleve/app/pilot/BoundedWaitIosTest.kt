package ch.monreleve.app.pilot

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.runComposeUiTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

// IOS-2c-FIX R807. THE BOUNDED WAIT'S POSITIVE CONTROL, run on the simulator in the same iOS run as every test that
// relies on it. A waitBounded that never failed would pass every other test in iosTest - which is exactly what the
// library's own wait does in CMP 1.7.3 (R800) - so this proves it FAILS when its condition stays false, naming the
// condition and the bound, and RETURNS when its condition holds. Both after a setContent, as every real use is: the
// probe only ever ran the library's wait on a scene that had been given content, and this adds no other variable.

/** Short on purpose: the failing side must fail, and quickly. */
private const val FAILING_BOUND_MS = 200L

/** Generous on purpose: the returning side must never fail on a slow first frame. */
private const val RETURNING_BOUND_MS = 10_000L

@OptIn(ExperimentalTestApi::class)
class BoundedWaitIosTest {
    @Test
    fun aConditionThatStaysFalseFailsPastItsBoundNamingTheConditionAndTheBound() {
        runComposeUiTest {
            setContent {}
            var polls = 0
            val failure =
                assertFailsWith<AssertionError> {
                    waitBounded("an always-false condition", FAILING_BOUND_MS) {
                        polls++
                        false
                    }
                }
            val message = failure.message.orEmpty()
            assertTrue(message.contains("an always-false condition"), "the failure names its condition: $message")
            assertTrue(message.contains("bound of ${FAILING_BOUND_MS}ms"), "the failure names its bound: $message")
            assertTrue(polls > 1, "the condition was polled up to the bound, not judged once: $polls polls")
        }
    }

    @Test
    fun aConditionThatBecomesTrueReturnsWithoutFailing() {
        runComposeUiTest {
            setContent {}
            var polls = 0
            waitBounded("true on the third poll", RETURNING_BOUND_MS) { ++polls >= 3 }
            assertEquals(3, polls, "it returned on the first poll that held")
        }
    }
}
