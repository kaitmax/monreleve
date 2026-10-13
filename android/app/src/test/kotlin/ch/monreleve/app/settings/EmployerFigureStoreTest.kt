package ch.monreleve.app.settings

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

// AN-RECON (R342). THE EMPLOYER FIGURE STAYS ON THE PHONE - tagged with the account, cleared on sign-out, and
// never sent. This proves the two halves the unit level can prove:
//   1. ACCOUNT-TAGGED: a figure saved under one account is invisible to another, and fail-closed when no
//      account is active (UNOWNED never collapses two people into one, R303). No account -> nothing is stored.
//   2. SWEPT: the real store (SharedPrefsEmployerFigureStore) shares the monreleve.detection prefs file, which
//      DeviceLocalStore.clearForSignOut() clears via detectionModeStore.clear() (R289/R295) - so the figure is
//      gone on sign-out exactly as AN-ALERT's ThresholdAlertStore is. ErasureCensusTest is that file's guard
//      (it requires every "monreleve.*" store to be erased by deletion); clearAll() here simulates the sweep.
// "Never sent" has no wire to assert against (no API carries it); the on-device walkthrough proves it empirically
// by reading the server row count back after a figure is entered.

class EmployerFigureStoreTest : FunSpec({
    test("R342: a figure is account-tagged - one account cannot see another's, and the sweep clears it") {
        val store = InMemoryEmployerFigureStore(account = "tag-a")
        store.save(2025, 41.25)
        store.figureFor(2025) shouldBe 41.25

        // Another account on the same device sees nothing.
        store.setAccount("tag-b")
        store.figureFor(2025).shouldBeNull()

        // Back to the owner, the figure stands.
        store.setAccount("tag-a")
        store.figureFor(2025) shouldBe 41.25

        // The sign-out sweep (the whole monreleve.detection file) removes it.
        store.clearAll()
        store.figureFor(2025).shouldBeNull()
    }

    test("R342: fail closed - no active account stores nothing") {
        val store = InMemoryEmployerFigureStore(account = null)
        store.save(2025, 41.25)
        store.figureFor(2025).shouldBeNull()
    }

    test("R342: figures are kept per year") {
        val store = InMemoryEmployerFigureStore(account = "tag-a")
        store.save(2024, 38.0)
        store.save(2025, 41.25)
        store.figureFor(2024) shouldBe 38.0
        store.figureFor(2025) shouldBe 41.25
    }
})
