package ch.monreleve.app

import kotlin.test.Test
import kotlin.test.assertEquals

// IOS-MOVE-GRAPH R1311. SessionReconciledTest (Kotest), TRANSCRIBED to kotlin.test with its values and expectations
// unchanged: one function per original case, in the original order, each `actual shouldBe expected` written as
// assertEquals(expected, actual). R1311's order: seen green in :app against ShellState's pure destination functions
// where they lived; moved with them to :shared commonTest, where it runs on the JVM AND the iOS simulator; the original
// deleted (R268). REPORT-IOS-MOVE-GRAPH.txt maps every original case to its function here.
//
// The original's header, kept: AN-STATE S4 (R310). The destination-restore reconcile is a pure function, so it is
// proven with no device - the SavedStateHandle-shaped half of R310 ("a ViewModel restoring from saved state needs no
// device"), here a plain reconcile. The instrumentation test proves the tab survives a real rebuild; this proves the
// restored destination is reconciled against the session, which the UI test does not exercise.
class SessionReconciledPinTest {
    // "a saved MAIN restored while signed out (start=SIGN_IN) is forced to SIGN_IN - no unsigned shell"
    @Test
    fun aSavedMainRestoredWhileSignedOutIsForcedToSignIn() {
        assertEquals(Destination.SIGN_IN, sessionReconciled(saved = Destination.MAIN, start = Destination.SIGN_IN))
    }

    // "a saved MAIN is honoured while still signed in (start=MAIN)"
    @Test
    fun aSavedMainIsHonouredWhileStillSignedIn() {
        assertEquals(Destination.MAIN, sessionReconciled(saved = Destination.MAIN, start = Destination.MAIN))
    }

    // "a saved ONBOARDING is honoured while signed-in-not-onboarded - no RESOLVING round-trip"
    @Test
    fun aSavedOnboardingIsHonouredWhileSignedInNotOnboarded() {
        // start=RESOLVING is what onCreate computes for signed-in-but-no-local-settings; the saved ONBOARDING
        // wins, so a rotation mid-onboarding stays on onboarding rather than re-fetching GET /me.
        assertEquals(
            Destination.ONBOARDING,
            sessionReconciled(saved = Destination.ONBOARDING, start = Destination.RESOLVING),
        )
    }

    // "a restored in-flight RESOLVING is re-decided from start, never left as a stale spinner"
    @Test
    fun aRestoredInFlightResolvingIsReDecidedFromStart() {
        assertEquals(Destination.MAIN, sessionReconciled(saved = Destination.RESOLVING, start = Destination.MAIN))
    }

    // AN-FORCED-SIGNOUT (R520): the server ended the session while the app was open. Every signed-in screen leaves
    // for sign-in - the shell (PARK-T1), onboarding, RESOLVING - and a person already on sign-in stays there.
    // "R520: a session the server ended takes every screen to SIGN_IN"
    @Test
    fun r520ASessionTheServerEndedTakesEveryScreenToSignIn() {
        assertEquals(
            Destination.entries.map { Destination.SIGN_IN },
            Destination.entries.map { destinationAfterSessionEnd(current = it, signedIn = false) },
        )
    }

    // AN-FORCED-SIGNOUT (R521): the saved destination is reconciled AS IT IS RESTORED - not one frame later - so a MAIN
    // saved before a session ended (and its settings cleared) is never composed: ParametresController requires them.
    // "R521: a saved MAIN restores as SIGN_IN when there is no session - before the first frame, not after it"
    @Test
    fun r521ASavedMainRestoresAsSignInWhenThereIsNoSession() {
        assertEquals(Destination.SIGN_IN, destinationSaver(start = Destination.SIGN_IN).restore(Destination.MAIN))
        assertEquals(Destination.SIGN_IN, destinationSaver(start = Destination.SIGN_IN).restore(Destination.ONBOARDING))
    }

    // "R521: with a session, the restore honours what was saved, exactly as sessionReconciled does"
    @Test
    fun r521WithASessionTheRestoreHonoursWhatWasSaved() {
        assertEquals(Destination.MAIN, destinationSaver(start = Destination.MAIN).restore(Destination.MAIN))
        assertEquals(
            Destination.ONBOARDING,
            destinationSaver(start = Destination.RESOLVING).restore(Destination.ONBOARDING),
        )
    }

    // "R520: still signed in when the signal is read (a new sign-in saved its pair first) - nobody moves"
    @Test
    fun r520StillSignedInWhenTheSignalIsReadNobodyMoves() {
        assertEquals(
            Destination.entries.toList(),
            Destination.entries.map { destinationAfterSessionEnd(current = it, signedIn = true) },
        )
    }
}
