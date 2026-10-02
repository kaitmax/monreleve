package ch.monreleve.app.fr

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * AN-AUTO increment 1 (R312). The not-sure message: well-formed, non-empty, and NEVER a percentage
 * (R27). "Never alarming" is a wording judgement, not a test; the string is kept calm by hand. The
 * reachability of this copy is CopyReachabilityTest's concern (R238).
 */
class DetectionCopyTest {
    @Test
    fun theNotSureMessageCarriesNoPercentage() {
        assertFalse("R27: the not-sure message quotes no percentage", DetectionCopy.NOT_SURE.contains("%"))
    }

    @Test
    fun theNotSureMessageSaysWhatToDo() {
        // It must direct the person to record the day themselves, not merely state uncertainty.
        assertTrue(DetectionCopy.NOT_SURE.contains("Indiquez-le vous-même"))
        assertTrue("the message is non-trivial", DetectionCopy.NOT_SURE.length > 40)
    }
}
