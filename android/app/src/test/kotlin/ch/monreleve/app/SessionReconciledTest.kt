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
})
