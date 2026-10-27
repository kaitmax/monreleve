package ch.monreleve.app.pilot

import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.ios.newIosMutationId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// AN-LAUNCH-SPEECH (R648, R650). THE SAME SEMANTICS ON iOS: AN ANSWER THAT WAS THERE AT LAUNCH IS NOT A LIVE REGION;
// THE ANSWER A TAP PRODUCES IS.
//
// The fix lives in commonMain (ChoiceCard.kt's RecordedAnswer), so it is asserted on the iOS simulator too, through the
// pilot - the REAL AujourdhuiController over the in-memory fixture (R608). Opening ANSWERED_WHOLE is a launch: the
// controller's first frame has no entries, then the fixture's rows arrive, exactly as Android's repository delivers
// them. On Android that arrival was spoken at every launch under Compose 1.7.6 (AN-TALKBACK R642-F1). Whether
// VoiceOver itself would have spoken it is IOS-1b-B's to hear on the phone; this proves the property it would read.
// The Android twin is :app's LaunchSpeechInstrumentedTest.

@OptIn(ExperimentalTestApi::class)
class LaunchSpeechIosTest {
    /** The recorded answer's column, when it is a polite live region: the node that holds « Modifier ». */
    private val liveAnswer =
        SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite)
            .and(hasAnyDescendant(hasText(AujourdhuiCopy.MODIFIER)))

    private fun SemanticsNodeInteractionsProvider.count(matcher: SemanticsMatcher): Int =
        onAllNodes(matcher, useUnmergedTree = true).fetchSemanticsNodes().size

    @Test
    fun aDayAnsweredBeforeTheScreenOpenedIsNotALiveRegion() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.ANSWERED_WHOLE, ::newIosMutationId) }
            waitForIdle()
            // Presence first (R169): the answer is on screen, so the zero is not an empty screen's zero.
            assertTrue(count(hasText(AujourdhuiCopy.MODIFIER)) > 0, "the answer and its « Modifier » are shown")
            assertEquals(0, count(liveAnswer), "an answer present at launch must not be a live region")
        }

    @Test
    fun theAnswerATapProducesIsPolite() =
        runComposeUiTest {
            setContent { AujourdhuiPilot(PilotScenario.UNANSWERED, ::newIosMutationId) }
            waitForIdle()
            // "Domicile" is also the week legend's word: the tap goes to the one that can be clicked - the choice.
            onAllNodes(hasText(AujourdhuiCopy.DOMICILE) and hasClickAction()).onFirst().performClick()
            waitForIdle()
            assertEquals(1, count(liveAnswer), "the answer a tap produced is announced, politely")
        }
}
