package ch.monreleve.app.fr

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * FW-FOLLOWUP (R376). The code-screen refusals point at the recovery that actually works.
 *
 * WHY THESE TWO STRINGS CHANGED. FW-CODE-CAP gave the server a per-address budget - ten code
 * attempts per rolling 24 h, counted in PostgreSQL across every code issued in that window. Once
 * it is spent, asking for a NEW code does not help: the new code is refused on arrival. The
 * client cannot distinguish that from the per-code limit, by design, because the wire code
 * (`too_many_attempts`) and the status (429) are unchanged. So a single sentence has to be true
 * for both causes (R165), and only the link is.
 *
 * THE ANDROID STRINGS ARE A SECOND HOME for this decision. The app renders its own copy and never
 * reads the server's French `message` field - CodeScreen maps a CodePhase to a CodeCopy constant -
 * so changing lib/fr/auth-api.ts on the web could not reach this screen. FW-CODE-CAP found that
 * and stopped to ask rather than editing android/; the operator ruled it in FW-FOLLOWUP.
 *
 * ERROR_EXPIRED IS DELIBERATELY NOT IN THE FORBIDDEN LIST. Requesting a code spends no budget -
 * only an exchange does - so "demandez-en un nouveau" is still true there, and the last test
 * asserts it still says so. Without that, this file would read as "no refusal may mention a new
 * code", which is a different and wrong rule.
 */
class CodeCopyTest {
    @Test
    fun theWrongCodeMessagePointsAtTheLink() {
        assertTrue(
            "R376: a wrong guess may have been the last one the budget allowed",
            CodeCopy.ERROR_WRONG_CODE.contains("lien de connexion"),
        )
    }

    @Test
    fun theTooManyMessagePointsAtTheLink() {
        assertTrue(
            "R376: once the per-address budget is spent, only the link still works",
            CodeCopy.ERROR_TOO_MANY.contains("lien de connexion"),
        )
    }

    @Test
    fun neitherMessagePromisesANewCode() {
        // The forbidden forms, written down because a property has to be stated to be checked.
        // Both spellings the old copy used: "un nouveau code" and "demandez-en un nouveau".
        for (message in listOf(CodeCopy.ERROR_WRONG_CODE, CodeCopy.ERROR_TOO_MANY)) {
            assertFalse("still promises a new code: $message", message.contains("nouveau code"))
            assertFalse("still promises a new one: $message", message.contains("un nouveau"))
        }
    }

    @Test
    fun theExpiredMessageStillSaysToAskForANewOne() {
        // THE OTHER DIRECTION (R196). A rule of "no refusal mentions a new code" would pass by
        // emptying every sentence; this one is true and must stay, because asking for a code costs
        // no budget. If this ever fails, the change above was applied too widely.
        assertTrue(CodeCopy.ERROR_EXPIRED.contains("demandez-en un nouveau"))
        assertFalse(
            "the expired message has no reason to mention the link",
            CodeCopy.ERROR_EXPIRED.contains("lien de connexion"),
        )
    }
}
