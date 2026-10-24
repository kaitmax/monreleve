package ch.monreleve.app

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-STATE S4 (R310). The destination-restore reconcile is a pure function, so it is proven on the JVM with
// no device - the SavedStateHandle-shaped half of R310 ("a ViewModel restoring from saved state needs no
// device"), here a plain reconcile. The instrumentation test proves the tab survives a real rebuild; this
// proves the restored destination is reconciled against the session, which the UI test does not exercise.
class SessionReconciledTest : FunSpec({
    test("a saved MAIN restored while signed out (start=SIGN_IN) is forced to SIGN_IN - no unsigned shell") {
        sessionReconciled(saved = Destination.MAIN, start = Destination.SIGN_IN) shouldBe Destination.SIGN_IN
    }

    test("a saved MAIN is honoured while still signed in (start=MAIN)") {
        sessionReconciled(saved = Destination.MAIN, start = Destination.MAIN) shouldBe Destination.MAIN
    }

    test("a saved ONBOARDING is honoured while signed-in-not-onboarded - no RESOLVING round-trip") {
        // start=RESOLVING is what onCreate computes for signed-in-but-no-local-settings; the saved ONBOARDING
        // wins, so a rotation mid-onboarding stays on onboarding rather than re-fetching GET /me.
        sessionReconciled(saved = Destination.ONBOARDING, start = Destination.RESOLVING) shouldBe
            Destination.ONBOARDING
    }

    test("a restored in-flight RESOLVING is re-decided from start, never left as a stale spinner") {
        sessionReconciled(saved = Destination.RESOLVING, start = Destination.MAIN) shouldBe Destination.MAIN
    }

    // AN-FORCED-SIGNOUT (R520): the server ended the session while the app was open. Every signed-in screen leaves
    // for sign-in - the shell (PARK-T1), onboarding, RESOLVING - and a person already on sign-in stays there.
    test("R520: a session the server ended takes every screen to SIGN_IN") {
        Destination.entries.map { destinationAfterSessionEnd(current = it, signedIn = false) } shouldBe
            Destination.entries.map { Destination.SIGN_IN }
    }

    // AN-FORCED-SIGNOUT (R521): the saved destination is reconciled AS IT IS RESTORED - not one frame later - so a MAIN
    // saved before a session ended (and its settings cleared) is never composed: ParametresController requires them.
    test("R521: a saved MAIN restores as SIGN_IN when there is no session - before the first frame, not after it") {
        destinationSaver(start = Destination.SIGN_IN).restore(Destination.MAIN) shouldBe Destination.SIGN_IN
        destinationSaver(start = Destination.SIGN_IN).restore(Destination.ONBOARDING) shouldBe Destination.SIGN_IN
    }

    test("R521: with a session, the restore honours what was saved, exactly as sessionReconciled does") {
        destinationSaver(start = Destination.MAIN).restore(Destination.MAIN) shouldBe Destination.MAIN
        destinationSaver(start = Destination.RESOLVING).restore(Destination.ONBOARDING) shouldBe Destination.ONBOARDING
    }

    test("R520: still signed in when the signal is read (a new sign-in saved its pair first) - nobody moves") {
        Destination.entries.map { destinationAfterSessionEnd(current = it, signedIn = true) } shouldBe
            Destination.entries.toList()
    }
})
